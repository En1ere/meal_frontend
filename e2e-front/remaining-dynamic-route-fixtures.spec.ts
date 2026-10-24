import { expect, test, type Page } from '@playwright/test';

const missingId = '00000000-0000-4000-8000-000000000099';

async function ensureServiceWorker(page: Page) {
    await page.evaluate(() => navigator.serviceWorker.ready);
    const controlled = () =>
        page.evaluate(() => navigator.serviceWorker.controller?.scriptURL.endsWith('/mockServiceWorker.js') ?? false);
    if (!(await controlled())) {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    }
    await expect.poll(controlled, { timeout: 30_000 }).toBe(true);
}

async function login(page: Page, email: string) {
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
    await expect(page.getByText('Проверяем сессию', { exact: true })).toHaveCount(0, { timeout: 30_000 });
    // Firefox can complete the document request before Next.js finishes a same-URL RSC navigation.
    // Waiting for the route to become idle prevents assertions from racing that second navigation.
    await page.waitForLoadState('networkidle', { timeout: 30_000 });
    expect(new URL(page.url()).pathname, `${path}: final pathname`).toBe(
        new URL(path, 'http://localhost:3000').pathname,
    );
}

async function dynamicHref(page: Page, listPath: string, selector: string) {
    await gotoExact(page, listPath);
    const link = page.locator(selector).filter({ visible: true }).first();
    await expect(link).toBeVisible({ timeout: 30_000 });
    const href = await link.getAttribute('href');
    expect(href).toBeTruthy();
    return new URL(href!, 'http://localhost:3000').pathname;
}

async function expectValidHeading(page: Page, path: string, heading?: string | RegExp) {
    await gotoExact(page, path);
    const landmark = page.locator('main').getByRole('heading', { level: 1 }).filter({ visible: true }).first();
    await expect(landmark).toBeVisible({ timeout: 30_000 });
    if (heading)
        await expect(page.getByRole('heading', { name: heading, exact: typeof heading === 'string' })).toBeVisible({
            timeout: 30_000,
        });
}

test('personal inventory and preserve details use real seeded IDs and reject missing IDs', async ({ page }) => {
    await login(page, 'user1@meal-planner.test');
    const inventory = await dynamicHref(page, '/inventory', 'a[href^="/inventory/batches/"]');
    await expectValidHeading(page, inventory);
    await gotoExact(page, `/inventory/batches/${missingId}`);
    await expect(page.getByRole('heading', { name: 'Запись недоступна' })).toBeVisible();

    const preserve = await dynamicHref(page, '/preserves', 'a[href^="/preserves/"]');
    await expectValidHeading(page, preserve);
    await gotoExact(page, `/preserves/${missingId}`);
    await expect(page.getByRole('heading', { name: 'Заготовка недоступна' })).toBeVisible();
});

test('family inventory and preserve details use real seeded IDs and reject missing IDs', async ({ page }) => {
    await login(page, 'plus1@meal-planner.test');
    const familyInventory = await dynamicHref(page, '/family/inventory', 'a[href^="/family/inventory/batches/"]');
    await expectValidHeading(page, familyInventory);
    await gotoExact(page, `/family/inventory/batches/${missingId}`);
    await expect(page.getByRole('heading', { name: 'Запись недоступна' })).toBeVisible();

    const familyPreserve = await dynamicHref(page, '/family/preserves', 'a[href^="/family/preserves/"]');
    await expectValidHeading(page, familyPreserve);
    await gotoExact(page, `/family/preserves/${missingId}`);
    await expect(page.getByRole('heading', { name: 'Заготовка недоступна' })).toBeVisible();
});

test('personal shopping details use real lists and scoped receipt/purchase fixtures', async ({ page }) => {
    await login(page, 'user1@meal-planner.test');
    const shopping = await dynamicHref(page, '/shopping', 'a[href^="/shopping/"]');
    await expectValidHeading(page, shopping);
    await gotoExact(page, `/shopping/${missingId}`);
    await expect(page.getByRole('alert').first()).toBeVisible();

    await expectValidHeading(page, '/receipts/a1000000-0000-4000-8000-000000000007', 'Чек');
    await gotoExact(page, `/receipts/${missingId}`);
    await expect(page.getByRole('alert').filter({ hasText: 'Чек недоступен' })).toBeVisible();
    await expectValidHeading(page, '/purchases/a2000001-0000-4000-8000-000000000007', 'Покупка');
    await gotoExact(page, `/purchases/${missingId}`);
    await expect(page.getByRole('alert').filter({ hasText: 'Покупка недоступна' })).toBeVisible();
});

test('family shopping details use real lists and scoped receipt/purchase fixtures', async ({ page }) => {
    await login(page, 'plus1@meal-planner.test');
    const familyShopping = await dynamicHref(page, '/family/shopping', 'a[href^="/family/shopping/"]');
    await expectValidHeading(page, familyShopping);
    await gotoExact(page, `/family/shopping/${missingId}`);
    await expect(page.getByRole('alert').first()).toBeVisible();

    await expectValidHeading(page, '/family/receipts/a1000000-0000-4000-8000-000000000001', 'Чек');
    await gotoExact(page, `/family/receipts/${missingId}`);
    await expect(page.getByRole('alert').filter({ hasText: 'Чек недоступен' })).toBeVisible();
    await expectValidHeading(page, '/family/purchases/a2000001-0000-4000-8000-000000000001', 'Покупка');
    await gotoExact(page, `/family/purchases/${missingId}`);
    await expect(page.getByRole('alert').filter({ hasText: 'Покупка недоступна' })).toBeVisible();
});

test('AI and support dynamic details are opened from real list fixtures', async ({ page }) => {
    await login(page, 'user1@meal-planner.test');
    const conversation = await dynamicHref(page, '/ai/history', 'a[href^="/ai/"]:has-text("Открыть беседу")');
    await expectValidHeading(page, conversation);
    await gotoExact(page, `/ai/${missingId}`);
    await expect(page.getByRole('alert').first()).toBeVisible();

    const support = await dynamicHref(page, '/support', 'a[href^="/support/"]:has(h2)');
    await expectValidHeading(page, support);
    await gotoExact(page, `/support/${missingId}`);
    await expect(page.getByRole('heading', { name: 'Обращение недоступно' })).toBeVisible();
});

test('family recipe detail and editor are opened from a real list fixture', async ({ page }) => {
    await login(page, 'plus1@meal-planner.test');
    await gotoExact(page, '/family/recipes/new');
    await page.getByLabel('Название', { exact: true }).fill('Семейный проверочный рецепт');
    await page.getByRole('button', { name: 'Сохранить черновик', exact: true }).click();
    await page.waitForURL(/\/family\/recipes\/[a-f0-9-]+\/edit$/);
    const familyRecipe = new URL(page.url()).pathname.replace(/\/edit$/, '');
    await expectValidHeading(page, familyRecipe);
    await gotoExact(page, `/family/recipes/${missingId}`);
    await expect(page.getByRole('alert').first()).toBeVisible();
    await gotoExact(page, `${familyRecipe}/edit`);
    await expect(
        page.locator('main').getByRole('heading', { level: 1 }).filter({ visible: true }).first(),
    ).toBeVisible();
    await gotoExact(page, `/family/recipes/${missingId}/edit`);
    await expect(page.getByRole('alert').first()).toBeVisible();
});

test('personal recipe draft opens its editor and cook route while missing IDs fail closed', async ({ page }) => {
    await login(page, 'user1@meal-planner.test');
    await gotoExact(page, '/recipes/new');
    await page.getByLabel('Название', { exact: true }).fill('Личный проверочный рецепт');
    await page.getByRole('button', { name: 'Сохранить черновик', exact: true }).click();
    await page.waitForURL(/\/recipes\/[a-f0-9-]+\/edit$/);
    await expect(page.getByRole('heading', { name: 'Редактор рецепта', exact: true })).toBeVisible();
    const recipeId = new URL(page.url()).pathname.split('/').at(-2)!;

    await expectValidHeading(page, `/recipes/${recipeId}/cook`, 'Приготовление');
    await gotoExact(page, `/recipes/${missingId}/cook`);
    await expect(page.getByRole('heading', { name: 'Рецепт недоступен' })).toBeVisible({ timeout: 30_000 });
    await gotoExact(page, `/recipes/${missingId}/edit`);
    await expect(page.getByRole('heading', { name: 'Рецепт недоступен' })).toBeVisible({ timeout: 30_000 });
});

test('finance expense detail is reachable after creation and a missing expense fails closed', async ({ page }) => {
    await login(page, 'pro1@meal-planner.test');
    await gotoExact(page, '/finance/expenses');
    await page.getByRole('button', { name: '＋ Добавить расход', exact: true }).click();
    const form = page
        .locator('form')
        .filter({ has: page.getByRole('heading', { name: 'Добавить расход', exact: true }) });
    await form.getByLabel('Сумма, ₽').fill('1250');
    await form.getByRole('checkbox').check();
    await form.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Добавить расход', exact: true })).toHaveCount(0);
    const expense = await dynamicHref(page, '/finance/expenses', 'a[href^="/finance/expenses/"]');
    await expectValidHeading(page, expense, /1\s?250,00\s₽/u);
    await gotoExact(page, `/finance/expenses/${missingId}`);
    await expect(page.getByRole('heading', { name: 'Финансы не загрузились' })).toBeVisible();
});

test('ownership request detail is reachable after creation, can be cancelled and rejects a missing token', async ({
    page,
}) => {
    await login(page, 'plus1@meal-planner.test');
    await gotoExact(page, '/family/ownership');
    await page.getByLabel('Новый владелец').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Проверить последствия', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Проверка передачи', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Отправить запрос', exact: true }).click();
    const requestLink = page.getByRole('link', { name: 'Открыть запрос', exact: true });
    await expect(requestLink).toBeVisible();
    const requestPath = new URL((await requestLink.getAttribute('href'))!, 'http://localhost:3000').pathname;
    await expectValidHeading(page, requestPath, 'Запрос передачи владения');
    await page.getByRole('button', { name: 'Отменить запрос', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Отменён' })).toBeVisible();
    await gotoExact(page, `/family/ownership/requests/${missingId}`);
    await expect(page.getByRole('heading', { name: 'Запрос недоступен' })).toBeVisible();
});

test('recipe report detail is reachable after submission and private to an existing report ID', async ({ page }) => {
    await login(page, 'user1@meal-planner.test');
    await gotoExact(page, '/recipes/70000000-0000-4000-8000-000000000001?tab=comments');
    await page.getByRole('button', { name: 'Пожаловаться на рецепт', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Жалоба' });
    await dialog.getByLabel('Пояснение').fill('Проверочная жалоба для карточки обращения.');
    await dialog.getByRole('button', { name: 'Отправить жалобу', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const report = await dynamicHref(page, '/reports', 'a[href^="/reports/"]');
    await expectValidHeading(page, report, 'Карточка жалобы');
    await gotoExact(page, `/reports/${missingId}`);
    await expect(page.getByRole('heading', { name: 'Рецепт недоступен' })).toBeVisible({ timeout: 30_000 });
});
