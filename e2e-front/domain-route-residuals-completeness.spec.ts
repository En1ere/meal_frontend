import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

type Fault = {
    path: string;
    method: string;
    status?: number;
    remaining?: number;
    crash?: boolean;
    dropResponse?: boolean;
    delayMs?: number;
    transform?: 'paginate';
};

async function installFaultController(page: Page) {
    await page.addInitScript(() => {
        const nativeFetch = window.fetch.bind(window);
        let persisted: Fault | null = null;
        let paginationSeeds: Record<string, unknown[]> = {};
        try {
            persisted = JSON.parse(sessionStorage.getItem('__domainCompletenessFault') ?? 'null') as Fault | null;
            paginationSeeds = JSON.parse(
                sessionStorage.getItem('__domainCompletenessPaginationSeeds') ?? '{}',
            ) as Record<string, unknown[]>;
        } catch {
            // Opaque documents may not expose session storage.
        }
        const state = { fault: persisted, paginationSeeds, archiveKeys: [] as string[] };
        Object.defineProperty(window, '__domainCompletenessFault', { value: state });
        window.fetch = async (input, init) => {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
            const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
            if (method === 'POST' && url.includes('/archive') && typeof init?.body === 'string') {
                const body = JSON.parse(init.body) as { idempotencyKey?: string };
                if (body.idempotencyKey) state.archiveKeys.push(body.idempotencyKey);
            }
            const fault = state.fault;
            if (!fault || method !== fault.method || !url.includes(fault.path) || (fault.remaining ?? 1) <= 0)
                return nativeFetch(input, init);

            fault.remaining = (fault.remaining ?? 1) - 1;
            sessionStorage.setItem('__domainCompletenessFault', JSON.stringify(fault));
            if (fault.delayMs) await new Promise((resolve) => setTimeout(resolve, fault.delayMs));
            if (fault.crash) throw new TypeError('Simulated unknown network outcome');
            if (fault.dropResponse) {
                await nativeFetch(input, init);
                throw new TypeError('Simulated response loss after the command reached the server');
            }
            if (fault.transform === 'paginate') {
                const response = await nativeFetch(input, init);
                const payload = (await response.clone().json()) as { data?: { items?: unknown[]; total?: number } };
                if (!payload.data || !Array.isArray(payload.data.items))
                    throw new Error('Pagination fixture requires a collection response');
                const requestUrl = new URL(url, location.origin);
                const isSecondPage =
                    requestUrl.searchParams.get('offset') === '100' || requestUrl.searchParams.get('page') === '2';
                if (!isSecondPage && payload.data.items.length > 0) {
                    state.paginationSeeds[fault.path] = structuredClone(payload.data.items);
                    sessionStorage.setItem(
                        '__domainCompletenessPaginationSeeds',
                        JSON.stringify(state.paginationSeeds),
                    );
                } else if (!isSecondPage && state.paginationSeeds[fault.path]?.length) {
                    payload.data.items = structuredClone(state.paginationSeeds[fault.path]);
                } else if (isSecondPage) {
                    const seed = state.paginationSeeds[fault.path];
                    if (!seed?.length) throw new Error('Pagination fixture has no deterministic seed item');
                    payload.data.items = structuredClone(seed).map((source, index) => {
                        const item = source as {
                            id?: string;
                            after?: { name?: string };
                            document?: { title?: string };
                        };
                        item.id = `00000000-0000-4000-8000-${String(101 + index).padStart(12, '0')}`;
                        if (item.after) item.after.name = `QA page 2 inventory marker ${index + 1}`;
                        if (item.document) item.document.title = `QA page 2 recipe marker ${index + 1}`;
                        return item;
                    });
                }
                payload.data.total = 101;
                const headers = new Headers(response.headers);
                headers.set('content-type', 'application/json');
                return new Response(JSON.stringify(payload), { status: response.status, headers });
            }

            const status = fault.status ?? 503;
            const code =
                status === 401
                    ? 'UNAUTHENTICATED'
                    : status === 403
                      ? 'FORBIDDEN'
                      : status === 404
                        ? 'NOT_FOUND'
                        : status === 409
                          ? 'CONFLICT'
                          : status === 412
                            ? 'PRECONDITION_FAILED'
                            : status === 429
                              ? 'RATE_LIMITED'
                              : 'SERVICE_UNAVAILABLE';
            return new Response(
                JSON.stringify({
                    error: { code, message: `Проверочная ошибка ${status}`, details: null },
                    meta: { requestId: crypto.randomUUID() },
                }),
                { status, headers: { 'content-type': 'application/json' } },
            );
        };
    });
}

async function setFault(page: Page, fault: Fault | null) {
    await page.evaluate((value) => {
        (
            window as typeof window & {
                __domainCompletenessFault: { fault: Fault | null };
            }
        ).__domainCompletenessFault.fault = value;
        if (value) sessionStorage.setItem('__domainCompletenessFault', JSON.stringify(value));
        else sessionStorage.removeItem('__domainCompletenessFault');
    }, fault);
}

async function ensureServiceWorker(page: Page) {
    await page.evaluate(() => navigator.serviceWorker.ready);
    if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
        await page.reload({ waitUntil: 'domcontentloaded' });
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
}

async function logout(page: Page) {
    await gotoExact(page, '/settings/account');
    await page.getByRole('button', { name: 'Выйти', exact: true }).click();
    await page.waitForURL(/\/auth(?:\?|$)/u);
}

async function gotoExact(page: Page, path: string) {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect([200, 304], `${path}: document status`).toContain(response?.status());
    await expect(page.getByText('Проверяем сессию', { exact: true })).toHaveCount(0, { timeout: 30_000 });
    expect(new URL(page.url()).pathname).toBe(new URL(path, 'http://local').pathname);
}

async function gotoExactWithLoading(page: Page, path: string, loadingLabel: string) {
    const marker = `__domainCompletenessLoading:${path}`;
    await page.addInitScript(
        ({ key, label }) => {
            sessionStorage.removeItem(key);
            const check = () => {
                const loading = Array.from(
                    document.querySelectorAll<HTMLElement>('[role="status"], [aria-busy="true"]'),
                ).some(
                    (element) =>
                        element.textContent?.trim() === label || element.getAttribute('aria-label')?.trim() === label,
                );
                if (loading) sessionStorage.setItem(key, 'seen');
            };
            const start = () => {
                check();
                new MutationObserver(check).observe(document.documentElement, { childList: true, subtree: true });
            };
            if (document.documentElement) start();
            else document.addEventListener('readystatechange', start, { once: true });
        },
        { key: marker, label: loadingLabel },
    );
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect([200, 304], `${path}: document status`).toContain(response?.status());
    await expect
        .poll(() => page.evaluate((key) => sessionStorage.getItem(key), marker), { timeout: 30_000 })
        .toBe('seen');
    await expect(page.getByText('Проверяем сессию', { exact: true })).toHaveCount(0, { timeout: 30_000 });
    expect(new URL(page.url()).pathname).toBe(new URL(path, 'http://local').pathname);
}

async function assertAccessibleSurface(page: Page, path: string, target: Locator, testInfo: TestInfo) {
    await gotoExact(page, path);
    const main = page.locator('main');
    await expect(main).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 }).filter({ visible: true })).toHaveCount(1);
    await expect(target).toBeVisible();
    await expect(target).toBeEnabled();
    await expect(target).toHaveAccessibleName(/\S/u);
    expect(
        await target.evaluate((element) => element.closest('main') !== null),
        `${path}: route control belongs to main`,
    ).toBe(true);

    const controls = main.locator(
        'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])',
    );
    for (let index = 0; index < (await controls.count()); index += 1) {
        const control = controls.nth(index);
        if (await control.isVisible())
            await expect(control, `${path}: control ${index + 1} has an accessible name`).toHaveAccessibleName(/\S/u);
    }

    await page.evaluate(() => {
        document.body.tabIndex = -1;
        document.body.focus({ preventScroll: true });
    });
    let reached = false;
    const targetIsLink = await target.evaluate((element) => element.tagName.toLowerCase() === 'a');
    if (testInfo.project.name.includes('webkit') && targetIsLink) {
        // Safari/WebKit follows the OS full-keyboard-access preference and may intentionally skip links on Tab.
        // Programmatic focus plus the Enter probe below verifies that the link itself remains keyboard operable.
        await target.focus();
        reached = await target.evaluate((element) => element === document.activeElement);
    } else {
        for (let stop = 0; stop < 100; stop += 1) {
            await page.keyboard.press('Tab');
            if (await target.evaluate((element) => element === document.activeElement)) {
                reached = true;
                break;
            }
        }
    }
    await page.evaluate(() => document.body.removeAttribute('tabindex'));
    expect(reached, `${path}: natural Tab order reaches the route control`).toBe(true);
    const focus = await target.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
            active: element === document.activeElement,
            visible: rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0,
            indicator: (style.outlineStyle !== 'none' && style.outlineWidth !== '0px') || style.boxShadow !== 'none',
            width: rect.width,
            height: rect.height,
        };
    });
    expect(focus.active, `${path}: keyboard focus returns to the route control`).toBe(true);
    expect(focus.visible, `${path}: focused control is visible`).toBe(true);
    expect(focus.indicator, `${path}: focused control has a visible indicator`).toBe(true);

    const tagName = await target.evaluate((element) => element.tagName.toLowerCase());
    const inputType = await target.getAttribute('type');
    if (
        tagName === 'input' &&
        !['button', 'submit', 'reset', 'checkbox', 'radio', 'file'].includes(inputType ?? 'text')
    ) {
        const original = await target.inputValue();
        await page.keyboard.type('z');
        await expect(target, `${path}: keyboard input changes the route control`).not.toHaveValue(original);
        await target.fill(original);
        await expect(target, `${path}: route control restores its prior value`).toHaveValue(original);
    } else if (tagName !== 'select' && tagName !== 'textarea') {
        await target.evaluate((element) => {
            element.addEventListener(
                'click',
                (event) => {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    (element as HTMLElement).dataset.keyboardProbe = 'activated';
                },
                { capture: true, once: true },
            );
        });
        await page.keyboard.press('Enter');
        await expect(target, `${path}: Enter activates the focused route control`).toHaveAttribute(
            'data-keyboard-probe',
            'activated',
        );
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow, `${path}: no horizontal overflow`).toBeLessThanOrEqual(1);
    if (testInfo.project.name.includes('mobile')) {
        const undersized = await main
            .locator('button, input:not([type="hidden"]), select, textarea, a[href]')
            .evaluateAll((elements) =>
                elements.flatMap((element) => {
                    const hitTarget =
                        element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type)
                            ? (element.closest('label') ?? element)
                            : element;
                    const rect = hitTarget.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0 || (rect.width >= 44 && rect.height >= 44)) return [];
                    return [
                        `${element.outerHTML.slice(0, 120)} (${Math.round(rect.width)}x${Math.round(rect.height)})`,
                    ];
                }),
            );
        expect(undersized, `${path}: every main action has at least a 44px mobile hit target`).toEqual([]);
        expect(focus.width, `${path}: focused mobile route-control width`).toBeGreaterThanOrEqual(44);
        expect(focus.height, `${path}: focused mobile route-control height`).toBeGreaterThanOrEqual(44);
    }
}

async function fillInventory(page: Page, name: string) {
    await page.getByLabel('Молоко 2,5%', { exact: true }).check();
    await page.getByLabel('Название партии', { exact: true }).fill(name);
    await page.getByRole('combobox', { name: 'Место хранения', exact: true }).selectOption({ index: 1 });
    await page.getByLabel('Количество', { exact: true }).fill('2');
}

test.beforeEach(async ({ page }) => installFaultController(page));

test('all residual protected routes preserve an exact safe return target for guests', async ({ browser }, testInfo) => {
    const routes = [
        '/family/inventory/history',
        '/family/inventory/import',
        '/family/inventory/locations',
        '/family/inventory/new',
        '/family/inventory/scan',
        '/family/plan',
        '/family/recipes',
        '/inventory/history',
        '/inventory/locations',
        '/inventory/prepared',
        '/recipes/mine',
        '/recipes/offline',
    ];
    for (const route of routes) {
        // An isolated context per URL proves every guard from a genuinely signed-out state.
        // Reusing one context here can retain a mock session through the service worker after
        // a Next development full reload and turn later routes into authenticated checks.
        const context = await browser.newContext({
            viewport: testInfo.project.name.includes('mobile')
                ? { width: 412, height: 915 }
                : { width: 1280, height: 720 },
        });
        const page = await context.newPage();
        try {
            await page.goto(route, { waitUntil: 'domcontentloaded' });
            await page.waitForURL((url) => url.pathname === '/auth', {
                timeout: 60_000,
                waitUntil: 'domcontentloaded',
            });
            expect(new URL(page.url()).searchParams.get('returnTo'), `${route}: exact guarded return target`).toBe(
                route,
            );
        } finally {
            await context.close();
        }
    }
});

test('inventory residual routes expose named controls, keyboard focus and mobile geometry', async ({
    page,
}, testInfo) => {
    test.setTimeout(240_000);
    await login(page, 'plus1@meal-planner.test');
    const main = page.locator('main');
    const routes = [
        ['/family/inventory/history', () => main.getByLabel('Поиск продукта')],
        ['/family/inventory/import', () => main.getByLabel('Таблица', { exact: true })],
        ['/family/inventory/locations', () => main.getByLabel('Название', { exact: true })],
        ['/family/inventory/new', () => main.getByLabel('Название партии', { exact: true })],
        ['/family/inventory/scan', () => main.getByLabel('Введите штрихкод вручную')],
        ['/inventory/history', () => main.getByLabel('Поиск продукта')],
        ['/inventory/locations', () => main.getByLabel('Название', { exact: true })],
        ['/inventory/prepared', () => main.getByRole('link', { name: 'Запасы', exact: false }).first()],
    ] as const;
    for (const [path, target] of routes) await assertAccessibleSurface(page, path, target(), testInfo);
});

test('family plan keeps its editor keyboard-visible and mobile-safe', async ({ page }, testInfo) => {
    await login(page, 'plus1@meal-planner.test');
    await assertAccessibleSurface(
        page,
        '/family/plan',
        page.locator('main').getByRole('button', { name: 'Добавить', exact: true }).first(),
        testInfo,
    );
    await page.getByRole('button', { name: 'Добавить', exact: true }).first().click();
    const meal = page.getByLabel('Приём пищи');
    const planned = page.getByLabel('Что планируем');
    const assertFocusedEditorControl = async (control: Locator, label: string) => {
        await expect(control).toBeFocused();
        await expect(control).toHaveAccessibleName(label);
        const geometry = await control.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return {
                width: rect.width,
                height: rect.height,
                withinViewport:
                    rect.width > 0 &&
                    rect.height > 0 &&
                    rect.left >= 0 &&
                    rect.right <= innerWidth &&
                    rect.top >= 0 &&
                    rect.bottom <= innerHeight,
            };
        });
        expect(geometry.withinViewport, `${label}: focused editor control is inside the viewport`).toBe(true);
        if (testInfo.project.name.includes('mobile')) {
            expect(geometry.width, `${label}: focused editor-control width`).toBeGreaterThanOrEqual(44);
            expect(geometry.height, `${label}: focused editor-control height`).toBeGreaterThanOrEqual(44);
        }
    };
    await assertFocusedEditorControl(meal, 'Приём пищи');
    await page.keyboard.press('Tab');
    await assertFocusedEditorControl(planned, 'Что планируем');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow, '/family/plan editor: no horizontal overflow').toBeLessThanOrEqual(1);
});

test('recipe workspaces expose accessible search and offline navigation', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await login(page, 'plus1@meal-planner.test');
    const main = page.locator('main');
    await assertAccessibleSurface(page, '/family/recipes', main.getByLabel('Поиск моих рецептов'), testInfo);
    await assertAccessibleSurface(page, '/recipes/mine', main.getByLabel('Поиск моих рецептов'), testInfo);
    await assertAccessibleSurface(
        page,
        '/recipes/offline',
        main.getByRole('link', { name: 'Управление локальными данными', exact: true }),
        testInfo,
    );
});

test('inventory history completes loading, pagination, rate-limit, membership and unauthorized-read boundaries', async ({
    page,
}) => {
    test.setTimeout(180_000);
    await login(page, 'plus1@meal-planner.test');
    for (const path of ['/inventory/history', '/family/inventory/history']) {
        await setFault(page, {
            path: '/api/v1/inventory-history',
            method: 'GET',
            status: 429,
            delayMs: 10_000,
            remaining: 10,
        });
        await gotoExactWithLoading(page, path, 'Загружаем запасы');
        const failure = page.getByRole('alert').filter({ hasText: 'Не удалось загрузить данные' }).first();
        await expect(failure).toBeVisible({ timeout: 30_000 });
        await setFault(page, {
            path: '/api/v1/inventory-history',
            method: 'GET',
            transform: 'paginate',
            remaining: 10,
        });
        await failure.getByRole('button', { name: 'Повторить', exact: true }).click();
        const pageOneEvent = page.locator('main button[aria-pressed]').first();
        await expect(pageOneEvent).toBeVisible();
        const pageOneEventText = await pageOneEvent.textContent();
        expect(pageOneEventText).toBeTruthy();
        const next = page.getByRole('button', { name: 'Следующие события', exact: true });
        await expect(next).toBeEnabled();
        await next.click();
        await expect(page).toHaveURL(/offset=100/u);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.locator('main button[aria-pressed]').first()).toBeVisible();
        await expect(page.getByRole('button', { name: /QA page 2 inventory marker 1/u, exact: false })).toBeVisible();
        await expect(page.getByText(pageOneEventText!, { exact: true })).toHaveCount(0);
        await expect(page.getByText('Всего 101', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Предыдущие события', exact: true })).toBeEnabled();
        await setFault(page, null);
    }

    await setFault(page, { path: '/api/v1/inventory-history', method: 'GET', status: 403, remaining: 10 });
    await gotoExact(page, '/family/inventory/history?q=membership-check');
    await expect(page.getByRole('alert').first()).toContainText('Проверочная ошибка 403');
    await setFault(page, { path: '/api/v1/inventory-history', method: 'GET', status: 401, remaining: 10 });
    await gotoExact(page, '/inventory/history?q=session-check');
    await expect(page.getByRole('alert').first()).toContainText('Проверочная ошибка 401');
    await expect(page.locator('main button[aria-pressed]')).toHaveCount(0);
    await expect(page).toHaveURL(/\/inventory\/history\?q=session-check$/u);
});

test('family create, import and scan preserve scoped input through denied and transient failures', async ({ page }) => {
    test.setTimeout(180_000);
    await login(page, 'plus1@meal-planner.test');

    await gotoExact(page, '/family/inventory/new');
    await fillInventory(page, 'Family denied draft');
    await setFault(page, { path: '/api/v1/inventory', method: 'POST', status: 403 });
    await page.getByRole('button', { name: 'Добавить в запасы', exact: true }).click();
    await expect(page.getByRole('alert').first()).toBeVisible();
    await expect(page.getByLabel('Название партии', { exact: true })).toHaveValue('Family denied draft');
    await setFault(page, null);

    await gotoExact(page, '/family/inventory/import');
    const table = page.getByLabel('Таблица', { exact: true });
    await table.setInputFiles({
        name: 'family-retry.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(
            'Название;Количество;Единица;Срок годности;Место хранения\nМолоко;1;л;2027-10-10;Холодильник\n',
        ),
    });
    await setFault(page, { path: '/api/v1/inventory/ingest/import', method: 'POST', status: 503 });
    await page.getByRole('button', { name: 'Загрузить и проверить', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Проверочная ошибка 503' })).toBeVisible();
    await expect(table).toHaveValue(/family-retry\.csv$/u);
    await setFault(page, null);
    await page.getByRole('button', { name: 'Загрузить и проверить', exact: true }).click();
    await expect(page.getByText('Читаем таблицу…', { exact: true })).toHaveCount(0, { timeout: 65_000 });
    await expect(page.getByRole('heading', { name: 'family-retry.csv', exact: true })).toBeVisible();

    await gotoExact(page, '/family/inventory/scan');
    const photo = page.getByLabel('Загрузить фото', { exact: true });
    await photo.setInputFiles({
        name: 'family-label.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            'base64',
        ),
    });
    await setFault(page, { path: '/api/v1/inventory/ingest/scan', method: 'POST', status: 429 });
    await page.getByRole('button', { name: 'Распознать выбранные фото', exact: true }).click();
    await expect(page.getByRole('alert').first()).toContainText('Можно заполнить данные вручную');
    await expect(page.getByAltText('Выбранное фото: family-label.png', { exact: true })).toBeVisible();
    await expect(page.locator('figcaption').getByText('family-label.png', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Распознать выбранные фото', exact: true })).toBeEnabled();
    await expect(page.getByRole('link', { name: 'Добавить продукт вручную' })).toHaveAttribute(
        'href',
        '/family/inventory/new',
    );
});

test('locations complete read recovery and preserve commands when a successful response is lost', async ({ page }) => {
    test.setTimeout(180_000);
    await login(page, 'plus1@meal-planner.test');
    for (const path of ['/inventory/locations', '/family/inventory/locations']) {
        await setFault(page, {
            path: '/api/v1/inventory-locations',
            method: 'GET',
            status: 503,
            delayMs: 10_000,
            remaining: 10,
        });
        await gotoExactWithLoading(page, path, 'Загружаем запасы');
        const failure = page.getByRole('alert').filter({ hasText: 'Не удалось загрузить данные' }).first();
        await expect(failure).toBeVisible({ timeout: 30_000 });
        await setFault(page, null);
        await failure.getByRole('button', { name: 'Повторить', exact: true }).click();
        await expect(page.getByLabel('Название', { exact: true })).toBeEnabled();

        const name = `${path.startsWith('/family') ? 'Family' : 'Personal'} uncertain ${test.info().project.name}`;
        await page.getByLabel('Название', { exact: true }).fill(name);
        await setFault(page, {
            path: '/api/v1/inventory-locations',
            method: 'POST',
            dropResponse: true,
        });
        await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
        await expect(page.getByRole('alert').filter({ hasText: 'Ответ не получен' })).toBeVisible();
        await expect(page.getByLabel('Название', { exact: true })).toHaveValue(name);
        await expect(page.getByRole('button', { name: 'Повторить незавершённую команду', exact: true })).toBeVisible();
        await setFault(page, null);
        await page.getByRole('button', { name: 'Повторить незавершённую команду', exact: true }).click();
        await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Повторить незавершённую команду', exact: true })).toHaveCount(0);
        await page.getByRole('button', { name: 'К списку мест', exact: false }).click();
        await expect(page.getByRole('button', { name, exact: true })).toHaveCount(1);
        await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeEnabled();
        await expect(page.getByLabel('Название', { exact: true })).toBeEnabled();
        const locationType = page.locator('main form select');
        await expect(locationType).toBeEnabled();
        await expect(locationType).toHaveAccessibleName('Базовый тип');
    }
});

test('family plan preserves its draft through read, rate-limit, crash and 401 fail-closed handling', async ({
    page,
}) => {
    test.setTimeout(180_000);
    await login(page, 'plus1@meal-planner.test');
    await setFault(page, {
        path: '/api/v1/meal-plan',
        method: 'GET',
        status: 503,
        delayMs: 10_000,
        remaining: 10,
    });
    await gotoExactWithLoading(page, '/family/plan', 'Загружаем план питания');
    const readFailure = page.getByRole('alert').filter({ hasText: 'Не удалось загрузить план' }).first();
    await expect(readFailure).toBeVisible({ timeout: 30_000 });
    await setFault(page, null);
    await readFailure.getByRole('button', { name: 'Повторить', exact: true }).click();

    await page.getByRole('button', { name: 'Добавить', exact: true }).first().click();
    await page.getByLabel('Что планируем').selectOption('outside');
    const retainedDraft = 'Family plan retained draft';
    await page.getByLabel('Заметка').fill(retainedDraft);
    await setFault(page, { path: '/api/v1/meal-plan/change-preview', method: 'POST', status: 429 });
    await page.getByRole('button', { name: 'Проверить изменения', exact: true }).click();
    await expect(page.locator('main').getByRole('alert').filter({ hasText: 'Проверочная ошибка 429' })).toBeVisible();
    await expect(page.getByLabel('Заметка')).toHaveValue(retainedDraft);
    await setFault(page, { path: '/api/v1/meal-plan/change-preview', method: 'POST', status: 503, crash: true });
    await page.getByRole('button', { name: 'Проверить изменения', exact: true }).click();
    const previewFailure = page
        .locator('main')
        .getByRole('alert')
        .filter({ hasText: 'Не удалось выполнить запрос. Попробуйте ещё раз.' });
    await expect(previewFailure).toBeVisible();
    await expect(previewFailure).not.toContainText('Проверочная ошибка 429');
    await expect(page.getByLabel('Заметка')).toHaveValue(retainedDraft);
    await setFault(page, { path: '/api/v1/meal-plan/change-preview', method: 'POST', status: 401 });
    await page.getByRole('button', { name: 'Проверить изменения', exact: true }).click();
    await expect(page.locator('main').getByRole('alert').filter({ hasText: 'Проверочная ошибка 401' })).toBeVisible();
    await expect(page.getByLabel('Заметка')).toHaveValue(retainedDraft);
    await expect(page.getByRole('region', { name: 'Записи плана', exact: true })).not.toContainText(retainedDraft);
    await expect(page).toHaveURL('/family/plan');
});

test('recipe lists complete pagination, family denial and replay-safe archive recovery', async ({ page }) => {
    test.setTimeout(300_000);
    await login(page, 'plus1@meal-planner.test');
    for (const [createPath, expectedEditPath, title] of [
        ['/recipes/new', /^\/recipes\/[0-9a-f-]{36}\/edit$/u, 'Personal completeness recipe'],
        ['/family/recipes/new', /^\/family\/recipes\/[0-9a-f-]{36}\/edit$/u, 'Family completeness recipe'],
    ] as const) {
        await gotoExact(page, createPath);
        await page.getByLabel('Название', { exact: true }).fill(title);
        await page.getByRole('button', { name: 'Сохранить черновик', exact: true }).click();
        await page.waitForURL((url) => expectedEditPath.test(url.pathname), { timeout: 60_000 });
    }
    // Personal data provides a contract-valid seed; the transform reuses that shape
    // when the development family fixture is empty so both pagination UIs are exercised.
    for (const path of ['/recipes/mine', '/family/recipes']) {
        await setFault(page, {
            path: '/api/v1/recipe-workspace',
            method: 'GET',
            transform: 'paginate',
            remaining: 10,
        });
        await gotoExact(page, path);
        const pageOneTitle = await page
            .locator('main article')
            .first()
            .getByRole('heading', { level: 2 })
            .textContent();
        expect(pageOneTitle).toBeTruthy();
        const next = page.getByRole('link', { name: 'Далее', exact: true });
        await expect(next).toBeVisible();
        await next.click();
        await expect(page).toHaveURL(/page=2/u);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.locator('main article').first()).toBeVisible();
        await expect(page.getByRole('heading', { name: 'QA page 2 recipe marker 1', exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: pageOneTitle!, exact: true })).toHaveCount(0);
        await expect(page.locator('main article').first().getByRole('heading', { level: 2 })).toHaveAccessibleName(
            /\S/u,
        );
        await expect(page.getByRole('link', { name: 'Назад', exact: true })).toBeVisible();
        await setFault(page, null);
    }

    await setFault(page, { path: '/api/v1/recipe-workspace', method: 'GET', status: 403, remaining: 10 });
    await gotoExact(page, '/family/recipes?membership-check=1');
    const denied = page.getByRole('alert').filter({ hasText: 'Не удалось загрузить рецепты' }).first();
    await expect(denied).toContainText('Проверочная ошибка 403');
    await setFault(page, null);
    const card = page
        .locator('article')
        .filter({ has: page.getByRole('button', { name: 'Архивировать' }) })
        .first();
    const retry = denied.getByRole('button', { name: 'Повторить', exact: true });
    if (await retry.count()) {
        try {
            await retry.click({ timeout: 5_000 });
        } catch (error) {
            // WebKit can complete the normal background recovery between clearing
            // the injected fault and clicking the now-detached retry button.
            if (!(await card.isVisible())) throw error;
        }
    }
    await expect(card).toBeVisible();
    const title = await card.getByRole('heading', { level: 2 }).textContent();
    expect(title).toBeTruthy();
    await page.evaluate(() => {
        (
            window as typeof window & {
                __domainCompletenessFault: { archiveKeys: string[] };
            }
        ).__domainCompletenessFault.archiveKeys = [];
    });
    await setFault(page, { path: '/archive', method: 'POST', dropResponse: true });
    await card.getByRole('button', { name: 'Архивировать', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Повторить незавершённую команду', exact: true })).toBeVisible();
    await setFault(page, null);
    await page.getByRole('button', { name: 'Повторить незавершённую команду', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Повторить незавершённую команду', exact: true })).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'Изменения сохранены.' })).toHaveText(
        'Изменения сохранены.',
    );
    await expect(page.locator('main').getByRole('alert')).toHaveCount(0);
    const archiveKeys = await page.evaluate(
        () =>
            (
                window as typeof window & {
                    __domainCompletenessFault: { archiveKeys: string[] };
                }
            ).__domainCompletenessFault.archiveKeys,
    );
    expect(archiveKeys).toHaveLength(2);
    expect(new Set(archiveKeys).size, 'archive replay reuses one idempotency key').toBe(1);
    await page.getByRole('link', { name: 'Архив', exact: true }).click();
    await expect(
        page.locator('article').filter({ hasText: title! }).getByRole('button', { name: 'Восстановить', exact: true }),
    ).toBeVisible();
    await expect(page.locator('article').filter({ hasText: title! })).toHaveCount(1);
});

test('prepared and offline readers cover non-empty, filtered, owner-isolated and corrupt-cache states', async ({
    page,
}) => {
    test.setTimeout(180_000);
    await login(page, 'user1@meal-planner.test');

    await gotoExact(page, '/inventory/prepared');
    const prepared = page.locator('main article').first();
    await expect(prepared).toBeVisible();
    const preparedText = await prepared.getByRole('heading', { level: 2 }).textContent();
    expect(preparedText).toBeTruthy();
    await setFault(page, {
        path: '/api/v1/cooking-attempts/stock-options',
        method: 'GET',
        status: 429,
        delayMs: 10_000,
        remaining: 10,
    });
    await gotoExactWithLoading(page, '/inventory/prepared?reload=1', 'Загружаем рецепты');
    const failure = page.getByRole('alert').filter({ hasText: 'Не удалось загрузить рецепты' }).first();
    await expect(failure).toBeVisible({ timeout: 30_000 });
    await setFault(page, null);
    await failure.getByRole('button', { name: 'Повторить', exact: true }).click();
    await expect(page.locator('main article').first()).toBeVisible();
    await gotoExact(page, '/inventory/prepared?batch=00000000-0000-4000-8000-000000000099');
    await expect(page.getByText('Готовых партий пока нет или партия недоступна.')).toBeVisible();

    await gotoExact(page, '/recipes/70000000-0000-4000-8000-000000000001');
    const cachedTitle = await page.getByRole('heading', { level: 1 }).textContent();
    expect(cachedTitle).toBeTruthy();
    await expect
        .poll(() => page.evaluate(() => localStorage.getItem('meal-planner-recipes-read-v1')), { timeout: 10_000 })
        .toContain(cachedTitle!);
    const user1RecipeCache = await page.evaluate(() => localStorage.getItem('meal-planner-recipes-read-v1'));
    expect(user1RecipeCache).toBeTruthy();
    await gotoExact(page, '/recipes/offline');
    await expect(page.getByRole('heading', { name: cachedTitle!, exact: true })).toBeVisible();

    await logout(page);
    await login(page, 'user2@meal-planner.test');
    await page.evaluate(
        (rawCache) => localStorage.setItem('meal-planner-recipes-read-v1', rawCache),
        user1RecipeCache!,
    );
    await gotoExact(page, '/recipes/offline');
    await expect(page.getByText('Для этого аккаунта сохранённых рецептов нет.')).toBeVisible();
    await expect(page.getByRole('heading', { name: cachedTitle!, exact: true })).toHaveCount(0);

    await page.evaluate(() => localStorage.setItem('meal-planner-recipes-read-v1', 'bad-json'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Для этого аккаунта сохранённых рецептов нет.')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Application error');
});
