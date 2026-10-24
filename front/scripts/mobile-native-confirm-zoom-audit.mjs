import { qaRoot } from '../../scripts/qa-output.mjs';
/* global document, innerWidth, window */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '@playwright/test');
const origin = process.env.FRONT_QA_ORIGIN ?? 'http://127.0.0.1:3000';
const output = new URL('mobile-native-confirm-zoom-audit/', qaRoot());
await mkdir(output, { recursive: true });

const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
});
const results = [];
const errors = [];

async function makeSession(email) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.on('pageerror', (error) => errors.push(`${email}: ${error.message}`));

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
        assert.ok(
            metrics.scrollWidth <= metrics.innerWidth + 1,
            `${name} horizontal page overflow: ${JSON.stringify(metrics)}`,
        );
        await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)), fullPage });
    }

    await goto('/auth');
    await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    await page.evaluate(() => navigator.serviceWorker.ready);
    if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    }
    await page.getByLabel('Электронная почта', { exact: true }).fill(email);
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/', { timeout: 60000 });
    return { context, page, goto, shot };
}

async function dismissConfirmation(page, action, expected) {
    let message = '';
    page.once('dialog', async (dialog) => {
        message = dialog.message();
        await dialog.dismiss();
    });
    await action.click();
    await page.waitForTimeout(150);
    assert.equal(message, expected);
}

async function assertTouchTarget(locator, name) {
    const box = await locator.boundingBox();
    assert.ok(box && box.width >= 44 && box.height >= 44, `${name} touch target is too small: ${JSON.stringify(box)}`);
}

async function shotPage(page, name, fullPage = false) {
    await page.waitForTimeout(350);
    await page.evaluate(() => document.fonts.ready);
    const metrics = await page.evaluate(() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.ok(
        metrics.scrollWidth <= metrics.innerWidth + 1,
        `${name} horizontal page overflow: ${JSON.stringify(metrics)}`,
    );
    await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)), fullPage });
}

try {
    const family = await makeSession('plus1@meal-planner.test');
    await family.goto('/family/chat');
    await family.page.getByRole('heading', { name: 'Семейный чат', exact: true }).waitFor();
    const hide = family.page.getByRole('button', { name: 'Скрыть у себя', exact: true }).first();
    await hide.scrollIntoViewIfNeeded();
    await assertTouchTarget(hide, 'family hide');
    const cardsBeforeHide = await family.page.locator('article').count();
    await family.shot('01-family-chat-before-hide');
    await dismissConfirmation(family.page, hide, 'Скрыть сообщение только у вас?');
    assert.equal(await family.page.locator('article').count(), cardsBeforeHide);
    await family.shot('02-family-chat-after-hide-dismiss');

    const remove = family.page.getByRole('button', { name: 'Удалить для всех', exact: true }).first();
    await remove.scrollIntoViewIfNeeded();
    await assertTouchTarget(remove, 'family remove for all');
    const cardsBeforeRemove = await family.page.locator('article').count();
    await dismissConfirmation(family.page, remove, 'Удалить сообщение для всех участников?');
    assert.equal(await family.page.locator('article').count(), cardsBeforeRemove);
    await family.shot('03-family-chat-after-remove-dismiss');
    results.push('family chat native confirmations are explicit, touch-sized, and cancellation preserves messages');

    await family.page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await hide.scrollIntoViewIfNeeded();
    const [scaledAction, scaledDock] = await Promise.all([
        hide.boundingBox(),
        family.page.getByRole('navigation', { name: 'Мобильная навигация' }).boundingBox(),
    ]);
    assert.ok(
        scaledAction && scaledDock && scaledAction.y + scaledAction.height <= scaledDock.y - 12,
        `scaled family action overlaps mobile dock: ${JSON.stringify({ scaledAction, scaledDock })}`,
    );
    await family.shot('04-family-chat-text-200-percent');
    results.push('family chat reflows at a 200% root text-size proxy without horizontal page overflow');
    await family.context.close();

    const user = await makeSession('user1@meal-planner.test');
    await user.goto('/receipts/new');
    const receiptText = user.page.locator('textarea').first();
    await receiptText.fill('Молоко 1 л\nХлеб 1 шт');
    const parse = user.page.getByRole('button', { name: 'Разобрать текст на строки для проверки', exact: true });
    await parse.click();
    const firstName = user.page.getByLabel('Фактическое название', { exact: true }).first();
    await firstName.waitFor();
    assert.equal(await firstName.inputValue(), 'Молоко 1 л');
    await receiptText.fill('Яблоки 2 кг\nЧай 1 уп');
    await parse.scrollIntoViewIfNeeded();
    await assertTouchTarget(parse, 'receipt reparse');
    await user.shot('05-receipt-before-reparse');
    await dismissConfirmation(
        user.page,
        parse,
        'Заменить позиции текстовыми строками? Текущие исправления позиций будут потеряны.',
    );
    assert.equal(await firstName.inputValue(), 'Молоко 1 л');
    await user.shot('06-receipt-after-reparse-dismiss');
    results.push('receipt reparse warns about lost corrections and cancellation preserves parsed lines');

    await user.page.getByRole('button', { name: 'Сохранить чек и перейти к поступлению', exact: true }).click();
    await user.page.waitForURL((url) => /^\/receipts\/[^/]+$/.test(url.pathname), { timeout: 60000 });
    const linkPurchase = user.page.getByRole('button', { name: 'Это моя покупка — связать', exact: true }).first();
    await linkPurchase.waitFor();
    await linkPurchase.scrollIntoViewIfNeeded();
    await assertTouchTarget(linkPurchase, 'receipt link purchase');
    await user.shot('07-receipt-before-link');
    await dismissConfirmation(
        user.page,
        linkPurchase,
        'Это та же покупка? Связать чек без нового поступления в запасы?',
    );
    await linkPurchase.waitFor();
    await user.shot('08-receipt-after-link-dismiss');
    results.push('receipt purchase-link confirmation explains inventory impact and cancellation keeps the draft');

    const offlinePage = await user.context.newPage();
    offlinePage.setDefaultTimeout(60000);
    await offlinePage.goto(origin + '/settings/offline', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await offlinePage.getByRole('heading', { name: 'Offline и устройство', exact: true }).waitFor();

    await user.goto('/shopping');
    const openList = user.page.getByRole('link', { name: 'Открыть список', exact: true }).first();
    await openList.waitFor();
    await openList.click();
    await user.page.waitForURL((url) => /^\/shopping\/[^/]+$/.test(url.pathname));
    const addItem = user.page.getByRole('button', { name: 'Добавить товар', exact: true });
    await addItem.waitFor();
    await user.context.setOffline(true);
    await addItem.click();
    const itemForm = user.page.locator('form').filter({
        has: user.page.getByRole('heading', { name: 'Добавить товар', exact: true }),
    });
    await itemForm.getByLabel('Название', { exact: true }).fill('Офлайн-позиция QA');
    await itemForm.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await itemForm.waitFor({ state: 'hidden' });
    await offlinePage.evaluate(() => window.dispatchEvent(new Event('meal-planner-offline-state')));
    const discard = offlinePage.getByRole('button', { name: 'Удалить локальное действие', exact: true }).first();
    await discard.waitFor();
    await discard.scrollIntoViewIfNeeded();
    await assertTouchTarget(discard, 'offline discard');
    await shotPage(offlinePage, '09-offline-before-discard');
    await dismissConfirmation(offlinePage, discard, 'Удалить это локальное действие без отправки на сервер?');
    await discard.waitFor();
    await shotPage(offlinePage, '10-offline-after-discard-dismiss');
    results.push('offline queue deletion is explicit, touch-sized, and cancellation preserves the queued action');

    await offlinePage.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await discard.scrollIntoViewIfNeeded();
    await shotPage(offlinePage, '11-offline-text-200-percent');
    results.push('offline queue reflows at a 200% root text-size proxy without horizontal page overflow');
    await user.context.setOffline(false);
    await user.context.close();

    assert.deepEqual(errors, []);
    for (const result of results) console.log(`PASS ${result}`);
} catch (error) {
    console.error(error);
    throw error;
} finally {
    await writeFile(new URL('results.json', output), JSON.stringify({ results, errors }, null, 2));
    await browser.close();
}
