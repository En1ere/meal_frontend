import { expect, test, type Page } from '@playwright/test';
import { armFetchFault, installFetchFaultHarness } from './helpers/fetch-fault.js';
import { enrollAdmin, setScenario, spaNavigate } from './helpers/admin-session.js';

const moderationId = '10000000-0000-4000-8000-000000000001';
const missingId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

test.beforeEach(async ({ context }) => installFetchFaultHarness(context));

for (const terminalAction of ['hide', 'unpublish'] as const) {
    const actionLabel = terminalAction === 'hide' ? 'hides' : 'unpublishes';
    test(`approves and then ${actionLabel} through the canonical moderation route with readback`, async ({ page }) => {
        await enrollAdmin(page);
        const workspace = await openModeration(page);
        await workspace.getByRole('button', { name: 'Одобрить эту версию', exact: true }).click();
        await expect(workspace.getByText('Публичная версия', { exact: true })).toBeVisible();
        await expect(workspace.getByText('Ожидающей версии нет.', { exact: true })).toBeVisible();

        await workspace.getByLabel('Причина, видимая автору').fill(`E2E ${terminalAction}: подтверждённая причина`);
        await workspace
            .getByRole('button', {
                name: terminalAction === 'hide' ? 'Скрыть публично' : 'Снять с публикации',
                exact: true,
            })
            .click();
        await expect(workspace.getByText('Публичной версии нет.', { exact: true })).toBeVisible();
        await expect(workspace.getByText('История решений (2)', { exact: true })).toBeVisible();

        await page.reload();
        await expect(page).toHaveURL(new RegExp(`/admin/moderation/${moderationId}$`, 'u'));
        await expect(page.getByText('Публичной версии нет.', { exact: true })).toBeVisible();
        await expect(page.getByText('История решений (2)', { exact: true })).toBeVisible();
    });
}

test('moderation 409 preserves the reason and succeeds on an explicit retry', async ({ page }) => {
    await enrollAdmin(page);
    const workspace = await openModeration(page);
    const reason = workspace.getByLabel('Причина, видимая автору');
    await reason.fill('E2E retry after conflict');
    await armFetchFault(page, {
        path: `/api/v1/admin/content-workspace/queues/${moderationId}/moderate`,
        method: 'POST',
        status: 409,
    });
    await workspace.getByRole('button', { name: 'Отклонить с причиной', exact: true }).click();
    await expect(workspace.getByRole('alert')).toContainText('Данные изменились');
    await expect(reason).toHaveValue('E2E retry after conflict');
    await workspace.getByRole('button', { name: 'Отклонить с причиной', exact: true }).click();
    await expect(workspace.getByText('Ожидающей версии нет.', { exact: true })).toBeVisible();
});

test('moderation unknown outcome reuses the command and reads back one effect', async ({ page }) => {
    await enrollAdmin(page);
    const workspace = await openModeration(page);
    await workspace.getByLabel('Причина, видимая автору').fill('E2E retry after unknown outcome');
    await armFetchFault(page, {
        path: `/api/v1/admin/content-workspace/queues/${moderationId}/moderate`,
        method: 'POST',
        status: 503,
        commitBeforeFailure: true,
    });
    await workspace.getByRole('button', { name: 'Отклонить с причиной', exact: true }).click();
    await expect(workspace.getByRole('alert')).toContainText('Сервис временно недоступен');
    await workspace.getByRole('button', { name: 'Отклонить с причиной', exact: true }).click();
    await expect(workspace.getByText('История решений (1)', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('История решений (1)', { exact: true })).toBeVisible();
});

test('moderation distinguishes missing detail from transient 503 and recovers', async ({ page }) => {
    await enrollAdmin(page);
    await spaNavigate(page, `/admin/moderation/${missingId}`);
    await expect(page.getByRole('heading', { name: 'Запись не найдена', exact: true })).toBeVisible();

    await setScenario(page, 'Ошибка загрузки');
    await spaNavigate(page, `/admin/moderation/${moderationId}`);
    await expect(page.getByRole('alert')).toBeVisible();
    await setScenario(page, 'Все данные');
    await openModeration(page);
});

async function openModeration(page: Page) {
    await spaNavigate(page, `/admin/moderation/${moderationId}`);
    const workspace = page
        .getByRole('heading', { name: 'Проверка версии материала', exact: true })
        .locator('xpath=ancestor::section[1]');
    await expect(workspace).toBeVisible();
    return workspace;
}
