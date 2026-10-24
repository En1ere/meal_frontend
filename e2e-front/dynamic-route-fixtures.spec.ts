import { expect, test, type Page, type Response } from '@playwright/test';
import { totp } from '../e2e/helpers/totp.js';

const missingId = '00000000-0000-4000-8000-000000000099';

async function ensureServiceWorker(page: Page) {
    await page.evaluate(() => navigator.serviceWorker.ready);
    if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    }
}

async function login(page: Page, email: string) {
    await gotoExact(page, '/auth');
    await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    await ensureServiceWorker(page);
    await page.getByLabel('Электронная почта', { exact: true }).fill(email);
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/', { timeout: 60_000 });
    await page.waitForTimeout(2_000);
    expect(new URL(page.url()).pathname).toBe('/');
}

async function loginModerator(page: Page) {
    await gotoExact(page, '/moderation/sign-in');
    await ensureServiceWorker(page);
    await page.getByLabel('Электронная почта').fill('moderator@meal-planner.test');
    await page.getByLabel('Пароль').fill('1');
    await page.getByRole('button', { name: /Продолжить|Войти/u }).click();
    await page.waitForURL(/\/moderation\/mfa/u, { timeout: 60_000 });
    const secret = await page.locator('.enrollment code').textContent();
    expect(secret).toBeTruthy();
    await page.getByLabel('Код из приложения').fill(totp(secret!));
    await page.getByRole('button', { name: 'Подтвердить' }).click();
    const saved = page.getByLabel(/Я сохранил/u);
    await expect(saved).toBeVisible();
    await saved.check();
    await page.getByRole('button', { name: 'Продолжить' }).click();
    await page.waitForURL((url) => url.pathname === '/moderation', { timeout: 60_000 });
}

async function gotoExact(page: Page, path: string, expectedStatus = 200) {
    let response: Response | null = null;
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            response = await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
            lastError = undefined;
            break;
        } catch (error) {
            lastError = error;
            const message = error instanceof Error ? error.message : String(error);
            if (
                !message.includes('NS_BINDING_ABORTED') &&
                !message.includes('NS_ERROR_ABORT') &&
                !message.includes('net::ERR_ABORTED') &&
                !message.includes('is interrupted by another navigation') &&
                !(error instanceof Error && error.name === 'TimeoutError')
            )
                throw error;
            if (attempt < 3) await page.goto('about:blank', { waitUntil: 'commit' }).catch(() => undefined);
        }
    }
    if (lastError) throw lastError;
    expect(response?.status(), `${path}: document status`).toBe(expectedStatus);
    const checkingSession = page.getByText('Проверяем сессию', { exact: true });
    await expect(checkingSession).toHaveCount(0, { timeout: 30_000 });
    // Avoid interacting during the one late Fast Refresh possible after a fresh dev-server route compile.
    await page.waitForTimeout(2_000);
    await expect(checkingSession).toHaveCount(0, { timeout: 30_000 });
    expect(new URL(page.url()).pathname, `${path}: final pathname`).toBe(path);
}

test('fixed public and catalog fixtures distinguish valid and missing dynamic routes', async ({ page }) => {
    await login(page, 'pro1@meal-planner.test');
    for (const [path, heading] of [
        ['/authors/pro1', '@pro1'],
        ['/authors/pro1/achievements', 'Достижения'],
        ['/authors/pro1/reputation', 'Репутация'],
        ['/news/73000000-0000-4000-8000-000000000002', 'Демонстрационное объявление о семейном меню'],
        ['/products/10000000-0000-4000-8000-000000000001', 'Молоко 2,5%'],
        ['/recipes/70000000-0000-4000-8000-000000000001', 'Паста с томатами и базиликом'],
        ['/recipes/70000000-0000-4000-8000-000000000001/cook', 'Приготовление'],
        ['/recipes/70000000-0000-4000-8000-000000000001/edit', 'Редактирование недоступно'],
    ] as const) {
        await gotoExact(page, path);
        await expect(
            page.getByRole('heading', { name: heading, exact: true }).filter({ visible: true }).first(),
        ).toBeVisible();
    }

    await gotoExact(page, '/authors/no-such-author');
    await expect(page.getByRole('heading', { name: 'Профиль недоступен' })).toBeVisible();
    await gotoExact(page, '/authors/no-such-author/achievements');
    await expect(page.getByRole('heading', { name: 'Профиль недоступен' })).toBeVisible();
    await gotoExact(page, '/authors/no-such-author/reputation');
    await expect(page.getByRole('heading', { name: 'Профиль недоступен' })).toBeVisible();
    await gotoExact(page, `/products/${missingId}`);
    await expect(page.getByRole('heading', { name: 'Запись недоступна' })).toBeVisible();
    await gotoExact(page, `/recipes/${missingId}`, 404);
    await expect(page.getByRole('heading', { name: 'Рецепт недоступен' })).toBeVisible();
    await gotoExact(page, `/recipes/${missingId}/cook`);
    await expect(page.getByRole('heading', { name: 'Рецепт недоступен' })).toBeVisible();
    await gotoExact(page, `/recipes/${missingId}/edit`);
    await expect(page.getByRole('heading', { name: 'Рецепт недоступен' })).toBeVisible();
    await gotoExact(page, '/news/73000000-0000-4000-8000-000000000099');
    await expect(page.getByRole('heading', { name: 'Новость недоступна' })).toBeVisible();
});

test('family note fixtures enforce family access and edit states', async ({ page }) => {
    await login(page, 'plus1@meal-planner.test');
    const noteId = '52000000-0000-4000-8000-000000000001';
    await gotoExact(page, `/family/notes/${noteId}`);
    await expect(page.getByRole('heading', { name: 'Покупки к выходным' })).toBeVisible();
    await gotoExact(page, `/family/notes/${noteId}/edit`);
    await expect(page.getByRole('heading', { name: 'Редактировать заметку' })).toBeVisible();
    await gotoExact(page, `/family/notes/${missingId}`);
    await expect(page.getByRole('alert').filter({ hasText: 'Заметка не найдена.' }).first()).toBeVisible();
    await gotoExact(page, `/family/notes/${missingId}/edit`);
    await expect(page.getByRole('alert').filter({ hasText: 'Заметка недоступна.' }).first()).toBeVisible();
});

test('AI appeal fixture creates a replay-safe valid dynamic detail and stays private', async ({
    browser,
}, testInfo) => {
    const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = testInfo.project.use;
    const contextOptions = {
        baseURL: 'http://localhost:3000',
        viewport,
        userAgent,
        deviceScaleFactor,
        isMobile,
        hasTouch,
    };
    const ownerContext = await browser.newContext(contextOptions);
    const owner = await ownerContext.newPage();
    await login(owner, 'user1@meal-planner.test');
    await gotoExact(owner, '/ai/appeals');
    await expect(owner.getByText('Ограничение по правилам безопасного использования AI')).toBeVisible();
    await owner.getByLabel('Объяснение').fill('Прошу пересмотреть ограничение и проверить контекст.');
    await owner.getByRole('button', { name: 'Отправить на рассмотрение' }).click();
    await owner.waitForURL(/\/ai\/appeals\/[0-9a-f-]{36}$/u);
    const detailPath = new URL(owner.url()).pathname;
    await expect(owner.getByRole('heading', { name: 'Апелляция по ограничению AI' })).toBeVisible();

    const foreignContext = await browser.newContext(contextOptions);
    const foreign = await foreignContext.newPage();
    await login(foreign, 'user2@meal-planner.test');
    await gotoExact(foreign, detailPath);
    await expect(foreign.getByRole('heading', { name: 'Апелляция недоступна' })).toBeVisible();
    await foreignContext.close();
    await ownerContext.close();
});

test('moderator dynamic fixtures cover all queues and reject an invalid queue', async ({ page }) => {
    await loginModerator(page);
    for (const queue of ['recipes', 'recipe_variants', 'products', 'reports', 'support', 'authorship']) {
        await gotoExact(page, `/moderation/queues/${queue}`);
        await expect(page.getByRole('heading', { name: /^Очередь:/u })).toBeVisible();
    }
    await gotoExact(page, '/moderation/queues/not-a-queue', 404);
    await expect(page.getByRole('heading', { name: 'Очередь модерации не найдена' })).toBeVisible();
});

test('moderator material/support details distinguish valid and missing IDs', async ({ page }) => {
    await loginModerator(page);
    await gotoExact(page, '/moderation/items/c1000000-0000-4000-8000-000000000001');
    await expect(page.getByRole('heading', { name: 'Проверка редакции' })).toBeVisible();
    await gotoExact(page, '/moderation/support/c1000000-0000-4000-8000-000000000006');
    await expect(page.getByRole('heading', { name: 'Обращение' })).toBeVisible();
    await gotoExact(page, `/moderation/items/${missingId}`);
    await expect(page.getByRole('heading', { name: 'Не удалось загрузить данные.' })).toBeVisible();
    await gotoExact(page, `/moderation/support/${missingId}`);
    await expect(page.getByRole('heading', { name: 'Не удалось загрузить данные.' })).toBeVisible();
});
