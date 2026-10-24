import { qaRoot } from '../../scripts/qa-output.mjs';
/* global document, innerWidth, window */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '@playwright/test');
const origin = process.env.FRONT_QA_ORIGIN ?? 'http://localhost:3000';
const output = new URL('mobile-interaction-audit/', qaRoot());
await mkdir(output, { recursive: true });

const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
page.setDefaultTimeout(60000);
const results = [];
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

async function goto(path) {
    await page.goto(origin + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page
        .waitForFunction(() => !document.body.innerText.includes('Проверяем сессию'), undefined, { timeout: 15000 })
        .catch(() => undefined);
}

async function screenshot(name, fullPage = false) {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
    const metrics = await page.evaluate(() => ({
        innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
    }));
    assert.ok(metrics.scrollWidth <= metrics.innerWidth + 1, `${name} horizontal overflow`);
    await page.screenshot({
        path: fileURLToPath(new URL(`${name}.png`, output)),
        fullPage,
    });
}

async function login() {
    await goto('/auth');
    await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.getByLabel('Электронная почта', { exact: true }).fill('pro1@meal-planner.test');
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/', { timeout: 60000 });
}

try {
    await login();
    await screenshot('01-home-start');

    const moreButton = page.getByRole('button', { name: 'Ещё', exact: true });
    await moreButton.click();
    const moreDialog = page.getByRole('dialog', { name: 'Ещё', exact: true });
    await moreDialog.waitFor();
    assert.equal(await page.locator('body').evaluate((body) => body.style.overflow), 'hidden');
    assert.ok(await moreDialog.evaluate((dialog) => dialog.contains(document.activeElement)));
    await screenshot('02-more-menu-open');
    await page.keyboard.press('Shift+Tab');
    assert.ok(await moreDialog.evaluate((dialog) => dialog.contains(document.activeElement)));
    await page.keyboard.press('Escape');
    await moreDialog.waitFor({ state: 'hidden' });
    assert.ok(await moreButton.evaluate((button) => button === document.activeElement));
    results.push('mobile More drawer traps focus, closes with Escape and restores focus');

    await goto('/recipes');
    await page.getByRole('button', { name: 'Фильтры', exact: true }).click();
    const filterDialog = page.locator('dialog[open]');
    await filterDialog.waitFor();
    const dialogRect = await filterDialog.evaluate((dialog) => {
        const rect = dialog.getBoundingClientRect();
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    });
    assert.ok(dialogRect.left >= 0 && dialogRect.right <= 390 && dialogRect.top >= 0 && dialogRect.bottom <= 844);
    await screenshot('03-recipe-filters-dialog');
    await page.keyboard.press('Escape');
    await filterDialog.waitFor({ state: 'hidden' });
    results.push('recipe filters dialog fits the mobile viewport and closes with Escape');

    await goto('/recipes/new');
    const productSearch = page.getByLabel('Поиск продукта', { exact: true });
    await productSearch.scrollIntoViewIfNeeded();
    await productSearch.focus();
    await page.setViewportSize({ width: 390, height: 500 });
    await productSearch.scrollIntoViewIfNeeded();
    const focusedField = await productSearch.evaluate((field) => {
        const rect = field.getBoundingClientRect();
        return {
            focused: field === document.activeElement,
            top: rect.top,
            bottom: rect.bottom,
            viewportHeight: window.innerHeight,
        };
    });
    assert.ok(focusedField.focused && focusedField.top >= 0 && focusedField.bottom <= focusedField.viewportHeight);
    await screenshot('04-recipe-form-keyboard-proxy');
    results.push('focused long-form field remains visible in a 500px keyboard-height proxy');

    await page.setViewportSize({ width: 390, height: 844 });
    await goto('/settings/notifications');
    const save = page.getByRole('button', { name: 'Сохранить', exact: true });
    await save.scrollIntoViewIfNeeded();
    const dock = page.getByRole('navigation', { name: 'Мобильная навигация' });
    const [saveRect, dockRect] = await Promise.all([
        save.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return { top: rect.top, bottom: rect.bottom };
        }),
        dock.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return { top: rect.top, bottom: rect.bottom };
        }),
    ]);
    assert.ok(
        saveRect.bottom <= dockRect.top,
        `save button overlaps mobile dock: ${JSON.stringify({ saveRect, dockRect })}`,
    );
    await screenshot('05-notifications-bottom-reachable');
    results.push('last action on the long notification form scrolls fully above the mobile dock');

    assert.deepEqual(errors, []);
    await writeFile(new URL('results.json', output), JSON.stringify({ results, errors }, null, 2));
    for (const result of results) console.log(`PASS ${result}`);
} catch (error) {
    await screenshot('failure', false).catch(() => undefined);
    await writeFile(
        new URL('results.json', output),
        JSON.stringify({ results, errors, failure: error instanceof Error ? error.stack : String(error) }, null, 2),
    );
    throw error;
} finally {
    await browser.close();
}
