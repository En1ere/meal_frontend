import { qaRoot } from '../../scripts/qa-output.mjs';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { generateSync } from 'otplib';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '@playwright/test');
const origin = process.env.ADMIN_QA_ORIGIN ?? 'http://localhost:3002';
const output = new URL('', qaRoot());
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
});
const results = [],
    errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
// Fake timers replace performance with an empty implementation. Preserve the
// real Navigation Timing API so reload/new-document security is tested honestly.
await context.addInitScript(() => {
    window.qaNavigationEntries = performance.getEntriesByType.bind(performance);
});
context.on('page', (tab) => tab.on('pageerror', (error) => errors.push(error.message)));
const page = await context.newPage();
page.setDefaultTimeout(25000);
const check = (name) => {
    results.push(name);
    console.log(`PASS ${name}`);
};
let secret;
let remembered = false;
async function nextCode(tab = page) {
    await tab.clock.fastForward(31_000);
    return generateSync({
        secret,
        period: 30,
        digits: 6,
        epoch: Math.floor((await tab.evaluate(() => Date.now())) / 1000),
    });
}
async function goto(path) {
    await page.goto(origin + path);
    if (remembered && path !== '/missing-admin-page') {
        await page.getByRole('heading', { name: 'Подтвердите повторный вход', exact: true }).waitFor();
        await page.getByLabel('Код из приложения', { exact: true }).fill(await nextCode());
        await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
        await page.waitForURL((url) => !url.pathname.startsWith('/auth'));
    }
}
const heading = (name) => page.getByRole('heading', { name, exact: true }).waitFor();
async function login(name = 'admin', password = '1') {
    await page.getByLabel('Логин', { exact: true }).fill(name);
    await page.getByLabel('Пароль', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
}
async function logout() {
    await page.getByRole('button', { name: 'Выйти', exact: true }).click();
    await page.locator('#login').waitFor();
    remembered = false;
}
async function shot(name) {
    await page.evaluate(() => document.fonts.ready);
    // Normalize scroll before full-page capture: Chromium otherwise paints offscreen
    // fixed elements (including the hidden skip link) at the previous document offset.
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
    assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
        'Horizontal overflow',
    );
    await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)), fullPage: true });
}
async function recoveryLogin(code) {
    await login();
    await page.getByRole('button', { name: 'Использовать резервный код', exact: true }).click();
    await page.getByLabel('Резервный код', { exact: true }).fill(code);
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
}
try {
    await page.clock.install();
    await page.addInitScript(() => {
        performance.getEntriesByType = window.qaNavigationEntries;
    });
    await goto('/');
    await page.waitForURL('**/auth?returnTo=*');
    await heading('Вход администратора');
    await page.waitForFunction(() => !document.querySelector('button[type="submit"]')?.disabled);
    await shot('admin-auth-desktop');
    await page.keyboard.press('Tab');
    assert.notEqual(await page.evaluate(() => document.activeElement?.tagName), 'BODY');
    check('guest guard, mock bootstrap, keyboard focus and desktop layout');
    await login('admin', 'wrong');
    await page.locator('.form-error').waitFor();
    assert.equal(await page.locator('#password').inputValue(), '');
    check('incorrect password rejected and cleared');
    for (const name of ['user1', 'moderator']) {
        await login(name);
        await page.locator('.form-error').waitFor();
        assert.ok(page.url().includes('/auth'));
    }
    check('ordinary user and moderator cannot start administrator MFA');
    await login();
    await page.waitForURL('**/auth/mfa');
    await page.locator('.enrollment code').waitFor();
    await page.clock.fastForward(10 * 60 * 1000 + 1000);
    await page.getByRole('link', { name: 'Вернуться ко входу', exact: true }).waitFor();
    assert.equal(await page.locator('.enrollment').count(), 0);
    await goto('/auth');
    await login();
    await page.locator('.enrollment code').waitFor();
    // Browser history navigation must not preserve an in-memory enrollment after leaving MFA.
    await page.goBack();
    await page.locator('#login').waitFor();
    await page.goForward();
    await page.getByRole('link', { name: 'Вернуться ко входу', exact: true }).waitFor();
    await goto('/auth');
    await login();
    await page.locator('.enrollment code').waitFor();
    check('expired and abandoned MFA enrollment is removed');
    secret = await page.locator('.enrollment code').textContent();
    await page.getByLabel('Код из приложения', { exact: true }).fill(
        generateSync({
            secret,
            period: 30,
            digits: 6,
            epoch: Math.floor((await page.evaluate(() => Date.now())) / 1000),
        }),
    );
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await heading('Сохраните резервные коды');
    const recovery = await page.locator('.recovery-codes code').allTextContents();
    assert.equal(recovery.length, 10);
    assert.equal(await page.getByRole('button', { name: 'Продолжить', exact: true }).isDisabled(), true);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await page.waitForURL(origin + '/');
    await heading('Служебный вход подтверждён');
    remembered = true;
    await page.getByText('Текущая сессия', { exact: true }).waitFor();
    await shot('admin-home-desktop');
    check('first enrollment, TOTP, ten recovery codes, save acknowledgement and protected home');
    const expiresBefore = await page.locator('.sessions-panel small').first().textContent();
    await page.reload();
    await heading('Служебный вход подтверждён').catch(async (error) => {
        console.error(
            'Reload diagnostics',
            await page.evaluate(() => ({
                url: location.pathname,
                navigation: performance.getEntriesByType('navigation').map((entry) => entry.type),
                proofPresent: !!sessionStorage.getItem('meal-admin-tab-unlock'),
                headings: [...document.querySelectorAll('h1')].map((element) => element.textContent),
            })),
        );
        throw error;
    });
    assert.equal(await page.locator('#unlock-code').count(), 0);
    await page.getByLabel('Код подтверждения из приложения', { exact: true }).fill(await nextCode());
    await page.getByRole('button', { name: 'Подтвердить критичные действия', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Действия подтверждены до' }).waitFor();
    await shot('admin-critical-confirmed-desktop');
    await page.reload();
    await page.getByRole('status').filter({ hasText: 'Действия подтверждены до' }).waitFor();
    await page.clock.fastForward(30 * 60 * 1000 + 1000);
    await page.getByLabel('Код подтверждения из приложения', { exact: true }).waitFor();
    await goto('/');
    await heading('Служебный вход подтверждён');
    assert.equal(await page.locator('.sessions-panel small').first().textContent(), expiresBefore);
    check(
        'reload stays unlocked, critical TOTP window survives reload then expires at30minutes, reentry does not extend session',
    );
    for (const [route, title] of [
        ['', 'Обзор'],
        ['queues', 'Очереди'],
        ['support', 'Поддержка'],
        ['users', 'Пользователи'],
        ['families', 'Семьи'],
        ['sanctions', 'Санкции'],
        ['access', 'Доступ'],
        ['subscriptions', 'Подписки'],
        ['payments', 'Платежи'],
        ['catalog', 'Каталог'],
        ['releases', 'Релизы'],
        ['news', 'Новости'],
        ['audit', 'Аудит'],
        ['rollback', 'Откат'],
        ['legal-requests', 'Правовые запросы'],
        ['operations', 'Операции'],
        ['errors', 'Ошибки'],
        ['metrics', 'Метрики'],
    ]) {
        await goto('/admin' + (route ? '/' + route : ''));
        await heading(title);
        await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
        assert.equal(await page.getByRole('alert').count(), 0, route);
    }
    await goto('/admin');
    await heading('Обзор');
    await page.getByText('Счётчики рассчитаны по сохранённым данным', { exact: false }).waitFor();
    const attention = page
        .locator('article')
        .filter({ has: page.getByRole('heading', { name: 'Требуют внимания', exact: true }) });
    assert.equal(
        await attention.getByRole('link', { name: 'Поддержка', exact: true }).getAttribute('href'),
        '/admin/support',
    );
    assert.equal(
        await attention.getByRole('link', { name: 'Очереди', exact: true }).getAttribute('href'),
        '/admin/queues/recipes',
    );
    await shot('admin-overview-desktop');
    await goto('/admin/subscriptions');
    await page.getByText('Введите UUID подписки или её владельца, чтобы начать поиск.', { exact: true }).waitFor();
    await goto('/admin/users/ffffffff-ffff-4fff-8fff-ffffffffffff');
    await heading('Запись не найдена');
    await shot('admin-record-missing-desktop');
    check('overview links follow record meaning, subscription hint and missing-record recovery');
    await goto('/admin/users');
    await page.locator('#admin-search').fill('ADMIN');
    await page.getByRole('button', { name: 'Найти', exact: true }).click();
    await page
        .getByRole('link', { name: /^Открыть\s*:/ })
        .first()
        .click();
    await page.getByText('Логин', { exact: true }).waitFor();
    await shot('admin-user-desktop');
    await goto('/admin/subscriptions/10000000-0000-4000-8000-000000000003');
    await page.getByRole('button', { name: /^Периоды подписки/ }).click();
    await page
        .getByRole('region', { name: /^Периоды подписки/ })
        .locator('article')
        .first()
        .waitFor();
    await shot('admin-subscription-desktop');
    await goto('/admin/payments/10000000-0000-4000-8000-000000000004');
    await page.getByRole('button', { name: /^Попытки оплаты/ }).click();
    await page
        .getByRole('region', { name: /^Попытки оплаты/ })
        .locator('article')
        .first()
        .waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByText('299,00 ₽', { exact: true }).waitFor();
    assert.equal(await page.getByText('pending', { exact: true }).count(), 0);
    await shot('admin-payment-mobile');
    await page.setViewportSize({ width: 1440, height: 1000 });
    check('related subscription/payment histories load lazily in desktop and mobile cards');
    await goto('/admin/support/10000000-0000-4000-8000-000000000005');
    await page.getByLabel('Ответ пользователю', { exact: true }).fill('Проверка ответа поддержки в браузере.');
    await page.getByRole('button', { name: 'Отправить ответ', exact: true }).click();
    await page.getByText('Проверка ответа поддержки в браузере.', { exact: true }).waitFor();
    await page.getByRole('status').filter({ hasText: 'Ответ сохранён' }).waitFor();
    await page.evaluate(() => {
        const originalJson = Response.prototype.json;
        Response.prototype.json = async function () {
            const value = await originalJson.call(this);
            if (value?.data?.ticketId && value.data.messageId) {
                Response.prototype.json = originalJson;
                throw new TypeError('QA response body lost after commit');
            }
            return value;
        };
    });
    await page.getByLabel('Ответ пользователю', { exact: true }).fill('Ответ с потерянным подтверждением.');
    await page.getByRole('button', { name: 'Отправить ответ', exact: true }).click();
    await page
        .getByRole('status')
        .filter({ hasText: 'Исход запроса неизвестен' })
        .waitFor()
        .catch(async (error) => {
            console.error('Support status:', await page.getByRole('status').allTextContents());
            throw error;
        });
    await page.getByRole('button', { name: 'Обновить данные', exact: true }).click();
    await page.getByRole('button', { name: 'Обновить переписку', exact: true }).click();
    await page.locator('ol').getByText('Ответ с потерянным подтверждением.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Отправить ответ', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Ответ сохранён' }).waitFor();
    assert.equal(await page.locator('ol').getByText('Ответ с потерянным подтверждением.', { exact: true }).count(), 1);
    check('uncertain support reply reuses original version and key after data refresh');
    await shot('admin-support-desktop');
    await page.reload();
    await page.getByText('Проверка ответа поддержки в браузере.', { exact: true }).waitFor();
    await goto('/admin/support/10000000-0000-4000-8000-000000000006');
    await page.getByRole('button', { name: 'Открыть повторно', exact: true }).click();
    await page.getByLabel('Ответ пользователю', { exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await goto('/admin/users');
    await heading('Пользователи');
    await shot('admin-users-mobile-empty');
    await page.locator('#admin-search').fill('ADMIN');
    await page.getByRole('button', { name: 'Найти', exact: true }).click();
    await page.getByRole('heading', { name: 'Администратор', exact: true }).waitFor();
    await shot('admin-users-mobile');
    await page.getByRole('button', { name: 'Меню', exact: true }).click();
    await page.getByRole('dialog', { name: 'Администрирование', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Меню', exact: true }).getAttribute('aria-expanded'), 'true');
    await shot('admin-menu-mobile');
    await page.keyboard.press('Escape');
    assert.equal(
        await page.getByRole('button', { name: 'Меню', exact: true }).evaluate((el) => el === document.activeElement),
        true,
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    check('all 18 sections, exact user lookup, persistent support reply/reopen, mobile focus and layout');
    // New administrative workflows share the same real browser client and auth guards.
    async function critical() {
        const code = page.getByLabel('Код подтверждения из приложения', { exact: true }).first();
        if (await code.count()) {
            await code.fill(await nextCode());
            await page.getByRole('button', { name: 'Подтвердить критичные действия', exact: true }).first().click();
        }
        await page.getByRole('status').filter({ hasText: 'Действия подтверждены до' }).first().waitFor();
    }
    await goto('/notifications');
    await heading('Центр уведомлений');
    for (const title of [
        'Безопасность и права',
        'Платежи и возвраты',
        'Обращения и апелляции',
        'Модерация',
        'Ошибки и задачи',
        'Рассылки',
    ]) {
        await page.getByRole('tab', { name: new RegExp(title) }).click();
        await heading(title);
    }
    assert.equal(await page.getByRole('tab').count(), 6);
    await shot('admin-center-desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await shot('admin-center-mobile');
    await page.setViewportSize({ width: 1440, height: 1000 });
    check('notification center has six accessible category tabs and responsive settings');

    await goto('/dev/scenarios');
    await heading('Сценарии разработки');
    await page.getByRole('radio', { name: 'Пустые списки', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Сценарий переключён' }).waitFor();
    await goto('/admin/catalog');
    await heading('Каталог');
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
    assert.equal(await page.getByRole('link', { name: /^Открыть\s*:/ }).count(), 0);
    await goto('/dev/scenarios');
    await page.getByRole('radio', { name: 'Ошибка загрузки', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Сценарий переключён' }).waitFor();
    await goto('/admin/catalog');
    await page.getByRole('alert').first().waitFor();
    await goto('/dev/scenarios');
    await page.getByRole('radio', { name: 'Все данные', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Сценарий переключён' }).waitFor();
    await shot('admin-scenarios-desktop');
    check('scenario console empty/error modes recover to normal without changing auth');

    await goto('/admin/news');
    await heading('Новости и рассылки');
    await page.getByLabel('Заголовок', { exact: true }).fill('Браузерная проверка новости');
    await page.getByLabel('Текст блока', { exact: true }).fill('Проверяем черновик и аудиторию.');
    await page.getByRole('button', { name: 'Сохранить черновик', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Изменения сохранены' }).waitFor();
    await page.getByRole('button', { name: 'Рассчитать аудиторию сохранённой версии', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'получателей' }).waitFor();
    await page.getByRole('button', { name: 'Тестовая отправка', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Тестовое сообщение доставлено внутри приложения' }).waitFor();
    await shot('admin-news-desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await shot('admin-news-mobile');
    await page.setViewportSize({ width: 1440, height: 1000 });
    check('news draft saves through API, audience previews and test delivery stays explicitly mocked');

    await goto('/admin/catalog/10000000-0000-4000-8000-000000000007');
    await heading('Сравнение и объединение дублей');
    await page.getByLabel(/Кандидат для сравнения/).selectOption('10000000-0000-4000-8000-000000000107');
    await page.getByLabel('Итог поля name', { exact: true }).selectOption('left');
    await page.getByRole('button', { name: 'Предпросмотр объединения', exact: true }).click();
    await heading('Итог и последствия');
    await shot('admin-catalog-compare-desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await shot('admin-catalog-compare-mobile');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await goto('/admin/queues/10000000-0000-4000-8000-000000000001');
    await heading('Проверка версии материала');
    await page.getByLabel('Причина, видимая автору', { exact: true }).fill('Уточните описание ингредиента.');
    await page.getByRole('button', { name: 'Отклонить с причиной', exact: true }).click();
    await page.getByText('Ожидающей версии нет.', { exact: true }).waitFor();
    await shot('admin-moderation-desktop');
    check('catalog resolves explicit conflicts and moderation rejects only reviewed pending revision');

    await goto('/admin/payments/71000000-0000-4000-8000-000000000001');
    await heading('Подписки и возвраты');
    await critical();
    await page.getByLabel('Сумма в копейках', { exact: true }).fill('100');
    await page.getByLabel('Причина', { exact: true }).fill('Браузерный тест компенсации без изменения доступа');
    await page.getByRole('button', { name: 'Проверить последствия', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Подтверждаю операцию', exact: true }).check();
    assert.equal(await page.getByRole('button', { name: 'Выполнить', exact: true }).isDisabled(), true);
    await page.getByText(/выполнить его нельзя до подключения платёжного провайдера/).waitFor();
    await shot('admin-billing-refund-desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await shot('admin-billing-refund-mobile');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await goto('/admin/users/10000000-0000-4000-8000-000000000008');
    await heading('Санкции и служебные права');
    const governance = page
        .locator('section')
        .filter({ has: page.getByRole('heading', { name: 'Санкции и служебные права', exact: true }) })
        .last();
    await governance.getByLabel(/Категория причины/).selectOption('rules');
    await governance.getByLabel(/Область/).selectOption('comments');
    await governance
        .getByLabel('Объяснение пользователю', { exact: true })
        .fill('Браузерный тест ограничения комментариев');
    await governance.getByRole('button', { name: 'Проверить последствия', exact: true }).click();
    await governance.getByRole('checkbox', { name: 'Подтверждаю указанные последствия', exact: true }).check();
    await governance.getByRole('button', { name: 'Выполнить', exact: true }).click();
    await governance.getByRole('status').filter({ hasText: 'Действие сохранено' }).waitFor();
    await shot('admin-governance-desktop');
    check('billing refund remains fail-closed while sanction requires explicit preview and critical confirmation');

    await goto('/admin/legal-requests/10000000-0000-4000-8000-000000000012');
    await heading('Проверка запроса и экспорт данных');
    assert.equal(
        await page.getByRole('button', { name: 'Окончательное удаление недоступно', exact: true }).isDisabled(),
        true,
    );
    await page.getByRole('link', { name: 'Заявитель подтверждён (тестовый пример)', exact: true }).click();
    await page.getByText('Проверка личности подтверждена.', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'Обновить предпросмотр последствий', exact: true }).click();
    await page.getByLabel('Причина действия', { exact: true }).fill('Экспорт по подтверждённому тестовому запросу');
    assert.equal(
        await page.getByRole('button', { name: 'Подготовка архива недоступна', exact: true }).isDisabled(),
        true,
    );
    await page.getByText(/выдача архива недоступны до подключения защищённого хранилища/).waitFor();
    assert.equal(await page.getByRole('button', { name: /Скачать/ }).count(), 0);
    await shot('admin-legal-export-desktop');
    await goto('/admin/rollback/10000000-0000-4000-8000-000000000011');
    await heading('Предпросмотр компенсирующего отката');
    await page.getByRole('button', { name: 'Обновить предпросмотр последствий', exact: true }).click();
    await page.getByLabel('Причина действия', { exact: true }).fill('Браузерная проверка частичного отката');
    await page.getByRole('button', { name: 'Компенсировать только готовые элементы', exact: true }).click();
    await page
        .getByRole('status')
        .filter({ hasText: /Компенсировано: [1-9]\d*/ })
        .waitFor();
    await shot('admin-rollback-desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await shot('admin-rollback-mobile');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await goto('/admin/support/10000000-0000-4000-8000-000000000005');
    await heading('Работа с обращением');
    await shot('admin-support-workspace-desktop');
    check(
        'legal export keeps applicant-only boundary, deletion blocked, rollback skips conflicts, support tools render',
    );
    await goto('/');
    await heading('Служебный вход подтверждён');
    await page.getByRole('link', { name: 'Настройки уведомлений', exact: true }).click();
    await heading('Уведомления');
    assert.equal(await page.getByRole('link', { name: 'К обзору', exact: true }).getAttribute('href'), '/admin');
    const channels = ['Браузер', 'Мобильный Web Push', 'Email'];
    for (const name of channels) {
        const toggle = page.getByRole('checkbox', { name, exact: true });
        await toggle.waitFor();
        assert.equal(await toggle.isChecked(), false);
    }
    for (const name of channels) {
        await page.getByRole('checkbox', { name, exact: true }).click();
        await page.getByRole('status').filter({ hasText: 'Настройка сохранена' }).waitFor();
        await page.waitForFunction(() =>
            [...document.querySelectorAll('input[type="checkbox"]')].every((input) => !input.disabled),
        );
    }
    await page.reload();
    await heading('Уведомления');
    for (const name of channels)
        assert.equal(await page.getByRole('checkbox', { name, exact: true }).isChecked(), true);
    await page.getByRole('checkbox', { name: 'Мобильный Web Push', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Настройка сохранена' }).waitFor();
    await page.reload();
    await page.getByRole('checkbox', { name: 'Мобильный Web Push', exact: true }).waitFor();
    assert.equal(await page.getByRole('checkbox', { name: 'Мобильный Web Push', exact: true }).isChecked(), false);
    assert.equal(await page.getByRole('checkbox', { name: 'Браузер', exact: true }).isChecked(), true);
    assert.equal(await page.getByRole('checkbox', { name: 'Email', exact: true }).isChecked(), true);
    await shot('admin-notifications-desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await shot('admin-notifications-mobile');
    await page.setViewportSize({ width: 1440, height: 1000 });
    check('notification defaults, independent channel persistence and mobile layout');
    await goto('/settings/notifications');
    await heading('Уведомления');
    await goto('/missing-admin-page');
    await heading('Страница не найдена');
    await page.reload();
    await heading('Страница не найдена');
    await page.getByRole('link', { name: 'Открыть администрирование', exact: true }).click();
    await page.getByRole('heading', { name: 'Подтвердите повторный вход', exact: true }).waitFor();
    await page.getByLabel('Код из приложения', { exact: true }).fill(await nextCode());
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await heading('Служебный вход подтверждён');
    check('SPA direct deep links, reload and unknown-route fallback');
    await page.getByRole('button', { name: 'Завершить другие сессии', exact: true }).click();
    await page.getByText('Завершено других сессий: 0', { exact: true }).waitFor();
    await logout();
    await goto('/settings/notifications');
    await page.waitForURL('**/auth?returnTo=%2Fsettings%2Fnotifications');
    assert.equal(await page.getByRole('checkbox').count(), 0);
    await goto('/auth');
    await recoveryLogin(recovery[0]);
    await heading('Служебный вход подтверждён');
    await logout();
    check('session revocation, logout and recovery-code login');
    await recoveryLogin(recovery[0]);
    await page.locator('.form-error').waitFor();
    check('used recovery code rejected');
    await page.reload();
    await page.getByRole('link', { name: 'Вернуться ко входу', exact: true }).waitFor();
    assert.equal(await page.locator('.enrollment').count(), 0);
    check('MFA flow is not persisted after reload');
    await goto('/auth');
    await recoveryLogin(recovery[1]);
    await heading('Служебный вход подтверждён');
    assert.equal(await page.evaluate(() => !!sessionStorage.getItem('meal-admin-tab-unlock')), true);
    const opened = context.waitForEvent('page');
    await page.evaluate(() => window.open('/', '_blank'));
    const second = await opened;
    await second.getByRole('heading', { name: 'Подтвердите повторный вход', exact: true }).waitFor();
    assert.equal(await second.evaluate(() => sessionStorage.getItem('meal-admin-tab-unlock')), null);
    assert.equal(await second.locator('#password').count(), 0);
    await second.getByRole('button', { name: 'Выйти и сменить аккаунт', exact: true }).click();
    await page.waitForURL('**/auth?returnTo=*');
    await second.close();
    check('cross-tab logout removes protected content');
    await page.setViewportSize({ width: 390, height: 844 });
    await heading('Вход администратора');
    await shot('admin-auth-mobile');
    await recoveryLogin(recovery[2]);
    await heading('Служебный вход подтверждён');
    await page.getByLabel('Код подтверждения из приложения', { exact: true }).waitFor();
    await shot('admin-home-mobile');
    check('mobile auth and protected home without horizontal overflow');
    await logout();
    await goto('/auth?returnTo=https://example.invalid/');
    await recoveryLogin(recovery[3]);
    await page.waitForURL(origin + '/');
    check('unsafe returnTo rejected');
    await page.clock.fastForward(7 * 24 * 60 * 60 * 1000 + 1000);
    await page.getByLabel('Логин', { exact: true }).waitFor();
    await page.getByLabel('Пароль', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('meal-admin-tab-unlock')), null);
    check('seven-day session expiry requires username password and clears tab proof');
    // A separate isolated browser has intentionally unavailable IndexedDB, not a fake auth failure.
    const failed = await browser.newContext();
    await failed.addInitScript(() => {
        Object.defineProperty(globalThis, 'indexedDB', {
            get() {
                throw new Error('QA storage unavailable');
            },
        });
    });
    const failurePage = await failed.newPage();
    await failurePage.goto(origin + '/');
    await failurePage.getByRole('heading', { name: 'Не удалось проверить вход', exact: true }).waitFor();
    await failurePage.getByRole('button', { name: 'Повторить', exact: true }).waitFor();
    await failed.close();
    check('unavailable service shows retry instead of infinite loader');
    assert.deepEqual(errors, []);
} catch (error) {
    console.error('Browser diagnostics', {
        url: page.url(),
        errors,
        body: (await page.locator('body').innerText()).slice(0, 6000),
    });
    await page.screenshot({ path: fileURLToPath(new URL('admin-workflow-failure.png', output)), fullPage: true });
    throw error;
} finally {
    await writeFile(new URL('admin-browser-results.json', output), JSON.stringify({ results, errors }, null, 2) + '\n');
    await browser.close();
}
