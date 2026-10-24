import { expect, test } from '@playwright/test';
import { confirmCritical, enrollAdmin, fillControlledInput, spaNavigate } from './helpers/admin-session.js';

const userId = '10000000-0000-4000-8000-000000000007';

test('schedules and cancels in-app news while external providers remain fail-closed', async ({ page }) => {
    test.setTimeout(90_000);
    const codes = await enrollAdmin(page);
    await spaNavigate(page, '/admin/news');
    await page.getByLabel('Заголовок', { exact: true }).fill('E2E запланированная новость');
    await page.getByLabel('Текст блока', { exact: true }).fill('Проверка расписания и отмены.');
    await page.getByRole('button', { name: 'Сохранить черновик', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Изменения сохранены');
    await page.getByRole('button', { name: 'Рассчитать аудиторию сохранённой версии', exact: true }).click();
    await confirmCritical(page, codes[0]!);
    await page.getByLabel(/Расписание/u).fill('2030-01-01T12:00');
    await page.getByRole('button', { name: 'Подтвердить запланированную рассылку', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: /заплан/u })).toBeVisible();
    await page.getByRole('button', { name: 'Отменить ещё не начатую отправку', exact: true }).click();
    await expect(page.getByRole('button', { name: /E2E запланированная новость · Отправка отменена/u })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Новости', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /E2E запланированная новость · Отправка отменена/u })).toBeVisible();
    await page.getByRole('button', { name: /E2E запланированная новость/u }).click();
    await page.getByRole('checkbox', { name: 'Email', exact: true }).check();
    await page.getByRole('button', { name: /Сохранить/u }).click();
    await expect(page.getByRole('note')).toContainText('отправка выключена до подключения провайдеров');
    await expect(page.getByRole('button', { name: /Подтвердить публикацию/u })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Тестовая отправка', exact: true })).toBeDisabled();
});

test('grants moderator rights, exposes them in access search, and revokes the role', async ({ page }) => {
    test.setTimeout(90_000);
    const codes = await enrollAdmin(page);
    await spaNavigate(page, `/admin/users/${userId}`);
    const governance = page
        .getByRole('heading', { name: 'Санкции и служебные права' })
        .locator('xpath=ancestor::section[1]');
    await governance.getByLabel('Действие').selectOption('grantModerator');
    await confirmCritical(page, codes[0]!);
    await governance.getByRole('checkbox', { name: /Разрешить временные баны/u }).check();
    await governance.getByLabel('Причина действия').fill('E2E назначение модератора с ограниченным правом');
    await governance.getByRole('button', { name: 'Проверить последствия', exact: true }).click();
    await governance.getByRole('checkbox', { name: 'Подтверждаю указанные последствия', exact: true }).check();
    await governance.getByRole('button', { name: 'Выполнить', exact: true }).click();
    await expect(governance.getByRole('status').filter({ hasText: 'Действие сохранено' })).toBeVisible();

    await spaNavigate(page, '/admin/access');
    await fillControlledInput(page.locator('#admin-search'), userId);
    await page.getByRole('button', { name: 'Найти', exact: true }).click();
    const roleLink = page.getByRole('link', { name: /^Открыть\s*:/u }).first();
    await expect(roleLink).toBeVisible();
    await roleLink.click();
    await expect(page.getByText('moderator', { exact: true })).toBeVisible();
    const revoke = page
        .getByRole('heading', { name: 'Санкции и служебные права' })
        .locator('xpath=ancestor::section[1]');
    await revoke.getByLabel('Причина действия').fill('E2E отзыв служебной роли');
    await revoke.getByRole('button', { name: 'Проверить последствия', exact: true }).click();
    await revoke.getByRole('checkbox', { name: 'Подтверждаю указанные последствия', exact: true }).check();
    await revoke.getByRole('button', { name: 'Выполнить', exact: true }).click();
    await expect(revoke.getByRole('status').filter({ hasText: 'Действие сохранено' })).toBeVisible();
    await page.reload();
    await expect(revoke).toContainText('Юзер 1 · user');
    await expect(revoke).toContainText('revokeRole: E2E отзыв служебной роли');
});

test('blocks revocation of the sole administrator before mutation', async ({ page }) => {
    await enrollAdmin(page);
    await spaNavigate(page, '/admin/users/10000000-0000-4000-8000-000000000001');
    const governance = page
        .getByRole('heading', { name: 'Санкции и служебные права' })
        .locator('xpath=ancestor::section[1]');
    await expect(governance).toContainText('Единственного администратора нельзя');
    await expect(governance.getByRole('button', { name: 'Проверить последствия', exact: true })).toBeDisabled();
});

test('persists support note, assignment, public reply, and closed-ticket reopen', async ({ page }) => {
    test.setTimeout(90_000);
    await enrollAdmin(page);
    await spaNavigate(page, '/admin/support/10000000-0000-4000-8000-000000000005');
    const workspace = page.getByRole('heading', { name: 'Работа с обращением' }).locator('xpath=ancestor::section[1]');
    await workspace.getByLabel('Действие').selectOption('note');
    await workspace.getByLabel('Текст').fill('E2E внутренняя заметка');
    await workspace.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(workspace).toContainText('E2E внутренняя заметка');
    await workspace.getByLabel('Действие').selectOption('assign');
    await workspace.getByLabel('Сотрудник').selectOption({ index: 1 });
    await workspace.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(workspace).not.toContainText('Ответственный: Общая очередь');
    await page.getByLabel('Ответ пользователю').fill('E2E публичный ответ поддержки');
    await page.getByRole('button', { name: 'Отправить ответ', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Ответ сохранён' })).toBeVisible();
    await page.reload();
    await expect(page.getByText('E2E публичный ответ поддержки', { exact: true })).toBeVisible();

    await spaNavigate(page, '/admin/support/10000000-0000-4000-8000-000000000006');
    await page.getByRole('button', { name: 'Открыть повторно', exact: true }).click();
    await expect(page.getByLabel('Ответ пользователю')).toBeVisible();
});
