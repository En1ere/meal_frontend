import { expect, test, type Page } from '@playwright/test';

const password = 'Valid-password-1';
const productionMockRun = process.env.FRONT_E2E_PRODUCTION_MOCKS === '1';

async function ensureServiceWorker(page: Page) {
    await page.evaluate(() => navigator.serviceWorker.ready);
    const controlled = () =>
        page.evaluate(() => navigator.serviceWorker.controller?.scriptURL.endsWith('/mockServiceWorker.js') ?? false);
    if (!(await controlled())) await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(controlled, { timeout: 30_000 }).toBe(true);
}

async function login(page: Page) {
    await gotoSettled(page, '/auth');
    await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    await ensureServiceWorker(page);
    await page.getByLabel('Электронная почта', { exact: true }).fill('user1@meal-planner.test');
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/', { timeout: 60_000 });
    await expect(page.getByRole('button', { name: 'Войти', exact: true })).toHaveCount(0);
    await expect(page.getByText(/Проверяем сессию/u)).toHaveCount(0, { timeout: 30_000 });
}

async function gotoSettled(page: Page, path: string) {
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
    await expect(page.getByText(/Проверяем сессию/u)).toHaveCount(0, { timeout: 30_000 });
    expect(new URL(page.url()).pathname, `${path}: final pathname`).toBe(
        new URL(path, 'http://localhost:3000').pathname,
    );
}

async function fillRegistration(page: Page, suffix: string) {
    await page.getByLabel('Имя (видно только вам)').fill('Проверка регистрации');
    await page.getByLabel('Публичный логин').fill(`legal_${suffix}`);
    await page.getByLabel('Электронная почта', { exact: true }).fill(`legal-${suffix}@example.test`);
    await page.getByLabel('Пароль', { exact: true }).fill(password);
    await page.getByLabel('Повторите пароль', { exact: true }).fill(password);
}

async function openRegistration(page: Page, suffix: string) {
    await gotoSettled(page, '/auth/sign-up');
    await page.getByRole('heading', { name: 'Создайте аккаунт' }).waitFor();
    await expect(page.getByText('Проверяем доступность документов…')).toHaveCount(0, { timeout: 30_000 });
    await fillRegistration(page, suffix);
}

async function prewarmRegistrationLegalPages(page: Page) {
    await gotoSettled(page, '/auth');
    await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    await ensureServiceWorker(page);
    await gotoSettled(page, '/legal/terms');
    await expect(page.getByText('Черновик — не опубликованная редакция')).toBeVisible();
    await gotoSettled(page, '/legal/privacy');
    await expect(page.getByText('Черновик — не опубликованная редакция')).toBeVisible();
}

async function acceptRegistrationDocuments(page: Page) {
    await page.getByLabel('Я принимаю').check();
    await page.getByLabel('Я ознакомился с').check();
}

async function installRegistrationFaults(page: Page) {
    await page.addInitScript(() => {
        const nativeFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
            const request = input instanceof Request ? input : null;
            const url = new URL(request?.url ?? String(input), window.location.origin);
            const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
            const scope = window as typeof window & {
                __registrationStatus?: number;
                __registrationCode?: string;
                __registrationDelay?: number;
                __registrationCalls?: number;
            };
            if (url.pathname === '/api/v1/auth/register/v2' && method === 'POST') {
                scope.__registrationCalls = (scope.__registrationCalls ?? 0) + 1;
                if (scope.__registrationDelay)
                    await new Promise((resolve) => setTimeout(resolve, scope.__registrationDelay));
                if (scope.__registrationStatus) {
                    const status = scope.__registrationStatus;
                    const code =
                        scope.__registrationCode ?? (status === 503 ? 'MAIL_PROVIDER_UNAVAILABLE' : 'CONFLICT');
                    scope.__registrationStatus = undefined;
                    scope.__registrationCode = undefined;
                    return new Response(
                        JSON.stringify({
                            error: { code, message: 'Проверочная ошибка регистрации', details: null },
                            meta: { requestId: crypto.randomUUID() },
                        }),
                        { status, headers: { 'content-type': 'application/json' } },
                    );
                }
            }
            return nativeFetch(input, init);
        };
    });
}

async function installConsentConflict(page: Page) {
    await page.addInitScript(() => {
        const nativeFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
            const request = input instanceof Request ? input : null;
            const url = new URL(request?.url ?? String(input), window.location.origin);
            const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
            const scope = window as typeof window & { __legalConsentConflict?: boolean };
            if (
                scope.__legalConsentConflict &&
                method === 'POST' &&
                url.pathname === '/api/v1/settings/legal-consents/ai_data_access/revoke'
            ) {
                scope.__legalConsentConflict = false;
                return new Response(
                    JSON.stringify({
                        error: { code: 'PRECONDITION_FAILED', message: 'Состояние изменилось', details: null },
                        meta: { requestId: crypto.randomUUID() },
                    }),
                    { status: 412, headers: { 'content-type': 'application/json' } },
                );
            }
            return nativeFetch(input, init);
        };
    });
}

test('registration requires each legal checkbox and opens marked drafts without losing the form', async ({ page }) => {
    // Compile both target=_blank routes before the form is filled. In Next dev a first-time
    // route compilation can broadcast a full refresh to the WebKit opener and erase local form state.
    if (productionMockRun) {
        await gotoSettled(page, '/auth');
        await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
        await ensureServiceWorker(page);
    } else await prewarmRegistrationLegalPages(page);
    await openRegistration(page, 'checkboxes');
    const submit = page.getByRole('button', { name: 'Создать аккаунт' });
    await expect(submit).toBeDisabled();

    await page.getByLabel('Я принимаю').check();
    await expect(submit).toBeDisabled();
    await page.getByLabel('Я принимаю').uncheck();
    await page.getByLabel('Я ознакомился с').check();
    await expect(submit).toBeDisabled();

    const termsPromise = page.waitForEvent('popup');
    await page.getByRole('link', { name: 'Условия использования (откроются в новой вкладке)' }).click();
    const terms = await termsPromise;
    await expect(terms.getByText('Черновик — не опубликованная редакция')).toBeVisible();
    await expect(terms.getByText('[УКАЗАТЬ', { exact: false }).first()).toBeVisible();
    await terms.close();

    const privacyPromise = page.waitForEvent('popup');
    await page.getByRole('link', { name: 'Политика конфиденциальности (откроется в новой вкладке)' }).click();
    const privacy = await privacyPromise;
    await expect(privacy.getByText('Черновик — не опубликованная редакция')).toBeVisible();
    await expect(privacy.getByText('[УКАЗАТЬ', { exact: false }).first()).toBeVisible();
    await privacy.close();

    await expect(page.getByLabel('Публичный логин')).toHaveValue('legal_checkboxes');
    await expect(page.getByLabel('Пароль', { exact: true })).toHaveValue(password);
    await page.getByLabel('Я принимаю').check();
    await expect(submit).toBeEnabled();
});

test('registration suppresses a double submit and creates one verification message', async ({ page }) => {
    test.skip(productionMockRun, 'The mailbox is intentionally unavailable in the production build.');
    await installRegistrationFaults(page);
    await openRegistration(page, 'double');
    await acceptRegistrationDocuments(page);
    await page.evaluate(() => {
        const scope = window as typeof window & { __registrationDelay?: number };
        scope.__registrationDelay = 250;
    });
    const submit = page.getByRole('button', { name: 'Создать аккаунт' });
    await submit.evaluate((button: HTMLButtonElement) => {
        button.click();
        button.click();
    });
    await expect(page.getByRole('heading', { name: 'Подтвердите почту' })).toBeVisible();
    expect(
        await page.evaluate(() => (window as typeof window & { __registrationCalls?: number }).__registrationCalls),
    ).toBe(1);

    await gotoSettled(page, '/dev/mailbox');
    const showMessages = page.getByRole('button', { name: 'Показать письма' });
    await expect(showMessages).toBeEnabled({ timeout: 30_000 });
    await page.getByLabel('Адрес тестовой почты').fill('legal-double@example.test');
    await showMessages.click();
    await expect(page.getByRole('heading', { name: 'Подтвердить почту' })).toHaveCount(1);
});

test('mail 503 and stale legal evidence fail closed while preserving non-secret registration input', async ({
    page,
}) => {
    await installRegistrationFaults(page);
    await openRegistration(page, 'recovery');
    await acceptRegistrationDocuments(page);
    await page.evaluate(() => {
        const scope = window as typeof window & { __registrationStatus?: number; __registrationCode?: string };
        scope.__registrationStatus = 503;
        scope.__registrationCode = 'MAIL_PROVIDER_UNAVAILABLE';
    });
    await page.getByRole('button', { name: 'Создать аккаунт' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Проверочная ошибка регистрации' })).toBeVisible();
    await expect(page.getByLabel('Публичный логин')).toHaveValue('legal_recovery');
    await expect(page.getByLabel('Я принимаю')).toBeChecked();
    await expect(page.getByLabel('Я ознакомился с')).toBeChecked();

    await page.getByLabel('Пароль', { exact: true }).fill(password);
    await page.getByLabel('Повторите пароль', { exact: true }).fill(password);
    await page.evaluate(() => {
        const scope = window as typeof window & { __registrationStatus?: number; __registrationCode?: string };
        scope.__registrationStatus = 409;
        scope.__registrationCode = 'LEGAL_DOCUMENT_STALE';
    });
    await page.getByRole('button', { name: 'Создать аккаунт' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Документы обновились' })).toBeVisible();
    await expect(page.getByLabel('Я принимаю')).not.toBeChecked();
    await expect(page.getByLabel('Я ознакомился с')).not.toBeChecked();
    await expect(page.getByRole('button', { name: 'Создать аккаунт' })).toBeDisabled();
});

test('legal center fails closed on partial loading failure and rejects an unsafe returnTo', async ({ page }) => {
    await login(page);
    await gotoSettled(page, '/settings');
    await page.getByRole('heading', { name: 'Настройки', exact: true }).waitFor();
    await page.evaluate(
        () =>
            new Promise<void>((resolve, reject) => {
                const open = indexedDB.open('meal-planner-api-v1-mock', 1);
                open.onerror = () => reject(open.error);
                open.onsuccess = () => {
                    const database = open.result;
                    const transaction = database.transaction('state', 'readwrite');
                    const store = transaction.objectStore('state');
                    const read = store.get('current');
                    read.onerror = () => reject(read.error);
                    read.onsuccess = () => {
                        const state = read.result;
                        state.limits['e2e:legal-settings-read'] = { started: Date.now(), attempts: 100 };
                        store.put(state, 'current');
                    };
                    transaction.oncomplete = () => {
                        database.close();
                        resolve();
                    };
                    transaction.onabort = () => reject(transaction.error);
                };
            }),
    );
    await page.getByRole('link', { name: /Документы и согласия/u }).click();
    await expect(page.getByRole('heading', { name: 'Центр временно недоступен' })).toBeVisible({ timeout: 30_000 });
    await page.evaluate(
        () =>
            new Promise<void>((resolve, reject) => {
                const open = indexedDB.open('meal-planner-api-v1-mock', 1);
                open.onerror = () => reject(open.error);
                open.onsuccess = () => {
                    const database = open.result;
                    const transaction = database.transaction('state', 'readwrite');
                    const store = transaction.objectStore('state');
                    const read = store.get('current');
                    read.onerror = () => reject(read.error);
                    read.onsuccess = () => {
                        const state = read.result;
                        state.limits['e2e:legal-settings-read'].attempts = 0;
                        store.put(state, 'current');
                    };
                    transaction.oncomplete = () => {
                        database.close();
                        resolve();
                    };
                    transaction.onabort = () => reject(transaction.error);
                };
            }),
    );
    await page.getByRole('button', { name: 'Повторить' }).click();
    await expect(page.getByRole('heading', { name: 'Управление согласиями' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Изменений пока нет.')).toBeVisible();
    await page.evaluate(() => {
        window.history.replaceState(null, '', '/settings/privacy?consent=ai_data_access&returnTo=https://evil.test');
    });
    await expect(page.getByRole('link', { name: 'Вернуться к функции' })).toHaveAttribute('href', '/');
});

test('two tabs resolve a stale consent CAS, then expose grant and revoke history', async ({ page, context }) => {
    const firefox = test.info().project.name.includes('firefox');
    if (firefox) await installConsentConflict(page);
    await login(page);
    await gotoSettled(page, '/settings/privacy?consent=ai_data_access&returnTo=/ai');
    await page.getByRole('heading', { name: 'Управление согласиями' }).waitFor();
    const firstCard = page.getByRole('heading', { name: 'Использование личных данных в AI' }).locator('..');
    let second: Page | null = null;
    if (!firefox) {
        second = await context.newPage();
        await gotoSettled(second, '/settings/privacy?consent=ai_data_access&returnTo=/ai');
        await second.getByRole('heading', { name: 'Управление согласиями' }).waitFor();
        await expect(
            second
                .getByRole('heading', { name: 'Использование личных данных в AI' })
                .locator('..')
                .getByRole('button', { name: 'Ознакомился и согласен' }),
        ).toBeVisible();
    }
    await firstCard.getByRole('button', { name: 'Ознакомился и согласен' }).click();
    await expect(firstCard.getByText('Разрешено', { exact: true })).toBeVisible();

    if (firefox) {
        await page.evaluate(() => {
            (window as typeof window & { __legalConsentConflict?: boolean }).__legalConsentConflict = true;
        });
        await firstCard.getByRole('button', { name: 'Отозвать' }).click();
        await expect(page.getByRole('alert').filter({ hasText: 'изменились в другой вкладке' })).toBeVisible();
        await expect(firstCard.getByText('Разрешено', { exact: true })).toBeVisible();
        await firstCard.getByRole('button', { name: 'Отозвать' }).click();
    } else {
        if (!second) throw new Error('The stale-consent page was not created.');
        const secondCard = second.getByRole('heading', { name: 'Использование личных данных в AI' }).locator('..');
        await secondCard.getByRole('button', { name: 'Ознакомился и согласен' }).click();
        await expect(second.getByRole('alert').filter({ hasText: 'изменились в другой вкладке' })).toBeVisible();
        await expect(secondCard.getByText('Разрешено', { exact: true })).toBeVisible();
        await expect(second.getByText(/Выдано/u)).toBeVisible();
        await secondCard.getByRole('button', { name: 'Отозвать' }).click();
        await expect(secondCard.getByText('Не разрешено', { exact: true })).toBeVisible();
        await second.close();
        await page.bringToFront();
        await page.reload();
    }
    await expect(firstCard.getByText('Не разрешено', { exact: true })).toBeVisible();
    await expect(page.getByText(/Отозвано/u)).toBeVisible();
});

test('legal pages and registration expose loading, draft and recovery states without page crashes', async ({
    page,
}) => {
    const errors: Error[] = [];
    page.on('pageerror', (error) => errors.push(error));
    await page.addInitScript(() => {
        const nativeFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
            const request = input instanceof Request ? input : null;
            const url = new URL(request?.url ?? String(input), window.location.origin);
            if (url.pathname === '/api/v1/legal/manifest') await new Promise((resolve) => setTimeout(resolve, 300));
            return nativeFetch(input, init);
        };
    });
    await gotoSettled(page, '/auth/sign-up');
    await expect(page.getByText('Проверяем доступность документов…')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Создать аккаунт' })).toBeDisabled();
    await expect(page.getByText('Проверяем доступность документов…')).toHaveCount(0, { timeout: 30_000 });
    await gotoSettled(page, '/legal/terms');
    await expect(page.getByRole('note', { name: 'Статус документа' })).toContainText('production-редакцией');
    await gotoSettled(page, '/legal/privacy');
    await expect(page.getByRole('note', { name: 'Статус документа' })).toContainText('[УКАЗАТЬ]');
    expect(errors).toEqual([]);
});
