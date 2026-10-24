import { qaRoot } from '../../scripts/qa-output.mjs';
/* global document, getComputedStyle, HTMLInputElement, innerHeight, innerWidth */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '@playwright/test');
const origin = process.env.FRONT_QA_ORIGIN ?? 'http://127.0.0.1:3000';
const output = new URL('responsive-accessibility-audit/', qaRoot());
await mkdir(output, { recursive: true });

const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const page = await context.newPage();
page.setDefaultTimeout(60000);
const results = [];
const issues = [];
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

async function goto(path) {
    await page.goto(origin + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page
        .waitForFunction(() => !document.body.innerText.includes('Проверяем сессию'), undefined, { timeout: 15000 })
        .catch(() => undefined);
    await page.waitForTimeout(300);
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
}

async function metrics() {
    return page.evaluate(() => {
        const visible = (element) => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        };
        const smallControls = Array.from(
            document.querySelectorAll(
                'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, a.button',
            ),
        )
            .filter(visible)
            .map((element) => {
                const target =
                    element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type)
                        ? element.closest('label') || element
                        : element;
                const rect = target.getBoundingClientRect();
                return {
                    text: (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 60),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                };
            })
            .filter(({ width, height }) => width < 44 || height < 44);
        return {
            innerWidth,
            innerHeight,
            scrollWidth: document.documentElement.scrollWidth,
            heading: document.querySelector('h1')?.textContent?.trim() ?? null,
            smallControls,
        };
    });
}

async function capture(name, fullPage = false) {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
    await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)), fullPage });
}

async function auditResponsive(name, viewport, paths) {
    await page.emulateMedia({ forcedColors: 'none', reducedMotion: 'no-preference' });
    await page.setViewportSize(viewport);
    for (const [index, path] of paths.entries()) {
        await goto(path);
        const value = await metrics();
        assert.ok(value.heading, `${name} ${path} has no h1`);
        if (value.scrollWidth > value.innerWidth + 1) issues.push(`${name} ${path}: horizontal overflow`);
        if (value.smallControls.length)
            issues.push(`${name} ${path}: small controls ${JSON.stringify(value.smallControls)}`);
        const actions = page.locator(
            'main button:not([disabled]), main a[href], main input:not([disabled]), main textarea:not([disabled])',
        );
        let lastAction = null;
        for (let actionIndex = (await actions.count()) - 1; actionIndex >= 0; actionIndex--) {
            const candidate = actions.nth(actionIndex);
            if (await candidate.isVisible()) {
                lastAction = candidate;
                break;
            }
        }
        if (lastAction) {
            await lastAction.scrollIntoViewIfNeeded();
            const dock = page.getByRole('navigation', { name: 'Мобильная навигация' });
            if (await dock.isVisible().catch(() => false)) {
                const [actionBox, dockBox] = await Promise.all([lastAction.boundingBox(), dock.boundingBox()]);
                if (actionBox && dockBox && actionBox.y + actionBox.height > dockBox.y - 8)
                    issues.push(`${name} ${path}: final action overlaps mobile navigation`);
            }
        }
        await capture(`${name}-${String(index + 1).padStart(2, '0')}-${path.replaceAll('/', '-') || 'home'}`);
        results.push(`${name} ${path} rendered at ${viewport.width}×${viewport.height}`);
    }
}

async function auditForcedColors(paths) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'no-preference' });
    for (const [index, path] of paths.entries()) {
        await goto(path);
        const value = await metrics();
        if (value.scrollWidth > value.innerWidth + 1) issues.push(`forced-colors ${path}: horizontal overflow`);
        const focusable = page.locator('main button:not([disabled]), main a[href], main input:not([disabled])').first();
        if (await focusable.count()) {
            await focusable.focus();
            const focus = await focusable.evaluate((element) => {
                const style = getComputedStyle(element);
                return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
            });
            if (focus.outlineStyle === 'none' || focus.outlineWidth === '0px')
                issues.push(`forced-colors ${path}: focused control has no computed outline`);
        }
        await capture(`forced-colors-${String(index + 1).padStart(2, '0')}-${path.replaceAll('/', '-')}`);
        results.push(`forced-colors ${path} retained visible content and focus geometry`);
    }
}

async function auditReducedMotion(paths) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ forcedColors: 'none', reducedMotion: 'reduce' });
    for (const [index, path] of paths.entries()) {
        await goto(path);
        const moving = await page.evaluate(() =>
            Array.from(document.querySelectorAll('body *'))
                .map((element) => {
                    const style = getComputedStyle(element);
                    const transitionDurations = style.transitionDuration.split(',').map((value) => parseFloat(value));
                    const transitionProperties = style.transitionProperty.split(',').map((value) => value.trim());
                    const transformTransition = transitionProperties.some(
                        (property, position) =>
                            ['all', 'transform'].includes(property) &&
                            (transitionDurations[position] ?? transitionDurations[0] ?? 0) > 0.01,
                    );
                    const animationDuration = Math.max(
                        ...style.animationDuration.split(',').map((value) => parseFloat(value) || 0),
                    );
                    if (!transformTransition && (style.animationName === 'none' || animationDuration <= 0.01))
                        return null;
                    return {
                        tag: element.tagName,
                        text: (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 60),
                        transitionProperty: style.transitionProperty,
                        transitionDuration: style.transitionDuration,
                        animationName: style.animationName,
                        animationDuration: style.animationDuration,
                    };
                })
                .filter(Boolean)
                .slice(0, 20),
        );
        if (moving.length) issues.push(`reduced-motion ${path}: ${JSON.stringify(moving)}`);
        await capture(`reduced-motion-${String(index + 1).padStart(2, '0')}-${path.replaceAll('/', '-')}`);
        results.push(`reduced-motion ${path} inspected for animations and transform transitions`);
    }
}

try {
    await login();
    await auditResponsive('narrow-320', { width: 320, height: 844 }, [
        '/',
        '/recipes',
        '/recipes/new',
        '/family/chat',
        '/settings/notifications',
        '/settings/offline',
    ]);
    await auditResponsive('landscape', { width: 844, height: 390 }, [
        '/recipes',
        '/recipes/new',
        '/family/chat',
        '/settings/offline',
    ]);
    await auditForcedColors(['/recipes', '/settings/notifications', '/settings/offline']);
    await auditReducedMotion(['/family', '/family/notes', '/plan', '/settings/offline']);
    assert.deepEqual(pageErrors, []);
    for (const result of results) console.log(`PASS ${result}`);
    for (const issue of issues) console.log(`ISSUE ${issue}`);
} finally {
    await writeFile(new URL('results.json', output), JSON.stringify({ results, issues, pageErrors }, null, 2));
    await browser.close();
}
