import { expect, test, type Page, type Request } from '@playwright/test';

test.setTimeout(180_000);

async function ensureServiceWorker(page: Page) {
    await page.evaluate(() => navigator.serviceWorker.ready);
    if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) await page.reload();
}

async function login(page: Page, login: string) {
    await page.goto('/auth');
    await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    await ensureServiceWorker(page);
    await page.getByLabel('Электронная почта', { exact: true }).fill(`${login}@meal-planner.test`);
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

async function installFetchCounter(page: Page, pathFragment: string) {
    await page.addInitScript((targetPath) => {
        const target = window as typeof window & { __familyPurchaseFetchCount?: number };
        const nativeFetch = window.fetch.bind(window);
        target.__familyPurchaseFetchCount = 0;
        window.fetch = async (input, init) => {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
            const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
            if (method === 'POST' && new URL(url, window.location.origin).pathname.includes(targetPath)) {
                target.__familyPurchaseFetchCount = (target.__familyPurchaseFetchCount ?? 0) + 1;
            }
            return nativeFetch(input, init);
        };
    }, pathFragment);
}

const fetchCount = (page: Page) =>
    page.evaluate(() => (window as typeof window & { __familyPurchaseFetchCount?: number }).__familyPurchaseFetchCount);

async function switchUser(page: Page, loginName: string) {
    await gotoExact(page, '/settings/account');
    await page.getByRole('button', { name: 'Выйти', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/auth');
    await login(page, loginName);
}

async function gotoExact(page: Page, path: string) {
    const failedBootstrapRequests: string[] = [];
    const recordBootstrapFailure = (request: Request) => {
        const pathname = new URL(request.url()).pathname;
        if (pathname.startsWith('/_next/static/') && ['script', 'stylesheet'].includes(request.resourceType())) {
            failedBootstrapRequests.push(`${pathname}: ${request.failure()?.errorText ?? 'unknown network failure'}`);
        }
    };
    page.on('requestfailed', recordBootstrapFailure);
    try {
        let response;
        try {
            response = await page.goto(path, { waitUntil: 'domcontentloaded' });
        } catch (error) {
            if (
                !(error instanceof Error) ||
                (!error.message.includes('interrupted by another navigation') &&
                    !error.message.includes('NS_BINDING_ABORTED'))
            )
                throw error;
            await page.waitForLoadState('domcontentloaded');
            response = await page.goto(path, { waitUntil: 'domcontentloaded' });
        }
        expect([200, 304], `${path}: document status`).toContain(response?.status());
        try {
            await expect(page.getByText(/Проверяем сессию/u)).toHaveCount(0, { timeout: 30_000 });
        } catch (error) {
            if (failedBootstrapRequests.length === 0) throw error;
            response = await page.reload({ waitUntil: 'domcontentloaded' });
            expect([200, 304], `${path}: recovery document status`).toContain(response?.status());
            await expect(page.getByText(/Проверяем сессию/u)).toHaveCount(0, { timeout: 30_000 });
        }
        expect(new URL(page.url()).pathname).toBe(new URL(path, 'http://local').pathname);
    } finally {
        page.off('requestfailed', recordBootstrapFailure);
    }
}

async function setControl(
    page: Page,
    cookie: 'family_test_control' | 'commerce_test_control',
    control: { path: string; method: 'GET' | 'POST'; value: 403 | 409 | 412 | 503; message?: string },
) {
    const value = Buffer.from(JSON.stringify({ nonce: crypto.randomUUID(), kind: 'status', ...control })).toString(
        'base64url',
    );
    await page.context().addCookies([{ name: cookie, value, url: 'http://localhost:3000' }]);
}

async function createFamilyList(page: Page, title: string) {
    await gotoExact(page, '/family/shopping');
    await page.getByLabel('Новый список').fill(title);
    await page.getByRole('button', { name: 'Создать список' }).click();
    await page.waitForURL(/\/family\/shopping\/[0-9a-f-]{36}$/u);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
}

async function addListItem(page: Page, name: string, quantity: string) {
    await page.getByRole('button', { name: 'Добавить товар' }).click();
    const form = page.getByRole('heading', { name: 'Добавить товар' }).locator('..');
    await form.getByLabel('Название').fill(name);
    await form.getByLabel('Количество').fill(quantity);
    await form.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
}

async function openPurchaseReview(page: Page) {
    await page.getByRole('button', { name: 'Проверить покупку' }).click();
    return page.getByRole('heading', { name: 'Проверить покупку' }).locator('..');
}

test('family setup creates once, reads the result back and survives reload', async ({ page }) => {
    await login(page, 'pro1');
    await gotoExact(page, '/family/setup');
    await expect(page.getByText(/Базовый семейный лимит — 4 участника/u)).toBeVisible();
    await page.getByLabel('Название семьи').fill('  Дом без дублей  ');
    let createRequests = 0;
    page.on('request', (request) => {
        if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/family') createRequests++;
    });
    await page.getByRole('button', { name: 'Создать семью' }).evaluate((button: HTMLButtonElement) => {
        button.click();
        button.click();
    });
    await page.waitForURL((url) => url.pathname === '/family');
    await expect(page.getByRole('heading', { level: 1, name: 'Дом без дублей' })).toBeVisible();
    expect(createRequests).toBe(1);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Дом без дублей' })).toBeVisible();
    await expect(page.getByText('1 из 4 мест', { exact: false })).toBeVisible();
});

test('family setup reports an existing membership and blocks an ineligible Free account', async ({ page }) => {
    await login(page, 'plus1');
    await gotoExact(page, '/family/setup');
    await expect(page.getByRole('heading', { name: 'Вы уже состоите в семье' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Открыть семью' })).toHaveAttribute('href', '/family');

    await switchUser(page, 'user1');
    await gotoExact(page, '/family/setup');
    await expect(page.getByRole('heading', { name: 'Нужен Plus или Pro' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Посмотреть Plus' })).toHaveAttribute('href', '/settings/subscription');
    await expect(page.getByLabel('Название семьи')).toHaveCount(0);
});

test('family setup preserves input across max-members, stale and 503 outcomes, then replays safely', async ({
    page,
}) => {
    await login(page, 'pro2');
    await gotoExact(page, '/family/setup');
    const input = page.getByLabel('Название семьи');
    await input.fill('Семья после восстановления');

    await setControl(page, 'family_test_control', {
        path: '/api/v1/family',
        method: 'POST',
        value: 409,
        message: 'В семье больше нет свободных мест',
    });
    await page.getByRole('button', { name: 'Создать семью' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'В семье больше нет свободных мест' })).toBeVisible();
    await expect(input).toHaveValue('Семья после восстановления');
    await expect(input).toBeEnabled();

    await setControl(page, 'family_test_control', {
        path: '/api/v1/family',
        method: 'POST',
        value: 412,
    });
    await page.getByRole('button', { name: 'Создать семью' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Состояние изменилось' })).toBeVisible();
    await expect(input).toHaveValue('Семья после восстановления');
    await expect(input).toBeEnabled();

    await setControl(page, 'family_test_control', {
        path: '/api/v1/family',
        method: 'POST',
        value: 503,
    });
    await page.getByRole('button', { name: 'Создать семью' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Результат запроса неизвестен' })).toBeVisible();
    await expect(input).toHaveValue('Семья после восстановления');
    await expect(input).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Перечитать состояние семьи' })).toBeVisible();
    await page.getByRole('button', { name: 'Повторить сохранённый запрос' }).click();
    await page.waitForURL((url) => url.pathname === '/family');
    await expect(page.getByRole('heading', { name: 'Семья после восстановления' })).toBeVisible();
});

test('family purchase covers partial allocation, overage, unknown quantity, detail resolution and reload', async ({
    page,
}) => {
    await prewarmRoutes(page, ['/family/shopping', '/family/purchases/00000000-0000-4000-8000-000000000001']);
    await login(page, 'plus1');
    await createFamilyList(page, 'Семейная покупка целиком');
    await addListItem(page, 'Семейные яблоки', '2');
    await addListItem(page, 'Семейный рис', '4');
    const review = await openPurchaseReview(page);
    const positions = review.getByRole('group', { name: /Позиция/u });
    await positions.nth(0).getByLabel('Фактически куплено').fill('3');
    await positions.nth(0).getByLabel('Продукт каталога').selectOption('10000000-0000-4000-8000-000000000002');
    await positions.nth(0).getByLabel('Добавить эту позицию в семейные запасы').uncheck();
    await positions.nth(1).getByLabel('Фактически куплено').fill('1');
    await positions.nth(1).getByLabel('Продукт каталога').selectOption('10000000-0000-4000-8000-000000000003');
    await positions.nth(1).getByLabel('Добавить эту позицию в семейные запасы').uncheck();
    await review.getByRole('button', { name: 'Добавить позицию вручную' }).click();
    await expect(positions).toHaveCount(3);
    await positions.nth(2).getByLabel('Фактическое название').fill('Неизвестный семейный товар');
    await positions.nth(2).getByLabel('Продукт каталога').selectOption('10000000-0000-4000-8000-000000000002');
    await review.getByRole('button', { name: 'Рассчитать поступление' }).click();
    await expect(review.getByText(/избыток 1/u)).toBeVisible();
    await expect(review.getByText(/осталось купить 3/u)).toBeVisible();
    await review.getByRole('button', { name: 'Подтвердить покупку и поступление' }).click();
    await expect(page.getByRole('heading', { name: 'Покупка подтверждена' })).toBeVisible();
    await expect(page.getByText(/Неизвестных количеств: 1/u)).toBeVisible();
    const purchasePath = await page
        .getByRole('link', { name: 'Открыть покупку отдельной страницей' })
        .getAttribute('href');
    expect(purchasePath).toBeTruthy();
    await gotoExact(page, purchasePath!);
    await page.reload();
    const unknown = page.getByRole('article').filter({ hasText: 'Неизвестный семейный товар' });
    await unknown.getByRole('button', { name: 'Уточнить и добавить в запасы' }).click();
    await unknown.getByLabel('Фактически куплено').fill('1');
    await unknown.getByLabel('Единица').selectOption('kg');
    await unknown.getByLabel('Место хранения').selectOption({ index: 1 });
    await unknown.getByRole('button', { name: 'Проверить поступление' }).click();
    await unknown.getByRole('button', { name: 'Подтвердить поступление' }).click();
    await expect(unknown.getByText(/Уже поступило в запасы/u)).toBeVisible();
});

test('family purchase preserves its draft on 403, 409, 412 and unknown 503 without duplicate commits', async ({
    page,
}) => {
    await installFetchCounter(page, '/purchase-commit');
    await prewarmRoutes(page, ['/family/shopping']);
    await login(page, 'plus1');
    await createFamilyList(page, 'Семейная покупка с ошибками');
    await addListItem(page, 'Гречка для ошибок', '2');
    const review = await openPurchaseReview(page);
    await review.getByLabel('Фактически куплено').fill('2');
    await review.getByLabel('Продукт каталога').selectOption('10000000-0000-4000-8000-000000000003');
    await review.getByLabel('Добавить эту позицию в семейные запасы').uncheck();
    const listId = new URL(page.url()).pathname.split('/').at(-1)!;
    const previewPath = `/api/v1/shopping-lists/${listId}/purchase-preview`;
    const commitPath = `/api/v1/shopping-lists/${listId}/purchase-commit`;

    await setControl(page, 'commerce_test_control', { path: previewPath, method: 'POST', value: 503 });
    await review.getByRole('button', { name: 'Рассчитать поступление' }).click();
    await expect(review.getByRole('alert')).toContainText('Сервис временно недоступен');
    await expect(review.getByLabel('Фактически куплено')).toHaveValue('2');
    await review.getByRole('button', { name: 'Рассчитать поступление' }).click();
    await expect(review.getByRole('heading', { name: 'Результат после подтверждения' })).toBeVisible();

    for (const status of [403, 409, 412] as const) {
        await setControl(page, 'commerce_test_control', { path: commitPath, method: 'POST', value: status });
        await review.getByRole('button', { name: 'Подтвердить покупку и поступление' }).click();
        await expect(review.getByRole('alert')).toBeVisible();
        await expect(review.getByLabel('Фактически куплено')).toHaveValue('2');
    }

    const commitRequestsBefore = await fetchCount(page);
    await setControl(page, 'commerce_test_control', { path: commitPath, method: 'POST', value: 503 });
    await review
        .getByRole('button', { name: 'Подтвердить покупку и поступление' })
        .evaluate((button: HTMLButtonElement) => {
            button.click();
            button.click();
        });
    await expect(review.getByRole('button', { name: 'Повторить сохранённый запрос' })).toBeVisible();
    expect(await fetchCount(page)).toBe((commitRequestsBefore ?? 0) + 1);
    await review.getByRole('button', { name: 'Повторить сохранённый запрос' }).click();
    await expect(page.getByRole('heading', { name: 'Покупка подтверждена' })).toBeVisible();
});

test('family purchase detail rejects cross-scope and outsider IDs while owner readback remains reload-safe', async ({
    page,
}) => {
    await login(page, 'plus1');
    await createFamilyList(page, 'Семейная покупка для IDOR');
    await addListItem(page, 'Товар семейного владельца', '1');
    const review = await openPurchaseReview(page);
    await review.getByLabel('Фактически куплено').fill('1');
    await review.getByLabel('Продукт каталога').selectOption('10000000-0000-4000-8000-000000000002');
    await review.getByLabel('Добавить эту позицию в семейные запасы').uncheck();
    await review.getByRole('button', { name: 'Рассчитать поступление' }).click();
    await review.getByRole('button', { name: 'Подтвердить покупку и поступление' }).click();
    const familyPath = await page
        .getByRole('link', { name: 'Открыть покупку отдельной страницей' })
        .getAttribute('href');
    expect(familyPath).toBeTruthy();
    await gotoExact(page, familyPath!);
    await expect(page.getByRole('heading', { name: 'Позиции покупки' })).toBeVisible();
    await page.reload();
    await expect(page.getByText('Товар семейного владельца', { exact: true })).toBeVisible();

    const purchaseId = familyPath!.split('/').at(-1)!;
    await gotoExact(page, `/purchases/${purchaseId}`);
    await expect(page.getByRole('alert').filter({ hasText: 'Покупка недоступна' })).toBeVisible();

    await switchUser(page, 'user1');
    await gotoExact(page, familyPath!);
    await expect(page.getByRole('alert').filter({ hasText: 'Покупка недоступна' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('alert').filter({ hasText: 'Покупка недоступна' })).toBeVisible();
});
