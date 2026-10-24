import { expect, test, type Page } from '@playwright/test';
import { armFetchFault, installFetchFaultHarness } from './helpers/fetch-fault.js';
import {
    confirmCritical,
    enrollAdmin,
    setScenario,
    spaNavigate,
    unlockTabWithRecovery,
} from './helpers/admin-session.js';

const jobId = '10000000-0000-4000-8000-000000000013';
const missingId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

test.beforeEach(async ({ context }) => installFetchFaultHarness(context));

test('preserves overview data through a partial 503 and recovers after retry', async ({ page }) => {
    await enrollAdmin(page);
    await spaNavigate(page, '/admin');
    await expect(page.locator('main article').first()).toBeVisible();

    await setScenario(page, 'Ошибка загрузки');
    await spaNavigate(page, '/admin');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText('Показаны ранее полученные данные. Их актуальность не подтверждена.')).toBeVisible();
    await expect(page.locator('main article').first()).toBeVisible();

    await setScenario(page, 'Все данные');
    await spaNavigate(page, '/admin');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.locator('main article').first()).toBeVisible();
});

for (const section of ['catalog', 'queues'] as const) {
    test(`${section} pagination deduplicates records, preserves the first page on failure, and retries`, async ({
        page,
    }) => {
        await installPagedSearch(page, section);
        await enrollAdmin(page);
        await spaNavigate(page, section === 'queues' ? '/admin/queues/recipes' : '/admin/catalog');
        await expect(page.getByRole('link', { name: /^Открыть/u })).toHaveCount(1);

        await page.getByRole('button', { name: 'Загрузить ещё', exact: true }).click();
        await expect(page.getByRole('alert')).toBeVisible();
        await expect(
            page.getByText('Показаны ранее полученные данные. Их актуальность не подтверждена.'),
        ).toBeVisible();
        await expect(page.getByRole('link', { name: /^Открыть/u })).toHaveCount(1);

        await page.getByRole('alert').getByRole('button', { name: 'Повторить', exact: true }).click();
        await expect(page.getByRole('alert')).toHaveCount(0);
        await page.getByRole('button', { name: 'Загрузить ещё', exact: true }).click();
        await expect(page.getByRole('link', { name: /^Открыть/u })).toHaveCount(2);
    });
}

test('shows explicit generic detail 404 and recovers a valid detail after 503', async ({ page }) => {
    await enrollAdmin(page);
    await spaNavigate(page, `/admin/users/${missingId}`);
    await expect(page.getByRole('heading', { name: 'Запись не найдена', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /К разделу/u })).toBeVisible();

    await setScenario(page, 'Ошибка загрузки');
    await spaNavigate(page, `/admin/operations/jobs/${jobId}`);
    await expect(page.getByRole('alert')).toBeVisible();
    await setScenario(page, 'Все данные');
    await spaNavigate(page, `/admin/operations/jobs/${jobId}`);
    await expect(page.getByRole('heading', { name: 'Управление задачей', exact: true })).toBeVisible();
});

test('notification preference failure has no false optimistic state and succeeds on retry', async ({ page }) => {
    await enrollAdmin(page);
    await spaNavigate(page, '/settings/notifications');
    const browser = page.getByRole('checkbox', { name: 'Браузер', exact: true });
    await expect(browser).not.toBeChecked();

    await armFetchFault(page, {
        path: '/api/v1/admin/notification-preferences',
        method: 'POST',
        status: 503,
    });
    await browser.click();
    await expect(page.getByRole('status')).toContainText('Сервис временно недоступен');
    await expect(browser).not.toBeChecked();

    await browser.click();
    await expect(page.getByRole('status')).toContainText('Настройка сохранена');
    await expect(browser).toBeChecked();
    await page.reload();
    await expect(browser).toBeChecked();
});

test('recipe policy preserves a stale draft, then rereads and retries with the current version', async ({
    page,
    context,
    browserName,
}) => {
    test.setTimeout(90_000);
    const codes = await enrollAdmin(page);
    await spaNavigate(page, '/settings/recipes');
    if (browserName === 'firefox') {
        const field = page.getByLabel('Отправок рецептов на модерацию за 24 часа');
        await field.fill('71');
        await confirmCritical(page, codes[0]!);
        await armFetchFault(page, {
            path: '/api/v1/admin/settings/recipe-policy',
            method: 'PUT',
            status: 412,
        });
        await page.getByRole('button', { name: 'Сохранить ограничения', exact: true }).click();
        await expect(page.getByRole('alert')).toBeVisible();
        await expect(field).toHaveValue('71');
        await page.getByRole('button', { name: 'Сохранить ограничения', exact: true }).click();
        await expect(page.getByText('Загружена сохранённая версия 2.')).toBeVisible();
        return;
    }
    const second = await context.newPage();
    await second.goto('/settings/recipes');
    await unlockTabWithRecovery(second, codes[0]!);
    await second.waitForURL('/settings/recipes');

    const field = 'Отправок рецептов на модерацию за 24 часа';
    await second.getByLabel(field).fill('71');
    await confirmCritical(page, codes[1]!);
    await page.getByLabel(field).fill('70');
    await page.getByRole('button', { name: 'Сохранить ограничения', exact: true }).click();
    await expect(page.getByText('Загружена сохранённая версия 2.')).toBeVisible();

    await second.getByRole('button', { name: 'Сохранить ограничения', exact: true }).click();
    await expect(second.getByRole('alert')).toContainText(/изменил|конфликт|перечитайте/iu);
    await expect(second.getByLabel(field)).toHaveValue('71');
    await second.getByRole('button', { name: 'Перечитать настройки', exact: true }).click();
    await expect(second.getByLabel(field)).toHaveValue('70');
    await second.getByLabel(field).fill('71');
    await second.getByRole('button', { name: 'Сохранить ограничения', exact: true }).click();
    await expect(second.getByText('Загружена сохранённая версия 3.')).toBeVisible();
});

test('recipe policy recovers from load and save 503 without losing the edited value', async ({ page }) => {
    const codes = await enrollAdmin(page);
    await armFetchFault(page, {
        path: '/api/v1/admin/settings/recipe-policy',
        method: 'GET',
        status: 503,
    });
    await spaNavigate(page, '/settings/recipes');
    await expect(page.getByRole('alert')).toContainText('Не удалось загрузить ограничения');
    await page.getByRole('button', { name: 'Повторить', exact: true }).click();

    const field = page.getByLabel('Отправок рецептов на модерацию за 24 часа');
    await expect(field).toBeVisible();
    await field.fill('81');
    await confirmCritical(page, codes[0]!);
    await armFetchFault(page, {
        path: '/api/v1/admin/settings/recipe-policy',
        method: 'PUT',
        status: 503,
    });
    await page.getByRole('button', { name: 'Сохранить ограничения', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Сервис временно недоступен');
    await expect(field).toHaveValue('81');
    await page.getByRole('button', { name: 'Сохранить ограничения', exact: true }).click();
    await expect(page.getByText('Загружена сохранённая версия 2.')).toBeVisible();
    await expect(field).toHaveValue('81');
});

test('operation 409 preserves preview and reason for an explicit same-intent retry', async ({ page }) => {
    await enrollAdmin(page);
    await spaNavigate(page, `/admin/operations/jobs/${jobId}`);
    const workspace = page
        .getByRole('heading', { name: 'Управление задачей', exact: true })
        .locator('xpath=ancestor::section[1]');
    const reason = workspace.getByLabel('Причина');
    await reason.fill('E2E retry after operation conflict');
    await workspace.getByRole('button', { name: 'Проверить последствия', exact: true }).click();
    await armFetchFault(page, {
        path: '/api/v1/admin/operations-workspace/execute',
        method: 'POST',
        status: 409,
    });
    await workspace.getByRole('button', { name: 'Подтвердить действие', exact: true }).click();
    await expect(workspace.getByRole('status')).toContainText('Данные изменились');
    await expect(reason).toHaveValue('E2E retry after operation conflict');
    await expect(workspace.getByRole('heading', { name: 'Последствия', exact: true })).toBeVisible();
    await workspace.getByRole('button', { name: 'Подтвердить действие', exact: true }).click();
    await expect(workspace).toContainText('Текущее состояние: Ожидает');
});

test('operation unknown outcome retries the same command and reads back its single effect', async ({ page }) => {
    await enrollAdmin(page);
    await spaNavigate(page, `/admin/operations/jobs/${jobId}`);
    const workspace = page
        .getByRole('heading', { name: 'Управление задачей', exact: true })
        .locator('xpath=ancestor::section[1]');
    await workspace.getByLabel('Причина').fill('E2E повтор после неизвестного результата');
    await workspace.getByRole('button', { name: 'Проверить последствия', exact: true }).click();
    await armFetchFault(page, {
        path: '/api/v1/admin/operations-workspace/execute',
        method: 'POST',
        status: 503,
        commitBeforeFailure: true,
    });
    await workspace.getByRole('button', { name: 'Подтвердить действие', exact: true }).click();
    await expect(workspace.getByRole('status')).toContainText('Сервис временно недоступен');
    await workspace.getByRole('button', { name: 'Подтвердить действие', exact: true }).click();
    await expect(workspace).toContainText('Текущее состояние: Ожидает');
    await page.reload();
    await expect(page.getByText('Текущее состояние: Ожидает', { exact: true })).toBeVisible();
});

async function installPagedSearch(page: Page, section: 'catalog' | 'queues') {
    await page.addInitScript((targetSection) => {
        const nativeFetch = window.fetch.bind(window);
        let failedNextPage = false;
        const item = (id: string, title: string) => ({
            id,
            title,
            status: 'pending',
            updatedAt: '2026-10-15T08:00:00.000Z',
            version: '1',
            fields: [],
            related: [],
            actions: [],
        });
        window.fetch = async (input, init) => {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
            const path = new URL(url, location.origin).pathname;
            if (path === `/api/v1/admin/${targetSection}/search` && init?.method === 'POST') {
                const body = JSON.parse(String(init.body ?? '{}')) as { cursor?: string };
                if (!body.cursor)
                    return new Response(
                        JSON.stringify({
                            data: {
                                section: targetSection,
                                availability: 'available',
                                reason: null,
                                items: [item('91000000-0000-4000-8000-000000000001', 'Первая запись')],
                                nextCursor: 'page-2',
                            },
                            meta: { requestId: crypto.randomUUID() },
                        }),
                        { status: 200, headers: { 'content-type': 'application/json' } },
                    );
                if (!failedNextPage) {
                    failedNextPage = true;
                    return new Response(
                        JSON.stringify({
                            error: { code: 'UNAVAILABLE', message: 'Сервис временно недоступен.', details: null },
                            meta: { requestId: crypto.randomUUID() },
                        }),
                        { status: 503, headers: { 'content-type': 'application/json' } },
                    );
                }
                return new Response(
                    JSON.stringify({
                        data: {
                            section: targetSection,
                            availability: 'available',
                            reason: null,
                            items: [
                                item('91000000-0000-4000-8000-000000000001', 'Первая запись'),
                                item('91000000-0000-4000-8000-000000000002', 'Вторая запись'),
                            ],
                            nextCursor: null,
                        },
                        meta: { requestId: crypto.randomUUID() },
                    }),
                    { status: 200, headers: { 'content-type': 'application/json' } },
                );
            }
            return nativeFetch(input, init);
        };
    }, section);
}
