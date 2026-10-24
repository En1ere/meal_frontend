import { expect, test, type Page } from '@playwright/test';

async function ensureServiceWorker(page: Page) {
    await expect
        .poll(() => page.evaluate(async () => Boolean(await navigator.serviceWorker.ready)).catch(() => false), {
            timeout: 30_000,
        })
        .toBe(true);
    const controlled = () =>
        page.evaluate(() => navigator.serviceWorker.controller?.scriptURL.endsWith('/mockServiceWorker.js') ?? false);
    if (!(await controlled())) {
        await page.reload({ waitUntil: 'domcontentloaded' }).catch((error: unknown) => {
            if (
                !(error instanceof Error) ||
                (!error.message.includes('NS_BINDING_ABORTED') &&
                    !error.message.includes('net::ERR_ABORTED') &&
                    !error.message.includes('is interrupted by another navigation'))
            )
                throw error;
        });
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
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 60_000 }).toBe('/');
    await expect(page.getByRole('link', { name: /^Профиль:/u })).toBeVisible({ timeout: 30_000 });
}

async function gotoStable(page: Page, path: string) {
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
}

test('Guest sees public pricing and protected routes preserve a safe returnTo', async ({ page }) => {
    await gotoStable(page, '/pricing');
    await expect(page.getByRole('heading', { name: 'Выберите подходящий тариф' })).toBeVisible();
    await ensureServiceWorker(page);
    await page.goto('/inventory', { waitUntil: 'domcontentloaded' }).catch((error: unknown) => {
        if (
            !(error instanceof Error) ||
            (!error.message.includes('NS_BINDING_ABORTED') &&
                !error.message.includes('net::ERR_ABORTED') &&
                !error.message.includes('is interrupted by another navigation'))
        )
            throw error;
    });
    await page.waitForURL((url) => url.pathname === '/auth', { timeout: 30_000 });
    expect(new URL(page.url()).searchParams.get('returnTo')).toBe('/inventory');
    await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
});

test('Free keeps personal basics and blocks family and Pro capabilities with relevant CTA', async ({ page }) => {
    await login(page, 'user1@meal-planner.test');
    await gotoStable(page, '/inventory');
    await expect(page.getByRole('heading', { name: 'Мои запасы' })).toBeVisible();

    await gotoStable(page, '/family');
    await expect(page.getByText('Для семейных возможностей нужен Plus или Pro.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Посмотреть Plus' })).toHaveAttribute('href', '/settings/subscription');

    await gotoStable(page, '/finance');
    await expect(page.getByRole('heading', { name: 'Финансы доступны в Pro' })).toBeVisible();
    await gotoStable(page, '/diary');
    await expect(page.getByRole('heading', { name: 'Дневник заблокирован настройкой согласия' })).toBeVisible();
    await page.getByRole('link', { name: 'Открыть документы и согласия' }).click();
    const healthConsent = page.getByRole('region', { name: 'Данные о здоровье и питании', exact: true });
    await healthConsent.getByRole('button', { name: 'Ознакомился и согласен', exact: true }).click();
    await healthConsent.getByRole('button', { name: 'Отозвать', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Вернуться к функции', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/diary');
    await expect(page.getByRole('heading', { name: 'Личный дневник доступен в Pro' })).toBeVisible();
});

test('Free plus AI40 gains purchased actions without unlocking Plus or Pro', async ({ page }) => {
    await login(page, 'user1@meal-planner.test');
    await gotoStable(page, '/ai/balance');
    const purchased = page.getByRole('heading', { name: 'Купленные' }).locator('..');
    const beforeText = await purchased.innerText();
    const before = /(?<available>\d+) доступно из (?<granted>\d+)/u.exec(beforeText)?.groups;
    expect(before, `unexpected purchased bucket: ${beforeText}`).toBeTruthy();
    await page.getByRole('button', { name: 'Провести тестовую покупку' }).click();
    await expect(page.getByText('Тестовый пакет начислен. Реального списания денег не было.')).toBeVisible();
    await expect(purchased).toContainText(
        `${Number(before!.available) + 40} доступно из ${Number(before!.granted) + 40}`,
    );

    await gotoStable(page, '/family');
    await expect(page.getByText('Для семейных возможностей нужен Plus или Pro.')).toBeVisible();
    await gotoStable(page, '/finance');
    await expect(page.getByRole('heading', { name: 'Финансы доступны в Pro' })).toBeVisible();
});

for (const account of [
    { email: 'plus1@meal-planner.test', role: 'Вы владелец' },
    { email: 'plus2@meal-planner.test', role: 'Вы участник' },
])
    test(`Plus family coverage works for ${account.role}`, async ({ page }) => {
        await login(page, account.email);
        await gotoStable(page, '/family');
        await expect(page.getByText(account.role, { exact: false })).toBeVisible();
        await expect(page.getByText('PLUS', { exact: true })).toBeVisible();
        await gotoStable(page, '/family/chat');
        await expect(page.getByPlaceholder('Напишите сообщение', { exact: true })).toBeVisible();
        await gotoStable(page, '/finance');
        await expect(page.getByRole('heading', { name: 'Финансы доступны в Pro' })).toBeVisible();
    });

test('Pro opens Pro overview and finance capabilities', async ({ page }) => {
    await login(page, 'pro1@meal-planner.test');
    await gotoStable(page, '/pro');
    await expect(page.getByRole('region', { name: 'Статус доступа Pro' })).toContainText('Pro активен');
    await gotoStable(page, '/finance');
    await expect(page.getByText('Личные финансы · Pro активен')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Финансы доступны в Pro' })).toHaveCount(0);
});

test('Eligible Free activates one Pro trial', async ({ page }) => {
    await login(page, 'user1@meal-planner.test');
    await gotoStable(page, '/settings/subscription');
    await page.getByRole('button', { name: 'Начать пробный период' }).click();
    const trialSummary = page.getByText('Пробный период до', { exact: false }).locator('..');
    await expect(trialSummary).toBeVisible();
    await expect(trialSummary).toContainText('Pro');
    await expect(page.getByRole('button', { name: 'Начать пробный период' })).toHaveCount(0);
    await gotoStable(page, '/finance');
    await expect(page.getByText('Личные финансы · Pro активен')).toBeVisible();
});

test('Family-history Free cannot activate a Pro trial', async ({ page }) => {
    await login(page, 'user2@meal-planner.test');
    await gotoStable(page, '/settings/subscription');
    await expect(page.getByText('Пробный период недоступен, потому что аккаунт ранее состоял в семье.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Начать пробный период' })).toHaveCount(0);
});
