import { expect, test, type Locator, type Page } from '@playwright/test';
import { enterFreshTotp } from './helpers/admin-session.js';

async function activate(locator: Locator) {
    await locator.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
    await locator.focus();
    await locator.press('Enter');
}

async function enrollAdmin(page: Page) {
    await page.goto('/auth');
    const submit = page.getByRole('button', { name: 'Продолжить' });
    await expect(submit).toBeEnabled({ timeout: 60_000 });
    await page.getByLabel('Логин').fill('admin');
    await page.getByLabel('Пароль').fill('1');
    await submit.click();
    await page.waitForURL(/\/auth\/mfa/u);
    const secret = await page.locator('.enrollment code').textContent();
    expect(secret).toBeTruthy();
    await enterFreshTotp(page.getByLabel('Код из приложения'), secret!);
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await expect(page.locator('.recovery-codes code')).toHaveCount(10);
    const recoveryCodes = await page.locator('.recovery-codes code').allTextContents();
    expect(recoveryCodes).toHaveLength(10);
    await page.getByLabel(/Я сохранил/u).check();
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
    return recoveryCodes;
}

for (const plan of ['plus', 'pro'] as const) {
    test(`grants and reads back a ${plan.toUpperCase()} gift from the user detail`, async ({ page }) => {
        test.setTimeout(90_000);
        const recoveryCodes = await enrollAdmin(page);
        await page.evaluate(() => {
            history.pushState({}, '', '/admin/users/10000000-0000-4000-8000-000000000007');
            window.dispatchEvent(new PopStateEvent('popstate'));
        });
        await page.waitForURL(/\/admin\/users\/10000000-0000-4000-8000-000000000007$/u);

        const billing = page
            .getByRole('heading', { name: 'Подписки и возвраты', exact: true })
            .locator('xpath=ancestor::section[1]');
        await expect(billing).toBeVisible();
        const criticalIds = await page
            .getByLabel('Код подтверждения из приложения', { exact: true })
            .evaluateAll((inputs) => inputs.map((input) => input.id));
        expect(new Set(criticalIds).size).toBe(criticalIds.length);
        await expect(billing.locator('select').nth(0)).toHaveValue('grant');
        await billing.locator('select').nth(1).selectOption(plan);
        await expect(billing.locator('select').nth(1)).toHaveValue(plan);

        const recoveryToggle = billing.getByRole('button', { name: 'Подтвердить резервным кодом', exact: true });
        await activate(recoveryToggle);
        await billing.getByLabel('Резервный код подтверждения', { exact: true }).fill(recoveryCodes[0]!);
        await activate(billing.getByRole('button', { name: 'Подтвердить критичные действия', exact: true }));
        await expect(billing.getByRole('status')).toContainText('Действия подтверждены до');

        await billing.locator('input[type="datetime-local"]').fill('2030-01-01T12:00');
        await billing.locator('textarea').fill(`Проверка выдачи ${plan.toUpperCase()} из карточки пользователя`);
        await activate(billing.getByRole('button', { name: 'Проверить последствия', exact: true }));
        const confirmation = billing.getByRole('checkbox', { name: 'Подтверждаю операцию', exact: true });
        await confirmation.focus();
        await confirmation.press('Space');
        await expect(confirmation).toBeChecked();
        await activate(billing.getByRole('button', { name: 'Выполнить', exact: true }));

        await expect(billing.getByRole('status').filter({ hasText: 'Тестовая операция сохранена' })).toBeVisible();
        await expect(billing).toContainText(`Тариф: ${plan}`);
        await expect(billing).toContainText('Административный подарок');
        await page.reload();
        const reloaded = page
            .getByRole('heading', { name: 'Подписки и возвраты', exact: true })
            .locator('xpath=ancestor::section[1]');
        await expect(reloaded).toContainText(`Тариф: ${plan}`);
        await expect(reloaded).toContainText('Административный подарок');
    });
}

test('blocks a second free grant for an active paid user before mutation', async ({ page }) => {
    test.setTimeout(90_000);
    await enrollAdmin(page);
    await page.evaluate(() => {
        history.pushState({}, '', '/admin/users/10000000-0000-4000-8000-000000000005');
        window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForURL(/\/admin\/users\/10000000-0000-4000-8000-000000000005$/u);
    const billing = page
        .getByRole('heading', { name: 'Подписки и возвраты', exact: true })
        .locator('xpath=ancestor::section[1]');
    await expect(billing).toContainText('Тариф: plus');
    await expect(billing.getByRole('note')).toContainText('уже есть активный или замороженный период');
    await expect(billing.getByRole('button', { name: 'Проверить последствия', exact: true })).toBeDisabled();
});
