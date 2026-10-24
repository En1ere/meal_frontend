import { qaRoot } from '../../scripts/qa-output.mjs';
/* global document, innerWidth, window */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '@playwright/test');
const origin = process.env.FRONT_QA_ORIGIN ?? 'http://127.0.0.1:3000';
const output = new URL('mobile-touch-dialog-audit/', qaRoot());
await mkdir(output, { recursive: true });

const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
});
const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
});
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

async function shot(name, fullPage = false) {
    await page.waitForTimeout(350);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
    const metrics = await page.evaluate(() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.ok(metrics.scrollWidth <= metrics.innerWidth + 1, `${name} horizontal page overflow`);
    await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)), fullPage });
}

async function tap(locator) {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    assert.ok(box, 'touch target is not visible');
    assert.ok(box.width >= 44 && box.height >= 44, `small touch target: ${JSON.stringify(box)}`);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function login() {
    await goto('/auth');
    await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.getByLabel('Электронная почта', { exact: true }).fill('user1@meal-planner.test');
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/', { timeout: 60000 });
}

try {
    await login();

    await goto('/inventory/scan');
    await page.getByRole('heading', { name: 'Фото и штрихкод', exact: true }).waitFor();
    await shot('01-scanner-start');
    await tap(page.getByRole('button', { name: 'Разрешить камеру', exact: true }));
    const cameraAlert = page.getByRole('alert').filter({ hasText: /Камера недоступна|доступ отклонён/ });
    const stopCamera = page.getByRole('button', { name: 'Остановить камеру', exact: true });
    await Promise.race([cameraAlert.waitFor(), stopCamera.waitFor()]);
    if (await cameraAlert.isVisible()) {
        await shot('02-scanner-camera-fallback');
        results.push('camera touch action exposes a usable manual fallback when media access is unavailable');
    } else {
        await shot('02-scanner-camera-active');
        if (await stopCamera.isVisible()) {
            await tap(stopCamera);
            await page.getByRole('button', { name: 'Разрешить камеру', exact: true }).waitFor();
            results.push('camera starts from touch and exposes a touch-sized stop action');
        } else {
            await cameraAlert.waitFor();
            results.push('camera touch action falls back cleanly after an asynchronous media failure');
        }
    }

    const upload = page.getByLabel('Загрузить фото', { exact: true });
    await upload.setInputFiles({ name: 'not-an-image.txt', mimeType: 'text/plain', buffer: Buffer.from('not image') });
    assert.match(
        await page
            .getByRole('alert')
            .filter({ hasText: /JPEG, PNG или WebP/ })
            .innerText(),
        /JPEG, PNG или WebP/,
    );
    await upload.setInputFiles(fileURLToPath(new URL('../public/assets/food-014.png', import.meta.url)));
    const uploadedName = page.getByText('food-014.png', { exact: true });
    await uploadedName.waitFor();
    await tap(page.getByRole('button', { name: 'Удалить фото', exact: true }));
    await uploadedName.waitFor({ state: 'hidden' });
    await shot('03-scanner-upload-recovery');
    results.push('invalid upload recovers and add/remove photo controls remain touch-sized');

    await goto('/search');
    const resultTabs = page.getByRole('navigation', { name: 'Тип результатов' });
    await resultTabs.waitFor();
    const scrollState = await resultTabs.evaluate((node) => ({
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
        overflowX: window.getComputedStyle(node).overflowX,
    }));
    assert.ok(['auto', 'scroll'].includes(scrollState.overflowX));
    if (scrollState.scrollWidth > scrollState.clientWidth) {
        await resultTabs.evaluate((node) => node.scrollTo({ left: node.scrollWidth, behavior: 'instant' }));
        assert.ok((await resultTabs.evaluate((node) => node.scrollLeft)) > 0);
    }
    await tap(resultTabs.getByRole('link', { name: 'Магазины', exact: true }));
    await page.waitForURL('**/search?type=store');
    await shot('04-search-horizontal-zone');
    results.push('horizontal search tabs are independently scrollable and keep touch targets at least 44px');

    await goto('/settings/offline');
    const clearButton = page.getByRole('button', { name: 'Очистить локальные данные', exact: true });
    await clearButton.waitFor();
    await clearButton.scrollIntoViewIfNeeded();
    await tap(clearButton);
    const clearDialog = page.getByRole('dialog', { name: 'Удалить локальные данные?', exact: true });
    await clearDialog.waitFor();
    const focusedClearAction = await clearDialog.evaluate(() => document.activeElement?.textContent?.trim());
    assert.equal(focusedClearAction, 'Отмена');
    await shot('05-offline-clear-dialog');
    await page.keyboard.press('Escape');
    await clearDialog.waitFor({ state: 'hidden' });
    assert.ok(await clearButton.evaluate((node) => node === document.activeElement));
    results.push('offline destructive dialog defaults to cancel, closes with Escape and restores focus');

    await goto('/settings/account/lifecycle');
    const archiveButton = page.getByRole('button', { name: 'Архивировать вместо удаления', exact: true });
    await archiveButton.scrollIntoViewIfNeeded();
    await tap(archiveButton);
    const archiveDialog = page.getByRole('dialog', { name: 'Архивировать аккаунт?', exact: true });
    await archiveDialog.waitFor();
    assert.equal(await archiveDialog.evaluate(() => document.activeElement?.textContent?.trim()), 'Вернуться');
    await shot('06-account-archive-dialog');
    await page.keyboard.press('Escape');
    await archiveDialog.waitFor({ state: 'hidden' });
    assert.ok(await archiveButton.evaluate((node) => node === document.activeElement));
    results.push('account lifecycle confirmation defaults to the safe action and restores focus');

    assert.deepEqual(errors, []);
    for (const result of results) console.log(`PASS ${result}`);
} catch (error) {
    console.log(`FAILED URL ${page.url()}`);
    await page.screenshot({ path: fileURLToPath(new URL('failure.png', output)), fullPage: true });
    throw error;
} finally {
    await writeFile(new URL('results.json', output), JSON.stringify({ results, errors }, null, 2));
    await browser.close();
}
