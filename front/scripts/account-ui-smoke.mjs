import { qaRoot } from '../../scripts/qa-output.mjs';
/* global document, indexedDB, innerWidth */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { generateSync } from 'otplib';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '@playwright/test');
const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
});
const context = await browser.newContext({ viewport: { width: 1487, height: 1058 } });
let page = await context.newPage();
page.setDefaultTimeout(25000);
const errors = [];
const results = [];
page.on('pageerror', (error) => errors.push(error.message));
const pass = (name) => {
    results.push(name);
    console.log('PASS ' + name);
};
const output = new URL('', qaRoot());
await mkdir(output, { recursive: true });
const origin = 'http://localhost:3000';
const runId = Date.now().toString(36);
const email = `account-qa-${runId}@meal-planner.test`;
const password = 'AccountQa2026!';
const goto = (path) => page.goto(origin + path);
async function mailLink(address, name) {
    const kinds = {
        'Подтвердить почту': ['verify', '/auth/verify-email'],
        'Подтвердить новый адрес': ['email-confirm', '/auth/email-change/confirm'],
        'Отменить смену адреса': ['email-cancel', '/auth/email-change/cancel'],
        'Задать новый пароль': ['reset', '/auth/reset-password'],
    };
    const [kind, path] = kinds[name];
    const token = await page.evaluate(
        async ({ email, expectedKind }) => {
            const database = await new Promise((resolve, reject) => {
                const request = indexedDB.open('meal-planner-api-v1-mock', 1);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            try {
                return await new Promise((resolve, reject) => {
                    const transaction = database.transaction('state', 'readonly');
                    const request = transaction.objectStore('state').get('current');
                    request.onsuccess = () => {
                        const messages = request.result?.account?.mail ?? [];
                        resolve(
                            [...messages]
                                .reverse()
                                .find((message) => message.email === email && message.kind === expectedKind)?.token ??
                                null,
                        );
                    };
                    request.onerror = () => reject(request.error);
                });
            } finally {
                database.close();
            }
        },
        { email: address, expectedKind: kind },
    );
    assert.ok(token, `${name} mail token for ${address}`);
    return `${path}?token=${encodeURIComponent(token)}`;
}
async function login(address = email, secret = password) {
    await goto('/auth');
    await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    await page.getByLabel('Электронная почта', { exact: true }).fill(address);
    await page.getByLabel('Пароль', { exact: true }).fill(secret);
    const submit = page.getByRole('button', { name: 'Войти', exact: true });
    await submit.waitFor();
    const responsePromise = page.waitForResponse(
        (response) => response.url().endsWith('/api/v1/auth/login') && response.request().method() === 'POST',
    );
    await submit.click();
    const response = await responsePromise;
    assert.equal(response.status(), 200, await response.text());
    await page.waitForURL(origin + '/');
}
async function logout() {
    await page.getByRole('button', { name: 'Выйти', exact: true }).click();
    await page.getByLabel('Пароль', { exact: true }).waitFor();
    await goto('/auth');
    await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    await page.locator('button[type="submit"]:not([disabled])').waitFor();
}
async function screenshot(name) {
    await page.screenshot({ path: fileURLToPath(new URL(name + '.png', output)), fullPage: true });
    assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
        name + ' overflow',
    );
}
try {
    await goto('/auth/sign-up');
    await page.evaluate(() => navigator.serviceWorker.ready);
    if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))))
        await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByLabel('Имя (видно только вам)').fill('Тест аккаунта');
    await page.getByLabel('Публичный логин').fill(`Account_${runId}`);
    await page.getByLabel('Электронная почта', { exact: true }).fill(email);
    await page.getByLabel('Пароль', { exact: true }).fill(password);
    await page.getByLabel('Повторите пароль', { exact: true }).fill(password);
    await page.getByRole('checkbox', { name: 'Я принимаю' }).check();
    await page.getByRole('checkbox', { name: 'Я ознакомился с' }).check();
    await screenshot('account-sign-up-desktop');
    await page.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
    await page.getByRole('heading', { name: 'Подтвердите почту', exact: true }).waitFor();
    pass('register username/password/legal consent and neutral verification state');
    const verifyLink = await mailLink(email, 'Подтвердить почту');
    await goto(verifyLink);
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await page.getByText('Почта подтверждена. Теперь можно войти в аккаунт.', { exact: true }).waitFor();
    pass('mock mailbox and explicit email confirmation without auto login');
    await login();
    await goto('/settings/account');
    await page.getByText('PIN в этом браузере не настроен.', { exact: false }).waitFor();
    await screenshot('account-security-desktop');
    await page.setViewportSize({ width: 393, height: 852 });
    await screenshot('account-security-mobile');
    await page.setViewportSize({ width: 1487, height: 1058 });
    await page.getByText('Настроить PIN', { exact: true }).click();
    await page.getByLabel('Пароль аккаунта', { exact: true }).fill(password);
    await page.getByLabel('Новый PIN — 6 цифр', { exact: true }).fill('654321');
    await page.getByLabel('Повторите PIN', { exact: true }).fill('654321');
    await page.getByRole('button', { name: 'Сохранить PIN' }).click();
    await page.getByText('PIN настроен для этого браузера.', { exact: true }).waitFor();
    await logout();
    const alternativeLogin = page.getByRole('button', { name: 'Войти другим способом' });
    const pinLogin = page.getByRole('button', { name: 'PIN устройства', exact: true });
    await alternativeLogin.click();
    await page.waitForFunction(() => document.querySelector('button[aria-expanded="true"]'));
    await pinLogin.click();
    await page.getByLabel('PIN этого устройства').fill('654321');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL(origin + '/');
    pass('device PIN enrollment, logout and standalone PIN login');
    await goto('/settings/account');
    await page.getByText('Подключить приложение', { exact: true }).click();
    await page.getByLabel('Пароль для управления аутентификатором', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Начать настройку' }).click();
    const secretElement = page.locator('code').filter({ hasText: /^[A-Z2-7]{16,}$/ });
    await secretElement.waitFor();
    const secret = await secretElement.textContent();
    await page.getByLabel('Код нового приложения').fill(generateSync({ secret, period: 30, digits: 6 }));
    await page.getByRole('button', { name: 'Подтвердить приложение' }).click();
    await page.getByRole('heading', { name: 'Сохраните резервные коды' }).waitFor();
    const codes = await page.locator('.recovery-codes code').allTextContents();
    assert.equal(codes.length, 10);
    await page.getByRole('checkbox', { name: 'Я сохранил резервные коды' }).check();
    await page.getByRole('button', { name: 'Закрыть коды' }).click();
    pass('authenticator setup, code verification and ten one-time recovery codes');
    await logout();
    await page.getByLabel('Электронная почта', { exact: true }).fill(email);
    await page.getByRole('button', { name: 'Войти другим способом' }).click();
    await page.getByRole('button', { name: 'Приложение-аутентификатор', exact: true }).click();
    await page
        .getByLabel('Код из приложения', { exact: true })
        .fill(generateSync({ secret, period: 30, digits: 6, epoch: Date.now() / 1000 + 30 }));
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL(origin + '/');
    pass('standalone TOTP user login');
    await goto('/settings/account');
    await page.getByText('Заменить приложение или резервные коды', { exact: true }).click();
    await page.getByLabel('Пароль для управления аутентификатором', { exact: true }).fill(password);
    await page.getByLabel('Способ подтверждения').selectOption('recovery');
    await page.getByLabel('Одноразовый резервный код').fill(codes[0]);
    await page.getByRole('button', { name: 'Перевыпустить резервные коды' }).click();
    await page.getByRole('heading', { name: 'Сохраните резервные коды' }).waitFor();
    const nextCodes = await page.locator('.recovery-codes code').allTextContents();
    assert.equal(nextCodes.length, 10);
    assert.ok(!nextCodes.includes(codes[0]));
    await page.getByRole('checkbox', { name: 'Я сохранил резервные коды' }).check();
    await page.getByRole('button', { name: 'Закрыть коды' }).click();
    pass('recovery code regeneration with password plus existing recovery proof');
    await page.getByText('Изменить почту', { exact: true }).click();
    await page.getByLabel('Новая электронная почта').fill('changed@meal-planner.test');
    await page.getByLabel('Текущий пароль', { exact: true }).first().fill(password);
    await page.getByRole('button', { name: 'Запросить смену почты' }).click();
    await page.getByText('Запрос принят. Проверьте письма на новом и прежнем адресах.', { exact: true }).waitFor();
    const confirmLink = await mailLink('changed@meal-planner.test', 'Подтвердить новый адрес');
    await goto(confirmLink);
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await page.getByText('Новый адрес подтверждён.', { exact: false }).waitFor();
    const cancelLink = await mailLink(email, 'Отменить смену адреса');
    await goto(cancelLink);
    await page.getByRole('button', { name: 'Отменить смену адреса', exact: true }).click();
    await page.getByText('Смена почты отменена.', { exact: true }).waitFor();
    pass('email change new-address confirmation and old-address cancellation');
    // Isolate the password-recovery scenario from send limits consumed by the
    // preceding mailbox scenarios without replacing the browser clock.
    await page.evaluate(async () => {
        const database = await new Promise((resolve, reject) => {
            const request = indexedDB.open('meal-planner-api-v1-mock', 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        try {
            await new Promise((resolve, reject) => {
                const transaction = database.transaction('state', 'readwrite');
                const store = transaction.objectStore('state');
                const request = store.get('current');
                request.onsuccess = () => {
                    request.result.account.sends = {};
                    store.put(request.result, 'current');
                };
                transaction.oncomplete = resolve;
                transaction.onerror = () => reject(transaction.error);
                transaction.onabort = () => reject(transaction.error);
            });
        } finally {
            database.close();
        }
    });
    await goto('/auth/recovery');
    await page.getByLabel('Электронная почта', { exact: true }).fill(email);
    await page.getByRole('button', { name: 'Отправить ссылку' }).click();
    await page.getByText('Запрос принят.', { exact: false }).waitFor();
    const resetLink = await mailLink(email, 'Задать новый пароль');
    await goto(resetLink);
    await page.getByLabel('Новый пароль', { exact: true }).waitFor();
    await page.setViewportSize({ width: 393, height: 852 });
    await screenshot('account-reset-mobile');
    const updatedPassword = 'UpdatedAccount2026!';
    await page.getByLabel('Новый пароль', { exact: true }).fill(updatedPassword);
    await page.getByLabel('Повторите пароль', { exact: true }).fill(updatedPassword);
    await page.getByRole('button', { name: 'Сохранить новый пароль' }).click();
    await page.waitForURL('**/auth?notice=password-changed');
    await page.getByRole('status').filter({ hasText: 'Пароль обновлён.' }).waitFor();
    pass('password recovery check then reset and session invalidation redirect');
    await goto(resetLink);
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByLabel('Новый пароль', { exact: true }).count(), 0);
    pass('used reset token does not display password form');
    await page.close();
    page = await context.newPage();
    page.setDefaultTimeout(25000);
    page.on('pageerror', (error) => errors.push(error.message));
    await login(email, updatedPassword);
    await goto('/settings/account');
    await page.getByText('PIN в этом браузере не настроен.', { exact: false }).waitFor();
    await page.getByText('Приложение подключено.', { exact: false }).waitFor();
    await page.getByText('Изменить пароль', { exact: true }).click();
    await page.getByLabel('Текущий пароль', { exact: true }).last().fill(updatedPassword);
    await page.getByLabel('Новый пароль', { exact: true }).fill('FinalAccount2026!');
    await page.getByLabel('Повторите новый пароль', { exact: true }).fill('FinalAccount2026!');
    await page.getByRole('button', { name: 'Изменить пароль и выйти' }).click();
    await page.waitForURL('**/auth?notice=password-changed');
    pass('password change with reauthentication, PIN revocation and retained authenticator');
    assert.deepEqual(errors, []);
    pass('no browser runtime errors');
} catch (error) {
    console.error('Current page:', new URL(page.url()).pathname);
    console.error('Visible errors:', await page.getByRole('alert').allTextContents());
    console.error('Buttons:', await page.getByRole('button').allTextContents());
    throw error;
} finally {
    await writeFile(new URL('account-ui-results.json', output), JSON.stringify({ results, errors }, null, 2));
    await browser.close();
}
