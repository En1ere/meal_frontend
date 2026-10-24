import { qaRoot } from '../../scripts/qa-output.mjs';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { generateSync } from 'otplib';

// Optional QA runner: supply an existing Playwright module, no installation or database required.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '@playwright/test');
const origin = 'http://localhost:3000';
const output = new URL('', qaRoot());
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
});
const results = [];
const errors = [];
const consoleErrors = [];
let context = await browser.newContext({ viewport: { width: 1487, height: 1058 } });
let page = await context.newPage();
page.setDefaultTimeout(20000);
context.on('page', (tab) => tab.on('pageerror', (error) => errors.push(error.message)));
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
});
const check = (name) => {
    results.push(name);
    console.log(`PASS ${name}`);
};
const goto = (path) => page.goto(origin + path);
const heading = (text) => page.getByRole('heading', { name: text, exact: true }).waitFor();
async function login(loginName, staff = false) {
    await page.getByLabel('Электронная почта', { exact: true }).fill(`${loginName}@meal-planner.test`);
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: staff ? 'Продолжить' : 'Войти', exact: true }).click();
}
async function logout() {
    await goto('/settings/account');
    await page.getByRole('button', { name: 'Выйти', exact: true }).click();
    await page.locator('#email').waitFor();
}
async function screenshot(name) {
    await page.evaluate(() => document.fonts.ready);
    if (name.startsWith('auth-'))
        await page.waitForFunction(() => document.querySelector('button[type="submit"]')?.disabled === false);
    await page.screenshot({ path: fileURLToPath(new URL(name + '.png', output)), fullPage: true });
    assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        true,
        name + ' overflow',
    );
}
try {
    await goto('/');
    await page.waitForURL('**/auth?returnTo=*');
    await heading('С возвращением');
    await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Войти', exact: true }).waitFor();
    await screenshot('auth-desktop');
    await page.keyboard.press('Tab');
    assert.notEqual(await page.evaluate(() => document.activeElement?.tagName), 'BODY');
    check('guest guard, service-worker bootstrap, keyboard focus');
    await page.getByLabel('Электронная почта', { exact: true }).fill('user1@meal-planner.test');
    await page.getByLabel('Пароль', { exact: true }).fill('wrong');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.locator('.form-error').filter({ hasText: 'Требуется вход или проверка данных' }).waitFor();
    await page.waitForFunction(() => document.querySelector('#password')?.value === '');
    check('incorrect password and password clearing');
    for (const name of ['user1', 'user2', 'plus1', 'plus2', 'pro1', 'pro2', 'admin', 'moderator']) {
        await context.close();
        context = await browser.newContext({ viewport: { width: 1487, height: 1058 } });
        context.on('page', (tab) => tab.on('pageerror', (error) => errors.push(error.message)));
        page = await context.newPage();
        page.setDefaultTimeout(20000);
        page.on('pageerror', (error) => errors.push(error.message));
        await goto('/auth');
        await login(name);
        await page.waitForURL(origin + '/');
        await page.locator('main h1').waitFor();
        await page.getByRole('link', { name: /^Профиль:/ }).waitFor();
        await logout();
        check(`user login/logout ${name}`);
    }
    // New isolated browser state for the MFA group, preserving the real login rate limit.
    await context.close();
    context = await browser.newContext({ viewport: { width: 1487, height: 1058 } });
    context.on('page', (tab) => tab.on('pageerror', (error) => errors.push(error.message)));
    page = await context.newPage();
    page.setDefaultTimeout(20000);
    await goto('/auth');
    await login('user1');
    await page.waitForURL(origin + '/');
    await goto('/');
    await page.locator('main h1').waitFor();
    await page.getByLabel('Тема интерфейса').selectOption('nature-light');
    await page.reload();
    await page.locator('main h1').waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'nature-light');
    await page.getByLabel('Тема интерфейса').selectOption('coffee-light');
    await screenshot('account-desktop');
    const second = await context.newPage();
    await second.goto(origin + '/settings/account');
    await second.getByRole('button', { name: 'Выйти', exact: true }).click();
    await page.waitForURL('**/auth?returnTo=*');
    await second.close();
    check('theme persistence, user/staff independence, cross-tab logout');
    await goto('/about');
    await heading('Знайте, что есть дома. Решайте, что приготовить.');
    await screenshot('about-desktop');
    await page.setViewportSize({ width: 393, height: 852 });
    await screenshot('about-mobile');
    await goto('/auth');
    await heading('С возвращением');
    await screenshot('auth-mobile');
    await login('user1');
    await page.waitForURL(origin + '/');
    await page.locator('main h1').waitFor();
    await screenshot('account-mobile');
    check('desktop/mobile screenshots and horizontal overflow');
    await context.close();
    context = await browser.newContext({ viewport: { width: 393, height: 852 } });
    context.on('page', (tab) => tab.on('pageerror', (error) => errors.push(error.message)));
    page = await context.newPage();
    page.setDefaultTimeout(20000);
    await goto('/moderation');
    await page.waitForURL('**/moderation/sign-in?returnTo=*');
    await login('moderator', true);
    await page.locator('.enrollment code').waitFor();
    const moderatorSecret = await page.locator('.enrollment code').textContent();
    const moderatorCode = generateSync({ secret: moderatorSecret, period: 30, digits: 6 });
    await page.getByLabel('Код из приложения').fill(moderatorCode === '000000' ? '999999' : '000000');
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await page.locator('.form-error').filter({ hasText: 'Требуется вход или проверка данных' }).waitFor();
    await page.getByLabel('Код из приложения').fill(generateSync({ secret: moderatorSecret, period: 30, digits: 6 }));
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await heading('Сохраните резервные коды');
    const switchTab = await context.newPage();
    await switchTab.goto(origin + '/auth');
    await switchTab.getByLabel('Электронная почта', { exact: true }).fill('user2@meal-planner.test');
    await switchTab.getByLabel('Пароль', { exact: true }).fill('1');
    await switchTab.getByRole('button', { name: 'Войти', exact: true }).click();
    await switchTab.waitForURL(origin + '/');
    await page.getByRole('link', { name: 'Вернуться ко входу' }).waitFor();
    assert.equal(await page.locator('.recovery-codes').count(), 0);
    await switchTab.close();
    await goto('/moderation');
    await heading('Модерация');
    check('moderator MFA, invalid TOTP, cross-tab recovery clearing and protected overview');
    const csrfRejected = await page.evaluate(
        async () =>
            (await fetch('/api/v1/auth/logout', { method: 'POST', headers: { 'x-csrf-token': 'invalid' } })).status,
    );
    assert.equal(csrfRejected, 403);
    check('browser mutation with invalid CSRF rejected');
    await page.evaluate(
        () =>
            new Promise((resolve, reject) => {
                const open = indexedDB.open('meal-planner-api-v1-mock', 1);
                open.onsuccess = () => {
                    const db = open.result;
                    const tx = db.transaction('state', 'readwrite');
                    const store = tx.objectStore('state');
                    const get = store.get('current');
                    get.onsuccess = () => {
                        const state = get.result;
                        for (const session of state.sessions) session.principal.expiresAt = '2020-01-01T00:00:00.000Z';
                        store.put(state, 'current');
                    };
                    tx.oncomplete = () => {
                        db.close();
                        resolve(true);
                    };
                    tx.onabort = () => {
                        db.close();
                        reject(new Error('test storage update failed'));
                    };
                };
                open.onerror = () => reject(new Error('test storage open failed'));
            }),
    );
    await page.reload();
    await page.waitForURL('**/moderation/sign-in?returnTo=*');
    check('expired staff session redirects after validation');
    await context.close();
    context = await browser.newContext();
    context.on('page', (tab) => tab.on('pageerror', (error) => errors.push(error.message)));
    await context.addInitScript(() => {
        const transport = window.fetch.bind(window);
        window.fetch = async (...args) => {
            const path = String(args[0]);
            if (path.endsWith('/api/v1/auth/me')) {
                return Response.json(
                    {
                        error: { code: 'UNAVAILABLE', message: 'Сервис временно недоступен', details: null },
                        meta: { requestId: crypto.randomUUID() },
                    },
                    { status: 503 },
                );
            }
            return transport(...args);
        };
    });
    page = await context.newPage();
    await goto('/');
    await heading('Не удалось проверить вход');
    assert.equal(page.url(), origin + '/');
    check('unavailable API shows retry without redirecting to login');
    await context.close();
    context = await browser.newContext();
    context.on('page', (tab) => tab.on('pageerror', (error) => errors.push(error.message)));
    await context.addInitScript(() => {
        const transport = window.fetch.bind(window);
        window.fetch = async (...args) => {
            if (String(args[0]).endsWith('/api/v1/auth/login')) {
                const response = await transport(...args);
                await new Promise((resolve) => setTimeout(resolve, 1500));
                document.documentElement.dataset.qaLateResponse = 'returned';
                return response;
            }
            return transport(...args);
        };
    });
    page = await context.newPage();
    await goto('/auth');
    await login('user1');
    await page.locator('.brand').click();
    await page.waitForURL('**/about');
    await page.waitForFunction(() => document.documentElement.dataset.qaLateResponse === 'returned');
    assert.equal(page.url(), origin + '/about');
    check('late login response cannot redirect after leaving the form');
    assert.deepEqual(errors, []);
    check('no browser runtime errors');
} catch (error) {
    console.log('Screen:', await page.locator('h1').allTextContents());
    console.log('Runtime errors:', errors);
    console.log('Console errors:', consoleErrors);
    if (!page.url().endsWith('/mfa')) await screenshot('failure');
    throw error;
} finally {
    await writeFile(new URL('browser-results.json', output), JSON.stringify({ results, errors }, null, 2));
    await browser.close();
}
