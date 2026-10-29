import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page, type Response } from '@playwright/test';
import { totp } from '../e2e/helpers/totp.js';

const productionMockRun = process.env.FRONT_E2E_PRODUCTION_MOCKS === '1';
const pagesRoot = path.resolve('front/src/app');
const routes: string[] = [];
const walk = (directory: string, segments: string[] = []) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(full, entry.name.startsWith('(') ? segments : [...segments, entry.name]);
        else if (entry.name === 'page.tsx') routes.push('/' + segments.join('/'));
    }
};
walk(pagesRoot);
routes.sort((left, right) => left.localeCompare(right));

const concrete = (route: string) => {
    if (route.startsWith('/recipes/[id]')) return route.replace('[id]', '70000000-0000-4000-8000-000000000001');
    return route
        .replace('[username]', 'pro1')
        .replace('[token]', 'invalid-token')
        .replace('[queue]', 'recipes')
        .replace('[id]', '00000000-0000-4000-8000-000000000001');
};

async function assertRoute(page: Page, route: string, errors: string[]) {
    errors.length = 0;
    const target = concrete(route);
    const serverErrors: string[] = [];
    const collectServerError = (response: Response) => {
        if (response.url().includes('/api/') && response.status() >= 500)
            serverErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    };
    page.on('response', collectServerError);
    await gotoBlank(page);
    let response: Response | null = null;
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60_000 });
            lastError = undefined;
            break;
        } catch (error) {
            lastError = error;
            if (
                !(error instanceof Error) ||
                (!error.message.includes('NS_ERROR_FAILURE') &&
                    !error.message.includes('NS_BINDING_ABORTED') &&
                    !error.message.includes('net::ERR_ABORTED') &&
                    !error.message.includes('NS_ERROR_ABORT') &&
                    error.name !== 'TimeoutError')
            )
                throw error;
            if (attempt < 3) await gotoBlank(page);
        }
    }
    if (lastError) throw lastError;
    expect(response, `${route}: navigation did not produce a document response`).not.toBeNull();
    expect(response!.status(), `${route}: document status`).toBeGreaterThanOrEqual(200);
    expect(response!.status(), `${route}: document redirect/error must be explicit in the route manifest`).toBeLessThan(
        400,
    );
    expect(new URL(page.url()).origin, route).toBe('http://localhost:3000');
    expect(new URL(page.url()).pathname, `${route}: unexpected redirect`).toBe(target);
    expect(page.url(), `${route}: stale blank document`).not.toBe('about:blank');
    await expect(page.locator('body'), route).not.toHaveText('', { timeout: 10_000 });
    await expect(page.getByText('Проверяем сессию', { exact: true }), route).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator('h1, main, [role="main"]').first(), `${route}: stable page landmark`).toBeVisible({
        timeout: 30_000,
    });
    expect(errors, route).toEqual([]);
    expect(serverErrors, `${route}: unexpected API 5xx`).toEqual([]);
    await expect(page.locator('body'), route).not.toContainText('Application error');
    await expect(page.locator('body'), route).not.toContainText('Internal Server Error');
    let audit: { interactiveIssues: string[]; horizontalOverflow: number } | undefined;
    let auditError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            audit = await page.locator('html').evaluate((root) => {
                if (!root.isConnected || !document.body) throw new Error('Route audit document is not stable');
                const elements = Array.from(
                    root.querySelectorAll(
                        'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"]',
                    ),
                );
                const interactiveIssues = elements.flatMap((element, index) => {
                    if (!(element instanceof HTMLElement) || !element.checkVisibility()) return [];
                    const labelledBy = (element.getAttribute('aria-labelledby') ?? '')
                        .split(/\s+/u)
                        .filter(Boolean)
                        .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
                        .join(' ')
                        .trim();
                    const labels =
                        element instanceof HTMLInputElement ||
                        element instanceof HTMLSelectElement ||
                        element instanceof HTMLTextAreaElement
                            ? Array.from(element.labels ?? [], (label) => label.textContent?.trim() ?? '')
                                  .join(' ')
                                  .trim()
                            : '';
                    const imageAlternative = element.querySelector('img[alt]')?.getAttribute('alt')?.trim() ?? '';
                    const controlName = [
                        element.getAttribute('aria-label')?.trim(),
                        labelledBy,
                        labels,
                        element.getAttribute('title')?.trim(),
                        element.textContent?.trim(),
                        imageAlternative,
                        element instanceof HTMLInputElement ? element.placeholder.trim() : '',
                        element instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(element.type)
                            ? element.value.trim()
                            : '',
                    ].find(Boolean);
                    const description = `${element.tagName.toLowerCase()}#${index}`;
                    const issues: string[] = [];
                    if (!controlName) issues.push(`${description} has no accessible name`);
                    if (element instanceof HTMLAnchorElement) {
                        const href = element.getAttribute('href')?.trim() ?? '';
                        if (!href || /^javascript:/iu.test(href))
                            issues.push(`${description} has an unsafe or empty href`);
                    }
                    return issues;
                });
                return {
                    interactiveIssues,
                    horizontalOverflow:
                        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
                };
            });
            auditError = undefined;
            break;
        } catch (error) {
            auditError = error;
            if (
                !(error instanceof Error) ||
                (!error.message.includes('Execution context was destroyed') &&
                    !error.message.includes('Route audit document is not stable')) ||
                attempt === 3
            )
                throw error;
            await expect(page.getByText('Проверяем сессию', { exact: true }), route).toHaveCount(0, {
                timeout: 30_000,
            });
            await expect(
                page.locator('h1, main, [role="main"]').first(),
                `${route}: stable page after service-worker reload`,
            ).toBeVisible({ timeout: 30_000 });
        }
    }
    if (auditError) throw auditError;
    expect(audit, `${route}: DOM audit did not complete`).toBeDefined();
    expect(
        audit!.interactiveIssues,
        `${route}: every visible interactive element must be identifiable and actionable`,
    ).toEqual([]);
    expect(audit!.horizontalOverflow, `${route}: page must not overflow the viewport horizontally`).toBeLessThanOrEqual(
        1,
    );
    page.off('response', collectServerError);
}

function isTransientNavigationError(error: unknown) {
    return (
        error instanceof Error &&
        (error.message.includes('NS_ERROR_FAILURE') ||
            error.message.includes('NS_BINDING_ABORTED') ||
            error.message.includes('net::ERR_ABORTED') ||
            error.message.includes('NS_ERROR_ABORT') ||
            error.name === 'TimeoutError')
    );
}

async function gotoBlank(page: Page) {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            await page.goto('about:blank', { waitUntil: 'commit', timeout: 10_000 });
            return;
        } catch (error) {
            lastError = error;
            if (!isTransientNavigationError(error)) throw error;
            if (page.url() === 'about:blank') return;
            if (attempt < 3) await page.waitForTimeout(100);
        }
    }
    throw lastError;
}

async function loginUser(page: Page) {
    const submit = page.getByRole('button', { name: 'Войти', exact: true });
    for (let attempt = 0; attempt < 3; attempt += 1) {
        await page.goto('/auth', { waitUntil: 'domcontentloaded' }).catch(() => undefined);
        await page
            .getByText('Тестовые аккаунты', { exact: true })
            .waitFor({ timeout: 30_000 })
            .catch(() => undefined);
        await page.evaluate(() => navigator.serviceWorker.ready).catch(() => undefined);
        if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)).catch(() => false))) {
            await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
        }
        if (
            await submit.waitFor({ state: 'visible', timeout: 30_000 }).then(
                () => submit.isEnabled(),
                () => false,
            )
        )
            break;
    }
    await expect(submit).toBeEnabled({ timeout: 30_000 });
    await page.getByLabel('Электронная почта').fill('pro1@meal-planner.test');
    await page.getByLabel('Пароль').fill('1');
    await submit.click();
    await page.waitForURL((url) => url.pathname === '/', { timeout: 30_000 });
}

async function loginModerator(page: Page) {
    const submit = page.getByRole('button', { name: /Продолжить|Войти/u });
    for (let attempt = 0; attempt < 3; attempt += 1) {
        await page.goto('/moderation/sign-in', { waitUntil: 'domcontentloaded' }).catch(() => undefined);
        if (
            await submit.waitFor({ state: 'visible', timeout: 30_000 }).then(
                () => submit.isEnabled(),
                () => false,
            )
        )
            break;
    }
    await expect(submit).toBeEnabled({ timeout: 30_000 });
    await page.getByLabel('Электронная почта').fill('moderator@meal-planner.test');
    await page.getByLabel('Пароль').fill('1');
    await submit.click();
    await page.waitForURL(/\/moderation\/mfa/u);
    const secret = await page.locator('.enrollment code').textContent();
    expect(secret).toBeTruthy();
    await page.getByLabel('Код из приложения').fill(totp(secret!));
    await page.getByRole('button', { name: 'Подтвердить' }).click();
    const saved = page.getByLabel(/Я сохранил/u);
    await expect(saved).toBeVisible({ timeout: 10_000 });
    if (await saved.isVisible()) {
        await saved.check();
        await page.getByRole('button', { name: 'Продолжить' }).click();
    }
    await page.waitForURL((url) => url.pathname === '/moderation', { timeout: 30_000 });
}

const userRoutes = routes.filter((item) => !item.startsWith('/moderation') && !item.startsWith('/dev'));
// The canonical isolated E2E runner starts every case on a fresh dev server,
// keeping each compiler lifetime below the verified RSS guard while preserving
// exhaustive coverage of the generated route manifest.
const chunkSize = 11;
const routeChunks = Array.from({ length: Math.ceil(userRoutes.length / chunkSize) }, (_, index) =>
    userRoutes.slice(index * chunkSize, (index + 1) * chunkSize),
);

expect(routes).toHaveLength(117);
expect(userRoutes).toHaveLength(109);
for (const [index, chunk] of routeChunks.entries())
    test(`renders authenticated Pro route chunk ${index + 1}/${routeChunks.length}`, async ({ page }) => {
        await loginUser(page);
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        for (const route of chunk) await assertRoute(page, route, errors);
    });

test('renders all development-only pages only in development', async ({ page }) => {
    test.skip(productionMockRun, 'Development-only routes are checked in the dedicated development run.');
    await loginUser(page);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const route of routes.filter((item) => item.startsWith('/dev'))) await assertRoute(page, route, errors);
});

test('enrolls moderator MFA and renders every moderator page', async ({ page }) => {
    await loginModerator(page);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const route of routes.filter((item) => item.startsWith('/moderation'))) await assertRoute(page, route, errors);

    for (const queue of ['recipes', 'recipe_variants', 'products', 'reports', 'support', 'authorship']) {
        await assertRoute(page, `/moderation/queues/${queue}`, errors);
        await expect(page.getByRole('heading', { name: /^Очередь:/ })).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText('Загружаем очередь…')).toHaveCount(0);
    }

    expect(errors).toEqual([]);
    await page.waitForLoadState('networkidle');

    const unknownPage = await page.context().newPage();
    const unknownErrors: string[] = [];
    unknownPage.on('pageerror', (error) => unknownErrors.push(error.message));
    try {
        const unknownQueue = await unknownPage.goto('/moderation/queues/not-a-queue', {
            waitUntil: 'domcontentloaded',
        });
        expect(unknownQueue?.status()).toBe(404);
        await expect(unknownPage.getByRole('heading', { name: 'Очередь модерации не найдена' })).toBeVisible();
        await expect(unknownPage.getByText('Загружаем очередь…')).toHaveCount(0);
        expect(unknownErrors).toEqual([]);
    } finally {
        await unknownPage.close();
    }
});
