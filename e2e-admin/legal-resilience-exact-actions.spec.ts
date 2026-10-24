import { expect, test } from '@playwright/test';
import {
    confirmCritical,
    enrollAdmin,
    setScenario,
    spaNavigate,
    unlockTabWithRecovery,
} from './helpers/admin-session.js';
import { armFetchFault, installFetchFaultHarness } from './helpers/fetch-fault.js';

const deletionId = '20000000-0000-4000-8000-000000000070';

test.beforeEach(async ({ context }) => installFetchFaultHarness(context));

for (const decision of ['approve', 'reject'] as const) {
    test(`${decision}s an account-deletion review without pretending deletion completed`, async ({ page }) => {
        test.setTimeout(90_000);
        const codes = await enrollAdmin(page);
        await spaNavigate(page, `/admin/legal-requests/${deletionId}`);
        const review = page
            .getByRole('heading', { name: 'Решение по удалению аккаунта' })
            .locator('xpath=ancestor::section[1]');
        await confirmCritical(page, codes[0]!);
        await review.getByRole('combobox', { name: 'Решение', exact: true }).selectOption(decision);
        await review.getByLabel('Основание решения').fill(`E2E ${decision}: подтверждённое основание решения`);
        await review.getByRole('checkbox', { name: 'Подтверждаю решение и его основание' }).check();
        await review
            .getByRole('button', { name: decision === 'approve' ? 'Подтвердить проверку' : 'Отклонить', exact: true })
            .click();
        const decisionMessage =
            decision === 'approve' ? 'Финализация по-прежнему зависит' : 'Решение сохранено в истории';
        await expect(review.getByRole('status').filter({ hasText: decisionMessage })).toContainText(decisionMessage);
        await expect(page.getByRole('button', { name: /Окончательное удаление/u })).toHaveCount(0);
    });
}

test('applies only ready rollback items and keeps conflicts visible', async ({ page }) => {
    const codes = await enrollAdmin(page);
    await spaNavigate(page, '/admin/rollback/10000000-0000-4000-8000-000000000011');
    await page.getByRole('button', { name: 'Обновить предпросмотр последствий', exact: true }).click();
    await expect(page.getByText(/конфликт/iu).first()).toBeVisible();
    await confirmCritical(page, codes[0]!);
    await page.getByLabel('Причина действия').fill('E2E частичный компенсирующий откат');
    await page.getByRole('button', { name: 'Компенсировать только готовые элементы', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Компенсировано:' })).toContainText(
        /Компенсировано: [1-9]\d*/u,
    );
    await expect(page.getByText(/пропущено|конфликт/iu).first()).toBeVisible();
});

test('rejects a stale legal decision with 412 after another tab commits first', async ({
    page,
    context,
    browserName,
}) => {
    test.setTimeout(90_000);
    const codes = await enrollAdmin(page);
    await spaNavigate(page, `/admin/legal-requests/${deletionId}`);
    if (browserName === 'firefox') {
        const review = page
            .getByRole('heading', { name: 'Решение по удалению аккаунта' })
            .locator('xpath=ancestor::section[1]');
        await confirmCritical(page, codes[0]!);
        await review.getByRole('combobox', { name: 'Решение', exact: true }).selectOption('reject');
        await review.getByLabel('Основание решения').fill('E2E Firefox stale equivalent');
        await review.getByRole('checkbox', { name: 'Подтверждаю решение и его основание' }).check();
        await armFetchFault(page, {
            path: `/api/v1/admin/account-deletions/${deletionId}/review`,
            method: 'POST',
            status: 412,
        });
        await review.getByRole('button', { name: 'Отклонить', exact: true }).click();
        await expect(review.getByRole('alert')).toBeVisible();
        await expect(review.getByRole('status').filter({ hasText: 'Финализация по-прежнему зависит' })).toHaveCount(0);
        await expect(review.getByLabel('Основание решения')).toHaveValue('E2E Firefox stale equivalent');
        return;
    }
    const second = await context.newPage();
    await second.goto(page.url());
    await unlockTabWithRecovery(second, codes[0]!);
    await second.waitForURL(`/admin/legal-requests/${deletionId}`);

    const firstReview = page
        .getByRole('heading', { name: 'Решение по удалению аккаунта' })
        .locator('xpath=ancestor::section[1]');
    await confirmCritical(page, codes[1]!);
    await firstReview.getByLabel('Основание решения').fill('E2E решение из первой конкурентной вкладки');
    await firstReview.getByRole('checkbox', { name: 'Подтверждаю решение и его основание' }).check();
    await firstReview.getByRole('button', { name: 'Подтвердить проверку', exact: true }).click();
    await expect(firstReview.getByRole('status').filter({ hasText: 'Финализация по-прежнему зависит' })).toBeVisible();

    const staleReview = second
        .getByRole('heading', { name: 'Решение по удалению аккаунта' })
        .locator('xpath=ancestor::section[1]');
    await staleReview.getByRole('combobox', { name: 'Решение', exact: true }).selectOption('reject');
    await staleReview.getByLabel('Основание решения').fill('E2E устаревшее решение второй вкладки');
    await staleReview.getByRole('checkbox', { name: 'Подтверждаю решение и его основание' }).check();
    await staleReview.getByRole('button', { name: 'Отклонить', exact: true }).click();
    await expect(staleReview.getByRole('alert')).toBeVisible();
    await expect(staleReview.getByRole('status')).toHaveCount(0);
});

test('covers generic empty, 503 and conflict states through the supported scenario console', async ({ page }) => {
    test.setTimeout(90_000);
    await enrollAdmin(page);
    await setScenario(page, 'Пустые списки');
    await spaNavigate(page, '/admin/catalog');
    await expect(page.getByRole('link', { name: /^Открыть\s*:/u })).toHaveCount(0);

    await setScenario(page, 'Ошибка загрузки');
    await spaNavigate(page, '/admin/catalog');
    await expect(page.getByRole('alert').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Повторить/u }).first()).toBeVisible();

    await setScenario(page, 'Конфликт изменений');
    await spaNavigate(page, '/admin/support/10000000-0000-4000-8000-000000000005');
    await page.getByLabel('Ответ пользователю').fill('E2E конфликт версии обращения');
    await page.getByRole('button', { name: 'Отправить ответ', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Обращение изменилось');
    await setScenario(page, 'Все данные');
});

test('rejects a malformed generic cursor without losing the authenticated UI', async ({ page }) => {
    await enrollAdmin(page);
    await spaNavigate(page, '/admin/catalog');
    const result = await page.evaluate(async () => {
        const unlock = sessionStorage.getItem('meal-admin-tab-unlock') ?? '';
        const csrfResponse = await fetch('/api/v1/admin/auth/csrf', { credentials: 'include' });
        const csrf = (await csrfResponse.json()).data.token as string;
        const response = await fetch('/api/v1/admin/catalog/search', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'content-type': 'application/json',
                'x-admin-unlock': unlock,
                'x-csrf-token': csrf,
            },
            body: JSON.stringify({ limit: 20, cursor: 'not-a-valid-cursor' }),
        });
        return { status: response.status, body: await response.json() };
    });
    expect(result.status).toBe(400);
    expect(result.body).toHaveProperty('error.code');
    await expect(page.getByRole('heading', { name: 'Каталог', exact: true })).toBeVisible();
});

test('serializes notification mutations and preserves server state after a refresh', async ({ page }) => {
    test.setTimeout(90_000);
    await enrollAdmin(page);
    await spaNavigate(page, '/notifications');
    const unread = page.getByRole('button', { name: 'Отметить прочитанным', exact: true }).first();
    await expect(unread).toBeVisible();
    const save = page.getByRole('button', { name: 'Сохранить настройки', exact: true });
    await Promise.all([unread.click(), save.click()]);
    await expect(page.getByRole('status')).toBeVisible();
    await page.getByRole('button', { name: 'Обновить уведомления', exact: true }).click();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
});

for (const status of [401, 403] as const) {
    test(`handles a ${status} authorization failure during a support mutation`, async ({ page }) => {
        test.setTimeout(90_000);
        await page.addInitScript((failureStatus) => {
            const nativeFetch = window.fetch.bind(window);
            window.fetch = async (input, init) => {
                const url =
                    typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
                if (url.includes('/api/v1/admin/support/') && url.endsWith('/reply') && init?.method === 'POST') {
                    return new Response(
                        JSON.stringify({
                            error: {
                                code: failureStatus === 401 ? 'UNAUTHENTICATED' : 'FORBIDDEN',
                                message:
                                    failureStatus === 401
                                        ? 'Служебная сессия отозвана.'
                                        : 'Недостаточно служебных прав.',
                                details: null,
                            },
                            meta: { requestId: crypto.randomUUID() },
                        }),
                        { status: failureStatus, headers: { 'content-type': 'application/json' } },
                    );
                }
                return nativeFetch(input, init);
            };
        }, status);
        await enrollAdmin(page);
        await spaNavigate(page, '/admin/support/10000000-0000-4000-8000-000000000005');
        await page.getByLabel('Ответ пользователю').fill(`E2E ответ при ${status}`);
        await page.getByRole('button', { name: 'Отправить ответ', exact: true }).click();
        if (status === 401) {
            await page.waitForURL(/\/auth\?returnTo=/u);
            await expect(page.getByRole('heading', { name: /служебный вход|повторный вход/u })).toBeVisible();
        } else {
            await expect(page).toHaveURL(/\/admin\/support\//u);
            await expect(page.getByRole('status')).toContainText('Недостаточно служебных прав');
            await expect(page.getByLabel('Ответ пользователю')).toHaveValue(`E2E ответ при ${status}`);
        }
    });
}
