import { expect, test } from '@playwright/test';
import {
    confirmCritical,
    enrollAdmin,
    fillControlledInput,
    spaNavigate,
    unlockTabWithRecovery,
} from './helpers/admin-session.js';
import { armFetchFault, installFetchFaultHarness } from './helpers/fetch-fault.js';

test.beforeEach(async ({ context }) => installFetchFaultHarness(context));

test('adds and removes an allergen mapping while icon upload stays fail-closed', async ({ page }) => {
    test.setTimeout(90_000);
    await enrollAdmin(page);
    await spaNavigate(page, '/admin/catalog/allergens/milk');
    await expect(page.getByRole('heading', { name: 'Молоко', exact: true })).toBeVisible();
    const detail = page.getByRole('heading', { name: 'Связи словаря' }).locator('xpath=ancestor::section[1]');
    const initialMappings = await detail.locator('article').count();
    await detail.getByLabel('Тип').selectOption('variant');
    await detail.getByRole('button', { name: 'Найти в каталоге', exact: true }).click();
    await detail.getByLabel('Продукт или ингредиент').selectOption({ index: 1 });
    await detail.getByLabel('Статус').selectOption('may_contain');
    await detail.getByLabel('Источник').fill('E2E: ручная проверка этикетки');
    await detail.getByRole('button', { name: 'Добавить связь', exact: true }).click();
    await expect(detail.locator('article')).toHaveCount(initialMappings + 1);
    await detail
        .locator('article')
        .filter({ hasText: 'E2E: ручная проверка этикетки' })
        .getByRole('button', { name: 'Удалить' })
        .click();
    await expect(detail.locator('article')).toHaveCount(initialMappings);
    await expect(page.getByText(/Development mock: файл проверяется локально/u)).toBeVisible();
    await expect(page.getByText(/без внешнего хранилища/u)).toBeVisible();
    await page.reload();
    await expect(detail.locator('article')).toHaveCount(initialMappings);
});

test('stages achievement and reputation changes into the same release', async ({ page }) => {
    test.setTimeout(90_000);
    await enrollAdmin(page);
    await spaNavigate(page, '/admin/releases');
    await page.getByLabel('Название нового релиза').fill('E2E каталог и репутация');
    await page.getByRole('button', { name: 'Создать релиз', exact: true }).click();
    await page.waitForURL(/\/admin\/releases\/[0-9a-f-]+$/u);
    const releasePath = new URL(page.url()).pathname;
    expect(releasePath).toMatch(/^\/admin\/releases\/[0-9a-f-]+$/u);

    await spaNavigate(page, '/admin/catalog/achievements');
    await page.getByRole('button', { name: 'Создать достижение', exact: true }).click();
    await page.getByLabel('Заголовок', { exact: true }).fill('E2E достижение');
    await page.getByLabel('Стабильный код', { exact: true }).fill('e2e-achievement');
    await page.locator('textarea').fill('Публичное достижение из точного UI-сценария.');
    await page
        .getByRole('combobox', { name: 'Добавить в релиз', exact: true })
        .selectOption({ label: 'E2E каталог и репутация' });
    const createInRelease = page.getByRole('button', { name: 'Создать в релизе', exact: true });
    await createInRelease.click();
    await expect(page.getByRole('status')).toContainText('Изменение добавлено');

    await spaNavigate(page, '/admin/catalog/reputation');
    await page.getByLabel('Репутация', { exact: true }).fill('999999');
    await expect(page.getByText('максимальный уровень', { exact: false })).toBeVisible({ timeout: 15_000 });
    await page
        .getByRole('combobox', { name: 'Добавить в релиз', exact: true })
        .selectOption({ label: 'E2E каталог и репутация' });
    const addReputation = page.getByRole('button', { name: 'Добавить в релиз', exact: true });
    await addReputation.click();
    await expect(page.getByRole('status')).toContainText('Шкала добавлена');

    await spaNavigate(page, releasePath);
    await expect(page.getByText('Достижения · 1', { exact: false })).toBeVisible();
    const summary = page.getByRole('heading', { name: 'Итоги релиза' }).locator('xpath=ancestor::aside[1]');
    await expect(summary).toContainText(/Звания\s*1/u);
});

test('surfaces a two-tab release conflict and can choose the server version', async ({
    page,
    context,
    browserName,
}) => {
    test.setTimeout(90_000);
    const codes = await enrollAdmin(page);
    await spaNavigate(page, '/admin/releases');
    await page.getByLabel('Название нового релиза').fill('E2E конфликт вкладок');
    await page.getByRole('button', { name: 'Создать релиз', exact: true }).click();
    await page.waitForURL(/\/admin\/releases\/[0-9a-f-]+$/u);
    const releaseUrl = page.url();
    await expect(page.getByText(/Сохранено \d/u)).toBeVisible({ timeout: 15_000 });
    if (browserName === 'firefox') {
        const releasePath = new URL(releaseUrl).pathname;
        await armFetchFault(page, {
            path: `/api/v1/admin/content-releases/${releasePath.split('/').at(-1)}`,
            method: 'PUT',
            status: 409,
            remaining: 10,
        });
        const name = page.getByLabel('Название релиза');
        await fillControlledInput(name, 'Устаревшее Firefox-изменение');
        await expect(page.getByRole('alert').filter({ hasText: 'Черновик изменён на сервере' })).toBeVisible({
            timeout: 10_000,
        });
        await expect(name).toHaveValue('Устаревшее Firefox-изменение');
        await page.getByRole('button', { name: 'Загрузить серверную', exact: true }).click();
        await expect(name).toHaveValue('E2E конфликт вкладок');
        return;
    }
    const second = await context.newPage();
    await second.goto(releaseUrl);
    await unlockTabWithRecovery(second, codes[0]!);
    await second.waitForURL(new URL(releaseUrl).pathname);
    await expect(second.getByLabel('Название релиза')).toHaveValue('E2E конфликт вкладок');

    await page.getByLabel('Название релиза').fill('Изменено в первой вкладке');
    await expect(page.getByText(/Сохранено \d/u)).toBeVisible({ timeout: 10_000 });
    await second.getByLabel('Название релиза').fill('Устаревшее изменение второй вкладки');
    await expect(second.getByRole('alert').filter({ hasText: 'Черновик изменён на сервере' })).toBeVisible({
        timeout: 10_000,
    });
    await second.getByRole('button', { name: 'Загрузить серверную', exact: true }).click();
    await expect(second.getByLabel('Название релиза')).toHaveValue('Изменено в первой вкладке');
});

test('validates, publishes, and rolls a release back to a durable draft', async ({ page }) => {
    test.setTimeout(90_000);
    const codes = await enrollAdmin(page);
    await spaNavigate(page, '/admin/releases');
    await fillControlledInput(page.getByLabel('Название нового релиза'), 'E2E публикация и откат');
    await page.getByRole('button', { name: 'Создать релиз', exact: true }).click();
    await page.waitForURL(/\/admin\/releases\/[0-9a-f-]+$/u);
    const publishedPath = new URL(page.url()).pathname;
    await page.getByLabel('Добавить из каталога').selectOption({ index: 1 });
    await expect(page.getByText(/Сохранено \d/u)).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Проверить релиз', exact: true }).click();
    await expect(page.getByText('Готов к публикации', { exact: true })).toBeVisible();
    await confirmCritical(page, codes[0]!);
    await page.getByRole('button', { name: 'Опубликовать релиз', exact: true }).click();
    await expect(page.getByText('Опубликован', { exact: true })).toBeVisible();
    await expect(page.getByText(/published · v/u)).toBeVisible();
    await page.getByRole('button', { name: 'Изменить как новую редакцию', exact: true }).click();
    await expect(page).not.toHaveURL(new RegExp(`${publishedPath}$`, 'u'));
    await expect(page.getByLabel('Название релиза')).toHaveValue('E2E публикация и откат — новая редакция');
    await expect(page.getByText('Черновик', { exact: true })).toBeVisible();

    await spaNavigate(page, publishedPath);
    await page.getByRole('button', { name: 'Откатить в черновик', exact: true }).click();
    await expect(page.getByText('Черновик', { exact: true })).toBeVisible();
    await expect(page.getByText(/rolled_back · v/u)).toBeVisible();
    await page.reload();
    await expect(page.getByText('Черновик', { exact: true })).toBeVisible();
    await expect(page.getByText(/rolled_back · v/u)).toBeVisible();
});
