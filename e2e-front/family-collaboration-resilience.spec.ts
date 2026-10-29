import { expect, test, type Page } from '@playwright/test';

async function ensureServiceWorker(page: Page) {
    await expect
        .poll(() => page.evaluate(async () => Boolean(await navigator.serviceWorker.ready)).catch(() => false), {
            timeout: 30_000,
        })
        .toBe(true);
    if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
        await page.reload({ waitUntil: 'domcontentloaded' }).catch((error: unknown) => {
            if (
                !(error instanceof Error) ||
                (!error.message.includes('NS_BINDING_ABORTED') &&
                    !error.message.includes('net::ERR_ABORTED') &&
                    !error.message.includes('is interrupted by another navigation'))
            )
                throw error;
        });
        await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    }
}

async function login(page: Page, login = 'plus1', returnTo = '/') {
    const target = new URL(returnTo, 'http://localhost:3000');
    await page.goto(returnTo === '/' ? '/auth' : `/auth?returnTo=${encodeURIComponent(returnTo)}`);
    await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    await ensureServiceWorker(page);
    await page.getByLabel('Электронная почта', { exact: true }).fill(`${login}@meal-planner.test`);
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect
        .poll(() => `${new URL(page.url()).pathname}${new URL(page.url()).search}`, { timeout: 60_000 })
        .toBe(`${target.pathname}${target.search}`);
    await expect(page.getByRole('link', { name: /^Профиль:/u })).toBeVisible({ timeout: 30_000 });
}

async function logout(page: Page) {
    await gotoExact(page, '/settings/account');
    await expect(page.getByRole('heading', { name: 'Аккаунт и безопасность' })).toBeVisible();
    await page.getByRole('button', { name: 'Выйти', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/auth');
}

async function gotoExact(page: Page, path: string) {
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
    const sessionError = page.getByRole('alert').filter({ hasText: 'Не удалось проверить вход' });
    await expect(sessionError).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe(new URL(path, 'http://local').pathname);
}

async function installOneShotFailure(page: Page, path: string, status = 503) {
    await page.addInitScript(
        ({ failedPath, responseStatus }) => {
            const nativeFetch = window.fetch.bind(window);
            window.fetch = async (input, init) => {
                const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
                const marker = `__family_fail_${failedPath}`;
                const state = window as typeof window & Record<string, boolean>;
                const onIntendedRoute = failedPath !== '/api/v1/auth/me' || window.location.pathname === '/family';
                if (
                    url.pathname === failedPath &&
                    onIntendedRoute &&
                    (state[marker] || sessionStorage.getItem(marker) === '1')
                ) {
                    state[marker] = false;
                    sessionStorage.removeItem(marker);
                    return new Response(
                        JSON.stringify({
                            error: {
                                code: responseStatus === 412 ? 'PRECONDITION_FAILED' : 'UNAVAILABLE',
                                message: responseStatus === 412 ? 'Состояние изменилось' : 'Сервис временно недоступен',
                                details: null,
                            },
                            meta: { requestId: crypto.randomUUID() },
                        }),
                        { status: responseStatus, headers: { 'content-type': 'application/json' } },
                    );
                }
                return nativeFetch(input, init);
            };
        },
        { failedPath: path, responseStatus: status },
    );
}

async function failNext(page: Page, path: string) {
    await page.evaluate((failedPath) => {
        const marker = `__family_fail_${failedPath}`;
        (window as typeof window & Record<string, boolean>)[marker] = true;
        sessionStorage.setItem(marker, '1');
    }, path);
}

async function installChatPaginationFixture(page: Page) {
    await page.addInitScript(() => {
        const nativeFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
            const request = input instanceof Request ? input : null;
            const url = new URL(request?.url ?? String(input), window.location.origin);
            const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
            if (url.pathname === '/api/v1/family/chat/read' && method === 'POST') {
                const raw = request ? await request.clone().text() : String(init?.body ?? '');
                const body = JSON.parse(raw) as { messageId: string };
                const failures = Number(sessionStorage.getItem('__family_chat_read_failures') ?? '0');
                if (failures > 0) {
                    sessionStorage.setItem('__family_chat_read_failures', String(failures - 1));
                    return new Response(
                        JSON.stringify({
                            error: { code: 'UNAVAILABLE', message: 'Сервис временно недоступен', details: null },
                            meta: { requestId: crypto.randomUUID() },
                        }),
                        { status: 503, headers: { 'content-type': 'application/json' } },
                    );
                }
                const response = await nativeFetch(input, init);
                if (response.ok) {
                    sessionStorage.setItem('__family_chat_last_read', body.messageId);
                    sessionStorage.setItem(
                        '__family_chat_read_count',
                        String(Number(sessionStorage.getItem('__family_chat_read_count') ?? '0') + 1),
                    );
                }
                return response;
            }
            const response = await nativeFetch(input, init);
            if (url.pathname !== '/api/v1/family/chat' || method !== 'GET' || !response.ok) return response;
            const payload = (await response.clone().json()) as {
                data: { items: Array<Record<string, unknown>>; nextBefore: string | null } & Record<string, unknown>;
                meta: { requestId: string };
            };
            if (!url.searchParams.has('before')) {
                const template = payload.data.items[0];
                if (template) sessionStorage.setItem('__family_chat_template', JSON.stringify(template));
                payload.data.nextBefore = '2026-09-29T12:00:00.000Z';
            } else {
                if (sessionStorage.getItem('__family_chat_older_failed') !== '1') {
                    sessionStorage.setItem('__family_chat_older_failed', '1');
                    await new Promise((resolve) => setTimeout(resolve, 200));
                    return new Response(
                        JSON.stringify({
                            error: { code: 'UNAVAILABLE', message: 'Сервис временно недоступен', details: null },
                            meta: { requestId: crypto.randomUUID() },
                        }),
                        { status: 503, headers: { 'content-type': 'application/json' } },
                    );
                }
                const template = JSON.parse(sessionStorage.getItem('__family_chat_template')!) as Record<
                    string,
                    unknown
                >;
                payload.data.items = [
                    {
                        ...template,
                        id: '53900000-0000-4000-8000-000000000001',
                        body: 'Предыдущее сообщение семьи',
                        sentAt: '2026-09-29T11:00:00.000Z',
                        pinned: false,
                    },
                ];
                payload.data.nextBefore = null;
            }
            return new Response(JSON.stringify(payload), {
                status: response.status,
                headers: response.headers,
            });
        };
    });
}

async function createOwnershipRequest(page: Page) {
    await gotoExact(page, '/family/ownership');
    await page.getByLabel('Новый владелец').selectOption({ label: 'Юзер-плюс 2' });
    await page.getByRole('button', { name: 'Проверить последствия' }).click();
    await expect(page.getByRole('heading', { name: 'Проверка передачи' })).toBeVisible();
    await page.getByRole('button', { name: 'Отправить запрос' }).click();
    const link = page.getByRole('link', { name: 'Открыть запрос' });
    await expect(link).toBeVisible();
    return (await link.getAttribute('href'))!;
}

test('direct family routes fail closed for outsider/member and recover after a transient family load error', async ({
    page,
}) => {
    await installOneShotFailure(page, '/api/v1/family');
    await installOneShotFailure(page, '/api/v1/auth/me');
    await login(page, 'user1', '/family');
    await failNext(page, '/api/v1/auth/me');
    await page.goto('/family', { waitUntil: 'domcontentloaded' }).catch((error: unknown) => {
        if (
            !(error instanceof Error) ||
            (!error.message.includes('NS_BINDING_ABORTED') &&
                !error.message.includes('net::ERR_ABORTED') &&
                !error.message.includes('is interrupted by another navigation'))
        )
            throw error;
    });
    const sessionError = page.getByRole('alert').filter({ hasText: 'Не удалось проверить вход' });
    await expect(sessionError).toBeVisible({ timeout: 30_000 });
    await sessionError.getByRole('button', { name: 'Повторить' }).click();
    await expect(page.getByRole('heading', { name: 'Общего дома пока нет' })).toBeVisible();
    await failNext(page, '/api/v1/family');
    await gotoExact(page, '/family');
    await expect(page.getByRole('alert').filter({ hasText: 'Семья не загрузилась' })).toBeVisible();
    await page.getByRole('button', { name: 'Повторить' }).click();
    await expect(page.getByRole('heading', { name: 'Общего дома пока нет' })).toBeVisible();
    await gotoExact(page, '/family/chat');
    await expect(page.getByRole('alert').filter({ hasText: 'Чат недоступен' })).toBeVisible();
    await gotoExact(page, '/family/invite?token=00000000-0000-4000-8000-000000000000');
    await expect(page.getByRole('alert').filter({ hasText: 'Приглашение недоступно' })).toBeVisible();
    await logout(page);
    await login(page, 'plus2');
    await gotoExact(page, '/family/ownership');
    await expect(page.getByRole('alert').filter({ hasText: 'Передача владения недоступна' })).toBeVisible();
});

test('owner cancels a direct invite, then approves a member proposal and the bound invitee accepts it', async ({
    page,
}) => {
    await login(page, 'plus1');
    await gotoExact(page, '/family/members');
    await page.getByLabel('Логин').fill('user1');
    await page.getByRole('button', { name: 'Создать приглашение' }).click();
    await expect(page.getByLabel('Ссылка приглашения')).toBeVisible();
    const user1Row = page.getByRole('listitem').filter({ hasText: '@user1' });
    await user1Row.getByRole('button', { name: 'Отменить' }).click();
    await expect(user1Row).toContainText('cancelled');

    await logout(page);
    await login(page, 'plus2');
    await gotoExact(page, '/family/members');
    await page.getByLabel('Логин').fill('user2');
    await page.getByRole('button', { name: 'Отправить владельцу' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: '@user2' })).toContainText('proposed');
    await logout(page);

    await login(page, 'plus1');
    await gotoExact(page, '/family/members');
    const proposal = page.getByRole('listitem').filter({ hasText: '@user2' });
    await proposal.getByRole('button', { name: 'Подтвердить' }).click();
    const inviteUrl = await page.getByLabel('Ссылка приглашения').inputValue();
    await logout(page);

    await login(page, 'user2');
    await gotoExact(page, new URL(inviteUrl).pathname + new URL(inviteUrl).search);
    await page.getByRole('button', { name: 'Принять приглашение' }).click();
    await expect(page.getByRole('heading', { name: 'Вы вступили в семью' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('status')).toContainText('Приглашение уже завершено: accepted');
});

test('ownership requests support decline, owner cancel and accept with role changes', async ({ page }) => {
    await login(page, 'plus1');
    let requestUrl = await createOwnershipRequest(page);
    await logout(page);
    await login(page, 'plus2');
    await gotoExact(page, requestUrl);
    await page.getByRole('button', { name: 'Отклонить запрос' }).click();
    await expect(page.getByRole('status')).toContainText('Отклонён получателем');

    await logout(page);
    await login(page, 'plus1');
    requestUrl = await createOwnershipRequest(page);
    await gotoExact(page, requestUrl);
    await page.getByRole('button', { name: 'Отменить запрос' }).click();
    await expect(page.getByRole('status')).toContainText('Отменён');

    requestUrl = await createOwnershipRequest(page);
    await logout(page);
    await login(page, 'plus2');
    await gotoExact(page, requestUrl);
    await page.getByRole('button', { name: 'Принять владение' }).click();
    await expect(page.getByRole('status')).toContainText('Владение передано');
    await gotoExact(page, '/family');
    await expect(page.getByText(/Вы владелец/)).toBeVisible();
});

test('member leave shows its preview and removes only that membership', async ({ page }) => {
    await installOneShotFailure(page, '/api/v1/family/leave');
    await login(page, 'plus2');
    await gotoExact(page, '/family/access');
    await expect(page.getByText('Семейные данные останутся семье; ваша запись сохранится в истории.')).toBeVisible();
    await failNext(page, '/api/v1/family/leave');
    await page.getByRole('button', { name: 'Выйти из семьи' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Результат выхода неизвестен' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Перечитать состав и последствия' })).toBeVisible();
    await page.getByRole('button', { name: 'Повторить сохранённый выход' }).click();
    await page.waitForURL((url) => url.pathname === '/');
    await gotoExact(page, '/family');
    await expect(page.getByRole('heading', { name: 'Общего дома пока нет' })).toBeVisible();

    await logout(page);
    await login(page, 'plus1');
    await gotoExact(page, '/family/members');
    await expect(page.getByText('Юзер-плюс 2', { exact: true })).toHaveCount(0);
});

test('owner removal is confirmed in an accessible dialog and keeps the owner in the family', async ({ page }) => {
    await login(page, 'plus1');
    await gotoExact(page, '/family/members');
    const member = page.getByRole('listitem').filter({ hasText: 'Юзер-плюс 2' });
    await member.getByRole('button', { name: 'Исключить' }).click();
    const dialog = page.getByRole('dialog', { name: 'Исключить Юзер-плюс 2?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Отмена' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Исключить', exact: true }).click();
    await expect(member).toHaveCount(0);
    await expect(page.getByText('Юзер-плюс 1', { exact: true })).toBeVisible();
});

test('automatic owner leave transfers ownership and the successor can dismiss the important notice', async ({
    page,
}) => {
    await login(page, 'plus1');
    await gotoExact(page, '/family/access');
    await expect(page.getByLabel('Кому передать владение')).toBeVisible();
    await page.getByRole('button', { name: 'Всё равно' }).click();
    await page.waitForURL((url) => url.pathname === '/');
    await logout(page);

    await login(page, 'plus2');
    const notice = page.getByRole('dialog', { name: 'Вы стали владельцем семьи' });
    await expect(notice).toBeVisible();
    await expect(notice.getByRole('button', { name: 'Понятно' })).toBeFocused();
    await notice.getByRole('button', { name: 'Понятно' }).click();
    await expect(notice).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('link', { name: /^Профиль:/u })).toBeVisible({ timeout: 30_000 });
    await expect(notice).toHaveCount(0);
    await gotoExact(page, '/family');
    await expect(page.getByText(/Вы владелец/)).toBeVisible();
});

test('family checklist keeps draft on 503, survives reload, records history, detects stale edit and archives', async ({
    page,
}) => {
    await installOneShotFailure(page, '/api/v1/family/notes');
    await login(page, 'plus2');
    await gotoExact(page, '/family/notes/new');
    await page.getByLabel('Тип').selectOption('checklist');
    await page.getByLabel('Название').fill('Проверка поездки');
    await page.getByLabel('Описание').fill('Общий список');
    await page.locator('fieldset input').fill('Купить воду');
    await failNext(page, '/api/v1/family/notes');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByLabel('Название')).toHaveValue('Проверка поездки');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByRole('heading', { name: 'Проверка поездки' })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('checkbox').click();
    await expect(page.getByRole('checkbox')).toBeChecked();
    await expect(page.getByText('Юзер-плюс 2', { exact: true })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Версия' })).not.toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('checkbox')).toBeChecked();

    const noteUrl = page.url();
    if (test.info().project.name.includes('firefox')) {
        const noteId = new URL(noteUrl).pathname.split('/').at(-1)!;
        const noteApiPath = `/api/v1/family/notes/${noteId}`;
        await installOneShotFailure(page, noteApiPath, 412);
        await page.reload();
        await page.getByRole('link', { name: 'Редактировать' }).click();
        await page.getByLabel('Название').fill('Устаревшая поездка');
        await failNext(page, noteApiPath);
        await page.getByRole('button', { name: 'Сохранить' }).click();
        await expect(page.getByRole('alert')).toBeVisible();
        await expect(page.getByLabel('Название')).toHaveValue('Устаревшая поездка');
        await page.getByLabel('Название').fill('Актуальная поездка');
        await page.getByRole('button', { name: 'Сохранить' }).click();
        await expect(page.getByRole('heading', { name: 'Актуальная поездка' })).toBeVisible({ timeout: 30_000 });
    } else {
        const stale = await page.context().newPage();
        await stale.goto(`${noteUrl}/edit`);
        await expect(stale.getByRole('heading', { name: 'Редактировать заметку' })).toBeVisible();
        await page.getByRole('link', { name: 'Редактировать' }).click();
        await page.getByLabel('Название').fill('Актуальная поездка');
        await page.getByRole('button', { name: 'Сохранить' }).click();
        await expect(page.getByRole('heading', { name: 'Актуальная поездка' })).toBeVisible();
        await stale.getByLabel('Название').fill('Устаревшая поездка');
        await stale.getByRole('button', { name: 'Сохранить' }).click();
        await expect(stale.locator('main').getByRole('alert')).toBeVisible();
        await expect(stale.getByLabel('Название')).toHaveValue('Устаревшая поездка');
        await stale.close();
    }

    await page.getByRole('button', { name: 'В архив' }).click();
    await expect(page.getByRole('button', { name: 'Восстановить' })).toBeVisible();
    await gotoExact(page, '/family/notes?tab=archived');
    await expect(page.getByRole('link').filter({ hasText: 'Актуальная поездка' })).toBeVisible();
});

test('chat preserves transient drafts and supports send, edit, reply, reaction, pin, hide and removal', async ({
    page,
}) => {
    await installOneShotFailure(page, '/api/v1/family/chat/messages');
    await installChatPaginationFixture(page);
    await login(page, 'plus2');
    await page.evaluate(() => sessionStorage.setItem('__family_chat_read_failures', '2'));
    await gotoExact(page, '/family/chat');
    await expect(page.getByText('Кто сможет купить продукты к ужину?', { exact: true })).toBeVisible();
    const readError = page.getByRole('alert').filter({ hasText: 'Не удалось отметить сообщения прочитанными' });
    await expect(readError).toBeVisible();
    await readError.getByRole('button', { name: 'Повторить' }).click();
    await expect(readError).toHaveCount(0);
    await expect
        .poll(() => page.evaluate(() => sessionStorage.getItem('__family_chat_last_read')))
        .toBe('53100000-0000-4000-8000-000000000002');
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('__family_chat_read_count'))).toBe('1');
    await page.getByRole('button', { name: 'Загрузить ещё' }).click();
    await expect(page.getByRole('button', { name: 'Загружаем…' })).toBeDisabled();
    await expect(page.getByRole('alert').filter({ hasText: 'предыдущие сообщения' })).toBeVisible();
    await page.getByRole('button', { name: 'Повторить загрузку' }).click();
    await expect(page.getByText('Предыдущее сообщение семьи', { exact: true })).toBeVisible();
    await expect(page.getByText('Кто сможет купить продукты к ужину?', { exact: true })).toHaveCount(1);
    await expect
        .poll(() => page.evaluate(() => sessionStorage.getItem('__family_chat_last_read')))
        .toBe('53100000-0000-4000-8000-000000000002');
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('__family_chat_read_count'))).toBe('1');
    await expect(page.getByRole('button', { name: 'Загрузить ещё' })).toHaveCount(0);
    const composer = page.getByLabel('Сообщение');
    await composer.fill('Черновик семьи');
    await composer.blur();
    await page.reload();
    await expect(composer).toHaveValue('Черновик семьи');
    await failNext(page, '/api/v1/family/chat/messages');
    await page.getByRole('button', { name: 'Отправить' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'текст сохранён' })).toBeVisible();
    await expect(composer).toHaveValue('Черновик семьи');
    await page.getByRole('button', { name: 'Отправить' }).click();
    let message = page.getByRole('article').filter({ hasText: 'Черновик семьи' });
    await expect(message).toBeVisible();
    await message.getByRole('button', { name: 'Изменить' }).click();
    await composer.fill('Сообщение семьи обновлено');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    message = page.getByRole('article').filter({
        has: page.getByText('Сообщение семьи обновлено', { exact: true }),
    });
    await expect(message).toBeVisible();
    await message.getByRole('button', { name: 'Реакция ❤️' }).click();
    await expect(message.getByRole('button', { name: 'Реакция ❤️' })).toHaveText(/1/);
    await message.getByRole('button', { name: 'Закрепить' }).click();
    await expect(page.getByLabel('Закреплённые сообщения')).toContainText('Сообщение семьи обновлено');
    await message.getByRole('button', { name: 'Ответить' }).click();
    await composer.fill('Ответ участника');
    await page.getByRole('button', { name: 'Отправить' }).click();
    await expect(page.getByRole('article').filter({ hasText: 'Ответ участника' })).toContainText(
        'Сообщение семьи обновлено',
    );
    page.once('dialog', (dialog) => void dialog.accept());
    await message.getByRole('button', { name: 'Скрыть у себя' }).click();
    await expect(message).toHaveCount(0);
    const reply = page.getByRole('article').filter({ hasText: 'Ответ участника' });
    page.once('dialog', (dialog) => void dialog.accept());
    await reply.getByRole('button', { name: 'Удалить для всех' }).click();
    await expect(page.getByText('Сообщение удалено', { exact: true })).toBeVisible();
});
