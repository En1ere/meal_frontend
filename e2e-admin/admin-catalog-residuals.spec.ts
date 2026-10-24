import { expect, test } from '@playwright/test';
import { armFetchFault, clearFetchFault, installFetchFaultHarness } from './helpers/fetch-fault.js';
import {
    enrollAdmin,
    fillControlledInput,
    setScenario,
    spaNavigate,
    unlockTabWithRecovery,
} from './helpers/admin-session.js';
import { stableUuid } from '../frontend_admin/src/features/releases/api.js';

const missingId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const firstAchievementId = stableUuid('achievement-first-dish');

test.beforeEach(async ({ context }) => installFetchFaultHarness(context));

test('allergen list filters, validates an icon, reports 404, and recovers from 503', async ({ page }) => {
    await enrollAdmin(page);
    await spaNavigate(page, '/admin/catalog/allergens');
    const list = page.getByRole('region', { name: 'Список аллергенов' });
    await expect(list.getByRole('link')).not.toHaveCount(0);
    await list.getByPlaceholder('Название или код').fill('не-существующий-аллерген');
    await list.getByRole('button', { name: 'Найти', exact: true }).click();
    await expect(list.getByRole('link')).toHaveCount(0);

    await spaNavigate(page, '/admin/catalog/allergens/milk');
    const upload = page.locator('input[type="file"]');
    await upload.setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
    await page.getByRole('button', { name: 'Подтвердить загрузку', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('PNG, WebP или SVG');

    await spaNavigate(page, '/admin/catalog/allergens/not-a-real-allergen');
    await expect(page.getByRole('button', { name: 'Повторить загрузку', exact: true }).last()).toBeVisible();
    await setScenario(page, 'Ошибка загрузки');
    await spaNavigate(page, '/admin/catalog/allergens');
    await expect(page.getByRole('button', { name: 'Повторить загрузку', exact: true }).first()).toBeVisible();
    await setScenario(page, 'Все данные');
    await spaNavigate(page, '/admin/catalog/allergens/milk');
    await expect(page.getByRole('heading', { name: 'Молоко', exact: true })).toBeVisible();
});

test('allergen detail rejects a stale two-tab mapping without losing the draft', async ({
    page,
    context,
    browserName,
}) => {
    test.setTimeout(90_000);
    const codes = await enrollAdmin(page);
    await spaNavigate(page, '/admin/catalog/allergens/milk');
    if (browserName === 'firefox') {
        const stored = await page.evaluate(() => ({
            proof: sessionStorage.getItem('meal-admin-tab-unlock'),
            tabId: sessionStorage.getItem('meal-admin-tab-unlock-tab-id'),
        }));
        expect(stored.proof).toBeTruthy();
        expect(stored.tabId).toBeTruthy();
        await page.evaluate(() => {
            window.name = 'meal-admin:copied-firefox-tab';
        });
        await page.reload();
        await unlockTabWithRecovery(page, codes[0]!);
        await page.getByRole('button', { name: 'Найти в каталоге', exact: true }).click();
        await page.getByLabel('Продукт или ингредиент').selectOption({ index: 2 });
        const source = page.getByLabel('Источник');
        await source.fill('E2E: Firefox stale equivalent');
        await armFetchFault(page, {
            path: '/api/v1/admin/allergens/milk/mappings',
            method: 'POST',
            status: 412,
        });
        await page.getByRole('button', { name: 'Добавить связь', exact: true }).click();
        await expect(page.getByRole('alert')).toContainText('Версия устарела');
        await expect(source).toHaveValue('E2E: Firefox stale equivalent');
        return;
    }
    const second = await context.newPage();
    await second.goto('/admin/catalog/allergens/milk');
    await unlockTabWithRecovery(second, codes[0]!);
    await second.waitForURL('/admin/catalog/allergens/milk');

    for (const [target, source] of [
        [page, 'E2E: первая вкладка'],
        [second, 'E2E: устаревшая вторая вкладка'],
    ] as const) {
        await target.getByRole('button', { name: 'Найти в каталоге', exact: true }).click();
        await target.getByLabel('Продукт или ингредиент').selectOption({ index: 2 });
        await target.getByLabel('Источник').fill(source);
    }
    await page.getByRole('button', { name: 'Добавить связь', exact: true }).click();
    await expect(page.getByText('E2E: первая вкладка', { exact: true })).toBeVisible();

    await second.getByRole('button', { name: 'Добавить связь', exact: true }).click();
    await expect(second.getByRole('alert')).toBeVisible();
    await expect(second.getByLabel('Источник')).toHaveValue('E2E: устаревшая вторая вкладка');
});

test('allergen 412 keeps the mapping draft and succeeds on an explicit retry with readback', async ({ page }) => {
    await enrollAdmin(page);
    await spaNavigate(page, '/admin/catalog/allergens/milk');
    await page.getByRole('button', { name: 'Найти в каталоге', exact: true }).click();
    await page.getByLabel('Продукт или ингредиент').selectOption({ index: 2 });
    const source = page.getByLabel('Источник');
    await source.fill('E2E: retry after 412');
    await armFetchFault(page, {
        path: '/api/v1/admin/allergens/milk/mappings',
        method: 'POST',
        status: 412,
    });
    await page.getByRole('button', { name: 'Добавить связь', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Версия устарела');
    await expect(source).toHaveValue('E2E: retry after 412');
    await page.getByRole('button', { name: 'Добавить связь', exact: true }).click();
    await expect(page.getByText('E2E: retry after 412', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('E2E: retry after 412', { exact: true })).toBeVisible();
});

test('achievement list filters locally and keeps an explicit missing identity', async ({ page }) => {
    await enrollAdmin(page);
    await spaNavigate(page, '/admin/catalog/achievements');
    await page.getByLabel('Поиск достижений').fill('Первое блюдо');
    await expect(page.getByRole('button', { name: /Первое блюдо/u })).toBeVisible();
    await page.getByLabel('Поиск достижений').fill('нет такого достижения');
    await expect(page.getByRole('button', { name: /Первое блюдо/u })).toHaveCount(0);
    await spaNavigate(page, `/admin/catalog/achievements/${missingId}`);
    await expect(page.getByRole('alert')).toContainText('не найдено');
});

test('achievement detail stages an update against the requested identity and reads it back from the release', async ({
    page,
}) => {
    await enrollAdmin(page);
    await spaNavigate(page, '/admin/releases');
    await page.getByLabel('Название нового релиза').fill('E2E achievement detail update');
    await page.getByRole('button', { name: 'Создать релиз', exact: true }).click();
    await page.waitForURL(/\/admin\/releases\/[0-9a-f-]+$/u);
    const releasePath = new URL(page.url()).pathname;

    await spaNavigate(page, `/admin/catalog/achievements/${firstAchievementId}`);
    await expect(page.getByRole('heading', { name: 'Первое блюдо', exact: true })).toBeVisible();
    await page.getByLabel('Заголовок', { exact: true }).fill('Первое блюдо · E2E update');
    await page.getByRole('combobox', { name: 'Добавить в релиз', exact: true }).selectOption({
        label: 'E2E achievement detail update',
    });
    await page.getByRole('button', { name: 'Добавить изменение', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Изменение добавлено');

    await spaNavigate(page, releasePath);
    await expect(page.getByText('Первое блюдо · E2E update', { exact: true })).toBeVisible();
});

test('release list exposes empty/error recovery and detail has an explicit 404', async ({ page }) => {
    await enrollAdmin(page);
    await spaNavigate(page, '/admin/releases');
    await expect(page.getByRole('heading', { name: 'Черновиков пока нет', exact: true })).toBeVisible();
    await setScenario(page, 'Ошибка загрузки');
    await spaNavigate(page, '/admin/releases');
    await expect(page.getByRole('button', { name: 'Повторить загрузку', exact: true })).toBeVisible();
    await setScenario(page, 'Все данные');
    await spaNavigate(page, `/admin/releases/${missingId}`);
    await expect(page.getByRole('heading', { name: 'Релиз не найден', exact: true })).toBeVisible();
});

test('release autosave preserves a local draft across 412 and succeeds after recovery', async ({ page }) => {
    test.setTimeout(90_000);
    await enrollAdmin(page);
    await spaNavigate(page, '/admin/releases');
    await page.getByLabel('Название нового релиза').fill('E2E 412 draft');
    await page.getByRole('button', { name: 'Создать релиз', exact: true }).click();
    await page.waitForURL(/\/admin\/releases\/[0-9a-f-]+$/u);
    const releaseId = new URL(page.url()).pathname.split('/').at(-1)!;
    await expect(page.getByText(/Сохранено \d/u)).toBeVisible({ timeout: 15_000 });
    await armFetchFault(page, {
        path: `/api/v1/admin/content-releases/${releaseId}`,
        method: 'PUT',
        status: 412,
        remaining: 10,
    });
    await fillControlledInput(page.getByLabel('Название релиза'), 'E2E draft сохранён после 412');
    await expect(page.getByRole('alert')).toContainText('Версия устарела', { timeout: 10_000 });
    await expect(page.getByLabel('Название релиза')).toHaveValue('E2E draft сохранён после 412');
    await clearFetchFault(page);
    await fillControlledInput(page.getByLabel('Название релиза'), 'E2E draft сохранён после 412 ');
    await fillControlledInput(page.getByLabel('Название релиза'), 'E2E draft сохранён после 412');
    await expect(page.getByText(/Сохранено \d/u)).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await expect(page.getByLabel('Название релиза')).toHaveValue('E2E draft сохранён после 412');
});
