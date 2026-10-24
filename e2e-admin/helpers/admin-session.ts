import { expect, type Locator, type Page } from '@playwright/test';
import { freshTotp } from '../../e2e/helpers/totp.js';

export async function fillControlledInput(locator: Locator, value: string) {
    await locator.evaluate((element, value) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (!setter) throw new Error('HTMLInputElement value setter is unavailable');
        setter.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    await expect(locator).toHaveValue(value);
}

export async function enterFreshTotp(locator: Locator, secret: string) {
    await fillControlledInput(locator, await freshTotp(secret));
}

export async function activate(locator: Locator) {
    await locator.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
    await locator.focus();
    await locator.press('Enter');
}

export async function enrollAdmin(page: Page) {
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

export async function spaNavigate(page: Page, path: string) {
    await page.evaluate((next) => {
        history.pushState({}, '', next);
        window.dispatchEvent(new PopStateEvent('popstate'));
    }, path);
    await page.waitForURL((url) => url.pathname === path);
}

export async function confirmCritical(page: Page, recoveryCode: string, scope?: Locator) {
    const root = scope ?? page.locator('body');
    const confirmed = root.getByRole('status').filter({ hasText: 'Действия подтверждены до' }).first();
    const toggle = root.getByRole('button', { name: 'Подтвердить резервным кодом', exact: true }).first();
    if (!(await confirmed.isVisible())) {
        await expect(toggle).toBeVisible();
        await toggle.click();
        const input = root.getByLabel('Резервный код подтверждения', { exact: true }).first();
        await expect(input).toBeVisible();
        await input.fill(recoveryCode);
        await root.getByRole('button', { name: 'Подтвердить критичные действия', exact: true }).first().click();
    }
    await expect(confirmed).toBeVisible();
}

export async function unlockTabWithRecovery(page: Page, recoveryCode: string) {
    const unlockHeading = page.getByRole('heading', { name: 'Подтвердите повторный вход', exact: true });
    await expect(unlockHeading).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Использовать резервный код', exact: true }).click();
    await page.getByLabel('Резервный код', { exact: true }).fill(recoveryCode);
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
}

export async function setScenario(
    page: Page,
    name: 'Все данные' | 'Пустые списки' | 'Ошибка загрузки' | 'Конфликт изменений',
) {
    await spaNavigate(page, '/dev/scenarios');
    const scenario = page.getByRole('radio', { name, exact: true });
    await scenario.click();
    await expect(scenario).toBeChecked();
    await expect(page.getByRole('status')).toContainText('Сценарий переключён');
}
