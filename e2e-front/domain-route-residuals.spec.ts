import { expect, test, type Page } from '@playwright/test';

type Fault = { path: string; method: string; status: number; remaining?: number; crash?: boolean; delayMs?: number };

async function installFaultController(page: Page) {
    await page.addInitScript(() => {
        const nativeFetch = window.fetch.bind(window);
        let persisted: Fault | null = null;
        try {
            persisted = JSON.parse(sessionStorage.getItem('__domainResidualFault') ?? 'null') as Fault | null;
        } catch {
            // about:blank and opaque documents may not expose session storage.
        }
        const state = { fault: persisted };
        Object.defineProperty(window, '__domainResidualFault', { value: state });
        window.fetch = async (input, init) => {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
            const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
            const fault = state.fault;
            if (fault && method === fault.method && url.includes(fault.path) && (fault.remaining ?? 1) > 0) {
                fault.remaining = (fault.remaining ?? 1) - 1;
                sessionStorage.setItem('__domainResidualFault', JSON.stringify(fault));
                if (fault.delayMs) await new Promise((resolve) => setTimeout(resolve, fault.delayMs));
                if (fault.crash) throw new TypeError('Simulated network crash');
                return new Response(
                    JSON.stringify({
                        error: {
                            code:
                                fault.status === 401
                                    ? 'UNAUTHENTICATED'
                                    : fault.status === 403
                                      ? 'FORBIDDEN'
                                      : fault.status === 404
                                        ? 'NOT_FOUND'
                                        : fault.status === 409
                                          ? 'CONFLICT'
                                          : fault.status === 412
                                            ? 'PRECONDITION_FAILED'
                                            : fault.status === 429
                                              ? 'RATE_LIMITED'
                                              : 'SERVICE_UNAVAILABLE',
                            message: `Проверочная ошибка ${fault.status}`,
                            details: null,
                        },
                        meta: { requestId: crypto.randomUUID() },
                    }),
                    { status: fault.status, headers: { 'content-type': 'application/json' } },
                );
            }
            return nativeFetch(input, init);
        };
    });
}

async function setFault(page: Page, fault: Fault | null) {
    await page.evaluate((value) => {
        (
            window as typeof window & {
                __domainResidualFault: { fault: Fault | null };
            }
        ).__domainResidualFault.fault = value;
        if (value) sessionStorage.setItem('__domainResidualFault', JSON.stringify(value));
        else sessionStorage.removeItem('__domainResidualFault');
    }, fault);
}

async function clearFaultAndRetry(page: Page, retry: ReturnType<Page['getByRole']>) {
    await setFault(page, null);
    try {
        await retry.dispatchEvent('click', undefined, { timeout: 2_000 });
    } catch (error) {
        // React Query can finish an already scheduled retry immediately after the fault is cleared.
        // Only accept that race when the stale recovery control has actually disappeared.
        if (await retry.isVisible().catch(() => false)) throw error;
    }
}

async function reloadExact(page: Page) {
    const before = new URL(page.url());
    let response = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            response = await page.reload({ waitUntil: 'domcontentloaded' });
            break;
        } catch (error) {
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
    expect([200, 304], `${before.pathname}${before.search}: reload document status`).toContain(response?.status());
    await expect(page.getByText('Проверяем сессию', { exact: true })).toHaveCount(0, { timeout: 30_000 });
    const after = new URL(page.url());
    expect(`${after.pathname}${after.search}`, 'reload must preserve path and query').toBe(
        `${before.pathname}${before.search}`,
    );
}

async function ensureServiceWorker(page: Page) {
    await page.evaluate(() => navigator.serviceWorker.ready);
    if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
        await reloadExact(page);
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
    await page.waitForURL((url) => url.pathname === '/', { timeout: 60_000 });
    await expect(page.getByRole('button', { name: 'Войти', exact: true })).toHaveCount(0);
    await expect(page.getByText(/Проверяем сессию/u)).toHaveCount(0, { timeout: 30_000 });
}

async function prewarmRoutes(page: Page, paths: string[]) {
    for (const path of paths) {
        const response = await page.request.get(path);
        expect([200, 304], `${path}: prewarm document status`).toContain(response.status());
    }
}

async function gotoExact(page: Page, path: string) {
    let response = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            response = await page.goto(path, { waitUntil: 'domcontentloaded' });
            break;
        } catch (error) {
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
    expect([200, 304], `${path}: document status`).toContain(response?.status());
    await expect(page.getByText('Проверяем сессию', { exact: true })).toHaveCount(0, { timeout: 30_000 });
    expect(new URL(page.url()).pathname).toBe(new URL(path, 'http://local').pathname);
}

async function fillInventory(page: Page, name: string) {
    await page.getByLabel('Молоко 2,5%', { exact: true }).check();
    await page.getByLabel('Название партии', { exact: true }).fill(name);
    await page.getByRole('combobox', { name: 'Место хранения', exact: true }).selectOption({ index: 1 });
    await page.getByLabel('Количество', { exact: true }).fill('2');
}

test.beforeEach(async ({ page }) => installFaultController(page));

test('family inventory create, history, import and scan keep the family scope through success and recovery', async ({
    page,
}) => {
    test.setTimeout(150_000);
    await prewarmRoutes(page, [
        '/family/inventory/new',
        '/family/inventory/history',
        '/family/inventory/import',
        '/family/inventory/scan',
    ]);
    await login(page, 'plus1@meal-planner.test');
    await gotoExact(page, '/family/inventory/new');
    const name = `Family residual ${test.info().project.name}`;
    await fillInventory(page, name);
    await page.getByRole('button', { name: 'Добавить в запасы', exact: true }).dblclick();
    await page.waitForURL(/\/family\/inventory\/batches\/[a-f0-9-]+$/u, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
    await page.getByText('Другие действия', { exact: true }).click();
    await page.getByRole('button', { name: 'В архив', exact: true }).click();
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).dblclick();
    await expect(page.getByRole('button', { name: 'Восстановить', exact: true }).last()).toBeVisible();
    await reloadExact(page);
    await page.getByRole('button', { name: 'Восстановить', exact: true }).last().click();
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await expect(
        page.getByRole('button', { name: 'Исправить', exact: true }).filter({ visible: true }).last(),
    ).toBeVisible();

    await gotoExact(page, '/family/inventory/history');
    await page.getByLabel('Поиск продукта').fill(name);
    await expect(page.getByRole('button').filter({ hasText: name }).first()).toBeVisible();
    await setFault(page, { path: '/api/v1/inventory-history', method: 'GET', status: 503, remaining: 10 });
    await page.getByLabel('Поиск продукта').fill(`${name} retry`);
    const error = page.getByRole('alert').filter({ hasText: 'Не удалось загрузить данные' }).first();
    await expect(error).toBeVisible();
    await clearFaultAndRetry(page, error.getByRole('button', { name: 'Повторить' }));
    await expect(page.getByText('Событий по этим условиям нет.')).toBeVisible();

    await gotoExact(page, '/family/inventory/import');
    await page.getByLabel('Таблица', { exact: true }).setInputFiles({
        name: 'family.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(
            'Название;Количество;Единица;Срок годности;Место хранения\nМолоко;1;л;2027-10-10;Холодильник\n',
        ),
    });
    await page.getByRole('button', { name: 'Загрузить и проверить', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'family.csv', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'К исправлению строк', exact: true }).click();
    await page.getByLabel('Товар каталога').selectOption({ index: 1 });
    await page.getByLabel('Место хранения').selectOption({ index: 1 });
    await page.getByRole('checkbox', { name: 'Проверил название, совпадение, количество и дату' }).check();
    await page.getByRole('checkbox', { name: 'Добавить выбранные строки только в семейные запасы' }).check();
    await page.getByRole('button', { name: /Добавить \d+ парти/u }).dblclick();
    await expect(page.getByRole('heading', { name: 'Запасы добавлены' })).toBeVisible();

    await gotoExact(page, '/family/inventory/scan');
    await page.getByLabel('Введите штрихкод вручную').fill('4601234567890');
    await page.getByRole('button', { name: 'Найти совпадение и проверить' }).click();
    await expect(page.getByRole('heading', { name: 'Проверка перед добавлением' })).toBeVisible();
    await expect(page.getByText(/семейные запасы/u)).toBeVisible();
});

for (const scope of [
    { route: '/inventory/locations', email: 'user1@meal-planner.test', label: 'личное' },
    { route: '/family/inventory/locations', email: 'plus1@meal-planner.test', label: 'семейное' },
] as const)
    test(`${scope.route} creates a location and preserves rename input after CAS conflict`, async ({ page }) => {
        await prewarmRoutes(page, [scope.route]);
        await login(page, scope.email);
        await gotoExact(page, scope.route);
        const name = `${scope.label} место ${test.info().project.name}`;
        await page.getByLabel('Название', { exact: true }).fill(name);
        await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
        await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Переименовать', exact: true }).click();
        const renamed = `${name} CAS`;
        await page.getByLabel('Название', { exact: true }).fill(renamed);
        await setFault(page, { path: '/api/v1/inventory-locations', method: 'POST', status: 412 });
        await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
        await expect(page.getByLabel('Название', { exact: true })).toHaveValue(renamed);
        await setFault(page, null);
        await page.getByRole('button', { name: 'Обновить сведения, сохранив ввод' }).click();
        await expect(page.getByRole('button', { name: 'Обновить сведения, сохранив ввод' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeEnabled();
        await expect(page.getByLabel('Название', { exact: true })).toHaveValue(renamed);
        await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
        await expect(page.getByRole('heading', { name: renamed, exact: true })).toBeVisible({ timeout: 30_000 });
        await reloadExact(page);
        await expect(page.getByRole('heading', { name: renamed, exact: true })).toBeVisible({ timeout: 30_000 });
    });

test('family meal plan commits one change, survives reload and preserves a stale draft', async ({ page }) => {
    await login(page, 'plus1@meal-planner.test');
    await gotoExact(page, '/family/plan');
    await expect(page.getByRole('heading', { name: 'Семейный план питания', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Добавить', exact: true }).first().click();
    await page.getByLabel('Что планируем').selectOption('outside');
    const note = `Family plan ${test.info().project.name}`;
    await page.getByLabel('Заметка').fill(note);
    await page.getByRole('button', { name: 'Проверить изменения', exact: true }).click();
    await page.getByRole('button', { name: 'Подтвердить изменение', exact: true }).dblclick();
    await expect(page.getByText(note, { exact: true })).toBeVisible();
    await reloadExact(page);
    await expect(page.getByText(note, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Добавить', exact: true }).last().click();
    await page.getByLabel('Что планируем').selectOption('outside');
    await page.getByLabel('Заметка').fill('Family stale draft');
    await setFault(page, { path: '/api/v1/meal-plan/change-preview', method: 'POST', status: 412 });
    await page.getByRole('button', { name: 'Проверить изменения', exact: true }).click();
    await expect(page.getByRole('alert').first()).toBeVisible();
    await expect(page.getByLabel('Заметка')).toHaveValue('Family stale draft');
});

test('family recipes list retries a 503, exposes empty search and keeps archive/restore effects', async ({ page }) => {
    await prewarmRoutes(page, ['/family/recipes/new', '/family/recipes']);
    await login(page, 'plus1@meal-planner.test');
    await gotoExact(page, '/family/recipes/new');
    const title = `Family list residual ${test.info().project.name}`;
    await page.getByLabel('Название', { exact: true }).fill(title);
    await page.getByRole('button', { name: 'Сохранить черновик', exact: true }).dblclick();
    await page.waitForURL(/\/family\/recipes\/[a-f0-9-]+\/edit$/u);
    await gotoExact(page, '/family/recipes');
    await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
    await setFault(page, { path: '/api/v1/recipe-workspace', method: 'GET', status: 503, remaining: 10 });
    await page.getByLabel('Поиск моих рецептов').fill('family-no-match');
    await page.getByRole('button', { name: 'Найти', exact: true }).click();
    const failure = page.locator('main [role="alert"]').first();
    await expect(failure).toBeVisible();
    await clearFaultAndRetry(page, failure.getByRole('button', { name: 'Повторить' }));
    await expect(page.getByText('Рецептов пока нет. Начните с семейного черновика.')).toBeVisible();
    await gotoExact(page, '/family/recipes');
    const card = page.locator('article').filter({ hasText: title });
    await card.getByRole('button', { name: 'Архивировать', exact: true }).dblclick();
    await page.getByRole('link', { name: 'Архив', exact: true }).click();
    await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
    await reloadExact(page);
    await card.getByRole('button', { name: 'Восстановить', exact: true }).click();
    await expect(page.getByRole('link', { name: title, exact: true })).toHaveCount(0);
});

test('family preserve detail applies consume, archive and restore once and survives reload', async ({ page }) => {
    await login(page, 'plus1@meal-planner.test');
    await gotoExact(page, '/family/preserves?create=1');
    const name = `Family preserve residual ${test.info().project.name}`;
    await page.getByLabel('Название', { exact: true }).fill(name);
    await page.getByLabel('Единица количества').selectOption('pcs');
    await page.getByLabel('Количество', { exact: true }).fill('3');
    await page.getByRole('button', { name: 'Сохранить', exact: true }).dblclick();
    await page.waitForURL(/\/family\/preserves\/[a-f0-9-]+$/u);
    await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Использовать', exact: true }).click();
    await page.getByLabel(/Использовать шт/u).fill('1');
    await page.getByRole('button', { name: 'Показать остаток', exact: true }).click();
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).dblclick();
    await expect(page.getByText('2 шт.', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'В архив', exact: true }).click();
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).dblclick();
    await expect(page.getByRole('button', { name: 'Восстановить', exact: true })).toBeVisible({ timeout: 30_000 });
    await reloadExact(page);
    const restore = page.getByRole('button', { name: 'Восстановить', exact: true });
    await expect(restore).toBeVisible({ timeout: 15_000 });
    await restore.click();
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await expect(page.getByText(/Активна/u).first()).toBeVisible();
});

test('personal inventory history exposes filter empty state and recovers from 503', async ({ page }) => {
    await login(page);
    await gotoExact(page, '/inventory/history');
    await setFault(page, { path: '/api/v1/inventory-history', method: 'GET', status: 503, remaining: 10 });
    await page.getByLabel('Поиск продукта').fill('history-residual-missing');
    const failure = page.locator('main [role="alert"]').first();
    await expect(failure).toBeVisible();
    await clearFaultAndRetry(page, failure.getByRole('button', { name: 'Повторить' }));
    await expect(page.getByText('Событий по этим условиям нет.')).toBeVisible();
    await reloadExact(page);
    await expect(page.getByText('Событий по этим условиям нет.')).toBeVisible();
});

test('prepared inventory shows fail-closed empty selection and retries a transient stock failure', async ({ page }) => {
    await prewarmRoutes(page, ['/inventory/prepared?batch=00000000-0000-4000-8000-000000000099']);
    await login(page);
    await gotoExact(page, '/inventory/prepared?batch=00000000-0000-4000-8000-000000000099');
    await expect(page.getByText('Готовых партий пока нет или партия недоступна.')).toBeVisible();
    await setFault(page, {
        path: '/api/v1/cooking-attempts/stock-options',
        method: 'GET',
        status: 503,
        remaining: 10,
    });
    await reloadExact(page);
    const failure = page.locator('main [role="alert"]').first();
    await expect(failure).toBeVisible();
    await clearFaultAndRetry(page, failure.getByRole('button', { name: 'Повторить' }));
    await expect(page.getByText('Готовых партий пока нет или партия недоступна.')).toBeVisible();
});

test('recipe catalog recovers from 503, renders empty search and preserves the query on reload', async ({ page }) => {
    await login(page);
    await gotoExact(page, '/recipes?tab=new');
    await setFault(page, {
        path: '/api/v1/recipes',
        method: 'GET',
        status: 503,
        remaining: 10,
        delayMs: 750,
    });
    await page.getByLabel('Найти рецепт').fill('catalog-residual-missing');
    await page.getByRole('button', { name: 'Найти', exact: true }).click();
    await expect(page.locator('section[aria-busy="true"]')).toBeVisible();
    const failure = page.locator('main [role="alert"]').first();
    await expect(failure).toBeVisible();
    await clearFaultAndRetry(page, failure.getByRole('button', { name: 'Повторить' }));
    await expect(page.getByRole('heading', { name: 'Рецепты не найдены' })).toBeVisible();
    await reloadExact(page);
    await expect(page.getByLabel('Найти рецепт')).toHaveValue('catalog-residual-missing');
    await expect(page.getByRole('heading', { name: 'Рецепты не найдены' })).toBeVisible();
});

test('my recipes retries list failure, preserves empty search and exposes cached recipe offline', async ({ page }) => {
    await prewarmRoutes(page, [
        '/recipes/mine',
        '/recipes/new',
        '/recipes/70000000-0000-4000-8000-000000000001',
        '/recipes/offline',
    ]);
    await login(page);
    await gotoExact(page, '/recipes/mine');
    await setFault(page, { path: '/api/v1/recipe-workspace', method: 'GET', status: 503, remaining: 10 });
    await page.getByLabel('Поиск моих рецептов').fill('mine-residual-missing');
    await page.getByRole('button', { name: 'Найти', exact: true }).click();
    const failure = page.locator('main [role="alert"]').first();
    await expect(failure).toBeVisible();
    await clearFaultAndRetry(page, failure.getByRole('button', { name: 'Повторить' }));
    await expect(page.getByText('Рецептов пока нет. Начните с личного черновика.')).toBeVisible();

    await gotoExact(page, '/recipes/new');
    const draft = `Mine replay residual ${test.info().project.name}`;
    await page.getByLabel('Название', { exact: true }).fill(draft);
    await page.getByRole('button', { name: 'Сохранить черновик', exact: true }).click();
    await page.waitForURL(/\/recipes\/[a-f0-9-]+\/edit$/u);
    await gotoExact(page, '/recipes/mine');
    const card = page.locator('article').filter({ hasText: draft });
    const archiveHref = await page.getByRole('link', { name: 'Архив', exact: true }).getAttribute('href');
    expect(archiveHref).toBe('/recipes/mine?status=archived&page=1');
    await setFault(page, { path: '/archive', method: 'POST', status: 503, crash: true });
    await card.getByRole('button', { name: 'Архивировать', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Повторить незавершённую команду' })).toBeVisible();
    await setFault(page, null);
    await page.getByRole('button', { name: 'Повторить незавершённую команду' }).dblclick();
    await expect(page.getByRole('status').filter({ hasText: 'Изменения сохранены.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Повторить незавершённую команду' })).toHaveCount(0);
    await gotoExact(page, archiveHref!);
    await expect(page.getByRole('link', { name: draft, exact: true })).toBeVisible();

    await gotoExact(page, '/recipes/70000000-0000-4000-8000-000000000001');
    const title = await page.getByRole('heading', { level: 1 }).textContent();
    expect(title).toBeTruthy();
    await expect
        .poll(() => page.evaluate(() => localStorage.getItem('meal-planner-recipes-read-v1')), { timeout: 10_000 })
        .toContain(title!);
    await gotoExact(page, '/recipes/offline');
    await expect(page.getByRole('heading', { name: title!, exact: true })).toBeVisible();
    await reloadExact(page);
    await expect(page.getByRole('heading', { name: title!, exact: true })).toBeVisible();
});
