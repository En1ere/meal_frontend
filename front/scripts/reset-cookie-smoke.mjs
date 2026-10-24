import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '@playwright/test');
const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
});
try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/auth');
    await page.getByRole('button', { name: 'Войти', exact: true }).waitFor();
    // Use the UI once to await runtime/MSW readiness before testing cookie transport.
    await page.getByLabel('Электронная почта', { exact: true }).fill('user1@meal-planner.test');
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL('http://localhost:3000/');
    const statuses = await page.evaluate(async () => {
        const csrf = (await (await fetch('/api/v1/auth/csrf')).json()).data.token;
        const post = (path, body) =>
            fetch('/api/v1/' + path, {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
                body: JSON.stringify(body),
            });
        const email = 'user1@meal-planner.test';
        const recovery = await post('auth/password/recovery', { email });
        const messages = (await (await post('dev/mailbox', { email })).json()).data.messages;
        const token = messages.find((item) => item.kind === 'reset').token;
        const reset = await post('auth/password/reset', { token, password: 'BrowserReset123!' });
        const revoked = await fetch('/api/v1/auth/me');
        const login = await post('auth/login', { email, password: 'BrowserReset123!' });
        const authenticated = await fetch('/api/v1/auth/me');
        await post('auth/logout', {});
        return [recovery.status, reset.status, revoked.status, login.status, authenticated.status];
    });
    assert.deepEqual(statuses, [200, 200, 401, 200, 200]);
    await page.goto('http://localhost:3000/auth');
    await page.getByLabel('Электронная почта', { exact: true }).fill('user1@meal-planner.test');
    await page.getByLabel('Пароль', { exact: true }).fill('BrowserReset123!');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL('http://localhost:3000/');
    console.log('PASS browser reset clears previous cookies and permits a new authenticated session');
} finally {
    await browser.close();
}
