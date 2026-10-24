import { expect, test, type Page } from '@playwright/test';

const databaseName = 'meal-planner-api-v1-mock';

test.use({ timezoneId: 'Europe/Berlin' });

async function installFetchHarness(page: Page) {
    await page.addInitScript(() => {
        const nativeFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
            const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
            const raw = localStorage.getItem(`e2e-fault:${url.pathname}`);
            if (raw) {
                const fault = JSON.parse(raw) as { kind: '503' | 'malformed'; remaining: number };
                if (fault.remaining > 0) {
                    fault.remaining -= 1;
                    localStorage.setItem(`e2e-fault:${url.pathname}`, JSON.stringify(fault));
                    if (fault.kind === 'malformed')
                        return Response.json({ data: { malformed: true }, meta: { requestId: crypto.randomUUID() } });
                    return Response.json(
                        {
                            error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Временная ошибка', details: null },
                            meta: { requestId: crypto.randomUUID() },
                        },
                        { status: 503 },
                    );
                }
            }
            return nativeFetch(input, init);
        };
    });
}

async function setFault(page: Page, path: string, kind: '503' | 'malformed', remaining = 1) {
    await page.evaluate(
        ({ faultPath, faultKind, count }) =>
            localStorage.setItem(`e2e-fault:${faultPath}`, JSON.stringify({ kind: faultKind, remaining: count })),
        { faultPath: path, faultKind: kind, count: remaining },
    );
}

async function clearFault(page: Page, path: string) {
    await page.evaluate((faultPath) => localStorage.removeItem(`e2e-fault:${faultPath}`), path);
}

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

async function login(page: Page, email = 'pro1@meal-planner.test') {
    await installFetchHarness(page);
    await page.goto('/auth');
    await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    await ensureServiceWorker(page);
    await page.getByLabel('Электронная почта', { exact: true }).fill(email);
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 60_000 }).toBe('/');
    await expect(page.getByRole('button', { name: 'Войти', exact: true })).toHaveCount(0);
    await expect(page.getByText(/Проверяем сессию/u)).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByRole('link', { name: /^Профиль:/u })).toBeVisible({ timeout: 30_000 });
}

async function logout(page: Page) {
    await gotoExact(page, '/settings/account');
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
    expect(new URL(page.url()).pathname).toBe(path);
}

async function updateState(
    page: Page,
    mutation:
        | 'ai-consent-on'
        | 'ai-consent-off'
        | 'special-consent-on'
        | 'exhaust-ai'
        | 'bump-ai-history'
        | 'partial-nutrition'
        | 'former-pro'
        | 'export-ready-short',
) {
    await page.evaluate(
        async ({ name, mutation: kind }) => {
            const database = await new Promise<IDBDatabase>((resolve, reject) => {
                const request = indexedDB.open(name, 1);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            await new Promise<void>((resolve, reject) => {
                const transaction = database.transaction('state', 'readwrite');
                const store = transaction.objectStore('state');
                const read = store.get('current');
                read.onerror = () => reject(read.error);
                read.onsuccess = () => {
                    const state = read.result;
                    const user = state.users.find((candidate: { login: string }) => candidate.login === 'pro1');
                    if (kind === 'ai-consent-on' || kind === 'ai-consent-off' || kind === 'special-consent-on') {
                        const consentKind = kind === 'special-consent-on' ? 'special_category' : 'ai_data_access';
                        const consent = state.legal[user.id].consents[consentKind];
                        consent.enabled = kind !== 'ai-consent-off';
                        consent.revision += 1;
                        consent.changedAt = new Date().toISOString();
                    }
                    if (kind === 'exhaust-ai') {
                        for (const bucket of state.ai.buckets)
                            if (bucket.userId === user.id || bucket.familyId) {
                                bucket.balance = 0;
                                bucket.available = 0;
                                bucket.reserved = 0;
                            }
                    }
                    if (kind === 'bump-ai-history') {
                        const item = state.ai.history.find(
                            (candidate: { userId: string; archived: boolean }) =>
                                candidate.userId === user.id && !candidate.archived,
                        );
                        item.version += 1;
                    }
                    if (kind === 'partial-nutrition') {
                        const entry = [...state.diary.entries]
                            .reverse()
                            .find((candidate: { userId: string }) => candidate.userId === user.id)?.entry;
                        entry.nutrition = {
                            energyKcal: '1000.5',
                            proteinG: null,
                            fatG: null,
                            carbohydrateG: null,
                            fiberG: null,
                        };
                        entry.completeness = 'partial';
                    }
                    if (kind === 'former-pro') {
                        user.plan = 'free';
                        for (const family of state.family.families) {
                            if (
                                family.plan === 'pro' &&
                                family.members.some(
                                    (member: { userId: string; leftAt: string | null }) =>
                                        member.userId === user.id && member.leftAt === null,
                                )
                            ) {
                                family.plan = 'plus';
                            }
                        }
                        const record = state.subscription.records.find(
                            (candidate: { userId: string }) => candidate.userId === user.id,
                        );
                        if (record) {
                            record.plan = 'free';
                            record.source = 'none';
                            record.subscriptionId = null;
                            record.period = null;
                            record.startsAt = null;
                            record.endsAt = null;
                            record.autoRenew = false;
                            record.downgradeToFreeAt = null;
                            record.scheduledPlan = null;
                            record.scheduledPeriod = null;
                            record.scheduledEndsAt = null;
                            record.version += 1;
                        }
                        if (!state.subscription.trialHistory.includes(user.id))
                            state.subscription.trialHistory.push(user.id);
                    }
                    if (kind === 'export-ready-short') {
                        const row = [...state.exports.jobs]
                            .reverse()
                            .find((candidate: { userId: string }) => candidate.userId === user.id);
                        row.job.status = 'ready';
                        row.job.completedAt = new Date().toISOString();
                        row.job.expiresAt = new Date(Date.now() + 15_000).toISOString();
                        row.job.failureCode = null;
                    }
                    store.put(state, 'current');
                };
                transaction.oncomplete = () => resolve();
                transaction.onabort = () => reject(transaction.error);
            });
            database.close();
        },
        { name: databaseName, mutation },
    );
}

async function rawRequest(page: Page, method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown, ifMatch?: number) {
    return page.evaluate(
        async ({ method: requestMethod, path: requestPath, body: requestBody, ifMatch: expectedVersion }) => {
            const headers: Record<string, string> = {};
            if (requestMethod !== 'GET') {
                const csrfResponse = await fetch('/api/v1/auth/csrf', { credentials: 'include', cache: 'no-store' });
                const csrf = (await csrfResponse.json()) as { data: { token: string } };
                headers['content-type'] = 'application/json';
                headers['x-csrf-token'] = csrf.data.token;
                if (expectedVersion !== undefined) headers['if-match'] = `"${expectedVersion}"`;
            }
            const response = await fetch(requestPath, {
                method: requestMethod,
                credentials: 'include',
                cache: 'no-store',
                headers,
                body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
            });
            return { status: response.status, body: await response.json() };
        },
        { method, path, body, ifMatch },
    );
}

async function createAiConversation(page: Page, personal = false) {
    await gotoExact(page, '/ai');
    await page.getByLabel('Запрос').fill(`Проверка AI ${crypto.randomUUID()}`);
    if (personal) await page.getByLabel('Использовать разрешённые данные профиля и личных запасов').check();
    await page.getByLabel('Я принимаю правила использования и списания AI-действий').check();
    await page.getByRole('button', { name: 'Рассчитать стоимость' }).click();
    await expect(page.getByRole('heading', { name: 'Подтвердите запуск' })).toBeVisible();
    await page.getByRole('button', { name: 'Подтвердить и запустить' }).click();
    await page.waitForURL(/\/ai\/[0-9a-f-]{36}$/u);
    return new URL(page.url()).pathname;
}

async function createExport(page: Page) {
    await gotoExact(page, '/exports');
    await page.getByRole('button', { name: 'Проверить состав', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Состав экспорта' })).toBeVisible();
    await page.getByRole('button', { name: 'Создать экспорт', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Подтвердите личность' });
    await dialog.getByLabel('Текущий пароль').fill('1');
    await dialog.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await expect(dialog).not.toBeVisible();
}

test('AI catalog exposes every supported task and malformed capabilities fail closed with recovery', async ({
    page,
}) => {
    await login(page);
    await gotoExact(page, '/ai');
    const expected = [
        'Кулинарный вопрос · 1 AI-действие',
        'Подбор замены · 1 AI-действие',
        'Совет по хранению · 1 AI-действие',
        'Извлечение ингредиентов · 1 AI-действие',
        'Классификация продукта · 1 AI-действие',
        'Рецепт из запасов · 2 AI-действия',
        'Расчёт КБЖУ · 2 AI-действия',
        'Персональная рекомендация · 2 AI-действия',
        'Подбор напитка · 2 AI-действия',
        'Порции и стоимость · 2 AI-действия',
        'Адаптация рецепта · 2 AI-действия',
        'Список покупок · 3 AI-действия',
        'Анализ реестра · 3 AI-действия',
        'Саммаризация отзывов · 3 AI-действия',
        'План питания · 4 AI-действия',
        'Анализ сезонности · 4 AI-действия',
        'Меню для события · 4 AI-действия',
        'Анализ документа · 5 AI-действий',
    ];
    await expect(page.getByLabel('Задача').locator('option')).toHaveText(expected);

    await setFault(page, '/api/v1/ai/capabilities', 'malformed', 4);
    await gotoExact(page, '/ai');
    const alert = page.getByRole('alert').filter({ hasText: 'Не удалось загрузить возможности AI' });
    await expect(alert).toBeVisible();
    await expect(page.getByRole('button', { name: 'Рассчитать стоимость' })).toBeDisabled();
    await clearFault(page, '/api/v1/ai/capabilities');
    await alert.getByRole('button', { name: 'Повторить' }).click();
    await expect(page.getByLabel('Задача').locator('option')).toHaveCount(expected.length);
});

test('AI conversation grants two clarifications and archive conflicts require explicit refresh', async ({ page }) => {
    await login(page);
    const conversationPath = await createAiConversation(page);
    const reply = page.getByLabel('Уточнение по той же цели');
    await reply.fill('Первое уточнение');
    await page.getByRole('button', { name: 'Отправить' }).click();
    await expect(page.getByText('Включено уточнений: 1 из 2.')).toBeVisible();
    await reply.fill('Второе уточнение');
    await page.getByRole('button', { name: 'Отправить' }).click();
    await expect(page.getByText('Два уточнения использованы.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Отправить' })).toBeDisabled();

    await gotoExact(page, '/ai/history');
    const title = await page
        .locator(`a[href="${conversationPath}"]`)
        .locator('..')
        .locator('..')
        .getByRole('heading')
        .innerText();
    const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: title }) });
    await updateState(page, 'bump-ai-history');
    await card.getByRole('button', { name: 'Архивировать' }).click();
    const stale = page.getByRole('alert').filter({ hasText: 'Не удалось подтвердить изменение архива' });
    await expect(stale).toBeVisible();
    await stale.getByRole('button', { name: 'Проверить статус' }).click();
    await card.getByRole('button', { name: 'Архивировать' }).click();
    await page.getByLabel('Показывать').selectOption('archived');
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
});

test('AI consent revocation during a clarification offers recovery without losing the draft', async ({ page }) => {
    await login(page);
    await updateState(page, 'ai-consent-on');
    await createAiConversation(page, true);
    const reply = page.getByLabel('Уточнение по той же цели');
    await reply.fill('Не теряйте этот текст');
    await updateState(page, 'ai-consent-off');
    await page.getByRole('button', { name: 'Отправить' }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'Согласие на использование личных данных отозвано' });
    await expect(alert).toBeVisible();
    await expect(alert.getByRole('link', { name: 'Ознакомиться и согласиться' })).toHaveAttribute(
        'href',
        /\/settings\/privacy\?consent=ai_data_access/u,
    );
    await expect(reply).toHaveValue('Не теряйте этот текст');
});

test('AI quota race and malformed provider response fail closed and preserve the preview', async ({ page }) => {
    await login(page);
    await gotoExact(page, '/ai');
    await page.getByLabel('Запрос').fill('Проверка гонки баланса');
    await page.getByLabel('Я принимаю правила использования и списания AI-действий').check();
    await page.getByRole('button', { name: 'Рассчитать стоимость' }).click();
    await expect(page.getByRole('heading', { name: 'Подтвердите запуск' })).toBeVisible();
    await updateState(page, 'exhaust-ai');
    await page.getByRole('button', { name: 'Подтвердить и запустить' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Запуск не выполнен' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Подтвердите запуск' })).toBeVisible();

    await gotoExact(page, '/ai/balance');
    await page.getByRole('button', { name: 'Провести тестовую покупку' }).click();
    await expect(page.getByText('Тестовый пакет начислен. Реального списания денег не было.')).toBeVisible();
    await gotoExact(page, '/ai');
    await page.getByLabel('Запрос').fill('Проверка ответа провайдера');
    await page.getByLabel('Я принимаю правила использования и списания AI-действий').check();
    await page.getByRole('button', { name: 'Рассчитать стоимость' }).click();
    await setFault(page, '/api/v1/ai/run', 'malformed');
    await page.getByRole('button', { name: 'Подтвердить и запустить' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Запуск не выполнен' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Подтвердите запуск' })).toBeVisible();
});

test('AI appeal keeps its explanation after 503 and succeeds only after an explicit retry', async ({ page }) => {
    await login(page, 'user1@meal-planner.test');
    await gotoExact(page, '/ai/appeals');
    const explanation = page.getByLabel('Объяснение');
    await explanation.fill('Прошу проверить контекст ограничения повторно.');
    await setFault(page, '/api/v1/ai/appeals', '503');
    await page.getByRole('button', { name: 'Отправить на рассмотрение' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Не удалось подтвердить отправку' })).toBeVisible();
    await expect(explanation).toHaveValue('Прошу проверить контекст ограничения повторно.');
    await page.getByRole('button', { name: 'Отправить на рассмотрение' }).click();
    await page.waitForURL(/\/ai\/appeals\/[0-9a-f-]{36}$/u);
    await expect(page.getByRole('heading', { name: 'Апелляция по ограничению AI' })).toBeVisible();
});

test('special-category consent gates diary and analytics and diary date navigation survives DST', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-03-29T00:30:00.000Z'));
    await login(page);
    await gotoExact(page, '/diary');
    await expect(page.getByRole('heading', { name: 'Дневник заблокирован настройкой согласия' })).toBeVisible();
    await gotoExact(page, '/diary/analytics');
    await expect(
        page.getByRole('heading', { name: 'Аналитика дневника заблокирована настройкой согласия' }),
    ).toBeVisible();
    await updateState(page, 'special-consent-on');
    await gotoExact(page, '/diary');
    await expect(page.getByRole('button', { name: /29 марта/u })).toBeVisible();
    await page.getByRole('button', { name: 'Следующий день' }).click();
    await expect(page.getByRole('button', { name: /30 марта/u })).toBeVisible();
    await page.getByRole('button', { name: 'Предыдущий день' }).click();
    await expect(page.getByRole('button', { name: /29 марта/u })).toBeVisible();
});

test('former Pro keeps read-only diary, incomplete nutrition and exact-money finance history', async ({ page }) => {
    await login(page);
    await updateState(page, 'special-consent-on');
    const today = await page.evaluate(() => {
        const value = new Date();
        const pad = (part: number) => String(part).padStart(2, '0');
        return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    });
    const diary = await rawRequest(page, 'POST', '/api/v1/diary', {
        eatenAt: new Date(`${today}T12:00:00`).toISOString(),
        meal: 'lunch',
        note: 'История former Pro',
        components: [
            {
                id: crypto.randomUUID(),
                source: { type: 'manual', name: 'Тестовое блюдо' },
                quantity: '1',
                unit: 'serv',
            },
        ],
        idempotencyKey: crypto.randomUUID(),
    });
    expect(diary.status).toBe(200);
    const profile = await rawRequest(page, 'PUT', '/api/v1/nutrition/profile', {
        goal: 'maintain',
        expectedVersion: null,
        idempotencyKey: crypto.randomUUID(),
    });
    expect(profile.status).toBe(200);
    expect(
        (
            await rawRequest(
                page,
                'POST',
                '/api/v1/nutrition/targets',
                {
                    effectiveFrom: today,
                    energyKcal: '2000',
                    proteinG: null,
                    fatG: null,
                    carbohydrateG: null,
                    fiberG: null,
                    expectedProfileVersion: 1,
                    idempotencyKey: crypto.randomUUID(),
                },
                1,
            )
        ).status,
    ).toBe(200);
    expect(
        (
            await rawRequest(page, 'POST', '/api/v1/finance/expenses', {
                category: 'groceries',
                amountMinor: 1005,
                occurredAt: new Date(`${today}T12:00:00`).toISOString(),
                financeConsent: true,
                idempotencyKey: crypto.randomUUID(),
            })
        ).status,
    ).toBe(200);
    await updateState(page, 'partial-nutrition');
    await updateState(page, 'former-pro');

    await gotoExact(page, '/diary');
    await expect(page.getByText('Режим чтения', { exact: true })).toBeVisible();
    await expect(page.getByText('Pro завершился: история сохранена, новые изменения отключены.')).toBeVisible();
    await expect(page.getByText('История former Pro')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Добавить приём пищи' })).toHaveCount(0);
    await gotoExact(page, '/diary/analytics');
    await expect(page.getByText('История только для чтения', { exact: true })).toBeVisible();
    await expect(page.getByText('1000.5 ккал')).toBeVisible();
    await expect(page.getByText(/с пропусками: 1/u)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Сохранить профиль' })).toHaveCount(0);

    await gotoExact(page, '/finance');
    await expect(page.getByText('История только для чтения', { exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Итоги периода' }).getByText(/10,05\s*₽/u)).toBeVisible();
    await gotoExact(page, '/finance/expenses');
    await expect(page.getByRole('button', { name: 'Добавить расход' })).toHaveCount(0);
    const detail = await page.locator('a[href^="/finance/expenses/"]').first().getAttribute('href');
    expect(detail).toBeTruthy();
    await gotoExact(page, detail!);
    await expect(page.getByText('История только для чтения', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Сохранить изменения' })).toHaveCount(0);
    await gotoExact(page, '/finance/analytics');
    await expect(page.getByText('Недостаточно данных', { exact: true }).first()).toBeVisible();
    await gotoExact(page, '/finance/prices');
    await expect(page.getByRole('button', { name: 'Добавить цену' })).toHaveCount(0);
});

test('export creation retries explicitly and storage delivery remains fail closed', async ({ page }) => {
    await login(page);
    await gotoExact(page, '/exports');
    await page.getByRole('button', { name: 'Проверить состав', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Состав экспорта' })).toBeVisible();
    await setFault(page, '/api/v1/exports', '503');
    await page.getByRole('button', { name: 'Создать экспорт', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'Подтвердите личность' });
    await dialog.getByLabel('Текущий пароль').fill('1');
    await dialog.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Результат создания не подтверждён' })).toBeVisible();
    await page.getByRole('button', { name: 'Создать экспорт', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Подтвердите личность' });
    await dialog.getByLabel('Текущий пароль').fill('1');
    await dialog.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Основные данные' })).toHaveCount(1);
    await expect(page.getByRole('alert').filter({ hasText: 'Защищённое хранилище ещё не подключено' })).toBeVisible({
        timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: 'Скачать JSON' })).toBeDisabled();
});

test('ready export expires in place, download fails closed and another user cannot see it', async ({ page }) => {
    await login(page);
    await createExport(page);
    await updateState(page, 'export-ready-short');
    await gotoExact(page, '/exports');
    const job = page
        .getByRole('article')
        .filter({ has: page.getByRole('heading', { name: 'Основные данные', exact: true }) });
    const download = job.getByRole('button', { name: 'Скачать JSON' });
    await expect(download).toBeEnabled();
    await download.click();
    await expect(job.getByRole('alert').filter({ hasText: 'Защищённое скачивание пока недоступно' })).toBeVisible();

    await expect(job.getByText('Срок скачивания истёк')).toBeVisible({ timeout: 20_000 });
    await expect(download).toBeDisabled();
    await expect(job.getByRole('link', { name: 'Проверить состав заново' })).toBeVisible();

    await logout(page);
    await login(page, 'user2@meal-planner.test');
    await gotoExact(page, '/exports');
    await expect(page.getByText('Вы ещё не создавали доступных экспортов.')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Основные данные' })).toHaveCount(0);
});
