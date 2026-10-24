import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';

const missingId = '00000000-0000-4000-8000-000000000099';

function contextOptions(testInfo: TestInfo) {
    const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = testInfo.project.use;
    return { baseURL: 'http://localhost:3000', viewport, userAgent, deviceScaleFactor, isMobile, hasTouch };
}

async function loggedContext(browser: Browser, testInfo: TestInfo, email: string) {
    const context = await browser.newContext(contextOptions(testInfo));
    const page = await context.newPage();
    await page.goto('/auth');
    await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    await page.evaluate(() => navigator.serviceWorker.ready);
    if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    }
    await page.getByLabel('Электронная почта', { exact: true }).fill(email);
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 60_000 }).toBe('/');
    await page.waitForTimeout(1_000);
    return { context, page };
}

async function gotoExact(page: Page, path: string, status = 200) {
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
    expect(response?.status(), `${path}: document status`).toBe(status);
    await expect(page.getByRole('banner'))
        .toBeVisible({ timeout: 30_000 })
        .catch(async () => {
            await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
            await expect(page.getByRole('banner')).toBeVisible({ timeout: 30_000 });
        });
    await expect(page.getByText('Проверяем сессию', { exact: true })).toHaveCount(0, { timeout: 30_000 });
    expect(new URL(page.url()).pathname, `${path}: final pathname`).toBe(path);
    // Let the fresh Next dev server finish route compilation/Fast Refresh before the next hard navigation.
    await page.waitForTimeout(1_000);
}

async function firstHref(page: Page, listPath: string, prefix: string) {
    await gotoExact(page, listPath);
    const link = page.locator(`a[href^="${prefix}"]:visible`).first();
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    expect(href).toBeTruthy();
    return new URL(href!, 'http://localhost:3000').pathname;
}

async function expectInventoryMissing(page: Page, path: string) {
    await gotoExact(page, path);
    await expect(page.getByRole('heading', { name: 'Запись недоступна' })).toBeVisible();
}

async function expectPreserveMissing(page: Page, path: string) {
    await gotoExact(page, path);
    await expect(page.getByRole('heading', { name: 'Заготовка недоступна' })).toBeVisible();
}

async function createReceiptAndPurchase(page: Page, family: boolean) {
    const root = family ? '/family' : '';
    await gotoExact(page, `${root}/receipts/new`);
    await page.getByLabel('Исходный распознанный текст').fill('Проверочная позиция');
    await page.getByRole('button', { name: 'Разобрать текст на строки для проверки' }).click();
    await page.getByRole('checkbox', { name: 'Продукт питания' }).uncheck();
    await page.getByRole('button', { name: 'Сохранить чек и перейти к поступлению' }).click();
    await expect
        .poll(() => new URL(page.url()).pathname, { timeout: 60_000 })
        .toMatch(new RegExp(`^${root}/receipts/[0-9a-f-]{36}$`, 'u'));
    const receiptPath = new URL(page.url()).pathname;
    await expect(page.getByRole('heading', { name: 'Чек', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Проверить поступление' }).click();
    await page.getByRole('button', { name: 'Рассчитать поступление' }).click();
    await expect(page.getByRole('heading', { name: 'Результат после подтверждения' })).toBeVisible();
    await page.getByRole('button', { name: 'Подтвердить покупку и поступление' }).click();
    const purchase = page.getByRole('link', { name: 'Открыть покупку отдельной страницей' });
    await expect(purchase).toBeVisible();
    const purchaseHref = await purchase.getAttribute('href');
    expect(purchaseHref).toBeTruthy();
    return { receiptPath, purchasePath: new URL(purchaseHref!, 'http://localhost:3000').pathname };
}

async function expectShoppingMissing(page: Page, path: string, kind: 'list' | 'receipt' | 'purchase') {
    await gotoExact(page, path);
    if (kind === 'list') await expect(page.getByRole('alert').filter({ hasText: 'Список недоступен.' })).toBeVisible();
    if (kind === 'receipt') await expect(page.getByRole('alert').filter({ hasText: 'Чек недоступен.' })).toBeVisible();
    if (kind === 'purchase')
        await expect(page.getByRole('alert').filter({ hasText: 'Покупка недоступна.' })).toBeVisible();
}

test('inventory and preserves keep personal/family scopes isolated and expose reversible actions', async ({
    browser,
}, testInfo) => {
    const owner = await loggedContext(browser, testInfo, 'plus1@meal-planner.test');
    const outsider = await loggedContext(browser, testInfo, 'user1@meal-planner.test');
    try {
        const personalBatch = await firstHref(owner.page, '/inventory', '/inventory/batches/');
        await gotoExact(owner.page, personalBatch);
        const personalBatchHeading = await owner.page.getByRole('heading', { level: 1 }).textContent();
        expect(personalBatchHeading).toBeTruthy();
        await owner.page.getByText('Другие действия', { exact: true }).click();
        await owner.page.getByRole('button', { name: 'В архив', exact: true }).click();
        await owner.page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
        await expect(
            owner.page.getByRole('button', { name: 'Восстановить', exact: true }).filter({ visible: true }).last(),
        ).toBeVisible();

        const familyBatch = await firstHref(owner.page, '/family/inventory', '/family/inventory/batches/');
        await gotoExact(owner.page, familyBatch);
        await expect(owner.page.getByText(/Семья · Активна/u)).toBeVisible();
        await expectInventoryMissing(owner.page, `/family/inventory/batches/${personalBatch.split('/').at(-1)}`);
        await expectInventoryMissing(owner.page, `/inventory/batches/${familyBatch.split('/').at(-1)}`);
        await expectInventoryMissing(owner.page, `/inventory/batches/${missingId}`);
        await expectInventoryMissing(outsider.page, personalBatch);
        await expectInventoryMissing(outsider.page, familyBatch);

        const personalPreserve = await firstHref(owner.page, '/preserves', '/preserves/');
        await gotoExact(owner.page, personalPreserve);
        const preserveHeading = await owner.page.getByRole('heading', { level: 1 }).textContent();
        expect(preserveHeading).toBeTruthy();
        await owner.page.getByRole('button', { name: 'В архив', exact: true }).click();
        await expect(owner.page.getByRole('heading', { name: 'Перенести в архив' })).toBeVisible();
        await owner.page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
        await expect(owner.page.getByText(/В архиве/u).first()).toBeVisible();

        const familyPreserve = await firstHref(owner.page, '/family/preserves', '/family/preserves/');
        await gotoExact(owner.page, familyPreserve);
        await expect(owner.page.getByText(/Доступна семье/u)).toBeVisible();
        await expectPreserveMissing(owner.page, `/family/preserves/${personalPreserve.split('/').at(-1)}`);
        await expectPreserveMissing(owner.page, `/preserves/${familyPreserve.split('/').at(-1)}`);
        await expectPreserveMissing(owner.page, `/preserves/${missingId}`);
        await expectPreserveMissing(outsider.page, personalPreserve);
        await expectPreserveMissing(outsider.page, familyPreserve);
    } finally {
        await Promise.all([owner.context.close(), outsider.context.close()]);
    }
});

test('shopping, receipt and purchase IDs remain isolated across owner, family and outsider', async ({
    browser,
}, testInfo) => {
    const owner = await loggedContext(browser, testInfo, 'plus1@meal-planner.test');
    const outsider = await loggedContext(browser, testInfo, 'user1@meal-planner.test');
    try {
        const personalList = await firstHref(owner.page, '/shopping', '/shopping/');
        await gotoExact(owner.page, personalList);
        const checkbox = owner.page.getByRole('checkbox').first();
        const before = await checkbox.isChecked();
        await checkbox.click();
        await expect(checkbox).toBeChecked({ checked: !before });

        const familyList = await firstHref(owner.page, '/family/shopping', '/family/shopping/');
        await gotoExact(owner.page, familyList);
        await expect(owner.page.getByText('Общие списки семьи · Plus')).toBeVisible();
        await expectShoppingMissing(owner.page, `/family/shopping/${personalList.split('/').at(-1)}`, 'list');
        await expectShoppingMissing(owner.page, `/shopping/${familyList.split('/').at(-1)}`, 'list');
        await expectShoppingMissing(owner.page, `/shopping/${missingId}`, 'list');
        await expectShoppingMissing(outsider.page, personalList, 'list');
        await expectShoppingMissing(outsider.page, familyList, 'list');

        const personal = await createReceiptAndPurchase(owner.page, false);
        await gotoExact(owner.page, personal.purchasePath);
        await expect(owner.page.getByRole('heading', { name: 'Покупка', exact: true })).toBeVisible();
        const family = await createReceiptAndPurchase(owner.page, true);
        await gotoExact(owner.page, family.purchasePath);
        await expect(owner.page.getByRole('heading', { name: 'Покупка', exact: true })).toBeVisible();

        await expectShoppingMissing(
            owner.page,
            `/family/receipts/${personal.receiptPath.split('/').at(-1)}`,
            'receipt',
        );
        await expectShoppingMissing(owner.page, `/receipts/${family.receiptPath.split('/').at(-1)}`, 'receipt');
        await expectShoppingMissing(
            owner.page,
            `/family/purchases/${personal.purchasePath.split('/').at(-1)}`,
            'purchase',
        );
        await expectShoppingMissing(owner.page, `/purchases/${family.purchasePath.split('/').at(-1)}`, 'purchase');
        await expectShoppingMissing(owner.page, `/receipts/${missingId}`, 'receipt');
        await expectShoppingMissing(owner.page, `/purchases/${missingId}`, 'purchase');
        await expectShoppingMissing(outsider.page, personal.receiptPath, 'receipt');
        await expectShoppingMissing(outsider.page, personal.purchasePath, 'purchase');
        await expectShoppingMissing(outsider.page, family.receiptPath, 'receipt');
        await expectShoppingMissing(outsider.page, family.purchasePath, 'purchase');
    } finally {
        await Promise.all([owner.context.close(), outsider.context.close()]);
    }
});

test('support and finance details use UI-created IDs, persist actions and reject foreign/missing IDs', async ({
    browser,
}, testInfo) => {
    const supportOwner = await loggedContext(browser, testInfo, 'user1@meal-planner.test');
    const supportForeign = await loggedContext(browser, testInfo, 'user2@meal-planner.test');
    try {
        await gotoExact(supportOwner.page, '/support/new');
        await supportOwner.page.getByRole('textbox', { name: 'Тема', exact: true }).fill('Проверка dynamic route');
        await supportOwner.page.getByLabel('Сообщение').fill('Первое сообщение для browser-проверки.');
        const createResponsePromise = supportOwner.page.waitForResponse(
            (response) => response.request().method() === 'POST' && response.url().endsWith('/api/v1/support'),
        );
        await supportOwner.page.getByRole('button', { name: 'Отправить обращение' }).click();
        const createResponse = await createResponsePromise;
        expect(createResponse.status(), await createResponse.text()).toBe(200);
        await expect
            .poll(() => new URL(supportOwner.page.url()).pathname, { timeout: 60_000 })
            .toMatch(/^\/support\/[0-9a-f-]{36}$/u);
        const supportPath = new URL(supportOwner.page.url()).pathname;
        await expect(supportOwner.page.getByRole('heading', { name: 'Проверка dynamic route' })).toBeVisible();
        await supportOwner.page
            .getByRole('heading', { name: 'Ответить' })
            .locator('..')
            .getByRole('textbox')
            .fill('Ответ владельца.');
        await supportOwner.page.getByRole('button', { name: 'Отправить', exact: true }).click();
        await expect(supportOwner.page.getByText('Ответ владельца.', { exact: true })).toBeVisible();
        await gotoExact(supportForeign.page, supportPath);
        await expect(supportForeign.page.getByRole('heading', { name: 'Обращение недоступно' })).toBeVisible();
        await gotoExact(supportOwner.page, `/support/${missingId}`);
        await expect(supportOwner.page.getByRole('heading', { name: 'Обращение недоступно' })).toBeVisible();
    } finally {
        await Promise.all([supportOwner.context.close(), supportForeign.context.close()]);
    }

    const owner = await loggedContext(browser, testInfo, 'pro1@meal-planner.test');
    const foreign = await loggedContext(browser, testInfo, 'pro2@meal-planner.test');
    try {
        await gotoExact(owner.page, '/finance/expenses');
        await owner.page
            .getByRole('button', { name: /Добавить расход/u })
            .first()
            .click();
        await expect(owner.page.getByRole('heading', { name: 'Добавить расход' })).toBeVisible();
        await owner.page.getByLabel('Сумма, ₽', { exact: true }).fill('1250');
        await owner.page
            .getByRole('checkbox', { name: 'Я согласен сохранить сумму в личной финансовой истории Pro.' })
            .check();
        await owner.page.getByRole('button', { name: 'Сохранить', exact: true }).click();
        const expenseLink = owner.page.locator('a[href^="/finance/expenses/"]').first();
        await expect(expenseLink).toBeVisible();
        const expensePath = new URL((await expenseLink.getAttribute('href'))!, 'http://localhost:3000').pathname;
        await gotoExact(owner.page, expensePath);
        await expect(owner.page.getByRole('heading', { name: /1\s?250,00\s?₽/u })).toBeVisible();
        await owner.page.getByLabel('Сумма, ₽').fill('1300');
        await owner.page.getByRole('button', { name: 'Сохранить изменения' }).click();
        await expect(owner.page.getByRole('heading', { name: /1\s?300,00\s?₽/u })).toBeVisible();
        await gotoExact(foreign.page, expensePath);
        await expect(foreign.page.getByRole('heading', { name: 'Финансы не загрузились' })).toBeVisible();
        await gotoExact(owner.page, `/finance/expenses/${missingId}`);
        await expect(owner.page.getByRole('heading', { name: 'Финансы не загрузились' })).toBeVisible();
    } finally {
        await Promise.all([owner.context.close(), foreign.context.close()]);
    }
});

test('private and family recipe editors preserve author rights; report detail stays reporter-only', async ({
    browser,
}, testInfo) => {
    const owner = await loggedContext(browser, testInfo, 'plus1@meal-planner.test');
    const familyMember = await loggedContext(browser, testInfo, 'plus2@meal-planner.test');
    const foreign = await loggedContext(browser, testInfo, 'user2@meal-planner.test');
    try {
        await gotoExact(owner.page, '/recipes/new');
        await owner.page.getByLabel('Название', { exact: true }).fill('Личный dynamic рецепт');
        await owner.page.getByRole('button', { name: '+ Молоко 2,5%', exact: true }).click();
        await owner.page.getByRole('button', { name: '+ Добавить шаг', exact: true }).click();
        await owner.page.getByLabel('Шаг 1', { exact: true }).fill('Проверить сохранение.');
        await owner.page.getByRole('button', { name: 'Сохранить черновик', exact: true }).click();
        await expect
            .poll(() => new URL(owner.page.url()).pathname, { timeout: 60_000 })
            .toMatch(/^\/recipes\/[0-9a-f-]{36}\/edit$/u);
        const privateEditPath = new URL(owner.page.url()).pathname;
        await expect(owner.page.getByRole('heading', { name: 'Редактор рецепта' })).toBeVisible();
        await owner.page.getByLabel('Название', { exact: true }).fill('Личный dynamic рецепт обновлён');
        await owner.page.getByRole('button', { name: 'Сохранить черновик', exact: true }).click();
        await expect(owner.page.getByLabel('Название', { exact: true })).toHaveValue('Личный dynamic рецепт обновлён');
        await gotoExact(foreign.page, privateEditPath);
        await expect(foreign.page.getByRole('heading', { name: 'Рецепт недоступен' })).toBeVisible();
        await gotoExact(owner.page, `/recipes/${missingId}/edit`);
        await expect(owner.page.getByRole('heading', { name: 'Рецепт недоступен' })).toBeVisible();

        await gotoExact(owner.page, '/family/recipes/new');
        await owner.page.getByLabel('Название', { exact: true }).fill('Семейный dynamic рецепт');
        await owner.page.getByRole('button', { name: '+ Молоко 2,5%', exact: true }).click();
        await owner.page.getByRole('button', { name: '+ Добавить шаг', exact: true }).click();
        await owner.page.getByLabel('Шаг 1', { exact: true }).fill('Семейный шаг.');
        await owner.page.getByRole('button', { name: 'Сохранить черновик', exact: true }).click();
        await expect
            .poll(() => new URL(owner.page.url()).pathname, { timeout: 60_000 })
            .toMatch(/^\/family\/recipes\/[0-9a-f-]{36}\/edit$/u);
        const familyEditPath = new URL(owner.page.url()).pathname;
        await expect(owner.page.getByRole('heading', { name: 'Редактор рецепта' })).toBeVisible();
        await gotoExact(familyMember.page, familyEditPath);
        await expect(familyMember.page.getByRole('heading', { name: 'Рецепт недоступен' })).toBeVisible();
        await gotoExact(owner.page, `/family/recipes/${missingId}/edit`);
        await expect(owner.page.getByRole('heading', { name: 'Рецепт недоступен' })).toBeVisible();

        await gotoExact(owner.page, '/recipes/70000000-0000-4000-8000-000000000001');
        await owner.page.getByRole('link', { name: /^Комментарии \(/u }).click();
        await expect(owner.page.getByRole('heading', { name: 'Комментарии', exact: true })).toBeVisible();
        await owner.page.getByRole('button', { name: 'Пожаловаться на рецепт', exact: true }).click();
        const report = owner.page.getByRole('dialog', { name: 'Жалоба', exact: true });
        await report.getByRole('combobox', { name: /Причина/u }).selectOption('quality');
        await report.getByRole('button', { name: 'Отправить жалобу' }).click();
        await expect(report).not.toBeVisible();
        await gotoExact(owner.page, '/reports');
        const reportLink = owner.page.locator('a[href^="/reports/"]').first();
        await expect(reportLink).toBeVisible();
        const reportPath = new URL((await reportLink.getAttribute('href'))!, 'http://localhost:3000').pathname;
        await gotoExact(owner.page, reportPath);
        await expect(owner.page.getByRole('heading', { name: 'Карточка жалобы' })).toBeVisible();
        await expect(owner.page.getByText('Причина: quality')).toBeVisible();
        await gotoExact(foreign.page, reportPath);
        await expect(foreign.page.getByRole('heading', { name: 'Рецепт недоступен' })).toBeVisible();
        await gotoExact(owner.page, `/reports/${missingId}`);
        await expect(owner.page.getByRole('heading', { name: 'Рецепт недоступен' })).toBeVisible();
    } finally {
        await Promise.all([owner.context.close(), familyMember.context.close(), foreign.context.close()]);
    }
});
