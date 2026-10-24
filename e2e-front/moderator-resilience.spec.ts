import { expect, test, type Page } from '@playwright/test';
import { totp } from '../e2e/helpers/totp.js';

test.setTimeout(240_000);

const ids = {
    recipe: 'c1000000-0000-4000-8000-000000000001',
    variant: 'c1000000-0000-4000-8000-000000000002',
    product: 'c1000000-0000-4000-8000-000000000003',
    report: 'c1000000-0000-4000-8000-000000000004',
    other: 'c1000000-0000-4000-8000-000000000005',
    extraRecipe: 'c1000000-0000-4000-8000-000000000008',
    hide: 'c1000000-0000-4000-8000-000000000010',
    unpublish: 'c1000000-0000-4000-8000-000000000011',
};

async function ensureServiceWorker(page: Page) {
    await page.evaluate(() => navigator.serviceWorker.ready);
    if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) await page.reload();
}

async function gotoStable(page: Page, path: string) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            return await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (
                attempt === 2 ||
                (!message.includes('NS_ERROR_FAILURE') &&
                    !message.includes('NS_BINDING_ABORTED') &&
                    !message.includes('NS_ERROR_ABORT') &&
                    !message.includes('ERR_ABORTED') &&
                    !message.includes('is interrupted by another navigation'))
            ) {
                throw error;
            }
        }
    }
    throw new Error(`Unable to navigate to ${path}`);
}

async function loginModerator(page: Page, returnTo = '/moderation') {
    await gotoStable(page, `/moderation/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
    await ensureServiceWorker(page);
    await page.getByLabel('Электронная почта').fill('moderator@meal-planner.test');
    await page.getByLabel('Пароль').fill('1');
    await page.getByRole('button', { name: /Продолжить|Войти/u }).click();
    await page.waitForURL(/\/moderation\/mfa/u);
    const secret = await page.locator('.enrollment code').textContent();
    expect(secret).toBeTruthy();
    await page.getByLabel('Код из приложения').fill(totp(secret!));
    await page.getByRole('button', { name: 'Подтвердить' }).click();
    await page.getByLabel(/Я сохранил/u).check();
    await page.getByRole('button', { name: 'Продолжить' }).click();
    await page.waitForURL((url) => url.pathname + url.search === returnTo, { timeout: 60_000 });
    await expect(page.getByRole('banner')).toBeVisible({ timeout: 30_000 });
    // Let the fresh dev server finish its one late Fast Refresh before installing one-shot failures.
    await page.waitForTimeout(2_000);
    expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(returnTo);
}

async function setFailure(page: Page, path: string, method: 'GET' | 'POST', status: number) {
    const value = Buffer.from(JSON.stringify({ nonce: crypto.randomUUID(), path, method, status })).toString(
        'base64url',
    );
    await page.context().addCookies([{ name: 'moderator_test_control', value, url: 'http://localhost:3000' }]);
}

async function decide(page: Page, action: string, reason: string) {
    await page.getByLabel('Действие *').selectOption(action);
    await page.getByLabel('Категория причины *').selectOption('quality');
    await page.getByLabel('Обоснование *').fill(reason);
    await page.getByRole('button', { name: 'Проверить решение' }).click();
    await page.getByRole('button', { name: 'Подтвердить' }).click();
}

test('moderator guard keeps safe deep links and rejects wrong staff scope', async ({ page }) => {
    const deepLink = '/moderation/queues/recipes?status=pending&assignment=unassigned&priority=high';
    await gotoStable(page, deepLink);
    await page.waitForURL(/\/moderation\/sign-in/u);
    expect(new URL(page.url()).searchParams.get('returnTo')).toBe(deepLink);

    await ensureServiceWorker(page);
    await page.getByLabel('Электронная почта').fill('admin@meal-planner.test');
    await page.getByLabel('Пароль').fill('1');
    await page.getByRole('button', { name: /Продолжить|Войти/u }).click();
    await expect(page.locator('.form-error')).toContainText('Требуется вход или проверка данных');

    await page.getByLabel('Электронная почта').fill('moderator@meal-planner.test');
    await page.getByLabel('Пароль').fill('1');
    await page.getByRole('button', { name: /Продолжить|Войти/u }).click();
    await page.waitForURL(/\/moderation\/mfa/u);
    const secret = await page.locator('.enrollment code').textContent();
    await page.getByLabel('Код из приложения').fill(totp(secret!));
    await page.getByRole('button', { name: 'Подтвердить' }).click();
    await page.getByLabel(/Я сохранил/u).check();
    await page.getByRole('button', { name: 'Продолжить' }).click();
    await page.waitForURL((url) => url.pathname + url.search === deepLink);
    await expect(page.getByRole('heading', { name: 'Очередь: рецепты' })).toBeVisible();

    await gotoStable(page, '/moderation/queues/not-a-queue');
    await expect(page.getByRole('heading', { name: 'Очередь модерации не найдена' })).toBeVisible();
});

test('queue preserves URL filters, empty state, cursor pages and skip outcome', async ({ page }) => {
    await loginModerator(page, '/moderation/queues/recipes');
    await expect(page.locator('article').filter({ hasText: 'Тыквенный суп с имбирём' })).toHaveCount(1);
    await expect(page.locator('article').filter({ hasText: 'Салат с печёной свёклой' })).toHaveCount(1);
    await expect(page.getByText('Запечённые яблоки', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Показать ещё' }).click();
    await expect(page.getByText('Запечённые яблоки', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Показать ещё' })).toHaveCount(0);

    await page.getByLabel('Приоритет').selectOption('critical');
    await expect(page).toHaveURL(/priority=critical/u);
    await expect(page.getByText('В этой выборке нет материалов.')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Приоритет')).toHaveValue('critical');
    await expect(page.getByText('В этой выборке нет материалов.')).toBeVisible();

    await gotoStable(page, '/moderation/queues/reports');
    const report = page.locator('article').filter({ hasText: 'Жалоба на описание рецепта' });
    await report.getByRole('button', { name: 'Пропустить уведомление' }).click();
    await expect(page.getByRole('status')).toContainText('материал остался в очереди');
    await expect(report.getByText('Не назначено', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator('article').filter({ hasText: 'Жалоба на описание рецепта' })).toBeVisible();
});

test('two tabs recover from stale claim and expose current assignment', async ({ page, context }) => {
    await loginModerator(page, '/moderation/queues/products');
    const firstRow = page.locator('article').filter({ hasText: 'Овсяное молоко 1 л' });
    if (test.info().project.name.includes('firefox')) {
        const claimRequestPromise = page.waitForRequest(
            (request) => request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/claim'),
        );
        await firstRow.getByRole('button', { name: 'Взять в работу' }).click();
        const claimRequest = await claimRequestPromise;
        await expect(page.getByRole('status')).toContainText('Задача назначена вам');
        const headers = await claimRequest.allHeaders();
        const staleStatus = await page.evaluate(
            async ({ url, body, csrf }) => {
                const parsed = JSON.parse(body) as Record<string, unknown>;
                parsed.idempotencyKey = crypto.randomUUID();
                const response = await fetch(url, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
                    body: JSON.stringify(parsed),
                });
                return response.status;
            },
            { url: claimRequest.url(), body: claimRequest.postData()!, csrf: headers['x-csrf-token']! },
        );
        expect(staleStatus).toBe(409);
        await page.reload();
        await expect(firstRow.getByText('Мне', { exact: true })).toBeVisible();
        return;
    }
    const second = await context.newPage();
    await gotoStable(second, '/moderation/queues/products');
    await expect(second.getByRole('heading', { name: 'Очередь: продукты' })).toBeVisible();

    const secondRow = second.locator('article').filter({ hasText: 'Овсяное молоко 1 л' });
    await firstRow.getByRole('button', { name: 'Взять в работу' }).click();
    await expect(page.getByRole('status')).toContainText('Задача назначена вам');
    await secondRow.getByRole('button', { name: 'Взять в работу' }).click();
    await expect(second.getByRole('status')).toContainText('Состояние изменилось. Обновите данные');
    await expect(firstRow.getByText('Мне', { exact: true })).toBeVisible();
    await expect(secondRow.getByText('Мне', { exact: true })).toBeVisible();
    await second.close();
});

test('all exposed material decisions update details and stale errors preserve the draft', async ({ page }) => {
    await loginModerator(page, `/moderation/items/${ids.variant}`);
    await decide(page, 'approve', 'Материал полностью проверен');
    await expect(page.getByRole('status')).toHaveText('Решение сохранено.');
    await expect(page.getByText('approved', { exact: true })).toBeVisible();
    await decide(page, 'publish', 'Публикация разрешена после проверки');
    await expect(page.getByText('published', { exact: true })).toBeVisible();

    await gotoStable(page, `/moderation/items/${ids.hide}`);
    await decide(page, 'hide', 'Материал скрыт по результатам проверки');
    await expect(page.getByText('hide', { exact: true })).toBeVisible();
    await gotoStable(page, `/moderation/items/${ids.unpublish}`);
    await decide(page, 'unpublish', 'Публикация снята по результатам проверки');
    await expect(page.getByText('unpublish', { exact: true })).toBeVisible();

    await gotoStable(page, `/moderation/items/${ids.other}`);
    await expect(page.getByRole('heading', { name: 'Эта очередь недоступна по вашим правам.' })).toBeVisible();
    await gotoStable(page, '/moderation/items/00000000-0000-4000-8000-000000000099');
    await expect(page.getByRole('heading', { name: 'Не удалось загрузить данные.' })).toBeVisible();

    await gotoStable(page, '/moderation/queues/recipes?priority=normal');
    const rejectedRecipe = page.locator('article').filter({ hasText: 'Салат с печёной свёклой' });
    await rejectedRecipe.getByRole('button', { name: 'Взять в работу' }).click();
    await rejectedRecipe.getByRole('link', { name: 'Открыть' }).click();
    await expect(page).toHaveURL(`/moderation/items/${ids.extraRecipe}`);
    await page.getByLabel('Действие *').selectOption('reject');
    await page.getByLabel('Категория причины *').selectOption('quality');
    await page.getByLabel('Обоснование *').fill('Черновик сохраняется при конфликте версии');
    await page.getByRole('button', { name: 'Проверить решение' }).click();
    await setFailure(page, `/api/v1/moderator/items/${ids.extraRecipe}/decision`, 'POST', 412);
    await page.getByRole('button', { name: 'Подтвердить' }).click();
    await expect(page.getByRole('status')).toContainText('Запись изменена');
    await expect(page.getByLabel('Обоснование *')).toHaveValue('Черновик сохраняется при конфликте версии');
    await page.getByRole('button', { name: 'Подтвердить' }).click();
    await expect(page.getByText('rejected', { exact: true })).toBeVisible();
});

test('recoverable 503, next-page failure, 429 and crash surfaces keep deterministic recovery', async ({ page }) => {
    await loginModerator(page, '/moderation/queues/recipes');
    await setFailure(page, '/api/v1/moderator/queues/recipes', 'GET', 503);
    await page.getByRole('button', { name: 'Показать ещё' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Уже загруженные материалы сохранены' })).toBeVisible();
    await expect(page.getByText('Тыквенный суп с имбирём')).toBeVisible();
    await page.getByRole('button', { name: 'Повторить загрузку' }).click();
    await expect(page.getByText('Запечённые яблоки', { exact: true })).toBeVisible();

    await setFailure(page, '/api/v1/moderator/overview', 'GET', 500);
    await gotoStable(page, '/moderation');
    await expect(page.getByRole('heading', { name: 'Не удалось загрузить данные.' })).toBeVisible();
    await page.getByRole('button', { name: 'Повторить' }).click();
    await expect(page.getByRole('heading', { name: 'Модерация' })).toBeVisible();

    const statuses = await page.evaluate(async () => {
        const results: number[] = [];
        for (let index = 0; index < 220; index++)
            results.push((await fetch('/api/v1/moderator/overview', { cache: 'no-store' })).status);
        return results;
    });
    expect(statuses).toContain(429);
});
