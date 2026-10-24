import { expect, test, type Page } from '@playwright/test';

const databaseName = 'meal-planner-api-v1-mock';
const user1Id = '10000000-0000-4000-8000-000000000007';
const productionMockRun = process.env.FRONT_E2E_PRODUCTION_MOCKS === '1';

async function ensureServiceWorker(page: Page) {
    await page.evaluate(() => navigator.serviceWorker.ready);
    if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) await page.reload();
}

async function login(page: Page, email = 'user1@meal-planner.test', password = '1') {
    await page.goto('/auth');
    await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    await ensureServiceWorker(page);
    await page.getByLabel('Электронная почта', { exact: true }).fill(email);
    await page.getByLabel('Пароль', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/', { timeout: 60_000 });
}

async function gotoExact(page: Page, path: string) {
    let response: Awaited<ReturnType<Page['goto']>> = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            response = await page.goto(path, { waitUntil: 'domcontentloaded' });
            break;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (
                attempt === 2 ||
                (!message.includes('NS_ERROR_FAILURE') &&
                    !message.includes('NS_BINDING_ABORTED') &&
                    !message.includes('ERR_ABORTED') &&
                    !message.includes('is interrupted by another navigation'))
            ) {
                throw error;
            }
        }
    }
    expect([200, 304], `${path}: document status`).toContain(response?.status());
    const checkingSession = page.getByText('Проверяем сессию', { exact: true });
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const ready = await expect(checkingSession)
            .toHaveCount(0, { timeout: 30_000 })
            .then(
                async () => {
                    // A fresh Next dev server may finish an on-demand route compilation with one Fast Refresh reload.
                    await page.waitForTimeout(2_000);
                    return (await checkingSession.count()) === 0;
                },
                () => false,
            );
        if (ready) break;
        await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
    }
    await expect(checkingSession).toHaveCount(0, { timeout: 30_000 });
    expect(new URL(page.url()).pathname).toBe(path.split('?')[0]);
}

async function installFaultHarness(page: Page) {
    await page.addInitScript(() => {
        const nativeFetch = window.fetch.bind(window);
        const state = window as typeof window & {
            __uiFaults?: Record<string, { status: number; remaining: number; type?: string }>;
        };
        let persisted: typeof state.__uiFaults = {};
        try {
            persisted = JSON.parse(sessionStorage.getItem('__uiFaults') ?? '{}') as typeof state.__uiFaults;
        } catch {
            // The initial about:blank document may not expose storage; the application document will.
        }
        state.__uiFaults ??= persisted;
        window.fetch = async (input, init) => {
            const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
            const fault = state.__uiFaults?.[url.pathname];
            if (fault && fault.remaining > 0 && (!fault.type || url.searchParams.get('type') === fault.type)) {
                fault.remaining--;
                try {
                    sessionStorage.setItem('__uiFaults', JSON.stringify(state.__uiFaults));
                } catch {
                    // Storage is only an aid for carrying a one-shot fault across navigation.
                }
                return new Response(
                    JSON.stringify({
                        error: { code: 'TEST_FAILURE', message: 'Временная ошибка проверки', details: null },
                        meta: { requestId: crypto.randomUUID() },
                    }),
                    { status: fault.status, headers: { 'content-type': 'application/json' } },
                );
            }
            return nativeFetch(input, init);
        };
    });
}

async function failNext(page: Page, path: string, status: number, type?: string, remaining = 1) {
    await page.evaluate(
        ({ failedPath, responseStatus, source, attempts }) => {
            const state = window as typeof window & {
                __uiFaults?: Record<string, { status: number; remaining: number; type?: string }>;
            };
            state.__uiFaults ??= {};
            state.__uiFaults[failedPath] = { status: responseStatus, remaining: attempts, type: source };
            sessionStorage.setItem('__uiFaults', JSON.stringify(state.__uiFaults));
        },
        { failedPath: path, responseStatus: status, source: type, attempts: remaining },
    );
}

async function registerUnverified(page: Page) {
    const suffix = String(Date.now());
    const email = `verify-${suffix}@example.test`;
    await gotoExact(page, '/auth/sign-up');
    await expect(page.getByText('Проверяем доступность документов…')).toHaveCount(0, { timeout: 30_000 });
    await page.getByLabel('Имя (видно только вам)').fill('Verify recovery test');
    await page.getByLabel('Публичный логин').fill(`verify_${suffix}`);
    await page.getByLabel('Электронная почта', { exact: true }).fill(email);
    await page.getByLabel('Пароль', { exact: true }).fill('Valid-password-1');
    await page.getByLabel('Повторите пароль', { exact: true }).fill('Valid-password-1');
    await page.getByLabel('Я принимаю').check();
    await page.getByLabel('Я ознакомился с').check();
    await page.getByRole('button', { name: 'Создать аккаунт' }).click();
    await expect(page.getByRole('heading', { name: 'Подтвердите почту' })).toBeVisible();
    return email;
}

async function mailboxLink(page: Page, email: string, name: string) {
    await gotoExact(page, '/dev/mailbox');
    const link = page.getByRole('link', { name, exact: true }).first();
    for (let attempt = 0; attempt < 3; attempt++) {
        await page.getByLabel('Адрес тестовой почты').fill(email);
        await page.getByRole('button', { name: 'Показать письма' }).click();
        if (await link.isVisible({ timeout: 8_000 }).catch(() => false)) break;
    }
    await expect(link).toBeVisible({ timeout: 8_000 });
    const href = await link.getAttribute('href');
    expect(href).toBeTruthy();
    return href!;
}

async function deleteNotificationTarget(page: Page) {
    await page.evaluate(
        async ({ name, userId }) => {
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
                    const item = state.notifications.items.find(
                        (row: { userId: string; item: { href: string | null; readAt: string | null } }) =>
                            row.userId === userId && row.item.href && !row.item.readAt,
                    );
                    item.item.href = '/recipes/00000000-0000-4000-8000-000000000099';
                    store.put(state, 'current');
                };
                read.onerror = () => reject(read.error);
                transaction.oncomplete = () => resolve();
                transaction.onabort = () => reject(transaction.error);
            });
            database.close();
        },
        { name: databaseName, userId: user1Id },
    );
}

test('verify and recovery links are one-time, neutral and recover after a transient check failure', async ({
    page,
}) => {
    test.skip(productionMockRun, 'The mailbox is intentionally unavailable in the production build.');
    await installFaultHarness(page);
    await page.goto('/auth');
    await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    await ensureServiceWorker(page);
    const email = await registerUnverified(page);
    const verifyHref = await mailboxLink(page, email, 'Подтвердить почту');
    await gotoExact(page, verifyHref);
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Почта подтверждена');
    await gotoExact(page, verifyHref);
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: /\S/u })).toBeVisible();

    await gotoExact(page, '/auth/recovery');
    const accepted = page.getByRole('status').filter({ hasText: 'Запрос принят' });
    for (let attempt = 0; attempt < 3; attempt += 1) {
        await page.getByLabel('Электронная почта').fill('unknown@meal-planner.test');
        await page.getByRole('button', { name: 'Отправить ссылку' }).click();
        if (
            await accepted.waitFor({ state: 'visible', timeout: 8_000 }).then(
                () => true,
                () => false,
            )
        )
            break;
    }
    await expect(accepted).toBeVisible({ timeout: 15_000 });
    await page.getByLabel('Электронная почта').fill('user1@meal-planner.test');
    const recovery = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' && response.url().endsWith('/api/v1/auth/password/recovery'),
    );
    await page.getByRole('button', { name: 'Отправить ссылку' }).click();
    expect((await recovery).status()).toBe(200);
    const resetHref = await mailboxLink(page, 'user1@meal-planner.test', 'Задать новый пароль');
    await failNext(page, '/api/v1/auth/password/reset/check', 503);
    await gotoExact(page, resetHref);
    await expect(page.getByRole('alert').filter({ hasText: 'Временная ошибка проверки' })).toBeVisible();
    await page.getByRole('button', { name: 'Проверить снова' }).click();
    await page.getByLabel('Новый пароль', { exact: true }).fill('NewStrong12!');
    await page.getByLabel('Повторите пароль', { exact: true }).fill('NewStrong12!');
    await page.getByRole('button', { name: 'Сохранить новый пароль' }).click();
    await page.waitForURL((url) => url.pathname === '/auth');
    await gotoExact(page, resetHref);
    await expect(page.getByRole('alert').filter({ hasText: /\S/u })).toBeVisible();
});

test('email change confirm and cancel remain safe across two tabs and stale link reuse', async ({ context, page }) => {
    test.skip(productionMockRun, 'The mailbox is intentionally unavailable in the production build.');
    await login(page);
    await gotoExact(page, '/settings/account');
    await page.getByText('Изменить почту', { exact: true }).click();
    const nextEmail = `two-tabs-${Date.now()}@meal-planner.test`;
    await page.getByLabel('Новая электронная почта').fill(nextEmail);
    await page
        .getByRole('heading', { name: 'Электронная почта', exact: true })
        .locator('..')
        .getByLabel('Текущий пароль', { exact: true })
        .fill('1');
    await page.getByRole('button', { name: 'Запросить смену почты' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Запрос принят' })).toBeVisible();
    const confirmHref = await mailboxLink(page, nextEmail, 'Подтвердить новый адрес');
    const cancelHref = await mailboxLink(page, 'user1@meal-planner.test', 'Отменить смену адреса');
    if (test.info().project.name.includes('firefox')) {
        await gotoExact(page, confirmHref);
        await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
        await expect(page.getByRole('status')).toContainText('Новый адрес подтверждён');
        await gotoExact(page, cancelHref);
        await page.getByRole('button', { name: 'Отменить смену адреса' }).click();
        await expect(page.getByRole('status')).toContainText('Смена почты отменена');
        await gotoExact(page, confirmHref);
        await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
        await expect(page.getByRole('alert').filter({ hasText: /\S/u })).toBeVisible();
        return;
    }
    const confirm = await context.newPage();
    const cancel = await context.newPage();
    await gotoExact(confirm, confirmHref);
    await gotoExact(cancel, cancelHref);
    await confirm.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await expect(confirm.getByRole('status')).toContainText('Новый адрес подтверждён');
    await cancel.getByRole('button', { name: 'Отменить смену адреса' }).click();
    await expect(cancel.getByRole('status')).toContainText('Смена почты отменена');
    await gotoExact(confirm, confirmHref);
    await confirm.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await expect(confirm.getByRole('alert').filter({ hasText: 'Некорректный запрос' })).toBeVisible();
    await Promise.all([confirm.close(), cancel.close()]);
});

test('search debounces to the last query, keeps successful sources and retries one failed source', async ({ page }) => {
    await installFaultHarness(page);
    await login(page);
    await gotoExact(page, '/search');
    const requests: string[] = [];
    page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.pathname === '/api/v1/search') requests.push(url.searchParams.get('q') ?? '');
    });
    // TanStack Query performs three automatic retries, so fail the initial request and all retries.
    await failNext(page, '/api/v1/search', 503, 'brand', 4);
    const input = page.locator('#global-search');
    for (let attempt = 0; attempt < 3; attempt++) {
        await input.fill('р');
        await input.fill('ри');
        await input.fill('рис');
        await page.waitForURL((url) => url.pathname === '/search' && url.searchParams.get('q') === 'рис');
        await page.waitForTimeout(1_000);
        if ((await input.inputValue()) === 'рис' && new URL(page.url()).searchParams.get('q') === 'рис') break;
    }
    await expect(input).toHaveValue('рис');
    await expect(page.getByRole('heading', { name: 'Продукты', exact: true })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'Не удалось загрузить этот раздел' })).toBeVisible({
        timeout: 15_000,
    });
    expect(requests.every((query) => query === 'рис')).toBe(true);
    await page.evaluate(() => {
        const state = window as typeof window & {
            __uiFaults?: Record<string, { status: number; remaining: number; type?: string }>;
        };
        if (state.__uiFaults?.['/api/v1/search']) state.__uiFaults['/api/v1/search'].remaining = 0;
        sessionStorage.setItem('__uiFaults', JSON.stringify(state.__uiFaults ?? {}));
    });
    await page.getByRole('alert').getByRole('button', { name: 'Повторить' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Не удалось загрузить этот раздел' })).toHaveCount(0, {
        timeout: 15_000,
    });
    await page.reload();
    await expect(input).toHaveValue('рис');
});

test('important announcement read state and author follow survive reload', async ({ page }) => {
    await login(page);
    await gotoExact(page, '/news/73000000-0000-4000-8000-000000000002');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Далее' }).click();
    await dialog.getByRole('button', { name: 'Отметить прочитанным' }).click();
    await expect(dialog.getByText('Отмечено прочитанным')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('dialog').getByText('Отмечено прочитанным')).toBeVisible();
    await gotoExact(page, '/authors/user2');
    const follow = page.getByRole('button', { name: 'Подписаться', exact: true });
    await follow.click();
    await expect(page.getByRole('button', { name: 'Отписаться', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Отписаться', exact: true })).toBeVisible();
});

test('notification counts synchronize across tabs and unavailable delivery stays fail-closed', async ({
    context,
    page,
}) => {
    await login(page);
    await gotoExact(page, '/notifications?unread=1');
    const firefox = test.info().project.name.includes('firefox');
    const second = firefox ? null : await context.newPage();
    if (second) await gotoExact(second, '/notifications?unread=1');
    const countSurface = second ?? page;
    const initial = Number(
        (
            await countSurface
                .getByText(/непрочитанных/u)
                .first()
                .textContent()
        )?.match(/\d+/u)?.[0],
    );
    await page.getByRole('button', { name: 'Прочитано', exact: true }).first().click();
    await expect(page.getByText(`${initial - 1} непрочитанных`, { exact: true })).toBeVisible({ timeout: 15_000 });
    if (firefox) await page.reload();
    await expect(countSurface.getByText(`${initial - 1} непрочитанных`, { exact: true })).toBeVisible();
    await deleteNotificationTarget(page);
    await page.reload();
    const deletedTarget = page.getByRole('link', { name: 'Открыть', exact: true }).first();
    const deletedTargetHref = await deletedTarget.getAttribute('href');
    expect(deletedTargetHref).toBeTruthy();
    await Promise.all([
        page.waitForURL((url) => url.pathname === deletedTargetHref, { timeout: 30_000 }),
        deletedTarget.click(),
    ]);
    await expect(page.getByRole('alert').filter({ hasText: 'Рецепт недоступен' })).toBeVisible({ timeout: 30_000 });
    await gotoExact(page, '/settings/notifications');
    await expect(page.getByText('Доставка ещё не подключена')).toBeVisible();
    await expect(page.getByLabel('Web Push: security')).toBeDisabled();
    await expect(page.getByLabel('Email: security')).toBeDisabled();
    await second?.close();
});

test('onboarding recovers from failure, resumes after reload and demo performs no domain writes', async ({ page }) => {
    await installFaultHarness(page);
    await login(page);
    await failNext(page, '/api/v1/personalization/onboarding', 503);
    await gotoExact(page, '/onboarding');
    await page.getByRole('button', { name: /Быстрый старт/u }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Не удалось сохранить выбор' })).toBeVisible();
    const writes: string[] = [];
    page.on('request', (request) => {
        if (!['GET', 'HEAD'].includes(request.method())) writes.push(new URL(request.url()).pathname);
    });
    await page.getByRole('button', { name: /Демонстрация/u }).click();
    await expect(page.getByText('Шаг 1 из 7')).toBeVisible();
    await page.getByRole('button', { name: 'Далее', exact: true }).click();
    await expect(page.getByText('Шаг 2 из 7')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Шаг 2 из 7')).toBeVisible();
    expect(writes.every((path) => path === '/api/v1/personalization/onboarding')).toBe(true);
    await page.getByRole('button', { name: 'Пропустить', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Как хотите начать?' })).toBeVisible();
});

test('support preserves drafts on failure and enforces reply, edit, close, reopen and stale recovery', async ({
    context,
    page,
}) => {
    await installFaultHarness(page);
    await login(page);
    await gotoExact(page, '/support/new');
    const subject = page.getByRole('textbox', { name: 'Тема', exact: true });
    const body = page.getByLabel('Сообщение');
    await subject.fill('Полный lifecycle поддержки');
    await body.fill('Черновик должен пережить временную ошибку.');
    await failNext(page, '/api/v1/support', 503);
    await page.getByRole('button', { name: 'Отправить обращение' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /\S/u })).toBeVisible();
    await expect(subject).toHaveValue('Полный lifecycle поддержки');
    await expect(body).toHaveValue('Черновик должен пережить временную ошибку.');
    let creates = 0;
    page.on('request', (request) => {
        if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/support') creates++;
    });
    await page.getByRole('button', { name: 'Отправить обращение' }).dblclick();
    await page.waitForURL(/\/support\/[0-9a-f-]{36}$/u);
    expect(creates).toBe(1);
    const ticketPath = new URL(page.url()).pathname;
    const replyBox = page.getByRole('heading', { name: 'Ответить' }).locator('..').getByRole('textbox');
    const firefox = test.info().project.name.includes('firefox');
    let second: Page | null = null;
    if (firefox) {
        await replyBox.fill('Конкурирующий ответ.');
        await failNext(page, `/api/v1/support/${ticketPath.split('/').at(-1)!}/reply`, 412);
        await page.getByRole('button', { name: 'Отправить', exact: true }).click();
        await expect(page.getByRole('alert').filter({ hasText: 'Состояние изменилось' })).toBeVisible();
        await expect(replyBox).toHaveValue('Конкурирующий ответ.');
        await replyBox.fill('Первый ответ владельца.');
        await page.getByRole('button', { name: 'Отправить', exact: true }).click();
        await expect(page.getByText('Первый ответ владельца.', { exact: true })).toBeVisible();
    } else {
        second = await context.newPage();
        await gotoExact(second, ticketPath);
        const staleBox = second.getByRole('heading', { name: 'Ответить' }).locator('..').getByRole('textbox');
        await staleBox.fill('Конкурирующий ответ.');
        await replyBox.fill('Первый ответ владельца.');
        await page.getByRole('button', { name: 'Отправить', exact: true }).click();
        await expect(page.getByText('Первый ответ владельца.', { exact: true })).toBeVisible();
        // Submit in the background so focus refetch cannot refresh the stale expectedVersion first.
        await second
            .getByRole('button', { name: 'Отправить', exact: true })
            .evaluate((button: HTMLButtonElement) => button.click());
        await expect(second.getByRole('alert').filter({ hasText: 'Состояние изменилось' })).toBeVisible();
        await expect(staleBox).toHaveValue('Конкурирующий ответ.');
    }
    await page.getByRole('button', { name: 'Изменить', exact: true }).last().click();
    await page.getByRole('textbox').last().fill('Отредактированный ответ владельца.');
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByText('Отредактированный ответ владельца.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Возобновить', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ответить' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Изменить', exact: true })).toHaveCount(0);
    await page.reload();
    await page.getByRole('button', { name: 'Возобновить', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Ответить' })).toBeVisible();
    await second?.close();
});
