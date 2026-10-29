import { expect, test, type Page } from '@playwright/test';
import { totp } from '../e2e/helpers/totp.js';

const databaseName = 'meal-planner-api-v1-mock';
const user1Id = '10000000-0000-4000-8000-000000000007';

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

async function login(page: Page, email = 'user1@meal-planner.test', password = '1') {
    await page.goto('/auth');
    await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    await ensureServiceWorker(page);
    const submit = page.getByRole('button', { name: 'Войти', exact: true });
    await expect(submit).toBeEnabled();
    const emailInput = page.getByLabel('Электронная почта', { exact: true });
    const passwordInput = page.getByLabel('Пароль', { exact: true });
    await emailInput.fill(email);
    await passwordInput.fill(password);
    await expect(emailInput).toHaveValue(email);
    await expect(passwordInput).toHaveValue(password);
    await submit.click();
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
    expect(new URL(page.url()).pathname).toBe(path);
}

async function mutateState(
    page: Page,
    kind:
        | 'profile-stale'
        | 'preferences-stale'
        | 'expire-export'
        | 'ready-export'
        | 'ready-deletion'
        | 'add-session'
        | 'pin-four',
) {
    await page.evaluate(
        async ({ databaseName: name, kind: mutation, userId }) => {
            const database = await new Promise<IDBDatabase>((resolve, reject) => {
                const request = indexedDB.open(name, 1);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            await new Promise<void>((resolve, reject) => {
                const transaction = database.transaction('state', 'readwrite');
                const store = transaction.objectStore('state');
                const read = store.get('current');
                read.onsuccess = () => {
                    const state = read.result;
                    if (mutation === 'profile-stale') state.personalization.rows[userId].profileVersion += 1;
                    if (mutation === 'preferences-stale') state.personalization.rows[userId].settingsVersion += 1;
                    if (mutation === 'add-session') {
                        const current = [...state.sessions]
                            .reverse()
                            .find((candidate) => candidate.principal.id === userId && !candidate.revoked);
                        state.sessions.push({
                            ...current,
                            token: crypto.randomUUID(),
                            authenticatedAt: new Date(Date.now() - 60_000).toISOString(),
                            principal: { ...current.principal, sessionId: crypto.randomUUID() },
                        });
                    }
                    if (mutation === 'pin-four') {
                        const pin = state.account.pins.find(
                            (candidate) => candidate.userId === userId && !candidate.revoked,
                        );
                        pin.attempts = 4;
                    }
                    if (mutation === 'expire-export') {
                        const row = [...state.exports.jobs].reverse().find((candidate) => candidate.userId === userId);
                        row.job.status = 'ready';
                        row.job.completedAt = new Date().toISOString();
                        row.job.expiresAt = new Date(Date.now() + 8_000).toISOString();
                        row.job.failureCode = null;
                    }
                    if (mutation === 'ready-export') {
                        const row = [...state.exports.jobs].reverse().find((candidate) => candidate.userId === userId);
                        row.job.status = 'ready';
                        row.job.completedAt = new Date().toISOString();
                        row.job.expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
                        row.job.failureCode = null;
                    }
                    if (mutation === 'ready-deletion') {
                        state.accountLifecycle.accounts[userId] = {
                            archived: false,
                            deletion: {
                                id: crypto.randomUUID(),
                                status: 'ready',
                                requestedAt: new Date(Date.now() - 86_400_000).toISOString(),
                                cancelUntil: null,
                                finalizationNotBefore: new Date(Date.now() - 1_000).toISOString(),
                                cancelledAt: null,
                                finalizedAt: null,
                                policyVersion: 'mock-policy-v1',
                                blockers: [],
                                version: 1,
                            },
                        };
                    }
                    store.put(state, 'current');
                };
                read.onerror = () => reject(read.error);
                transaction.oncomplete = () => resolve();
                transaction.onabort = () => reject(transaction.error);
            });
            database.close();
        },
        { databaseName, kind, userId: user1Id },
    );
}

async function rawPost(page: Page, path: string, body: unknown) {
    return page.evaluate(
        async ({ path: requestPath, body: requestBody }) => {
            const csrfResponse = await fetch('/api/v1/auth/csrf', { credentials: 'include', cache: 'no-store' });
            const csrf = (await csrfResponse.json()) as { data: { token: string } };
            const response = await fetch(requestPath, {
                method: 'POST',
                credentials: 'include',
                cache: 'no-store',
                headers: { 'content-type': 'application/json', 'x-csrf-token': csrf.data.token },
                body: JSON.stringify(requestBody),
            });
            return { status: response.status, body: await response.json() };
        },
        { path, body },
    );
}

async function rawReauth(page: Page) {
    const response = await rawPost(page, '/api/v1/account/critical-reauth', {
        purpose: 'account_lifecycle',
        password: '1',
        factor: null,
    });
    expect(response.status).toBe(200);
    return (response.body as { data: { reauthToken: string } }).data.reauthToken;
}

async function installOneShotFailure(page: Page, path: string) {
    await page.addInitScript((failedPath) => {
        const nativeFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
            const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
            const marker = `__fail_${failedPath}`;
            const state = window as typeof window & Record<string, number | false>;
            const status = state[marker];
            if (url.pathname === failedPath && status) {
                state[marker] = false;
                return new Response(
                    JSON.stringify({
                        error: {
                            code: status === 412 ? 'PRECONDITION_FAILED' : 'UPSTREAM_UNAVAILABLE',
                            message: status === 412 ? 'Состояние изменилось' : 'Временная ошибка проверки',
                            details: null,
                        },
                        meta: { requestId: crypto.randomUUID() },
                    }),
                    { status, headers: { 'content-type': 'application/json' } },
                );
            }
            return nativeFetch(input, init);
        };
    }, path);
}

async function failNext(page: Page, path: string, status = 503) {
    await page.evaluate(
        ({ failedPath, responseStatus }) => {
            const marker = `__fail_${failedPath}`;
            (window as typeof window & Record<string, number>)[marker] = responseStatus;
        },
        { failedPath: path, responseStatus: status },
    );
}

async function logout(page: Page) {
    await page.getByRole('button', { name: 'Выйти', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/auth');
}

async function confirmIdentity(page: Page) {
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Подтвердите личность' });
    await dialog.getByLabel('Текущий пароль').fill('1');
    await dialog.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Подтверждено', exact: true })).toBeVisible();
}

async function createExportJob(page: Page) {
    await gotoExact(page, '/exports');
    await page.getByRole('button', { name: 'Проверить состав', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Состав экспорта' })).toBeVisible();
    await page.getByRole('button', { name: 'Создать экспорт', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Подтвердите личность' });
    await dialog.getByLabel('Текущий пароль').fill('1');
    await dialog.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Мои экспорты' })).toBeVisible();
}

test('profile and preferences persist, preserve transient drafts and surface stale versions', async ({ page }) => {
    await installOneShotFailure(page, '/api/v1/personalization/preferences');
    await login(page);
    await gotoExact(page, '/profile');
    const name = page.getByLabel('Имя', { exact: true });
    await name.fill('Проверка профиля');
    await page.getByLabel('Часовой пояс').fill('Asia/Yekaterinburg');
    await page.getByRole('button', { name: 'Сохранить профиль', exact: true }).click();
    await expect(page.getByRole('status', { name: '' }).filter({ hasText: 'Профиль сохранён.' })).toBeVisible();
    await page.reload();
    await expect(name).toHaveValue('Проверка профиля');
    await mutateState(page, 'profile-stale');
    await name.fill('Устаревшее имя');
    await page.getByRole('button', { name: 'Сохранить профиль', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Не удалось сохранить профиль' })).toBeVisible();

    await gotoExact(page, '/settings/preferences');
    await page.getByLabel('Вегетарианское').check();
    const dislikes = page.getByLabel('Продукты и вкусы');
    await dislikes.fill('кинза');
    await failNext(page, '/api/v1/personalization/preferences');
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Введённые значения сохранены в форме' })).toBeVisible();
    await expect(dislikes).toHaveValue('кинза');
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Настройки сохранены.' })).toBeVisible();
    await page.reload();
    await expect(dislikes).toHaveValue('кинза');
    await mutateState(page, 'preferences-stale');
    await dislikes.fill('оливки');
    const staleResponse = page.waitForResponse(
        (response) =>
            response.url().endsWith('/api/v1/personalization/preferences') && response.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    expect((await staleResponse).status()).toBe(412);
    await expect(page.getByRole('alert').filter({ hasText: 'Проверьте обновлённые значения' })).toBeVisible();
    await expect(dislikes).toHaveValue('кинза');
});

test('sessions revoke others and announce a transient action failure as an alert', async ({ page }) => {
    await installOneShotFailure(page, '/api/v1/auth/sessions/revoke-others');
    await login(page);
    await mutateState(page, 'add-session');
    await gotoExact(page, '/settings/account');
    await expect(page.getByText('Другая сессия', { exact: true })).toBeVisible();
    await failNext(page, '/api/v1/auth/sessions/revoke-others');
    await page.getByRole('button', { name: 'Завершить другие сессии', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Временная ошибка проверки' })).toBeVisible();
    await expect(page.getByText('Другая сессия', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Завершить другие сессии', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Завершено других сессий: 1');
    await expect(page.getByText('Другая сессия', { exact: true })).toHaveCount(0);
});

test('five invalid PIN attempts disable the device binding while password login remains available', async ({
    page,
}) => {
    await login(page);
    await gotoExact(page, '/settings/account');
    await page.getByText('Настроить PIN', { exact: true }).click();
    await page.getByLabel('Пароль аккаунта', { exact: true }).fill('1');
    await page.getByLabel('Новый PIN — 6 цифр', { exact: true }).fill('654321');
    await page.getByLabel('Повторите PIN', { exact: true }).fill('654321');
    await page.getByRole('button', { name: 'Сохранить PIN', exact: true }).click();
    await expect(page.getByText('PIN настроен для этого браузера.', { exact: true })).toBeVisible();
    await logout(page);
    await mutateState(page, 'pin-four');
    await page.getByRole('button', { name: 'Войти другим способом' }).click();
    await page.getByRole('button', { name: 'PIN устройства', exact: true }).click();
    await page.getByLabel('PIN этого устройства').fill('000000');
    const submit = page.getByRole('button', { name: 'Войти', exact: true });
    await submit.click();
    await expect(page.locator('.form-error[role="alert"]')).toBeVisible();
    await expect(submit).toBeEnabled();
    await page.getByRole('button', { name: 'Пароль', exact: true }).click();
    await page.getByLabel('Электронная почта', { exact: true }).fill('user1@meal-planner.test');
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL((url) => ['/', '/settings/account'].includes(url.pathname));
    await gotoExact(page, '/settings/account');
    await expect(page.getByText('PIN в этом браузере не настроен.', { exact: false })).toBeVisible();
});

test('authenticator recovery codes are one-time and regeneration invalidates old codes', async ({ page }) => {
    await login(page);
    await gotoExact(page, '/settings/account');
    await page.getByText('Подключить приложение', { exact: true }).click();
    await page.getByLabel('Пароль для управления аутентификатором', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Начать настройку', exact: true }).click();
    const secretNode = page.locator('code').filter({ hasText: /^[A-Z2-7]{16,}$/u });
    const secret = await secretNode.textContent();
    expect(secret).toBeTruthy();
    await page.getByLabel('Код нового приложения').fill(totp(secret!));
    await page.getByRole('button', { name: 'Подтвердить приложение', exact: true }).click();
    const recovery = page.getByRole('heading', { name: 'Сохраните резервные коды' }).locator('..');
    await expect(recovery).toBeVisible();
    const codes = await recovery.locator('code').allTextContents();
    expect(codes).toHaveLength(10);
    await page.getByRole('checkbox', { name: 'Я сохранил резервные коды' }).check();
    await page.getByRole('button', { name: 'Закрыть коды', exact: true }).click();
    await logout(page);
    await page.getByLabel('Электронная почта', { exact: true }).fill('user1@meal-planner.test');
    await page.getByRole('button', { name: 'Войти другим способом' }).click();
    await page.getByRole('button', { name: 'Приложение-аутентификатор', exact: true }).click();
    await page.getByLabel('Код из приложения', { exact: true }).fill(totp(secret!, Date.now() + 30_000));
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL((url) => ['/', '/settings/account'].includes(url.pathname));
    await gotoExact(page, '/settings/account');
    await page.getByText('Заменить приложение или резервные коды', { exact: true }).click();
    await page.getByLabel('Пароль для управления аутентификатором', { exact: true }).fill('1');
    await page.getByLabel('Способ подтверждения').selectOption('recovery');
    await page.getByLabel('Одноразовый резервный код').fill(codes[0]!);
    await page.getByRole('button', { name: 'Перевыпустить резервные коды', exact: true }).click();
    const regenerated = page.getByRole('heading', { name: 'Сохраните резервные коды' }).locator('..');
    await expect(regenerated).toBeVisible();
    const nextCodes = await regenerated.locator('code').allTextContents();
    expect(nextCodes).toHaveLength(10);
    expect(nextCodes).not.toContain(codes[0]);
    await page.getByRole('checkbox', { name: 'Я сохранил резервные коды' }).check();
    await page.getByRole('button', { name: 'Закрыть коды', exact: true }).click();
    await page.getByText('Заменить приложение или резервные коды', { exact: true }).click();
    await page.getByLabel('Пароль для управления аутентификатором', { exact: true }).fill('1');
    await page.getByLabel('Способ подтверждения').selectOption('recovery');
    await page.getByLabel('Одноразовый резервный код').fill(codes[0]!);
    await page.getByRole('button', { name: 'Перевыпустить резервные коды', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Требуется вход или проверка данных' })).toBeVisible();
});

test('archive revokes the session, login restores the account, and risk hold blocks archive', async ({ page }) => {
    await login(page);
    await gotoExact(page, '/settings/account/lifecycle');
    await page.getByRole('button', { name: 'Архивировать вместо удаления', exact: true }).click();
    const confirmation = page.getByRole('dialog', { name: 'Архивировать аккаунт?' });
    await expect(confirmation.getByRole('button', { name: 'Вернуться', exact: true })).toBeFocused();
    await confirmation.getByRole('button', { name: 'Продолжить', exact: true }).click();
    const reauth = page.getByRole('dialog', { name: 'Подтвердите личность' });
    await reauth.getByLabel('Текущий пароль').fill('1');
    await reauth.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/auth' && url.searchParams.get('archived') === '1');
    await login(page);
    await gotoExact(page, '/profile');
    await expect(page.getByRole('heading', { name: 'Мой профиль' })).toBeVisible();
    await gotoExact(page, '/settings/account');
    await logout(page);
    await login(page, 'user2@meal-planner.test');
    await gotoExact(page, '/settings/account/lifecycle');
    await page.getByRole('button', { name: 'Архивировать вместо удаления', exact: true }).click();
    await page
        .getByRole('dialog', { name: 'Архивировать аккаунт?' })
        .getByRole('button', { name: 'Продолжить' })
        .click();
    const held = page.getByRole('dialog', { name: 'Подтвердите личность' });
    await held.getByLabel('Текущий пароль').fill('1');
    await held.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await expect(held.getByRole('alert')).toContainText('удержана проверкой риска');
    expect(new URL(page.url()).pathname).toBe('/settings/account/lifecycle');
});

test('deletion requires a live export, uses ten-minute reauth, cancels safely and keeps finalize fail-closed', async ({
    page,
}) => {
    await login(page);
    await gotoExact(page, '/settings/account/lifecycle');
    await expect(page.getByRole('button', { name: 'Продолжить удаление', exact: true })).toBeDisabled();
    await expect(page.getByText('Юридический срок не опубликован — финализация заблокирована.')).toBeVisible();
    await createExportJob(page);
    await mutateState(page, 'expire-export');
    await gotoExact(page, '/settings/account/lifecycle');
    const exportStep = page.getByRole('heading', { name: 'Экспорт данных', exact: true }).locator('..').locator('..');
    await expect(exportStep.getByText('Готово', { exact: true })).toBeVisible();
    await expect(exportStep.getByText('Требуется', { exact: true })).toBeVisible({ timeout: 12_000 });
    await expect(page.getByRole('button', { name: 'Продолжить удаление', exact: true })).toBeDisabled();
    await mutateState(page, 'ready-export');
    await page.reload();
    await confirmIdentity(page);
    const reauthWindow = await page.evaluate(
        async ({ databaseName: name, userId }) => {
            const database = await new Promise<IDBDatabase>((resolve, reject) => {
                const request = indexedDB.open(name, 1);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            const state = await new Promise<unknown>((resolve, reject) => {
                const request = database.transaction('state', 'readonly').objectStore('state').get('current');
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            database.close();
            const rows = (state as { accountLifecycle: { reauth: Array<{ userId: string; expiresAt: number }> } })
                .accountLifecycle.reauth;
            const row = [...rows].reverse().find((candidate) => candidate.userId === userId)!;
            return row.expiresAt - Date.now();
        },
        { databaseName, userId: user1Id },
    );
    expect(reauthWindow).toBeGreaterThan(9 * 60_000);
    expect(reauthWindow).toBeLessThanOrEqual(10 * 60_000);
    await page.getByRole('button', { name: 'Продолжить удаление', exact: true }).click();
    await page
        .getByRole('dialog', { name: 'Запросить удаление аккаунта?' })
        .getByRole('button', { name: 'Продолжить' })
        .click();
    await expect(page.getByRole('heading', { name: 'Запрос принят' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Подтвердить окончательное удаление' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Отменить запрос', exact: true }).click();
    await page
        .getByRole('dialog', { name: 'Отменить запрос на удаление?' })
        .getByRole('button', { name: 'Продолжить' })
        .click();
    const cancelReauth = page.getByRole('dialog', { name: 'Подтвердите личность' });
    await cancelReauth.getByLabel('Текущий пароль').fill('1');
    await cancelReauth.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Запрос отменён' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Подтвердить окончательное удаление' })).toHaveCount(0);
});

test('direct finalize persists a blocked snapshot until a live export makes the workflow ready', async ({ page }) => {
    await login(page);
    await mutateState(page, 'ready-deletion');
    const blocked = await rawPost(page, '/api/v1/account/deletion/finalize', {
        reauthToken: await rawReauth(page),
        expectedVersion: 1,
    });
    expect(blocked.status).toBe(200);
    const blockedDeletion = (
        blocked.body as { data: { status: string; version: number; blockers: Array<{ code: string }> } }
    ).data;
    expect(blockedDeletion.status).toBe('blocked');
    expect(blockedDeletion.version).toBe(2);
    expect(blockedDeletion.blockers.map((item) => item.code)).toEqual(['export_not_ready']);
    const beforeExport = await page.evaluate(
        async ({ databaseName: name, userId }) => {
            type StoredState = {
                users: Array<{ id: string; active: boolean }>;
                sessions: Array<{ principal: { id: string }; revoked: boolean }>;
                accountLifecycle: {
                    accounts: Record<
                        string,
                        { deletion: { status: string; version: number; blockers: Array<{ code: string }> } }
                    >;
                };
            };
            const database = await new Promise<IDBDatabase>((resolve, reject) => {
                const request = indexedDB.open(name, 1);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            const state = await new Promise<StoredState>((resolve, reject) => {
                const request = database.transaction('state', 'readonly').objectStore('state').get('current');
                request.onsuccess = () => resolve(request.result as StoredState);
                request.onerror = () => reject(request.error);
            });
            database.close();
            return {
                active: state.users.find((user) => user.id === userId)!.active,
                liveSessions: state.sessions.filter((session) => session.principal.id === userId && !session.revoked)
                    .length,
                deletion: state.accountLifecycle.accounts[userId].deletion,
            };
        },
        { databaseName, userId: user1Id },
    );
    expect(beforeExport.active).toBe(true);
    expect(beforeExport.liveSessions).toBeGreaterThan(0);
    expect(beforeExport.deletion.status).toBe('blocked');
    expect(beforeExport.deletion.version).toBe(2);
    expect(beforeExport.deletion.blockers.map((item) => item.code)).toEqual(['export_not_ready']);

    await createExportJob(page);
    await mutateState(page, 'ready-export');
    const finalized = await rawPost(page, '/api/v1/account/deletion/finalize', {
        reauthToken: await rawReauth(page),
        expectedVersion: 2,
    });
    expect(finalized.status).toBe(200);
    expect((finalized.body as { data: { status: string; version: number } }).data).toMatchObject({
        status: 'finalized',
        version: 3,
    });
});
