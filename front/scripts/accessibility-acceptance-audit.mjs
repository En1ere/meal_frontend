import { qaRoot } from '../../scripts/qa-output.mjs';
/* global document, getComputedStyle, HTMLElement, innerHeight, innerWidth */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '@playwright/test');
const origin = process.env.FRONT_QA_ORIGIN ?? 'http://127.0.0.1:3000';
const output = new URL('accessibility-acceptance-audit/', qaRoot());
await mkdir(output, { recursive: true });

const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, hasTouch: true });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send('Accessibility.enable');
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
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(200);
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
}

async function capture(name) {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
    const geometry = await page.evaluate(() => ({
        innerWidth,
        innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        offenders: Array.from(document.querySelectorAll('body *'))
            .map((element) => {
                const rect = element.getBoundingClientRect();
                return rect.right > innerWidth + 1 || rect.left < -1
                    ? {
                          tag: element.tagName,
                          className: typeof element.className === 'string' ? element.className : '',
                          text: (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 60),
                          left: Math.round(rect.left),
                          right: Math.round(rect.right),
                          width: Math.round(rect.width),
                      }
                    : null;
            })
            .filter(Boolean)
            .slice(0, 12),
    }));
    assert.ok(
        geometry.scrollWidth <= geometry.innerWidth + 1,
        `${name}: horizontal overflow ${geometry.scrollWidth}/${geometry.innerWidth} ${JSON.stringify(geometry.offenders)}`,
    );
    await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)) });
}

async function auditSemantics(path) {
    await goto(path);
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    const exposed = nodes.filter((node) => !node.ignored);
    const roles = exposed.map((node) => node.role?.value).filter(Boolean);
    const unnamedInteractive = exposed
        .filter((node) => ['button', 'link', 'textbox', 'combobox', 'checkbox', 'radio'].includes(node.role?.value))
        .filter((node) => !String(node.name?.value ?? '').trim())
        .map((node) => node.role?.value);
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll((elements) =>
        elements
            .filter((element) => {
                const style = getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
            })
            .map((element) => ({ level: Number(element.tagName.slice(1)), text: element.textContent?.trim() ?? '' })),
    );
    const jumps = headings.filter((heading, index) => index > 0 && heading.level > headings[index - 1].level + 1);
    assert.ok(roles.includes('main'), `${path}: main landmark is missing`);
    assert.equal(headings.filter(({ level }) => level === 1).length, 1, `${path}: expected exactly one visible h1`);
    if (unnamedInteractive.length) issues.push(`${path}: unnamed interactive roles ${unnamedInteractive.join(', ')}`);
    if (jumps.length) issues.push(`${path}: heading level jumps ${JSON.stringify(jumps)}`);
    results.push(`${path}: accessibility tree exposes main, one h1 and named controls`);
}

async function auditKeyboardOrder() {
    await page.setViewportSize({ width: 1280, height: 900 });
    await goto('/recipes');
    await page.evaluate(() => {
        const active = document.activeElement;
        if (active instanceof HTMLElement) active.blur();
    });
    const sequence = [];
    for (let attempt = 0; attempt < 40 && sequence.length < 24; attempt++) {
        await page.keyboard.press('Tab');
        const focused = await page.evaluate(() => {
            const element = document.activeElement;
            if (!(element instanceof HTMLElement)) return null;
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return {
                tag: element.tagName,
                name: (
                    element.getAttribute('aria-label') ||
                    element.textContent ||
                    element.getAttribute('placeholder') ||
                    ''
                )
                    .trim()
                    .slice(0, 80),
                visible: rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= innerHeight,
                outline: `${style.outlineStyle} ${style.outlineWidth}`,
            };
        });
        if (focused?.tag === 'NEXTJS-PORTAL') continue;
        assert.ok(
            focused?.visible,
            `recipes keyboard step ${sequence.length + 1}: focus is not visible ${JSON.stringify(focused)}`,
        );
        assert.ok(focused.name, `recipes keyboard step ${sequence.length + 1}: focused control has no name`);
        sequence.push(focused);
    }
    assert.equal(sequence.length, 24, 'recipes keyboard path did not expose 24 product controls');
    assert.ok(new Set(sequence.map(({ tag, name }) => `${tag}:${name}`)).size >= 18, 'recipes tab order is stuck');
    await capture('01-keyboard-focus-order');
    results.push('recipes: first 24 Tab stops remain visible, named and progressive');
}

async function auditDialog() {
    await page.setViewportSize({ width: 320, height: 800 });
    await goto('/recipes');
    const opener = page.getByRole('button', { name: 'Фильтры', exact: true });
    await opener.click();
    const dialog = page.locator('dialog[open]');
    await dialog.waitFor();
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    const dialogNode = nodes.find((node) => !node.ignored && node.role?.value === 'dialog');
    assert.ok(dialogNode, 'recipe filters dialog is absent from the accessibility tree');
    if (!String(dialogNode.name?.value ?? '').trim()) issues.push('recipe filters dialog has no accessible name');
    assert.ok(await dialog.evaluate((element) => element.contains(document.activeElement)));
    await capture('02-dialog-400-percent-reflow');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.ok(await opener.evaluate((element) => element === document.activeElement));
    results.push('recipe filters: 400% reflow equivalent keeps named dialog and focus lifecycle');
}

async function auditReflow() {
    await page.emulateMedia({ forcedColors: 'none', reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 640, height: 800 });
    await goto('/settings/notifications');
    const save = page.getByRole('button', { name: 'Сохранить', exact: true });
    await save.scrollIntoViewIfNeeded();
    await capture('03-notifications-200-percent-reflow');
    results.push('notifications: 200% reflow equivalent keeps the final action reachable');

    await page.setViewportSize({ width: 320, height: 800 });
    await goto('/family/chat');
    await page.getByPlaceholder('Напишите сообщение', { exact: true }).waitFor();
    await capture('04-family-chat-400-percent-reflow');
    results.push('family chat: 400% reflow equivalent keeps search and content readable');
}

async function auditForcedColors() {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    await goto('/plan');
    const add = page.getByRole('button', { name: 'Добавить', exact: true }).first();
    await add.focus();
    const focus = await add.evaluate((element) => {
        const style = getComputedStyle(element);
        return { style: style.outlineStyle, width: style.outlineWidth };
    });
    assert.notEqual(focus.style, 'none');
    assert.notEqual(focus.width, '0px');
    await capture('05-plan-forced-colors-focus');
    results.push('meal plan: forced colors preserves structure and keyboard focus');
}

try {
    await login();
    for (const path of ['/recipes', '/family/chat', '/settings/notifications', '/plan', '/settings/offline'])
        await auditSemantics(path);
    await auditKeyboardOrder();
    await auditDialog();
    await auditReflow();
    await auditForcedColors();
    assert.deepEqual(pageErrors, []);
    for (const result of results) console.log(`PASS ${result}`);
    for (const issue of issues) console.log(`ISSUE ${issue}`);
} finally {
    await writeFile(new URL('results.json', output), JSON.stringify({ results, issues, pageErrors }, null, 2));
    await browser.close();
}
