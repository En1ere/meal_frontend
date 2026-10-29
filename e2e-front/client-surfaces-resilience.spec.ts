import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const user1Id = '10000000-0000-4000-8000-000000000007';

test.use({ timezoneId: 'Europe/Berlin' });

async function installFaultHarness(page: Page) {
    await page.addInitScript(() => {
        const nativeFetch = window.fetch.bind(window);
        const state = window as typeof window & {
            __clientSurfaceFaults?: Record<string, { status: number; remaining: number }>;
            __proposalKeys?: string[];
        };
        let persisted: Record<string, { status: number; remaining: number }> = {};
        try {
            persisted = JSON.parse(sessionStorage.getItem('__clientSurfaceFaults') ?? '{}') as Record<string, number>;
        } catch {
            // about:blank may not expose storage; the application document will.
        }
        state.__clientSurfaceFaults ??= persisted;
        window.fetch = async (input, init) => {
            const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
            if (url.pathname === '/api/v1/products/proposals') {
                const rawBody = input instanceof Request ? await input.clone().text() : String(init?.body ?? '');
                const key = (JSON.parse(rawBody) as { idempotencyKey?: string }).idempotencyKey;
                if (key) (state.__proposalKeys ??= []).push(key);
            }
            const fault = state.__clientSurfaceFaults?.[url.pathname];
            if (fault && fault.remaining > 0) {
                fault.remaining--;
                sessionStorage.setItem('__clientSurfaceFaults', JSON.stringify(state.__clientSurfaceFaults));
                return new Response(
                    JSON.stringify({
                        error: { code: 'TEST_FAILURE', message: 'Временная ошибка проверки', details: null },
                        meta: { requestId: crypto.randomUUID() },
                    }),
                    { status: fault.status, headers: { 'content-type': 'application/json' } },
                );
            }
            return nativeFetch(input, init);
        };
    });
}

async function failNext(page: Page, path: string, status = 503, remaining = 1) {
    await page.evaluate(
        ({ failedPath, responseStatus, attempts }) => {
            const state = window as typeof window & {
                __clientSurfaceFaults?: Record<string, { status: number; remaining: number }>;
            };
            state.__clientSurfaceFaults ??= {};
            state.__clientSurfaceFaults[failedPath] = { status: responseStatus, remaining: attempts };
            sessionStorage.setItem('__clientSurfaceFaults', JSON.stringify(state.__clientSurfaceFaults));
        },
        { failedPath: path, responseStatus: status, attempts: remaining },
    );
}

async function restoreEndpoint(page: Page, path: string) {
    await page.evaluate((restoredPath) => {
        const state = window as typeof window & {
            __clientSurfaceFaults?: Record<string, { status: number; remaining: number }>;
        };
        delete state.__clientSurfaceFaults?.[restoredPath];
        sessionStorage.setItem('__clientSurfaceFaults', JSON.stringify(state.__clientSurfaceFaults ?? {}));
    }, path);
}

test.beforeEach(async ({ page }) => installFaultHarness(page));

async function ensureServiceWorker(page: Page) {
    await expect
        .poll(() => page.evaluate(async () => Boolean(await navigator.serviceWorker.ready)).catch(() => false), {
            timeout: 30_000,
        })
        .toBe(true);
    if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
        await page.reload({ waitUntil: 'domcontentloaded' }).catch((error: unknown) => {
            if (
                !(error instanceof Error) ||
                (!error.message.includes('NS_BINDING_ABORTED') &&
                    !error.message.includes('net::ERR_ABORTED') &&
                    !error.message.includes('is interrupted by another navigation'))
            )
                throw error;
        });
        await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    }
}

async function login(page: Page, email = 'user1@meal-planner.test') {
    await page.goto('/auth');
    await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    await ensureServiceWorker(page);
    await page.getByLabel('Электронная почта', { exact: true }).fill(email);
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 60_000 }).toBe('/');
    await expect(page.getByRole('button', { name: 'Войти', exact: true })).toHaveCount(0);
    await expect(page.getByText(/Проверяем сессию/u)).toHaveCount(0, { timeout: 30_000 });
}

async function logout(page: Page) {
    await gotoExact(page, '/settings/account');
    await page.getByRole('button', { name: 'Выйти', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/auth');
}

async function gotoExact(page: Page, path: string) {
    let response = null;
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            response = await page.goto(path, { waitUntil: 'domcontentloaded' });
            lastError = undefined;
            break;
        } catch (error) {
            lastError = error;
            if (
                attempt === 3 ||
                !(error instanceof Error) ||
                (!error.message.includes('NS_ERROR_FAILURE') &&
                    !error.message.includes('NS_BINDING_ABORTED') &&
                    !error.message.includes('net::ERR_ABORTED') &&
                    !error.message.includes('is interrupted by another navigation'))
            )
                throw error;
            await page.waitForLoadState('domcontentloaded').catch(() => undefined);
        }
    }
    if (lastError) throw lastError;
    expect([200, 304], `${path}: document status`).toContain(response?.status());
    await expect
        .poll(
            async () => {
                const text = await page
                    .locator('main')
                    .innerText()
                    .catch(() => '');
                return text.trim().length > 0 && !text.includes('Проверяем сессию');
            },
            { timeout: 30_000 },
        )
        .toBe(true);
    expect(new URL(page.url()).pathname).toBe(path.split('?')[0]);
}

async function seedOfflineQueue(page: Page) {
    await page.evaluate(
        async ({ owner }) => {
            const database = await new Promise<IDBDatabase>((resolve, reject) => {
                const request = indexedDB.open('meal-planner-offline-v1', 2);
                request.onupgradeneeded = () => {
                    if (!request.result.objectStoreNames.contains('queue'))
                        request.result.createObjectStore('queue', { keyPath: 'queueId' });
                    if (!request.result.objectStoreNames.contains('snapshots'))
                        request.result.createObjectStore('snapshots', { keyPath: 'key' });
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            await new Promise<void>((resolve, reject) => {
                const transaction = database.transaction('queue', 'readwrite');
                const common = {
                    operationType: 'update',
                    entityType: 'recipe',
                    entityId: crypto.randomUUID(),
                    route: 'PUT /api/v1/recipe-workspace/{id}',
                    params: { id: crypto.randomUUID() },
                    body: { title: 'Не потерять локальный черновик' },
                    baseVersion: 1,
                    idempotencyKey: crypto.randomUUID(),
                    dependsOn: [],
                    createdAt: new Date().toISOString(),
                    retryCount: 0,
                    serverRevision: null,
                    nextAttemptAt: null,
                };
                transaction.objectStore('queue').put({
                    ...common,
                    queueId: crypto.randomUUID(),
                    owner,
                    status: 'conflict',
                    lastError: 'Версия изменилась',
                });
                transaction.objectStore('queue').put({
                    ...common,
                    queueId: crypto.randomUUID(),
                    owner: '10000000-0000-4000-8000-000000000008',
                    status: 'failed',
                    lastError: 'Чужая локальная ошибка',
                });
                transaction.oncomplete = () => resolve();
                transaction.onabort = () => reject(transaction.error);
            });
            database.close();
            window.dispatchEvent(new Event('meal-planner-offline-state'));
        },
        { owner: user1Id },
    );
}

async function openSecondAuthenticatedPage(context: BrowserContext) {
    const page = await context.newPage();
    await gotoExact(page, '/settings/subscription');
    await expect(page.getByRole('heading', { name: 'Подписка и квоты' })).toBeVisible();
    return page;
}

test('pricing keeps exact month/year amounts and protected CTAs preserve the selected period', async ({ page }) => {
    await gotoExact(page, '/pricing');
    await expect(page.getByRole('heading', { name: 'Выберите подходящий тариф' })).toBeVisible();
    // Let the freshly compiled client route hydrate before exercising its controlled radios.
    await page.waitForTimeout(1_000);
    await expect(page.getByText(/399\s*₽/u)).toBeVisible();
    await expect(page.getByText(/599\s*₽/u)).toBeVisible();
    await page.getByLabel('Год', { exact: true }).check();
    await expect(page.getByText(/3\s*899\s*₽/u)).toBeVisible();
    await expect(page.getByText(/5\s*899\s*₽/u)).toBeVisible();
    await expect(page.getByText('Экономия 889 ₽ относительно помесячной оплаты')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Посмотреть точную сумму' })).toHaveAttribute(
        'href',
        '/settings/subscription?period=year',
    );
    await page.getByRole('link', { name: 'Посмотреть точную сумму' }).click();
    await page.waitForURL((url) => url.pathname === '/auth');
    expect(new URL(page.url()).searchParams.get('returnTo')).toBe('/settings/subscription?period=year');
});

test('subscription preview preserves the chosen period after 503 and stale tabs require a reviewed retry', async ({
    context,
    page,
}) => {
    await login(page);
    await gotoExact(page, '/settings/subscription?period=year');
    const firefox = test.info().project.name.includes('firefox');
    const second = firefox ? null : await openSecondAuthenticatedPage(context);
    await expect(page.getByLabel('Год', { exact: true })).toBeChecked();

    await failNext(page, '/api/v1/settings/subscription/plan/preview');
    await page.getByRole('button', { name: 'Перейти на Plus' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Данные подписки обновлены' })).toBeVisible();
    await expect(page.getByLabel('Год', { exact: true })).toBeChecked();
    await page.getByRole('button', { name: 'Перейти на Plus' }).click();
    await expect(page.getByRole('heading', { name: 'Подтвердите тестовый переход на Plus' })).toBeVisible();
    await expect(page.getByRole('dialog')).toContainText('Год');
    await page.getByRole('dialog').getByRole('button', { name: 'Подтвердить' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Состояние подписки обновлено' })).toBeVisible();

    const staleSurface = second ?? page;
    if (firefox) await failNext(page, '/api/v1/settings/subscription/plan/preview', 412);
    await staleSurface.getByRole('button', { name: firefox ? 'Перейти сейчас' : 'Перейти на Pro' }).click();
    await expect(staleSurface.getByRole('alert').filter({ hasText: 'Данные подписки обновлены' })).toBeVisible();
    await expect(staleSurface.locator('section[aria-labelledby="current-plan-title"]')).toContainText('Plus');
    await expect(staleSurface.getByRole('button', { name: 'Перейти сейчас' })).toBeVisible();
    await expect(staleSurface.getByRole('dialog')).not.toBeVisible();
    await second?.close();
});

test('Pro overview fails closed on a transient response and recovers explicitly', async ({ page }) => {
    await login(page, 'pro1@meal-planner.test');
    await failNext(page, '/api/v1/pro/overview', 503, 4);
    await gotoExact(page, '/pro');
    const alert = page.getByRole('alert').filter({ hasText: 'Обзор Pro не загрузился' });
    await expect(alert).toBeVisible();
    await restoreEndpoint(page, '/api/v1/pro/overview');
    await alert.getByRole('button', { name: 'Повторить' }).click();
    await expect(page.getByRole('region', { name: 'Статус доступа Pro' })).toContainText('Pro активен');
});

test('offline settings isolate owners, expose conflicts and block destructive clearing until resolution', async ({
    page,
}) => {
    await login(page);
    await seedOfflineQueue(page);
    await gotoExact(page, '/settings/offline');
    await expect(page.getByRole('heading', { name: 'Offline и устройство' })).toBeVisible();
    await expect(page.getByText('Конфликт версий')).toBeVisible();
    await expect(page.getByText('Чужая локальная ошибка')).toHaveCount(0);
    await expect(page.getByText('Очистка заблокирована, пока в очереди остаются операции.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Очистить локальные данные' })).toBeDisabled();
    await page.getByText('Показать сохранённый ввод').click();
    await expect(page.getByText(/Не потерять локальный черновик/u)).toBeVisible();
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Удалить локальное действие' }).click();
    await expect(page.getByText('Локальных действий, ожидающих обработки, нет.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Очистить локальные данные' })).toBeEnabled();
    await page.getByRole('button', { name: 'Очистить локальные данные' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Удалить с устройства' }).click();
    const foreignRows = await page.evaluate(
        () =>
            new Promise<number>((resolve, reject) => {
                const request = indexedDB.open('meal-planner-offline-v1', 2);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const database = request.result;
                    const transaction = database.transaction('queue', 'readonly');
                    const read = transaction.objectStore('queue').getAll();
                    read.onerror = () => reject(read.error);
                    read.onsuccess = () =>
                        resolve(
                            (read.result as Array<{ owner: string }>).filter(
                                (item) => item.owner === '10000000-0000-4000-8000-000000000008',
                            ).length,
                        );
                    transaction.oncomplete = () => database.close();
                };
            }),
    );
    expect(foreignRows).toBe(1);
});

test('product proposal retries one uncertain request idempotently and remains private until moderation', async ({
    page,
}) => {
    await login(page);
    await gotoExact(page, '/products/new');
    await page.getByLabel('Название').fill('Приватный тестовый продукт');
    await page.getByLabel('Категория').selectOption({ label: 'Крупы' });
    await page.getByLabel('Бренд').fill('Тест');
    await failNext(page, '/api/v1/products/proposals');
    await page.getByRole('button', { name: 'Создать и отправить на проверку' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Временная ошибка проверки' })).toBeVisible();
    await expect(page.getByLabel('Название')).toHaveValue('Приватный тестовый продукт');
    await page.getByRole('button', { name: 'Повторить тот же запрос' }).click();
    await page.waitForURL(/\/products\/[0-9a-f-]{36}$/u);
    const privatePath = new URL(page.url()).pathname;
    await expect(page.getByRole('heading', { name: 'Приватный тестовый продукт', level: 1 })).toBeVisible();
    await expect(
        page.getByText(
            'Ваш продукт ожидает проверки модератором. Вы уже можете использовать его в личных запасах; в общий каталог он ещё не опубликован.',
        ),
    ).toBeVisible();
    const keys = await page.evaluate(
        () => (window as typeof window & { __proposalKeys?: string[] }).__proposalKeys ?? [],
    );
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);

    await logout(page);
    await login(page, 'user2@meal-planner.test');
    await gotoExact(page, privatePath);
    await expect(page.getByRole('heading', { name: 'Запись недоступна' })).toBeVisible();
});

test('public achievements recover from 503, keep accessible filters and expose only the public projection', async ({
    page,
}) => {
    await gotoExact(page, '/authors/pro1/achievements');
    await expect(page.getByRole('heading', { name: 'Достижения', exact: true })).toBeVisible({ timeout: 60_000 });
    await gotoExact(page, '/about');
    await failNext(page, '/api/v1/authors/pro1/achievements', 503, 4);
    await gotoExact(page, '/authors/pro1/achievements');
    const alert = page.getByRole('alert').filter({ hasText: 'Не удалось загрузить данные' });
    await expect(alert).toBeVisible({ timeout: 30_000 });
    await restoreEndpoint(page, '/api/v1/authors/pro1/achievements');
    await alert.getByRole('button', { name: 'Повторить' }).click();
    await expect(page.getByRole('heading', { name: 'Достижения', exact: true })).toBeVisible();
    const categories = page.locator('[aria-label="Категории достижений"]');
    await expect(categories.getByRole('button', { name: 'Все', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const category = categories.getByRole('button').nth(1);
    await category.click();
    await expect(category).toHaveAttribute('aria-pressed', 'true');
    await page.getByLabel('Порядок').selectOption('newest');
    await expect(page.getByText(/@pro1/u).first()).toBeVisible();
    await expect(page.getByText(/pro1@meal-planner\.test/u)).toHaveCount(0);
    await page.getByRole('link', { name: 'Репутация', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Репутация', exact: true })).toBeVisible({ timeout: 30_000 });
    await gotoExact(page, '/authors/no-such-author/achievements');
    await expect(page.getByRole('heading', { name: 'Профиль недоступен' })).toBeVisible();
});

test('community filters are URL-backed, reload-safe and recover from an initial 503 without a crash', async ({
    page,
}) => {
    await gotoExact(page, '/community');
    await expect(page.getByRole('heading', { name: 'Сообщество рецептов' })).toBeVisible();
    await failNext(page, '/api/v1/community', 503, 4);
    await page.getByRole('link', { name: 'Супы', exact: true }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'Не удалось загрузить рецепты' });
    await expect(alert).toBeVisible();
    await restoreEndpoint(page, '/api/v1/community');
    const retry = alert.getByRole('button', { name: 'Повторить' });
    if (await retry.isVisible().catch(() => false)) await retry.click();
    await expect(page.getByRole('heading', { name: 'Сообщество рецептов' })).toBeVisible();
    await expect(alert).toHaveCount(0);
    await expect(page.locator('article').first()).toBeVisible();
    await gotoExact(page, '/community');
    await page.getByPlaceholder('Название или описание рецепта').fill('паста');
    await page.getByText('Дополнительные фильтры').click();
    await page.getByLabel('Категория').selectOption('mains');
    await page.getByLabel('Автор').fill('pro1');
    await page.getByLabel('Порядок').selectOption('oldest');
    await page.getByRole('button', { name: 'Найти' }).click();
    await page.waitForURL(
        (url) =>
            url.pathname === '/community' &&
            url.searchParams.get('q') === 'паста' &&
            url.searchParams.get('category') === 'mains' &&
            url.searchParams.get('author') === 'pro1' &&
            url.searchParams.get('sort') === 'oldest',
    );
    await page.reload();
    await expect(page.getByPlaceholder('Название или описание рецепта')).toHaveValue('паста');
    await page.getByText('Дополнительные фильтры').click();
    await expect(page.getByLabel('Категория')).toHaveValue('mains');
    await expect(page.getByLabel('Автор')).toHaveValue('pro1');
    await expect(page.getByLabel('Порядок')).toHaveValue('oldest');
});
