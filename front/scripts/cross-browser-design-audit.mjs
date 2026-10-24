import { qaRoot } from '../../scripts/qa-output.mjs';
/* global document, getComputedStyle, innerHeight, innerWidth */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium, firefox, webkit } = await import(process.env.PLAYWRIGHT_MODULE ?? '@playwright/test');
const origin = process.env.FRONT_QA_ORIGIN ?? 'http://127.0.0.1:3000';
const output = new URL('cross-browser-design-audit/', qaRoot());
const iteration = process.env.CROSS_BROWSER_ITERATION ?? 'adhoc';
if (!/^(?:I[1-3]|adhoc)$/u.test(iteration)) throw new Error(`Unsupported CROSS_BROWSER_ITERATION: ${iteration}`);
const runOutput = new URL(`iterations/${iteration}/`, output);
await mkdir(output, { recursive: true });
await mkdir(runOutput, { recursive: true });
const startedAt = new Date().toISOString();
const packageManifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const engines = [
    ['chromium', chromium, process.env.CROSS_BROWSER_CHROMIUM_EXECUTABLE],
    ['firefox', firefox, process.env.CROSS_BROWSER_FIREFOX_EXECUTABLE],
    ['webkit', webkit, process.env.CROSS_BROWSER_WEBKIT_EXECUTABLE],
];
const selectedEngineNames = new Set(
    (process.env.CROSS_BROWSER_ENGINES ?? engines.map(([name]) => name).join(','))
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean),
);
const results = [];
const issues = [];
const pageErrors = [];
const browserVersions = {};

async function runEngine(name, browserType, executablePath) {
    const engineOutput = new URL(`${name}/`, runOutput);
    await mkdir(engineOutput, { recursive: true });
    const browser = await browserType.launch({ headless: true, executablePath });
    browserVersions[name] = browser.version();
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, hasTouch: true });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.on('pageerror', (error) => pageErrors.push(`${name}: ${error.message}`));

    async function goto(path) {
        await page.goto(origin + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page
            .waitForFunction(() => !document.body.innerText.includes('Проверяем сессию'), undefined, {
                timeout: 15000,
            })
            .catch(() => undefined);
        await page.waitForTimeout(250);
        await page.waitForLoadState('networkidle');
    }

    async function capture(fileName) {
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
        const metrics = await page.evaluate(() => ({
            innerWidth,
            innerHeight,
            scrollWidth: document.documentElement.scrollWidth,
            heading: document.querySelector('h1')?.textContent?.trim() ?? null,
        }));
        assert.ok(metrics.heading, `${name} ${fileName}: h1 is missing`);
        assert.ok(
            metrics.scrollWidth <= metrics.innerWidth + 1,
            `${name} ${fileName}: horizontal overflow ${metrics.scrollWidth}/${metrics.innerWidth}`,
        );
        await page.screenshot({ path: fileURLToPath(new URL(`${fileName}.png`, engineOutput)) });
    }

    async function login() {
        await goto('/auth');
        await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
        await page.evaluate(() => navigator.serviceWorker.ready);
        if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
        }
        await page.getByLabel('Электронная почта', { exact: true }).fill('plus1@meal-planner.test');
        await page.getByLabel('Пароль', { exact: true }).fill('1');
        await page.getByRole('button', { name: 'Войти', exact: true }).click();
        await page.waitForURL((url) => url.pathname === '/', { timeout: 60000 });
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(300);
    }

    async function assertActionAboveDock(action, label) {
        await action.scrollIntoViewIfNeeded();
        const dock = page.getByRole('navigation', { name: 'Мобильная навигация' });
        assert.ok(await dock.isVisible(), `${name} ${label}: mobile navigation is not visible`);
        const [actionBox, dockBox] = await Promise.all([action.boundingBox(), dock.boundingBox()]);
        assert.ok(actionBox && dockBox, `${name} ${label}: geometry is unavailable`);
        assert.ok(
            actionBox.y + actionBox.height <= dockBox.y - 8,
            `${name} ${label}: final action overlaps mobile navigation`,
        );
    }

    try {
        await login();

        await page.setViewportSize({ width: 1280, height: 900 });
        await goto('/recipes');
        await capture('01-recipes-desktop');
        results.push(`${name}: recipes desktop renders without overflow`);

        await page.setViewportSize({ width: 390, height: 844 });
        await goto('/recipes');
        const filterButton = page.getByRole('button', { name: 'Фильтры', exact: true });
        await filterButton.click();
        const dialog = page.locator('dialog[open]');
        await dialog.waitFor();
        const dialogBox = await dialog.boundingBox();
        assert.ok(dialogBox, `${name}: recipe filter dialog geometry is unavailable`);
        assert.ok(
            dialogBox.x >= 0 &&
                dialogBox.y >= 0 &&
                dialogBox.x + dialogBox.width <= 390 &&
                dialogBox.y + dialogBox.height <= 844,
            `${name}: recipe filter dialog escapes the mobile viewport`,
        );
        assert.ok(await dialog.evaluate((element) => element.contains(document.activeElement)));
        await capture('02-recipes-mobile-dialog');
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        assert.ok(await filterButton.evaluate((element) => element === document.activeElement));
        results.push(`${name}: recipe filter dialog fits viewport and restores focus`);

        await goto('/settings/notifications');
        const save = page.getByRole('button', { name: 'Сохранить', exact: true });
        await assertActionAboveDock(save, 'notifications');
        await save.focus();
        const focusStyle = await save.evaluate((element) => {
            const style = getComputedStyle(element);
            return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
        });
        assert.notEqual(focusStyle.outlineStyle, 'none', `${name}: save focus outline is missing`);
        assert.notEqual(focusStyle.outlineWidth, '0px', `${name}: save focus outline has zero width`);
        await capture('03-notifications-mobile-final');
        results.push(`${name}: notification final action and focus remain accessible above the dock`);

        await page.setViewportSize({ width: 844, height: 390 });
        await goto('/family/chat');
        await page.getByPlaceholder('Напишите сообщение', { exact: true }).waitFor();
        const chatSearchLayout = await page.getByLabel('Поиск в чате', { exact: true }).evaluate((input) => {
            const form = input.closest('form');
            const button = form?.querySelector('button');
            const box = (element) => {
                const rect = element?.getBoundingClientRect();
                return rect
                    ? { x: rect.x, right: rect.right, width: rect.width, display: getComputedStyle(element).display }
                    : null;
            };
            return { form: box(form), input: box(input), button: box(button) };
        });
        assert.ok(
            chatSearchLayout.input &&
                chatSearchLayout.button &&
                chatSearchLayout.button.x - chatSearchLayout.input.right <= 12,
            `${name}: family chat search has a cross-browser gap ${JSON.stringify(chatSearchLayout)}`,
        );
        await capture('04-family-chat-landscape');
        results.push(`${name}: family chat landscape renders without overflow`);

        await page.setViewportSize({ width: 390, height: 844 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await goto('/plan');
        await page.getByRole('button', { name: 'Добавить', exact: true }).first().waitFor();
        const moving = await page.evaluate(() =>
            Array.from(document.querySelectorAll('body *'))
                .map((element) => {
                    const style = getComputedStyle(element);
                    const durations = style.transitionDuration.split(',').map((value) => parseFloat(value) || 0);
                    const properties = style.transitionProperty.split(',').map((value) => value.trim());
                    const transformTransition = properties.some(
                        (property, index) =>
                            ['all', 'transform'].includes(property) && (durations[index] ?? durations[0] ?? 0) > 0.01,
                    );
                    const animationDuration = Math.max(
                        ...style.animationDuration.split(',').map((value) => parseFloat(value) || 0),
                    );
                    return transformTransition || (style.animationName !== 'none' && animationDuration > 0.01)
                        ? element.tagName
                        : null;
                })
                .filter(Boolean),
        );
        assert.deepEqual(moving, [], `${name}: reduced-motion leaves active movement`);
        await capture('05-plan-reduced-motion');
        results.push(`${name}: meal plan respects reduced motion`);
    } catch (error) {
        issues.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
        await page.screenshot({ path: fileURLToPath(new URL('failure.png', engineOutput)) }).catch(() => undefined);
    } finally {
        await context.close();
        await browser.close();
    }
}

for (const [name, browserType, executablePath] of engines)
    if (selectedEngineNames.has(name)) await runEngine(name, browserType, executablePath);

const report = {
    version: 2,
    status: issues.length === 0 && pageErrors.length === 0 ? 'passed' : 'failed',
    iteration,
    sourceVersion: packageManifest.version,
    startedAt,
    finishedAt: new Date().toISOString(),
    origin,
    browserVersions,
    results,
    issues,
    pageErrors,
};
const serializedReport = JSON.stringify(report, null, 2) + '\n';
await writeFile(new URL('results.json', runOutput), serializedReport);
await writeFile(new URL('results.json', output), serializedReport);
for (const result of results) console.log(`PASS ${result}`);
for (const issue of issues) console.log(`ISSUE ${issue}`);
assert.deepEqual(pageErrors, []);
assert.deepEqual(issues, []);
