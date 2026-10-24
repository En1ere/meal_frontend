import { expect, test, type Page } from '@playwright/test';
import { enterFreshTotp } from './helpers/admin-session.js';

const sections = [
    'overview',
    'queues',
    'support',
    'users',
    'sanctions',
    'access',
    'subscriptions',
    'families',
    'payments',
    'catalog',
    'releases',
    'news',
    'audit',
    'rollback',
    'legal-requests',
    'operations',
    'errors',
    'metrics',
] as const;
const routes = [
    '/',
    '/admin',
    ...sections.map((section) => `/admin/${section}`),
    '/admin/queues/recipes',
    '/admin/catalog/allergens',
    '/admin/catalog/allergens/milk',
    '/admin/catalog/achievements',
    '/admin/catalog/achievements/00000000-0000-4000-8000-000000000001',
    '/admin/catalog/reputation',
    '/admin/releases',
    '/admin/releases/00000000-0000-4000-8000-000000000001',
    '/admin/queues',
    '/admin/moderation/00000000-0000-4000-8000-000000000001',
    '/admin/operations/jobs/00000000-0000-4000-8000-000000000001',
    '/admin/users/00000000-0000-4000-8000-000000000001',
    '/notifications',
    '/settings/notifications',
    '/settings/recipes',
    '/dev/scenarios',
    '/does-not-exist',
];

async function loginAdmin(page: Page) {
    await page.goto('/auth');
    const submit = page.getByRole('button', { name: 'Продолжить' });
    await expect(submit).toBeEnabled({ timeout: 60_000 });
    await page.getByLabel('Логин').fill('admin');
    await page.getByLabel('Пароль').fill('1');
    await submit.click();
    await page.waitForURL(/\/auth\/mfa/u);
    const secret = await page.locator('.enrollment code').textContent();
    expect(secret).toBeTruthy();
    await enterFreshTotp(page.getByLabel('Код из приложения'), secret!);
    await page.getByRole('button', { name: 'Подтвердить' }).click();
    const saved = page.getByLabel(/Я сохранил/u);
    await expect(saved).toBeVisible({ timeout: 10_000 });
    if (await saved.isVisible()) {
        await saved.check();
        await page.getByRole('button', { name: 'Продолжить' }).click();
    }
    await page.waitForURL((url) => url.pathname === '/', { timeout: 30_000 });
}

async function navigateInsideUnlockedTab(page: Page, route: string) {
    const expected = route === '/admin/queues' ? '/admin/queues/recipes' : route;
    if (new URL(page.url()).pathname !== route) {
        await page.evaluate((path) => {
            history.pushState({}, '', path);
            window.dispatchEvent(new PopStateEvent('popstate'));
        }, route);
    }
    await page.waitForURL((url) => url.pathname === expected, { timeout: 30_000 });
    return expected;
}

expect(sections).toHaveLength(18);
const chunkSize = 12;
const routeChunks = Array.from({ length: Math.ceil(routes.length / chunkSize) }, (_, index) =>
    routes.slice(index * chunkSize, (index + 1) * chunkSize),
);

for (const [index, chunk] of routeChunks.entries())
    test(`enrolls admin MFA and renders route chunk ${index + 1}/${routeChunks.length}`, async ({ page }) => {
        await loginAdmin(page);
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        for (const route of chunk) {
            errors.length = 0;
            const expected = await navigateInsideUnlockedTab(page, route);
            await expect(page.locator('body'), route).not.toHaveText('', { timeout: 10_000 });
            await expect(page.locator('#main, main').first(), route).toBeVisible({ timeout: 10_000 });
            expect(new URL(page.url()).pathname, route).toBe(expected);
            expect(new URL(page.url()).pathname, route).not.toBe('/auth');
            await expect(page, route).not.toHaveTitle(/Вход администратора/u);
            expect(errors, route).toEqual([]);
            await expect(page.locator('body'), route).not.toContainText('Application error');
        }
    });
