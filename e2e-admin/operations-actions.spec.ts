import { expect, test, type Locator, type Page } from '@playwright/test';
import { enterFreshTotp } from './helpers/admin-session.js';

const jobId = '10000000-0000-4000-8000-000000000013';
const incidentId = '10000000-0000-4000-8000-000000000014';

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
    await page.getByLabel(/Я сохранил/u).check();
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
}

async function openWorkspace(page: Page, path: string, heading: string) {
    await page.evaluate((target) => {
        history.pushState({}, '', target);
        window.dispatchEvent(new PopStateEvent('popstate'));
    }, path);
    await page.waitForURL((url) => url.pathname === path);
    const workspace = page.getByRole('heading', { name: heading, exact: true }).locator('xpath=ancestor::section[1]');
    await expect(workspace).toBeVisible();
    return workspace;
}

async function execute(workspace: Locator, operation: string, reason: string, ignoreUntil?: string) {
    await workspace.locator('select').selectOption(operation);
    await workspace.locator('textarea').fill(reason);
    if (ignoreUntil) await workspace.locator('input[type="datetime-local"]').fill(ignoreUntil);
    await activate(workspace.getByRole('button', { name: 'Проверить последствия', exact: true }));
    await expect(workspace.getByRole('heading', { name: 'Последствия', exact: true })).toBeVisible();
    await expect(workspace).toContainText(`Причина: ${reason}`);
    await activate(workspace.getByRole('button', { name: 'Подтвердить действие', exact: true }));
    await expect(workspace.getByRole('status').filter({ hasText: 'Изменение сохранено' })).toBeVisible();
}

test('retries and then cancels a safe import with durable readback', async ({ page }) => {
    test.setTimeout(90_000);
    await enrollAdmin(page);
    let workspace = await openWorkspace(page, `/admin/operations/jobs/${jobId}`, 'Управление задачей');
    await expect(workspace).toContainText('Текущее состояние: Ошибка');

    await execute(workspace, 'retry', 'Повтор после проверки входных данных');
    await expect(workspace).toContainText('Текущее состояние: Ожидает');
    await page.reload();
    workspace = page
        .getByRole('heading', { name: 'Управление задачей', exact: true })
        .locator('xpath=ancestor::section[1]');
    await expect(workspace).toContainText('Текущее состояние: Ожидает');

    await execute(workspace, 'cancel', 'Отмена до начала повторной обработки');
    await expect(workspace).toContainText('Текущее состояние: Отменена');
    await page.reload();
    workspace = page
        .getByRole('heading', { name: 'Управление задачей', exact: true })
        .locator('xpath=ancestor::section[1]');
    await expect(workspace).toContainText('Текущее состояние: Отменена');
    await expect(workspace.getByRole('button', { name: 'Проверить последствия', exact: true })).toBeDisabled();
});

test('persists the complete incident-state lifecycle without mutating its source event', async ({ page }) => {
    test.setTimeout(90_000);
    await enrollAdmin(page);
    let workspace = await openWorkspace(page, `/admin/errors/${incidentId}`, 'Состояние инцидента');
    await expect(workspace).toContainText('Текущее состояние: Новая');

    await execute(workspace, 'in_progress', 'Инцидент принят в работу');
    await expect(workspace).toContainText('Текущее состояние: В работе');
    await execute(workspace, 'resolved', 'Исправление подтверждено локальной проверкой');
    await expect(workspace).toContainText('Текущее состояние: Решена');
    await execute(workspace, 'ignored', 'Временное подавление известного сигнала', '2030-01-01T12:00');
    await expect(workspace).toContainText('Текущее состояние: Игнорируется');

    await page.reload();
    workspace = page
        .getByRole('heading', { name: 'Состояние инцидента', exact: true })
        .locator('xpath=ancestor::section[1]');
    await expect(workspace).toContainText('Текущее состояние: Игнорируется');
    await execute(workspace, 'new', 'Вернуть сигнал в очередь разбора');
    await expect(workspace).toContainText('Текущее состояние: Новая');
    await page.reload();
    workspace = page
        .getByRole('heading', { name: 'Состояние инцидента', exact: true })
        .locator('xpath=ancestor::section[1]');
    await expect(workspace).toContainText('Текущее состояние: Новая');
    await expect(page.getByRole('heading', { name: 'IMPORT_TIMEOUT', exact: true })).toBeVisible();
});
