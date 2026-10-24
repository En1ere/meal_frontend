import { expect, test, type Page } from '@playwright/test';

test.use({ timezoneId: 'Europe/Berlin' });

async function installFaultHarness(page: Page) {
    await page.addInitScript(() => {
        const nativeFetch = window.fetch.bind(window);
        const state = window as typeof window & {
            __residualRouteFaults?: Record<string, { status: number; remaining: number }>;
            __residualNewsFixture?: { mode: 'empty' | 'paginated'; nextFailures: number };
        };
        let persisted: NonNullable<typeof state.__residualRouteFaults> = {};
        try {
            persisted = JSON.parse(sessionStorage.getItem('__residualRouteFaults') ?? '{}') as typeof persisted;
        } catch {
            // about:blank may not expose storage; the application document will.
        }
        state.__residualRouteFaults ??= persisted;
        try {
            const newsFixture = sessionStorage.getItem('__residualNewsFixture');
            if (newsFixture)
                state.__residualNewsFixture = JSON.parse(newsFixture) as typeof state.__residualNewsFixture;
        } catch {
            // about:blank may not expose storage; the application document will.
        }
        window.fetch = async (input, init) => {
            const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
            const fault = state.__residualRouteFaults?.[url.pathname];
            if (fault && fault.remaining > 0) {
                fault.remaining--;
                sessionStorage.setItem('__residualRouteFaults', JSON.stringify(state.__residualRouteFaults));
                return new Response(
                    JSON.stringify({
                        error: { code: 'TEST_FAILURE', message: 'Временная ошибка проверки', details: null },
                        meta: { requestId: crypto.randomUUID() },
                    }),
                    { status: fault.status, headers: { 'content-type': 'application/json' } },
                );
            }
            const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
            const fixture = state.__residualNewsFixture;
            if (method === 'GET' && url.pathname === '/api/v1/news' && fixture) {
                const cursor = url.searchParams.get('cursor');
                if (fixture.mode === 'empty') {
                    return Response.json({
                        data: { items: [], nextCursor: null },
                        meta: { requestId: crypto.randomUUID() },
                    });
                }
                if (!cursor) {
                    return Response.json({
                        data: {
                            items: [
                                {
                                    id: '73000000-0000-4000-8000-000000000003',
                                    type: 'article',
                                    title: 'Первая тестовая новость',
                                    publishedAt: '2026-10-03T00:00:00.000Z',
                                    coverImage: null,
                                    pageCount: 1,
                                },
                            ],
                            nextCursor: 'residual-page-2',
                        },
                        meta: { requestId: crypto.randomUUID() },
                    });
                }
                if (cursor === 'residual-page-2' && fixture.nextFailures > 0) {
                    fixture.nextFailures--;
                    sessionStorage.setItem('__residualNewsFixture', JSON.stringify(fixture));
                    return Response.json(
                        {
                            error: { code: 'TEST_FAILURE', message: 'Временная ошибка проверки', details: null },
                            meta: { requestId: crypto.randomUUID() },
                        },
                        { status: 503 },
                    );
                }
                if (cursor === 'residual-page-2') {
                    return Response.json({
                        data: {
                            items: [
                                {
                                    id: '73000000-0000-4000-8000-000000000004',
                                    type: 'article',
                                    title: 'Вторая тестовая новость',
                                    publishedAt: '2026-10-02T00:00:00.000Z',
                                    coverImage: null,
                                    pageCount: 1,
                                },
                            ],
                            nextCursor: null,
                        },
                        meta: { requestId: crypto.randomUUID() },
                    });
                }
            }
            return nativeFetch(input, init);
        };
    });
}

async function failNext(page: Page, path: string, remaining = 1) {
    await page.evaluate(
        ({ failedPath, attempts }) => {
            const state = window as typeof window & {
                __residualRouteFaults?: Record<string, { status: number; remaining: number }>;
            };
            state.__residualRouteFaults ??= {};
            state.__residualRouteFaults[failedPath] = { status: 503, remaining: attempts };
            sessionStorage.setItem('__residualRouteFaults', JSON.stringify(state.__residualRouteFaults));
        },
        { failedPath: path, attempts: remaining },
    );
}

async function restoreEndpoint(page: Page, path: string) {
    await page.evaluate((restoredPath) => {
        const state = window as typeof window & {
            __residualRouteFaults?: Record<string, { status: number; remaining: number }>;
        };
        delete state.__residualRouteFaults?.[restoredPath];
        sessionStorage.setItem('__residualRouteFaults', JSON.stringify(state.__residualRouteFaults ?? {}));
    }, path);
}

async function setNewsFixture(page: Page, mode: 'empty' | 'paginated', nextFailures = 0) {
    await page.evaluate(
        ({ fixtureMode, failures }) => {
            const state = window as typeof window & {
                __residualNewsFixture?: { mode: 'empty' | 'paginated'; nextFailures: number };
            };
            state.__residualNewsFixture = { mode: fixtureMode, nextFailures: failures };
            sessionStorage.setItem('__residualNewsFixture', JSON.stringify(state.__residualNewsFixture));
        },
        { fixtureMode: mode, failures: nextFailures },
    );
}

async function recoverNextNewsPage(page: Page) {
    await page.evaluate(() => {
        const state = window as typeof window & {
            __residualNewsFixture?: { mode: 'empty' | 'paginated'; nextFailures: number };
        };
        if (!state.__residualNewsFixture) throw new Error('News fixture is not installed');
        state.__residualNewsFixture.nextFailures = 0;
        sessionStorage.setItem('__residualNewsFixture', JSON.stringify(state.__residualNewsFixture));
    });
}

async function ensureServiceWorker(page: Page) {
    await page.evaluate(() => navigator.serviceWorker.ready);
    if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) await page.reload();
}

async function gotoExact(page: Page, path: string) {
    let response: Awaited<ReturnType<Page['goto']>> = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            response = await page.goto(path, { waitUntil: 'domcontentloaded' });
            break;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (
                attempt === 2 ||
                (!message.includes('NS_ERROR_FAILURE') &&
                    !message.includes('NS_BINDING_ABORTED') &&
                    !message.includes('ERR_ABORTED') &&
                    !message.includes('is interrupted by another navigation'))
            ) {
                throw error;
            }
        }
    }
    expect([200, 304], `${path}: document status`).toContain(response?.status());
    const checkingSession = page.getByText('Проверяем сессию', { exact: true });
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const ready = await expect(checkingSession)
            .toHaveCount(0, { timeout: 30_000 })
            .then(
                async () => {
                    // A fresh Next dev server may finish an on-demand route compilation with one Fast Refresh reload.
                    await page.waitForTimeout(2_000);
                    return (await checkingSession.count()) === 0;
                },
                () => false,
            );
        if (ready) break;
        await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
    }
    await expect(checkingSession).toHaveCount(0, { timeout: 30_000 });
    expect(new URL(page.url()).pathname).toBe(new URL(path, 'http://local').pathname);
}

async function openAuth(page: Page, returnTo?: string) {
    await gotoExact(page, returnTo ? `/auth?returnTo=${encodeURIComponent(returnTo)}` : '/auth');
    await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    await ensureServiceWorker(page);
}

async function submitLogin(page: Page, email = 'user1@meal-planner.test') {
    await page.getByLabel('Электронная почта', { exact: true }).fill(email);
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
}

async function login(page: Page, email = 'user1@meal-planner.test') {
    await openAuth(page);
    await submitLogin(page, email);
    await page.waitForURL((url) => url.pathname === '/', { timeout: 60_000 });
}

test.beforeEach(async ({ page }) => installFaultHarness(page));

test('sign-in preserves identity after 503 and retries into a safe returnTo', async ({ page }) => {
    await openAuth(page, '/settings');
    await failNext(page, '/api/v1/auth/login');
    await submitLogin(page);
    await expect(page.getByRole('alert').filter({ hasText: 'Временная ошибка проверки' })).toBeVisible();
    await expect(page.getByLabel('Электронная почта', { exact: true })).toHaveValue('user1@meal-planner.test');
    await expect(page.getByLabel('Пароль', { exact: true })).toHaveValue('');
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/settings');
    await expect(page.getByRole('heading', { name: 'Настройки', exact: true })).toBeVisible();
});

test('home recovers explicitly while a failed recommendation source stays partial', async ({ page }) => {
    await openAuth(page);
    await failNext(page, '/api/v1/home', 4);
    await submitLogin(page);
    await page.waitForURL((url) => url.pathname === '/');
    const homeError = page.getByRole('alert').filter({ hasText: 'Главная не загрузилась' });
    await expect(homeError).toBeVisible();
    await restoreEndpoint(page, '/api/v1/home');
    await homeError.getByRole('button', { name: 'Повторить' }).click();
    await expect(page.getByRole('heading', { name: 'Быстрые действия' })).toBeVisible();

    await failNext(page, '/api/v1/recommendations', 4);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Быстрые действия' })).toBeVisible();
    await expect(
        page.getByRole('alert').filter({ hasText: 'Персональная подборка временно недоступна' }),
    ).toBeVisible();

    await restoreEndpoint(page, '/api/v1/recommendations');
    await page.reload();
    const recommendation = page
        .locator('article')
        .filter({ has: page.locator('[aria-label="Настроить рекомендации"]') })
        .first();
    const recommendationHref = await recommendation.getByRole('link').getAttribute('href');
    expect(recommendationHref).not.toBeNull();
    expect(recommendationHref).toMatch(/^\/recipes\/[0-9a-f-]{36}$/u);
    await recommendation.getByRole('button', { name: 'Не интересно' }).click();
    const dismissedRecommendation = page.locator(`a[href="${recommendationHref!}"]`);
    await expect(dismissedRecommendation).toHaveCount(0);
    await page.reload();
    await expect(dismissedRecommendation).toHaveCount(0);
});

test('public about and help controls expose safe destinations, filters and an empty state', async ({ page }) => {
    await gotoExact(page, '/about');
    await expect(page.getByRole('heading', { name: 'Знайте, что есть дома. Решайте, что приготовить.' })).toBeVisible();
    await expect(page.locator('#main').getByRole('link', { name: 'Создать аккаунт' })).toHaveAttribute(
        'href',
        '/auth/sign-up',
    );
    await expect(page.getByRole('link', { name: 'Сравнить тарифы →' })).toHaveAttribute('href', '/pricing');
    await expect(page.getByRole('region', { name: 'Дополнительные возможности' })).toBeVisible();

    await gotoExact(page, '/help');
    await page.getByRole('button', { name: 'AI-помощник', exact: true }).click();
    await expect(page.getByRole('button', { name: 'AI-помощник', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
    );
    await expect(page.getByText('Сколько AI-действий доступно')).toBeVisible();
    await page.getByLabel('Поиск по справке').fill('запрос без совпадений');
    await expect(page.getByRole('status').filter({ hasText: 'Ничего не нашли' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Войти и обратиться' })).toHaveAttribute(
        'href',
        '/auth?returnTo=%2Fsupport%2Fnew',
    );
});

test('own achievements and reputation recover independently and keep accessible filters', async ({ page }) => {
    await login(page);
    await failNext(page, '/api/v1/authors/user1/achievements', 4);
    await gotoExact(page, '/achievements');
    const achievementsError = page.getByRole('alert').filter({ hasText: 'Не удалось загрузить данные' });
    await expect(achievementsError).toBeVisible();
    await restoreEndpoint(page, '/api/v1/authors/user1/achievements');
    await achievementsError.getByRole('button', { name: 'Повторить' }).click();
    const categories = page.locator('[aria-label="Категории достижений"]');
    await expect(categories.getByRole('button', { name: 'Все', exact: true })).toHaveAttribute('aria-pressed', 'true');

    await failNext(page, '/api/v1/authors/user1/reputation', 4);
    await gotoExact(page, '/reputation');
    const reputationError = page.getByRole('alert').filter({ hasText: 'Не удалось загрузить данные' });
    await expect(reputationError).toBeVisible();
    await restoreEndpoint(page, '/api/v1/authors/user1/reputation');
    await reputationError.getByRole('button', { name: 'Повторить' }).click();
    await expect(page.getByRole('heading', { name: 'Репутация', exact: true })).toBeVisible();
});

test('news renders empty state and preserves the first page across a recoverable next-page failure', async ({
    page,
}) => {
    await gotoExact(page, '/about');
    await setNewsFixture(page, 'empty');
    await gotoExact(page, '/news');
    await expect(page.getByText('Опубликованных новостей пока нет.')).toBeVisible();

    await setNewsFixture(page, 'paginated', 4);
    await page.reload();
    const firstPageItem = page.getByRole('link', { name: 'Первая тестовая новость' });
    await expect(firstPageItem).toBeVisible();
    await page.getByRole('button', { name: 'Показать ещё' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Следующая часть не загрузилась' })).toBeVisible();
    await expect(firstPageItem).toBeVisible();

    await recoverNextNewsPage(page);
    await page.getByRole('button', { name: 'Показать ещё' }).click();
    await expect(page.getByRole('link', { name: 'Вторая тестовая новость' })).toBeVisible();
    await expect(firstPageItem).toHaveCount(1);
});

test('settings hub exposes every covered destination without hidden or broken controls', async ({ page }) => {
    await login(page);
    await gotoExact(page, '/settings');
    const destinations = [
        ['/settings/preferences', 'Питание'],
        ['/settings/account', 'Аккаунт'],
        ['/settings/offline', 'Offline'],
        ['/settings/privacy', 'Документы и согласия'],
        ['/settings/notifications', 'Уведомления'],
        ['/settings/subscription', 'Подписка и квоты'],
        ['/support', 'Поддержка'],
        ['/exports', 'Экспорт'],
        ['/settings/account/lifecycle', 'Управление аккаунтом'],
    ] as const;
    const settingsMain = page.locator('#main');
    for (const [href, name] of destinations) {
        await expect(settingsMain.getByRole('link', { name: new RegExp(`^${name}`, 'u') })).toHaveAttribute(
            'href',
            href,
        );
    }
});
