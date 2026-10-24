import { expect, test, type Page } from '@playwright/test';
import { totp } from '../e2e/helpers/totp.js';

async function ensureServiceWorker(page: Page) {
    await expect
        .poll(() => page.evaluate(async () => Boolean(await navigator.serviceWorker.ready)).catch(() => false), {
            timeout: 30_000,
        })
        .toBe(true);
    if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
        await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
        await page.getByRole('heading', { name: 'Вход модератора' }).waitFor();
    }
}

async function gotoExact(page: Page, path: string) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            await page.goto(path, { waitUntil: 'domcontentloaded' });
            break;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (
                attempt === 2 ||
                (!message.includes('NS_BINDING_ABORTED') &&
                    !message.includes('ERR_ABORTED') &&
                    !message.includes('is interrupted by another navigation'))
            ) {
                throw error;
            }
        }
    }

    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).toBe(path);
    await expect
        .poll(async () => {
            const text = await page.locator('main').innerText().catch(() => '');
            return text.trim().length > 0 && !text.includes('Проверяем сессию');
        }, { timeout: 30_000 })
        .toBe(true);
}

async function loginModerator(page: Page) {
    await gotoExact(page, '/moderation/sign-in');
    await ensureServiceWorker(page);
    await page.getByLabel('Электронная почта').fill('moderator@meal-planner.test');
    await page.getByLabel('Пароль').fill('1');
    await page.getByRole('button', { name: /Продолжить|Войти/u }).click();
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).toBe('/moderation/mfa');
    const secret = await page.locator('.enrollment code').textContent();
    expect(secret).toBeTruthy();
    await page.getByLabel('Код из приложения').fill(totp(secret!));
    await page.getByRole('button', { name: 'Подтвердить' }).click();
    await page.getByLabel(/Я сохранил/u).check();
    await page.getByRole('button', { name: 'Продолжить' }).click();
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).toBe('/moderation');
    await expect(page.getByRole('heading', { name: 'Модерация' })).toBeVisible({ timeout: 30_000 });
}

test('moderator claims a case, records an allowed decision and resets the form', async ({ page }) => {
    await loginModerator(page);
    await gotoExact(page, '/moderation/queues/recipes');
    const row = page.locator('article').filter({ hasText: 'Тыквенный суп с имбирём' });
    await row.getByRole('button', { name: 'Взять в работу' }).click();
    await expect(row.getByText('Мне', { exact: true })).toBeVisible();
    await row.getByRole('link', { name: 'Открыть' }).click();
    await expect(page.getByRole('heading', { name: 'Проверка редакции' })).toBeVisible({ timeout: 30_000 });

    await page.getByLabel('Действие *').selectOption('approve');
    await page.getByLabel('Категория причины *').selectOption('quality');
    await page.getByLabel('Обоснование *').fill('Материал проверен полностью');
    await page.getByRole('button', { name: 'Проверить решение' }).click();
    await page.getByRole('button', { name: 'Подтвердить' }).click();

    await expect(page.getByRole('status')).toHaveText('Решение сохранено.');
    await expect(page.getByText('approved', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Действие *')).toHaveValue('');
    await expect(page.getByLabel('Категория причины *')).toHaveValue('');
    await expect(page.getByLabel('Обоснование *')).toHaveValue('');
    await expect(page.getByLabel('Действие *').locator('option[value="approve"]')).toHaveCount(0);
});

test('moderator reopens a closed support ticket and cannot open another assignee case', async ({ page }) => {
    await loginModerator(page);
    await gotoExact(page, '/moderation/support/c1000000-0000-4000-8000-000000000007');
    await expect(page.getByText('Статус:').locator('..')).toContainText('closed');
    await expect(page.getByRole('button', { name: 'Открыть повторно' })).toBeVisible();
    await page.getByRole('button', { name: 'Открыть повторно' }).click();
    await expect(page.getByRole('status')).toHaveText('Обращение открыто повторно.');
    await expect(page.getByText('Статус:').locator('..')).toContainText('waiting_for_support');
    await expect(page.getByRole('button', { name: 'Отправить ответ' })).toBeVisible();

    await gotoExact(page, '/moderation/items/c1000000-0000-4000-8000-000000000005');
    await expect(page.getByRole('heading', { name: 'Эта очередь недоступна по вашим правам.' })).toBeVisible();
});
