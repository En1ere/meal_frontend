import { expect, test, type Page } from '@playwright/test';

test.setTimeout(180_000);

async function ensureServiceWorker(page: Page) {
    await expect
        .poll(() => page.evaluate(async () => Boolean(await navigator.serviceWorker.ready)).catch(() => false), {
            timeout: 30_000,
        })
        .toBe(true);
    if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
        await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
        await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    }
}

async function login(page: Page, login = 'user1') {
    await page.goto('/auth');
    await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    await ensureServiceWorker(page);
    await page.getByLabel('Электронная почта', { exact: true }).fill(`${login}@meal-planner.test`);
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 60_000 }).toBe('/');
    await expect(page.getByRole('link', { name: /^Профиль:/u })).toBeVisible({ timeout: 30_000 });
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
        }
    }
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
            {
                timeout: 30_000,
            },
        )
        .toBe(true);
    expect(new URL(page.url()).pathname).toBe(new URL(path, 'http://local').pathname);
}

async function failNext(page: Page, path: string, method: 'GET' | 'POST', status: 409 | 412 | 503) {
    await setNetworkControl(page, { path, method, kind: 'status', value: status });
}

async function setNetworkControl(
    page: Page,
    control: { path: string; method: 'GET' | 'POST'; kind: 'status'; value: number },
) {
    const value = Buffer.from(JSON.stringify({ nonce: crypto.randomUUID(), ...control })).toString('base64url');
    await page.context().addCookies([{ name: 'commerce_test_control', value, url: 'http://localhost:3000' }]);
}

async function createList(page: Page, root = '', title = 'Регрессионный список') {
    await gotoExact(page, `${root}/shopping`);
    await page.getByLabel('Новый список').fill(title);
    await page.getByRole('button', { name: 'Создать список' }).click();
    await page.waitForURL((url) => new RegExp(`^${root}/shopping/[0-9a-f-]{36}$`, 'u').test(url.pathname));
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    return new URL(page.url()).pathname;
}

async function addListItem(page: Page, name: string, quantity = '2') {
    await page.getByRole('button', { name: 'Добавить товар' }).click();
    const form = page.getByRole('heading', { name: 'Добавить товар' }).locator('..');
    await form.getByLabel('Название').fill(name);
    await form.getByLabel('Количество').fill(quantity);
    await form.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
}

async function createDraftReceipt(page: Page, root = '', text = 'Яблоки') {
    await gotoExact(page, `${root}/receipts/new`);
    await page.getByLabel('Исходный распознанный текст').fill(text);
    await page.getByRole('button', { name: 'Разобрать текст на строки для проверки' }).click();
    await page.getByRole('button', { name: 'Сохранить чек и перейти к поступлению' }).click();
    await page.waitForURL((url) => new RegExp(`^${root}/receipts/[0-9a-f-]{36}$`, 'u').test(url.pathname));
    await expect(page.getByRole('heading', { name: 'Чек', exact: true })).toBeVisible();
    return new URL(page.url()).pathname;
}

test('Free list supports create, edit, reorder, status lifecycle, history, filters and browser navigation', async ({
    page,
}) => {
    await login(page);
    const path = await createList(page, '', 'Покупки для полного цикла');
    await expect(page.getByText('Список пока пуст.')).toBeVisible();
    await addListItem(page, 'Яблоки', '2');
    await addListItem(page, 'Рис', '1');

    const apples = page.getByRole('checkbox', { name: 'Яблоки', exact: true }).locator('../..');
    await apples.getByRole('button', { name: 'Изменить' }).click();
    const edit = page.getByRole('heading', { name: 'Изменить строку' }).locator('..');
    await edit.getByLabel('Требования').fill('Без повреждений');
    await edit.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Изменить строку' })).toHaveCount(0);
    await apples.getByRole('button', { name: 'Изменить' }).click();
    await expect(
        page.getByRole('heading', { name: 'Изменить строку' }).locator('..').getByLabel('Требования'),
    ).toHaveValue('Без повреждений');
    await page
        .getByRole('heading', { name: 'Изменить строку' })
        .locator('..')
        .getByRole('button', { name: 'Отмена' })
        .click();

    const rice = page.getByRole('checkbox', { name: 'Рис', exact: true }).locator('../..');
    await rice.getByRole('button', { name: 'Выше' }).click();
    await expect(
        page
            .locator('section')
            .filter({ has: page.getByRole('heading', { name: 'Товары' }) })
            .locator('strong')
            .first(),
    ).toHaveText('Рис');
    const riceCheckbox = page.getByRole('checkbox', { name: 'Рис', exact: true });
    await riceCheckbox.click();
    await expect(riceCheckbox).toBeChecked();
    await expect(page.getByText(/1 из 2 куплено/u)).toBeVisible();

    await page.getByLabel('Название', { exact: true }).fill('Покупки — обновлено');
    await page.getByRole('button', { name: 'Переименовать' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Покупки — обновлено' })).toBeVisible();
    await page.getByRole('button', { name: 'Завершить список' }).click();
    await expect(page.getByText('Завершён', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Вернуть в активные' }).click();
    await page.getByRole('button', { name: 'В архив' }).click();
    await expect(page.getByText('В архиве', { exact: true }).first()).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'История изменений' }).locator('..').getByRole('listitem'),
    ).not.toHaveCount(0);
    await page.getByRole('button', { name: 'Восстановить' }).click();
    await expect(page.getByText('Активен', { exact: true }).first()).toBeVisible();

    await gotoExact(page, '/shopping');
    const listSearch = page.getByRole('textbox', { name: 'Поиск', exact: true });
    await listSearch.fill('точно-нет-такого');
    await expect(page).toHaveURL(/q=%D1%82%D0%BE%D1%87%D0%BD%D0%BE-?/u);
    await expect(page.getByText('Списков по выбранным условиям нет.')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(path);
    await page.goForward();
    await expect(listSearch).toHaveValue('точно-нет-такого');
});

test('shopping purchase preview covers partial allocation, overage, unknown quantity and one-time resolution', async ({
    page,
}) => {
    await page.addInitScript(() => {
        const nativeFetch = window.fetch.bind(window);
        let delayed = false;
        window.fetch = async (input, init) => {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
            const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
            if (!delayed && method === 'POST' && url.includes('/purchase-preview')) {
                delayed = true;
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
            return nativeFetch(input, init);
        };
    });
    await login(page);
    await createList(page, '', 'Покупка с распределением');
    await addListItem(page, 'Яблоки', '2');
    await page.getByRole('button', { name: 'Проверить покупку' }).click();
    const review = page.getByRole('heading', { name: 'Проверить покупку' }).locator('..');
    await review.getByLabel('Фактически куплено').fill('3');
    await review.getByLabel('Продукт каталога').selectOption('10000000-0000-4000-8000-000000000002');
    await review.getByLabel('Добавить эту позицию в личные запасы').uncheck();
    await review.getByRole('button', { name: 'Добавить позицию вручную' }).click();
    const positions = review.getByRole('group', { name: /Позиция/u });
    await expect(positions).toHaveCount(2);
    await positions.nth(1).getByLabel('Фактическое название').fill('Яблоки с неизвестным количеством');
    await positions.nth(1).getByLabel('Продукт каталога').selectOption('10000000-0000-4000-8000-000000000002');
    const calculate = review.getByRole('button', { name: 'Рассчитать поступление' });
    await expect(calculate).toBeEnabled();
    const calculateRequest = calculate.click();
    await expect(calculate).toBeDisabled();
    await calculateRequest;
    await expect(review.getByRole('heading', { name: 'Результат после подтверждения' })).toBeVisible();
    await expect(review.getByRole('button', { name: 'Пересчитать' })).toBeEnabled();
    await expect(review.getByText(/избыток 1/u)).toBeVisible();
    await review.getByRole('button', { name: 'Подтвердить покупку и поступление' }).click();
    await expect(page.getByRole('heading', { name: 'Покупка подтверждена' })).toBeVisible();
    await expect(page.getByText(/Неизвестных количеств: 1/u)).toBeVisible();
    const purchaseHref = await page
        .getByRole('link', { name: 'Открыть покупку отдельной страницей' })
        .getAttribute('href');
    expect(purchaseHref).toBeTruthy();
    await gotoExact(page, purchaseHref!);
    await expect(page.getByText('Количество неизвестно', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Уточнить и добавить в запасы' }).click();
    const resolution = page.getByRole('article').filter({ hasText: 'Яблоки с неизвестным количеством' });
    await resolution.getByLabel('Фактически куплено').fill('1');
    await resolution.getByLabel('Единица').selectOption('kg');
    await resolution.getByLabel('Место хранения').selectOption({ index: 1 });
    await resolution.getByRole('button', { name: 'Проверить поступление' }).click();
    await resolution.getByRole('button', { name: 'Подтвердить поступление' }).click();
    await expect(resolution.getByText(/Уже поступило в запасы/u)).toBeVisible();
});

test('receipt supports parse, correction, commit and duplicate linking without a second intake', async ({ page }) => {
    await login(page);
    const firstReceipt = await createDraftReceipt(page, '', 'Яблоки\nСалфетки');
    await page.getByRole('button', { name: 'Исправить позиции' }).click();
    const corrections = page.getByRole('heading', { name: 'Исправить позиции' }).locator('..');
    await corrections.getByLabel('Фактическое название').first().fill('Яблоки зелёные');
    await corrections.getByRole('button', { name: 'Сохранить исправления' }).click();
    await expect(page.getByText('Яблоки зелёные', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Проверить поступление' }).click();
    const review = page.getByRole('heading', { name: 'Проверить покупку' }).locator('..');
    await review.getByRole('checkbox', { name: 'Продукт питания' }).first().uncheck();
    await review.getByRole('checkbox', { name: 'Продукт питания' }).nth(1).uncheck();
    await review.getByRole('button', { name: 'Рассчитать поступление' }).click();
    await review.getByRole('button', { name: 'Подтвердить покупку и поступление' }).click();
    await expect(page.getByText('Поступление подтверждено', { exact: true })).toBeVisible();
    await expect(page.getByText(/Повторное поступление чека заблокировано/u)).toBeVisible();

    const duplicate = await createDraftReceipt(page, '', 'Повторный чек');
    expect(duplicate).not.toBe(firstReceipt);
    const candidate = page.getByRole('article').filter({ hasText: 'Яблоки зелёные' }).first();
    await expect(candidate).toBeVisible();
    page.once('dialog', (dialog) => void dialog.accept());
    await candidate.getByRole('button', { name: 'Это моя покупка — связать' }).click();
    await expect(page.getByText('Связан с покупкой', { exact: true })).toBeVisible();
    await expect(page.getByText(/Повторное поступление чека заблокировано/u)).toBeVisible();
});

test('Pro enables electronic and financial receipt fields while provider-dependent PDF/OCR remain fail closed', async ({
    page,
}) => {
    await login(page, 'pro1');
    await gotoExact(page, '/receipts/new');
    await expect(page.getByRole('radio', { name: 'PDF · временно недоступен' })).toBeDisabled();
    await expect(
        page.getByText(/PDF не загружается: защищённое хранение и OCR-адаптер ещё не настроены/u),
    ).toBeVisible();
    await page.getByRole('radio', { name: 'Ссылка на электронный чек · Pro' }).check();
    await page.getByLabel('Безопасная HTTPS-ссылка').fill('https://example.test/receipt/42');
    await page.getByLabel('Исходный распознанный текст').fill('Рис');
    await page.getByRole('button', { name: 'Разобрать текст на строки для проверки' }).click();
    await page.getByRole('checkbox', { name: 'Сохранить цены и итог в личной финансовой истории · Pro' }).check();
    await page.getByLabel('Магазин').fill('Тестовый магазин');
    await page.getByLabel('Итого, ₽').fill('100');
    await page.getByLabel('Оплачено за позицию, ₽').fill('100');
    await page.getByLabel('Способ оплаты').selectOption('card');
    await page.getByLabel('Я согласен сохранить суммы в личной финансовой истории Pro.').check();
    await page.getByRole('button', { name: 'Сохранить чек и перейти к поступлению' }).click();
    await page.waitForURL(/\/receipts\/[0-9a-f-]{36}$/u);
    await expect(page.getByRole('heading', { name: 'Финансовые данные · Pro' })).toBeVisible();
    await expect(page.getByText(/Тестовый магазин · 100\.00 ₽/u)).toBeVisible();
    await expect(page.getByText(/способ оплаты: карта/u)).toBeVisible();
});

test('Plus family commerce stays in family scope and uses family-specific inventory language', async ({ page }) => {
    await login(page, 'plus1');
    const path = await createList(page, '/family', 'Общий семейный список');
    await expect(page.getByText('Общие списки семьи · Plus')).toBeVisible();
    await addListItem(page, 'Семейный рис', '2');
    await page.reload();
    await expect(page.getByText('Семейный рис', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Проверить покупку' }).click();
    await expect(page.getByRole('checkbox', { name: 'Добавить эту позицию в семейные запасы' })).toBeVisible();
    const familyReceipt = await createDraftReceipt(page, '/family', 'Семейный чек');
    expect(familyReceipt).toMatch(/^\/family\/receipts\//u);
    await gotoExact(page, '/shopping');
    await expect(page.getByText('Общий семейный список', { exact: true })).toHaveCount(0);
    await gotoExact(page, path);
    await expect(page.getByRole('heading', { name: 'Общий семейный список' })).toBeVisible();
});

test('503 retry and 412 conflict are announced and preserve list and receipt drafts', async ({ page }) => {
    await login(page);
    await gotoExact(page, '/shopping?status=completed');
    await expect(page).toHaveURL(/status=completed/u);
    await expect(page.getByRole('heading', { name: 'Завтрак дома' })).toBeVisible();
    await failNext(page, '/api/v1/shopping-lists', 'GET', 503);
    await page.getByRole('link', { name: 'В архиве' }).click();
    await expect(page).toHaveURL(/status=archived/u);
    const loadError = page.getByRole('alert').filter({ hasText: 'Не удалось загрузить списки.' });
    await expect(loadError).toBeVisible();
    await loadError.getByRole('button', { name: 'Повторить' }).click();
    await expect(page.getByRole('heading', { name: 'В архиве — пикник' })).toBeVisible();

    await createList(page, '', 'Конфликтный список');
    await page.getByRole('button', { name: 'Добавить товар' }).click();
    const form = page.getByRole('heading', { name: 'Добавить товар' }).locator('..');
    await form.getByLabel('Название').fill('Черновик при конфликте');
    await failNext(
        page,
        new URL(page.url()).pathname.replace('/shopping/', '/api/v1/shopping-lists/') + '/items',
        'POST',
        412,
    );
    await form.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(form.getByRole('alert')).toContainText('Данные изменились. Ваш ввод сохранён.');
    await expect(form.getByLabel('Название')).toHaveValue('Черновик при конфликте');
    await expect(form.getByText(/Форма останется открытой/u)).toBeVisible();
    await form.getByRole('button', { name: 'Отмена' }).click();
    const listPath = new URL(page.url()).pathname.replace('/shopping/', '/api/v1/shopping-lists/');
    await failNext(page, `${listPath}/command`, 'POST', 409);
    await page.getByRole('button', { name: 'В архив' }).click();
    await expect(
        page.getByRole('alert').filter({ hasText: 'Операция конфликтует с текущим состоянием' }),
    ).toBeVisible();

    await gotoExact(page, '/receipts/new');
    await page.getByLabel('Исходный распознанный текст').fill('Черновик чека');
    await page.getByRole('button', { name: 'Разобрать текст на строки для проверки' }).click();
    await failNext(page, '/api/v1/receipts', 'POST', 503);
    await page.getByRole('button', { name: 'Сохранить чек и перейти к поступлению' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Сервис временно недоступен' })).toBeVisible();
    await expect(page.getByLabel('Исходный распознанный текст')).toHaveValue('Черновик чека');
    await expect(page.getByRole('button', { name: 'Повторить сохранённый запрос' })).toBeVisible();
    await page.getByRole('button', { name: 'Повторить сохранённый запрос' }).click();
    await page.waitForURL(/\/receipts\/[0-9a-f-]{36}$/u);
});

test('empty, offline cache, reload and keyboard focus remain usable; unavailable sources stay disabled', async ({
    page,
    context,
}) => {
    await login(page);
    const list = await createList(page, '', 'Offline список');
    await addListItem(page, 'Offline позиция', '1');
    await page.reload();
    await expect(page.getByText('Offline позиция', { exact: true })).toBeVisible();
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Добавить товар' }).click();
    const form = page.getByRole('heading', { name: 'Добавить товар' }).locator('..');
    await form.getByLabel('Название').fill('Локальная очередь');
    await form.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Действие сохранено локально');
    await context.setOffline(false);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Offline список' })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(list);

    await gotoExact(page, '/receipts/new');
    const photo = page.getByRole('radio', { name: 'Фото чека' });
    await photo.focus();
    await expect(photo).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('radio', { name: 'Ссылка на электронный чек · Pro' })).toBeDisabled();
    await expect(page.getByRole('radio', { name: 'PDF · временно недоступен' })).toBeDisabled();
    await expect(page.getByLabel('Сфотографировать чек')).toBeFocused();
    await expect(page.getByRole('button', { name: 'Распознать фото' })).toBeDisabled();
});
