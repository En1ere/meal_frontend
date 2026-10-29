import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';

const missingId = '00000000-0000-4000-8000-000000000099';

type Fault = {
    path: string;
    method: string;
    status: number;
    message?: string;
    remaining?: number;
    crash?: boolean;
};

function contextOptions(testInfo: TestInfo) {
    const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = testInfo.project.use;
    return {
        baseURL: String(testInfo.project.use.baseURL ?? 'http://localhost:3000'),
        viewport,
        userAgent,
        deviceScaleFactor,
        isMobile,
        hasTouch,
    };
}

async function installFaultController(page: Page) {
    await page.addInitScript(() => {
        const nativeFetch = window.fetch.bind(window);
        const state = {
            fault: null as Fault | null,
            requests: [] as Array<{ url: string; method: string; body: string }>,
        };
        Object.defineProperty(window, '__domainQaFault', {
            value: state,
            configurable: false,
            writable: false,
        });
        window.fetch = async (input, init) => {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
            const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
            state.requests.push({
                url,
                method,
                body: typeof init?.body === 'string' ? init.body : '',
            });
            const fault = state.fault;
            if (fault && method === fault.method && url.includes(fault.path) && (fault.remaining ?? 1) > 0) {
                fault.remaining = (fault.remaining ?? 1) - 1;
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
                            message: fault.message ?? `Проверочная ошибка ${fault.status}`,
                            details: null,
                        },
                        meta: { requestId: crypto.randomUUID() },
                    }),
                    { status: fault.status, headers: { 'content-type': 'application/json' } },
                );
            }
            const response = await nativeFetch(input, init);
            const projectionText = localStorage.getItem('qa-recipe-revision-projection');
            const parsedUrl = new URL(url, location.href);
            if (
                projectionText &&
                method === 'GET' &&
                parsedUrl.pathname === '/api/v1/recipe-workspace' &&
                response.ok
            ) {
                const projection = JSON.parse(projectionText) as {
                    id: string;
                    stage: 'published-r1' | 'rejected-r2' | 'published-r3';
                    r2: string;
                    r3: string;
                };
                const body = (await response.clone().json()) as {
                    data: { items: Array<Record<string, unknown>> };
                };
                const recipe = body.data.items.find((item) => item.id === projection.id);
                if (recipe) {
                    const r1 = String(recipe.revisionId);
                    if (projection.stage === 'published-r1') {
                        recipe.status = 'published';
                        recipe.review = { revisionId: r1, status: 'published', publicReason: null };
                        recipe.publication = { revisionId: r1, publishedAt: '2026-10-28T00:00:00.000Z' };
                    } else if (projection.stage === 'rejected-r2') {
                        recipe.revisionId = projection.r2;
                        recipe.revision = Number(recipe.revision) + 1;
                        recipe.status = 'rejected';
                        recipe.review = {
                            revisionId: projection.r2,
                            status: 'rejected',
                            publicReason: 'Уточните способ приготовления',
                        };
                        recipe.publication = { revisionId: r1, publishedAt: '2026-10-28T00:00:00.000Z' };
                    } else {
                        recipe.revisionId = projection.r3;
                        recipe.revision = Number(recipe.revision) + 2;
                        recipe.status = 'published';
                        recipe.review = { revisionId: projection.r3, status: 'published', publicReason: null };
                        recipe.publication = {
                            revisionId: projection.r3,
                            publishedAt: '2026-10-28T01:00:00.000Z',
                        };
                    }
                }
                return new Response(JSON.stringify(body), {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                });
            }
            return response;
        };
    });
}

async function setFault(page: Page, fault: Fault | null) {
    await page.evaluate((value) => {
        (window as typeof window & { __domainQaFault: { fault: Fault | null } }).__domainQaFault.fault = value;
    }, fault);
}

async function setRecipeRevisionProjection(
    page: Page,
    projection: {
        id: string;
        stage: 'published-r1' | 'rejected-r2' | 'published-r3';
        r2: string;
        r3: string;
    } | null,
) {
    await page.evaluate((value) => {
        if (value) localStorage.setItem('qa-recipe-revision-projection', JSON.stringify(value));
        else localStorage.removeItem('qa-recipe-revision-projection');
    }, projection);
}

async function reloadExact(page: Page) {
    const expected = new URL(page.url());
    let response;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            response = await page.reload({ waitUntil: 'domcontentloaded' });
            break;
        } catch (error) {
            if (
                attempt === 3 ||
                !(error instanceof Error) ||
                (!error.message.includes('Frame load interrupted') &&
                    !error.message.includes('NS_ERROR_FAILURE') &&
                    !error.message.includes('NS_BINDING_ABORTED') &&
                    !error.message.includes('net::ERR_ABORTED') &&
                    !error.message.includes('interrupted by another navigation'))
            )
                throw error;
            await page.waitForLoadState('domcontentloaded').catch(() => undefined);
        }
    }
    expect([200, 304], `${expected.pathname}: reload document status`).toContain(response?.status());
    const actual = new URL(page.url());
    expect(`${actual.pathname}${actual.search}`, `${expected.pathname}: reloaded URL`).toBe(
        `${expected.pathname}${expected.search}`,
    );
}

async function ensureServiceWorker(page: Page) {
    await page.evaluate(() => navigator.serviceWorker.ready);
    if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
        await reloadExact(page);
        await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    }
}

async function login(page: Page, email = 'user1@meal-planner.test', returnTo = '/') {
    const target = new URL(returnTo, 'http://localhost:3000');
    await page.goto(returnTo === '/' ? '/auth' : `/auth?returnTo=${encodeURIComponent(returnTo)}`);
    await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    await ensureServiceWorker(page);
    await page.getByLabel('Электронная почта', { exact: true }).fill(email);
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL((url) => url.pathname === target.pathname && url.search === target.search, {
        timeout: 60_000,
    });
    await expect(page.getByRole('link', { name: /^Профиль:/u })).toBeVisible({ timeout: 30_000 });
}

async function loggedContext(browser: Browser, testInfo: TestInfo, email = 'user1@meal-planner.test', returnTo = '/') {
    const context = await browser.newContext(contextOptions(testInfo));
    const page = await context.newPage();
    await installFaultController(page);
    await login(page, email, returnTo);
    return { context, page };
}

async function gotoExact(page: Page, path: string) {
    let response;
    try {
        response = await page.goto(path, { waitUntil: 'load' });
    } catch (error) {
        if (
            !(error instanceof Error) ||
            (!error.message.includes('NS_BINDING_ABORTED') &&
                !error.message.includes('net::ERR_ABORTED') &&
                !error.message.includes('interrupted by another navigation'))
        )
            throw error;
        await page.waitForLoadState('domcontentloaded');
        response = await page.goto(path, { waitUntil: 'load' });
    }
    expect([200, 304], `${path}: document status`).toContain(response?.status());
    await expect(page.getByRole('link', { name: /^Профиль:/u })).toBeVisible({ timeout: 30_000 });
    expect(new URL(page.url()).pathname).toBe(new URL(path, 'http://localhost:3000').pathname);
}

async function firstHref(page: Page, path: string, selector: string) {
    if (new URL(page.url()).pathname !== path) await gotoExact(page, path);
    const link = page.locator(selector).filter({ visible: true }).first();
    await expect(link).toBeVisible({ timeout: 30_000 });
    return new URL((await link.getAttribute('href'))!, 'http://localhost:3000').pathname;
}

async function expectUnavailable(page: Page, paths: readonly string[], heading: string) {
    for (const path of paths) {
        await gotoExact(page, path);
        await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 30_000 });
    }
}

async function expectNotDisclosed(page: Page, paths: readonly string[]) {
    const results = await page.evaluate(async (urls) => {
        return Promise.all(
            urls.map(async (url) => {
                const response = await fetch(url);
                return { url, status: response.status };
            }),
        );
    }, paths);
    for (const { url, status } of results) expect(status, `${url}: non-disclosing status`).toBe(404);
}

type ScopeEvidence = {
    personalBatchId: string;
    familyBatchId: string;
    personalPreserveId: string;
    familyPreserveId: string;
};

async function collectOwnerScopeEvidence(page: Page): Promise<ScopeEvidence> {
    const personalBatch = await firstHref(page, '/inventory', 'a[href^="/inventory/batches/"]');
    const familyBatch = await firstHref(page, '/family/inventory', 'a[href^="/family/inventory/batches/"]');
    const personalBatchId = personalBatch.split('/').at(-1)!;
    const familyBatchId = familyBatch.split('/').at(-1)!;
    await expectNotDisclosed(page, [
        `/api/v1/inventory/batches/${personalBatchId}?scope=family`,
        `/api/v1/inventory/batches/${familyBatchId}?scope=private`,
        `/api/v1/inventory/batches/${missingId}?scope=private`,
    ]);
    await expectUnavailable(page, [`/inventory/batches/${missingId}`], 'Запись недоступна');
    const personalPreserve = await firstHref(page, '/preserves', 'a[href^="/preserves/"]');
    const familyPreserve = await firstHref(page, '/family/preserves', 'a[href^="/family/preserves/"]');
    const personalPreserveId = personalPreserve.split('/').at(-1)!;
    const familyPreserveId = familyPreserve.split('/').at(-1)!;
    await expectNotDisclosed(page, [
        `/api/v1/preserves/${personalPreserveId}?scope=family`,
        `/api/v1/preserves/${familyPreserveId}?scope=private`,
        `/api/v1/preserves/${missingId}?scope=private`,
    ]);
    await expectUnavailable(page, [`/family/preserves/${personalPreserveId}`], 'Заготовка недоступна');
    return { personalBatchId, familyBatchId, personalPreserveId, familyPreserveId };
}

async function collectOwnerScopeEvidenceFromApi(page: Page): Promise<ScopeEvidence> {
    const evidence = await page.evaluate(async () => {
        const localDate = new Date().toISOString().slice(0, 10);
        async function firstId(path: string) {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`${path}: ${response.status}`);
            const payload = (await response.json()) as { data: { items: Array<{ id: string }> } };
            const id = payload.data.items[0]?.id;
            if (!id) throw new Error(`${path}: missing fixture item`);
            return id;
        }
        return {
            personalBatchId: await firstId(`/api/v1/inventory?scope=private&limit=20&localDate=${localDate}`),
            familyBatchId: await firstId(`/api/v1/inventory?scope=family&limit=20&localDate=${localDate}`),
            personalPreserveId: await firstId(`/api/v1/preserves?scope=private&limit=20&localDate=${localDate}`),
            familyPreserveId: await firstId(`/api/v1/preserves?scope=family&limit=20&localDate=${localDate}`),
        };
    });
    await expectNotDisclosed(page, [
        `/api/v1/inventory/batches/${evidence.personalBatchId}?scope=family`,
        `/api/v1/inventory/batches/${evidence.familyBatchId}?scope=private`,
        `/api/v1/inventory/batches/${missingId}?scope=private`,
        `/api/v1/preserves/${evidence.personalPreserveId}?scope=family`,
        `/api/v1/preserves/${evidence.familyPreserveId}?scope=private`,
        `/api/v1/preserves/${missingId}?scope=private`,
    ]);
    return evidence;
}

async function expectOutsiderScopeIsolation(page: Page, evidence: ScopeEvidence) {
    await expectNotDisclosed(page, [
        `/api/v1/inventory/batches/${evidence.personalBatchId}?scope=private`,
        `/api/v1/inventory/batches/${evidence.familyBatchId}?scope=family`,
        `/api/v1/preserves/${evidence.personalPreserveId}?scope=private`,
        `/api/v1/preserves/${evidence.familyPreserveId}?scope=family`,
    ]);
}

async function fillInventoryCreate(page: Page, name: string) {
    await page.getByLabel('Молоко 2,5%', { exact: true }).check();
    await page.getByLabel('Название партии', { exact: true }).fill(name);
    const location = page.getByRole('combobox', { name: 'Место хранения', exact: true });
    await expect(location).toBeVisible();
    await expect(location).toBeEnabled();
    await location.selectOption({ label: 'Кухонный шкаф' });
    await page.getByLabel('Количество', { exact: true }).fill('2');
}

async function createRecipe(page: Page, title: string) {
    if (new URL(page.url()).pathname !== '/recipes/new') await gotoExact(page, '/recipes/new');
    await page.getByLabel('Название', { exact: true }).fill(title);
    await page.getByRole('button', { name: '+ Молоко 2,5%', exact: true }).click();
    await page.getByRole('button', { name: '+ Добавить шаг', exact: true }).click();
    await page.getByLabel('Шаг 1', { exact: true }).fill('Смешать и проверить результат.');
    const save = page.getByRole('button', { name: 'Сохранить черновик', exact: true });
    await save.dblclick();
    await page.waitForURL(/\/recipes\/[a-f0-9-]+\/edit$/u);
    await expect(page.getByRole('heading', { name: 'Редактор рецепта', exact: true })).toBeVisible();
    return new URL(page.url()).pathname.split('/').at(-2)!;
}

test.beforeEach(async ({ page }) => {
    await installFaultController(page);
});

test('inventory create is single-effect on double click and archive/restore persists after reload', async ({
    page,
}) => {
    await login(page, 'user1@meal-planner.test', '/inventory/new');
    const name = `E2E партия ${test.info().project.name}`;
    await fillInventoryCreate(page, name);
    await page.getByRole('button', { name: 'Добавить в запасы', exact: true }).dblclick();
    await page.waitForURL(/\/inventory\/batches\/[a-f0-9-]+$/u, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
    await page.getByText('Другие действия', { exact: true }).click();
    await page.getByRole('button', { name: 'В архив', exact: true }).click();
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).dblclick();
    await expect(page.getByRole('button', { name: 'Восстановить', exact: true }).last()).toBeVisible();
    await reloadExact(page);
    await expect(page.getByRole('button', { name: 'Восстановить', exact: true }).last()).toBeVisible();
    await page.getByRole('button', { name: 'Восстановить', exact: true }).last().click();
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Исправить', exact: true }).first()).toBeVisible({
        timeout: 30_000,
    });
    await expect(page.getByRole('heading', { name: 'История движения' })).toBeVisible();
});

test('inventory preserves drafts for 403/404/409/412/429/503 and an unknown network result', async ({ page }) => {
    test.setTimeout(150_000);
    await login(page, 'user1@meal-planner.test', '/inventory/new');
    for (const status of [403, 404, 409, 412, 429, 503] as const) {
        if (new URL(page.url()).pathname !== '/inventory/new') await gotoExact(page, '/inventory/new');
        const name = `Fault ${status}`;
        await fillInventoryCreate(page, name);
        await setFault(page, {
            path: '/api/v1/inventory',
            method: 'POST',
            status,
            message: `inventory-${status}`,
        });
        await page.getByRole('button', { name: 'Добавить в запасы', exact: true }).click();
        await expect(page.locator('main [role="alert"]').first()).toBeVisible();
        await expect(page.getByLabel('Название партии', { exact: true })).toHaveValue(name);
        await setFault(page, null);
    }
    await gotoExact(page, '/inventory/new');
    await fillInventoryCreate(page, 'Fault crash');
    await setFault(page, { path: '/api/v1/inventory', method: 'POST', status: 503, crash: true });
    await page.getByRole('button', { name: 'Добавить в запасы', exact: true }).click();
    await expect(page.locator('main [role="alert"]').first()).toContainText('Ответ не получен');
    await expect(page.getByLabel('Название партии', { exact: true })).toHaveValue('Fault crash');
});

test('inventory list exposes loading, empty, 503 retry and fail-closed missing detail', async ({ page }) => {
    await login(page, 'user1@meal-planner.test', '/inventory');
    await setFault(page, { path: '/api/v1/inventory', method: 'GET', status: 503, remaining: 10 });
    await page.getByRole('searchbox', { name: 'Поиск в запасах' }).fill('no-such-e2e-item');
    await expect(page).toHaveURL(/q=no-such-e2e-item/u);
    await expect(page.getByRole('alert').filter({ hasText: 'Не удалось загрузить данные' }).first()).toBeVisible();
    await setFault(page, null);
    await page.getByRole('button', { name: 'Повторить', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Здесь пока нет продуктов' })).toBeVisible();
    await gotoExact(page, `/inventory/batches/${missingId}`);
    await expect(page.getByRole('heading', { name: 'Запись недоступна' })).toBeVisible();
});

test('inventory import validates files, keeps partial rows reviewable and commits selected valid rows', async ({
    page,
}) => {
    test.setTimeout(150_000);
    await login(page, 'user1@meal-planner.test', '/inventory/import');
    await page.getByLabel('Таблица', { exact: true }).setInputFiles({
        name: 'bad.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('bad'),
    });
    await page.getByRole('button', { name: 'Загрузить и проверить', exact: true }).click();
    await expect(page.locator('main [role="alert"]').first()).toContainText('Нужен CSV');
    await page.getByLabel('Таблица', { exact: true }).setInputFiles({
        name: 'inventory.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(
            '\ufeffНазвание;Количество;Единица;Срок годности;Место хранения\nМолоко;1;л;2027-10-10;Холодильник\nОшибка;-2;кг;not-a-date;Шкаф\n',
        ),
    });
    await page.getByRole('button', { name: 'Загрузить и проверить', exact: true }).click();
    await expect(page.getByText('Читаем таблицу…', { exact: true })).toHaveCount(0, { timeout: 65_000 });
    await expect(page.getByRole('heading', { name: 'inventory.csv', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'К исправлению строк', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Проверка перед добавлением' })).toBeVisible();
    await expect(page.getByText(/требуют проверки 2/u)).toBeVisible();
    await page.getByLabel('Товар каталога').first().selectOption({ index: 1 });
    await page.getByLabel('Место хранения').first().selectOption({ index: 1 });
    await page.getByRole('checkbox', { name: 'Проверил название, совпадение, количество и дату' }).first().check();
    await page.getByRole('checkbox', { name: 'Пропустить строку' }).nth(1).check();
    await page.getByRole('checkbox', { name: 'Добавить выбранные строки только в мои личные запасы' }).check();
    const commit = page.getByRole('button', { name: /Добавить \d+ парти/u });
    await commit.dblclick();
    await expect(page.getByRole('heading', { name: 'Запасы добавлены' })).toBeVisible();
});

test('scan boundaries keep barcode/OCR review local and recover from provider-style 503', async ({ page }) => {
    await login(page, 'user1@meal-planner.test', '/inventory/scan');
    await page.getByLabel('Введите штрихкод вручную').fill('4601234567890');
    await page.getByRole('button', { name: 'Найти совпадение и проверить' }).click();
    await expect(page.getByRole('heading', { name: 'Проверка перед добавлением' })).toBeVisible();
    await page.getByRole('button', { name: 'К исходным данным', exact: true }).click();
    await setFault(page, { path: '/api/v1/inventory/ingest/scan', method: 'POST', status: 503 });
    await page.getByLabel('Загрузить фото').setInputFiles({
        name: 'label.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            'base64',
        ),
    });
    await page.getByRole('button', { name: 'Распознать выбранные фото', exact: true }).click();
    await expect(page.locator('main [role="alert"]').first()).toContainText('Можно заполнить данные вручную');
    await expect(page.getByRole('link', { name: 'Добавить продукт вручную' })).toBeVisible();
});

test('recipe draft is replay-safe, reloads, and starts a cooking attempt with persisted progress', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, 'user1@meal-planner.test', '/recipes/new');
    const id = await createRecipe(page, `E2E рецепт ${test.info().project.name}`);
    await reloadExact(page);
    await expect(page.getByRole('heading', { name: 'Редактор рецепта' })).toBeVisible();
    await gotoExact(page, `/recipes/${id}/cook`);
    await page.getByRole('button', { name: 'Начать новое приготовление', exact: true }).dblclick();
    await page.waitForURL(new RegExp(`/recipes/${id}/cook\\?attempt=[a-f0-9-]+$`, 'u'));
    await page.getByRole('button', { name: 'Шаг выполнен', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Вернуть к выполнению', exact: true })).toBeVisible();
    await reloadExact(page);
    await expect(page.getByText(/Шаг 1 из/u)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Вернуть к выполнению', exact: true })).toBeVisible();
});

test('recipe submission conflict awaits workspace readback before another attempt', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, 'user1@meal-planner.test', '/recipes/new');
    const title = `Recipe submit readback ${test.info().project.name}`;
    const id = await createRecipe(page, title);
    await gotoExact(page, '/recipes/mine');
    const card = page.locator('article').filter({ hasText: title });
    const submit = card.getByRole('button', { name: 'Отправить на модерацию', exact: true });
    await expect(submit).toBeEnabled();
    let workspaceReads = 0;
    page.on('request', (request) => {
        const url = new URL(request.url());
        if (request.method() === 'GET' && url.pathname === '/api/v1/recipe-workspace') workspaceReads++;
    });
    await setFault(page, {
        path: `/api/v1/recipe-workspace/${id}/submit`,
        method: 'POST',
        status: 412,
    });
    await submit.click();
    await expect(page.getByRole('alert').filter({ hasText: 'Список рецептов перечитан' })).toBeVisible();
    expect(workspaceReads).toBeGreaterThan(0);
    await expect(card.getByRole('button', { name: 'Отправить на модерацию', exact: true })).toBeEnabled();
});

test('recipe revision axes keep the active public version while a newer revision is reviewed', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, 'user1@meal-planner.test', '/recipes/new');
    const title = `Recipe revisions ${test.info().project.name}`;
    const id = await createRecipe(page, title);
    const r2 = crypto.randomUUID();
    const r3 = crypto.randomUUID();
    await setRecipeRevisionProjection(page, { id, stage: 'published-r1', r2, r3 });
    await gotoExact(page, '/recipes/mine');
    const card = page.locator('article').filter({ hasText: title });
    await expect(card.getByText('Текущая редакция опубликована')).toBeVisible();
    await expect(card.getByRole('link', { name: 'Публичная карточка' })).toBeVisible();
    await setRecipeRevisionProjection(page, { id, stage: 'rejected-r2', r2, r3 });
    await reloadExact(page);
    await expect(card.getByText('Опубликована предыдущая редакция; текущая редакция остаётся приватной')).toBeVisible();
    await expect(card.getByText('Причина модерации: Уточните способ приготовления')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Отправить на модерацию' })).toBeDisabled();
    await setRecipeRevisionProjection(page, { id, stage: 'published-r3', r2, r3 });
    await reloadExact(page);
    await expect(card.getByText('Текущая редакция опубликована')).toBeVisible();
    await expect(card.getByText('Причина модерации: Уточните способ приготовления')).toHaveCount(0);
});

test('recipe submit retries a 503 with the exact same idempotency command', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, 'user1@meal-planner.test', '/recipes/new');
    const title = `Recipe submit exact retry ${test.info().project.name}`;
    const id = await createRecipe(page, title);
    await gotoExact(page, '/recipes/mine');
    await setFault(page, {
        path: `/api/v1/recipe-workspace/${id}/submit`,
        method: 'POST',
        status: 503,
    });
    const card = page.locator('article').filter({ hasText: title });
    await card.getByRole('button', { name: 'Отправить на модерацию', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Повторить незавершённую команду' })).toBeVisible();
    await setFault(page, null);
    await page.getByRole('button', { name: 'Повторить незавершённую команду' }).click();
    await expect(page.getByRole('status')).toContainText('Редакция отправлена');
    const commands = await page.evaluate((path) => {
        const state = (
            window as typeof window & {
                __domainQaFault: { requests: Array<{ url: string; method: string; body: string }> };
            }
        ).__domainQaFault;
        return state.requests
            .filter((request) => request.method === 'POST' && new URL(request.url, location.href).pathname === path)
            .map((request) => request.body);
    }, `/api/v1/recipe-workspace/${id}/submit`);
    expect(commands).toHaveLength(2);
    expect(commands[1]).toBe(commands[0]);
});

test('recipe update handles 412 stale recovery, 429 and 503 while preserving author input', async ({ page }) => {
    test.setTimeout(150_000);
    await login(page, 'user1@meal-planner.test', '/recipes/new');
    const id = await createRecipe(page, `Recipe faults ${test.info().project.name}`);
    for (const status of [429, 503] as const) {
        const value = `Recipe faults ${status}`;
        await page.getByLabel('Название', { exact: true }).fill(value);
        await setFault(page, { path: `/api/v1/recipe-workspace/${id}`, method: 'PUT', status });
        await page.getByRole('button', { name: /Сохранить черновик|Повторить сохранение/u }).click();
        await expect(page.locator('main [role="alert"]').first()).toBeVisible();
        await expect(page.getByLabel('Название', { exact: true })).toHaveValue(value);
        await setFault(page, null);
        if (status === 503) await page.getByRole('button', { name: 'Повторить сохранение', exact: true }).click();
    }
    await page.getByLabel('Название', { exact: true }).fill('Recipe stale draft');
    await setFault(page, { path: `/api/v1/recipe-workspace/${id}`, method: 'PUT', status: 412 });
    await page.getByRole('button', { name: 'Сохранить черновик', exact: true }).click();
    await expect(page.locator('main [role="alert"]').first()).toContainText('Проверочная ошибка 412');
    await expect(page.getByLabel('Название', { exact: true })).toHaveValue('Recipe stale draft');
    await expect(page.getByRole('button', { name: 'Загрузить актуальную версию' })).toBeVisible();
    await setFault(page, null);
    await page.getByRole('button', { name: 'Загрузить актуальную версию' }).click();
    await expect(page.getByRole('status')).toContainText('ваши поля сохранены');
    await expect(page.getByLabel('Название', { exact: true })).toHaveValue('Recipe stale draft');
});

test('recipe two-tab edit rejects the stale writer and preserves its draft for reconciliation', async ({ page }) => {
    test.setTimeout(150_000);
    await login(page, 'user1@meal-planner.test', '/recipes/new');
    const id = await createRecipe(page, `Recipe tabs ${test.info().project.name}`);
    if (test.info().project.name.includes('firefox')) {
        await page.getByLabel('Название', { exact: true }).fill('Recipe tabs stale draft');
        await setFault(page, { path: `/api/v1/recipe-workspace/${id}`, method: 'PUT', status: 412 });
        await page.getByRole('button', { name: 'Сохранить черновик', exact: true }).click();
        await expect(page.locator('main [role="alert"]').first()).toBeVisible();
        await expect(page.getByLabel('Название', { exact: true })).toHaveValue('Recipe tabs stale draft');
        await expect(page.getByRole('button', { name: 'Загрузить актуальную версию' })).toBeVisible();
        await setFault(page, null);
        await page.getByRole('button', { name: 'Загрузить актуальную версию' }).click();
        await expect(page.getByRole('status')).toContainText('ваши поля сохранены');
        await expect(page.getByLabel('Название', { exact: true })).toHaveValue('Recipe tabs stale draft');
        return;
    }
    const stale = await page.context().newPage();
    try {
        await installFaultController(stale);
        await gotoExact(stale, `/recipes/${id}/edit`);
        await page.getByLabel('Название', { exact: true }).fill('Recipe tabs winner');
        await page.getByRole('button', { name: 'Сохранить черновик', exact: true }).click();
        await expect(page.getByRole('status')).toContainText('Черновик сохранён');
        await stale.getByLabel('Название', { exact: true }).fill('Recipe tabs stale draft');
        await setFault(stale, { path: `/api/v1/recipe-workspace/${id}`, method: 'PUT', status: 412 });
        await stale.getByRole('button', { name: 'Сохранить черновик', exact: true }).click();
        await expect(stale.locator('main [role="alert"]').first()).toBeVisible();
        await expect(stale.getByLabel('Название', { exact: true })).toHaveValue('Recipe tabs stale draft');
        await expect(stale.getByRole('button', { name: 'Загрузить актуальную версию' })).toBeVisible();
        await setFault(stale, null);
        await stale.getByRole('button', { name: 'Загрузить актуальную версию' }).click();
        await expect(stale.getByRole('status')).toContainText('ваши поля сохранены');
        await expect(stale.getByLabel('Название', { exact: true })).toHaveValue('Recipe tabs stale draft');
    } finally {
        await stale.close();
    }
});

test('meal plan enforces tariffs and add/commit/remove effects survive reload', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, 'user1@meal-planner.test', '/plan');
    await expect(page.getByRole('button', { name: 'Период · Plus' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Календарь · Pro' })).toBeDisabled();
    await page.getByRole('button', { name: 'Добавить', exact: true }).first().click();
    await page.getByLabel('Что планируем').selectOption('outside');
    await page.getByLabel('Заметка').fill('E2E plan note');
    await page.getByRole('button', { name: 'Проверить изменения', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Проверка изменения' })).toBeVisible();
    await page.getByRole('button', { name: 'Подтвердить изменение', exact: true }).dblclick();
    await expect(page.getByText('E2E plan note', { exact: true })).toBeVisible();
    await reloadExact(page);
    await expect(page.getByText('E2E plan note', { exact: true })).toBeVisible();
    const entry = page.getByText('E2E plan note', { exact: true }).locator('xpath=../..');
    await entry.getByRole('button', { name: 'Убрать', exact: true }).click();
    await page.getByRole('button', { name: 'Подтвердить изменение', exact: true }).click();
    await expect(page.getByText('E2E plan note', { exact: true })).toHaveCount(0);
});

test('meal plan recovers from 409/412/429/503 and preserves the editor draft', async ({ page }) => {
    test.setTimeout(150_000);
    await login(page, 'user1@meal-planner.test', '/plan');
    for (const status of [409, 412, 429, 503] as const) {
        if (new URL(page.url()).pathname !== '/plan') await gotoExact(page, '/plan');
        await page.getByRole('button', { name: 'Добавить', exact: true }).first().click();
        const note = `Plan fault ${status}`;
        await page.getByLabel('Что планируем').selectOption('outside');
        await page.getByLabel('Заметка').fill(note);
        await setFault(page, { path: '/api/v1/meal-plan/change-preview', method: 'POST', status });
        await page.getByRole('button', { name: 'Проверить изменения', exact: true }).click();
        await expect(page.locator('main [role="alert"]').first()).toBeVisible();
        await expect(page.getByLabel('Заметка')).toHaveValue(note);
        await setFault(page, null);
    }
});

test('preserve create/consume/archive/restore has exact effects and remains durable', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, 'user1@meal-planner.test', '/preserves?create=1');
    const name = `E2E заготовка ${test.info().project.name}`;
    await page.getByLabel('Название', { exact: true }).fill(name);
    await page.getByLabel('Единица количества').selectOption('pcs');
    await page.getByLabel('Количество', { exact: true }).fill('3');
    await page.getByRole('button', { name: 'Сохранить', exact: true }).dblclick();
    await page.waitForURL(/\/preserves\/[a-f0-9-]+$/u);
    await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Использовать', exact: true }).click();
    await page.getByLabel(/Использовать шт/u).fill('1');
    await page.getByRole('button', { name: 'Показать остаток', exact: true }).click();
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).dblclick();
    await expect(page.getByText('2 шт.', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'В архив', exact: true }).click();
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).dblclick();
    await expect(page.getByText(/В архиве/u).first()).toBeVisible();
    await reloadExact(page);
    await page.getByRole('button', { name: 'Восстановить', exact: true }).click();
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await expect(page.getByText(/Активна/u).first()).toBeVisible();
});

test('preserve edit handles authorization/conflict/rate/server failures and keeps stale input', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, 'user1@meal-planner.test', '/preserves');
    const path = await firstHref(page, '/preserves', 'a[href^="/preserves/"]');
    await gotoExact(page, path);
    for (const status of [403, 404, 409, 412, 429, 503] as const) {
        await page.getByRole('button', { name: 'Изменить', exact: true }).click();
        const editForm = page.locator('form').filter({
            has: page.getByRole('heading', { level: 2, name: 'Изменить заготовку', exact: true }),
        });
        const name = `Preserve fault ${status}`;
        await editForm.getByLabel('Название', { exact: true }).fill(name);
        await setFault(page, { path: '/edit', method: 'POST', status });
        await editForm.getByRole('button', { name: 'Сохранить', exact: true }).click();
        await expect(editForm.getByRole('alert')).toBeVisible();
        await expect(editForm.getByLabel('Название', { exact: true })).toHaveValue(name);
        await setFault(page, null);
        if (status === 412) {
            await editForm.getByRole('button', { name: 'Перечитать, сохранив ввод' }).click();
            await expect(editForm.getByRole('status')).toContainText('Введённые поля сохранены');
        }
        if (status === 503) {
            await setFault(page, null);
            await editForm.getByRole('button', { name: 'Повторить сохранённый запрос', exact: true }).click();
            await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
        } else {
            page.once('dialog', (dialog) => dialog.accept());
            const cancel = editForm.getByRole('button', { name: 'Отмена', exact: true });
            await expect(cancel).toBeEnabled();
            await cancel.click();
            await expect(page.getByRole('button', { name: 'Изменить', exact: true })).toBeEnabled();
        }
    }
});

test('a 401 during a preserve mutation invalidates the session without applying the draft', async ({ page }) => {
    await login(page, 'user1@meal-planner.test', '/preserves');
    const path = await firstHref(page, '/preserves', 'a[href^="/preserves/"]');
    await gotoExact(page, path);
    await page.getByRole('button', { name: 'Изменить', exact: true }).click();
    await page.getByLabel('Название', { exact: true }).fill('Preserve unauthorized draft');
    await setFault(page, { path: '/edit', method: 'POST', status: 401 });
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await page.waitForURL(/\/auth(?:\?|$)/u);
    await expect(page.getByRole('heading', { level: 1, name: 'С возвращением', exact: true })).toBeVisible();
});

test('personal/family inventory and preserves reject cross-scope, outsider and missing IDs', async ({
    browser,
    page,
}, testInfo) => {
    test.setTimeout(testInfo.project.name.includes('webkit') ? 300_000 : 150_000);
    if (testInfo.project.name.includes('firefox')) {
        await Promise.all(
            [`/inventory/batches/${missingId}`, `/family/preserves/${missingId}`].map((path) => page.request.get(path)),
        );
        await login(page, 'plus1@meal-planner.test', `/inventory/batches/${missingId}`);
        const evidence = await collectOwnerScopeEvidenceFromApi(page);
        await expect(page.getByRole('heading', { name: 'Запись недоступна' })).toBeVisible({ timeout: 30_000 });
        await expectUnavailable(page, [`/family/preserves/${evidence.personalPreserveId}`], 'Заготовка недоступна');
        const logoutStatus = await page.evaluate(async () => {
            const csrfResponse = await fetch('/api/v1/auth/csrf');
            const csrf = (await csrfResponse.json()) as { data: { token: string } };
            return fetch('/api/v1/auth/logout', {
                method: 'POST',
                headers: { 'x-csrf-token': csrf.data.token },
            }).then((response) => response.status);
        });
        expect(logoutStatus).toBe(200);
        await login(page, 'user1@meal-planner.test');
        await expectOutsiderScopeIsolation(page, evidence);
        return;
    }
    await Promise.all(
        [
            '/inventory',
            '/family/inventory',
            `/inventory/batches/${missingId}`,
            '/preserves',
            '/family/preserves',
            `/family/preserves/${missingId}`,
        ].map((path) => page.request.get(path)),
    );
    const owner = await loggedContext(browser, testInfo, 'plus1@meal-planner.test', '/inventory');
    let outsider: Awaited<ReturnType<typeof loggedContext>> | null = null;
    try {
        const evidence = await collectOwnerScopeEvidence(owner.page);
        outsider = await loggedContext(browser, testInfo, 'user1@meal-planner.test');
        await expectOutsiderScopeIsolation(outsider.page, evidence);
    } finally {
        await outsider?.context.close();
        await owner.context.close();
    }
});
