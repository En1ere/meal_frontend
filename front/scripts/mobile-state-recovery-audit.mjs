import { qaRoot } from '../../scripts/qa-output.mjs';
/* global document, innerWidth, window */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '@playwright/test');
const origin = process.env.FRONT_QA_ORIGIN ?? 'http://127.0.0.1:3000';
const output = new URL('mobile-state-recovery-audit/', qaRoot());
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
await context.addInitScript(() => {
    const transport = window.fetch.bind(window);
    window.fetch = async (...args) => {
        const input = args[0];
        const raw = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
        const url = new URL(raw, window.location.origin);
        if (window.sessionStorage.getItem('qaDelaySearch') === '1' && url.pathname === '/api/v1/search') {
            await new Promise((resolve) => setTimeout(resolve, 1800));
        }
        if (window.sessionStorage.getItem('qaFailInventory') === '1' && url.pathname === '/api/v1/inventory') {
            return Response.json(
                {
                    error: { code: 'UNAVAILABLE', message: 'Сервис временно недоступен', details: null },
                    meta: { requestId: crypto.randomUUID() },
                },
                { status: 503 },
            );
        }
        return transport(...args);
    };
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

    await page.evaluate(() => {
        window.sessionStorage.setItem('qaDelaySearch', '1');
    });
    await goto('/search?q=молоко');
    await page.getByText('Ищем…', { exact: true }).first().waitFor();
    await shot('01-search-loading');
    await page.evaluate(() => {
        window.sessionStorage.removeItem('qaDelaySearch');
    });
    await page.getByText('Молоко 2,5%', { exact: true }).first().waitFor();
    await shot('02-search-loaded');
    results.push('delayed search exposes a named loading state and resolves without layout overflow');

    await goto('/search?q=qa-no-results-927431');
    await page.getByText('По вашему запросу здесь ничего не найдено.', { exact: true }).first().waitFor();
    assert.equal(await page.getByText('По вашему запросу здесь ничего не найдено.', { exact: true }).count(), 4);
    await shot('03-search-empty', true);
    results.push('empty global search explains all four empty result groups without a dead end');

    await page.evaluate(() => {
        window.sessionStorage.setItem('qaFailInventory', '1');
    });
    await goto('/inventory');
    const failure = page.getByRole('alert').filter({ hasText: 'Не удалось загрузить данные' });
    await failure.waitFor();
    assert.match(await failure.innerText(), /Сервис временно недоступен/);
    const inventoryBack = page.getByRole('link', { name: 'К запасам', exact: true });
    const backRect = await inventoryBack.evaluate((node) => {
        node.scrollIntoView({ block: 'center' });
        const rect = node.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom };
    });
    const dockRect = await page.getByRole('navigation', { name: 'Мобильная навигация' }).evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom };
    });
    assert.ok(
        backRect.bottom <= dockRect.top - 12,
        `inventory failure action overlaps dock: ${JSON.stringify({ backRect, dockRect })}`,
    );
    await shot('04-inventory-error');
    await page.evaluate(() => {
        window.sessionStorage.removeItem('qaFailInventory');
    });
    const retry = page.getByRole('button', { name: 'Повторить', exact: true });
    const box = await retry.boundingBox();
    assert.ok(box && box.width >= 44 && box.height >= 44, `small retry target: ${JSON.stringify(box)}`);
    await retry.click();
    await failure.waitFor({ state: 'hidden' });
    await page.getByText(/^Всего \d+$/).waitFor();
    await shot('05-inventory-recovered');
    results.push('inventory 503 state gives a touch-sized retry and recovers in place');

    await goto('/preserves?create=1');
    const name = page.getByLabel('Название', { exact: true });
    await name.fill('Черновик для проверки отмены');
    await shot('06-preserve-dirty-form');
    let confirmation = '';
    page.once('dialog', async (dialog) => {
        confirmation = dialog.message();
        await dialog.dismiss();
    });
    const cancel = page.getByRole('button', { name: 'Отмена', exact: true });
    const cancelBox = await cancel.boundingBox();
    assert.ok(
        cancelBox && cancelBox.width >= 44 && cancelBox.height >= 44,
        `small cancel target: ${JSON.stringify(cancelBox)}`,
    );
    await cancel.click();
    assert.equal(confirmation, 'Отменить несохранённые изменения?');
    assert.equal(await name.inputValue(), 'Черновик для проверки отмены');
    assert.equal(page.url(), `${origin}/preserves?create=1`);
    await shot('07-preserve-after-cancel-dismiss');
    results.push('native cancel confirmation preserves the draft when dismissed');

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
