import { qaRoot } from '../../scripts/qa-output.mjs';
import { fileURLToPath } from 'node:url';
/* global document, window, innerWidth */
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '@playwright/test');
const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(60000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const results = [];
const pass = (name) => {
    results.push(name);
    console.log('PASS ' + name);
};
const goto = (path) => page.goto('http://localhost:3000' + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
const shot = async (name) => {
    await page.evaluate(() => {
        document.activeElement?.blur();
        window.scrollTo(0, 0);
    });
    await page.evaluate(() => document.fonts.ready);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ' overflow');
    await page.screenshot({ path: `${fileURLToPath(qaRoot())}recipes-workflow-${name}.png`, fullPage: true });
};
await mkdir(qaRoot(), { recursive: true });
try {
    await goto('/auth');
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Электронная почта', { exact: true }).fill('user1@meal-planner.test');
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
    const mockKeepalive = await context.newPage();
    await mockKeepalive.goto('http://localhost:3000/dev/ui', { waitUntil: 'domcontentloaded' });
    await mockKeepalive.reload({ waitUntil: 'domcontentloaded' });
    await goto('/recipes/new');
    await page.getByRole('heading', { name: 'Новый рецепт', exact: true }).waitFor();
    await page.getByLabel('Название', { exact: true }).fill('Проверочный суп');
    await page.getByRole('button', { name: '+ Молоко 2,5%', exact: true }).click();
    await page.getByRole('button', { name: '+ Добавить шаг', exact: true }).click();
    await page.getByLabel('Шаг 1', { exact: true }).fill('Смешайте и прогрейте ингредиенты.');
    await page.getByLabel('Таймер, секунд').fill('60');
    await shot('editor-desktop');
    await page.getByRole('button', { name: 'Сохранить черновик', exact: true }).click();
    await page.waitForURL(/\/recipes\/[a-f0-9-]+\/edit$/);
    const id = page.url().split('/').at(-2);
    pass('create private draft with ingredient and step');
    await page.getByRole('link', { name: 'Управление публикацией' }).click();
    await page.getByRole('heading', { name: 'Мои рецепты', exact: true }).waitFor();
    const article = page.getByRole('article').filter({ hasText: 'Проверочный суп' });
    await article.getByRole('button', { name: 'Отправить на модерацию', exact: true }).click();
    await page.getByText('Редакция отправлена на ручную модерацию. Она ещё не опубликована.').waitFor();
    pass('explicit moderation submission');
    await goto(`/recipes/${id}/cook`);
    await page.getByRole('button', { name: 'Начать новое приготовление' }).click();
    await page.waitForURL(/attempt=/);
    await page.getByRole('button', { name: 'Включить сигнал таймера', exact: true }).click();
    await page.getByRole('button', { name: 'Настроить таймер' }).click();
    const dialog = page.getByRole('dialog', { name: 'Таймер шага' });
    await dialog.getByLabel('Длительность, секунд').fill('1');
    await dialog.getByRole('button', { name: 'Запустить', exact: true }).click();
    await page.getByRole('button', { name: 'Вернуться к шагу' }).click();
    await page
        .getByText('Время закончилось. Проверьте блюдо; шаг не завершён автоматически.', { exact: true })
        .waitFor();
    assert.equal((await page.getByRole('navigation', { name: 'Шаги приготовления' }).innerText()).includes('✓'), false);
    pass('timer reaches deadline without completing the step');
    await page.getByRole('button', { name: 'Шаг выполнен', exact: true }).click();
    await page.waitForURL((url) => url.searchParams.get('step') === '0');
    await page.getByRole('button', { name: 'Готово — проверить расход' }).click();
    await page.getByLabel('Расход Молоко', { exact: true }).fill('0.1');
    await page.getByLabel('Количество', { exact: true }).fill('100');
    await page.getByRole('combobox', { name: /^Место хранения/ }).selectOption({ label: 'Холодильник' });
    await page.getByRole('button', { name: '+ Добавить размещение готового блюда', exact: true }).click();
    const placement = page.getByRole('heading', { name: 'Размещение 2', exact: true }).locator('..');
    await placement.getByLabel('Количество', { exact: true }).fill('25');
    await placement.getByRole('combobox', { name: /Место хранения/ }).selectOption({ label: 'Кухонный шкаф' });
    await shot('cooking-review-desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);
    await shot('cooking-review-mobile');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.waitForTimeout(250);
    await page.getByRole('button', { name: 'Подтвердить расход и результат' }).click();
    await page.getByRole('heading', { name: 'Приготовление подтверждено', exact: true }).waitFor();
    pass('timer progress and confirmed consumption create output exactly once');
    assert.equal(await page.getByRole('link', { name: 'Открыть готовую партию' }).count(), 2);
    await page.getByRole('link', { name: 'К обсуждению и оценке рецепта' }).click();
    await page.getByRole('heading', { name: 'Обсуждение и оценка', exact: true }).waitFor();
    pass('split output placements and private completion community URL');
    await page.getByRole('link', { name: 'Открыть готовую партию' }).first().click();
    await page.getByRole('heading', { name: 'Готовые блюда и заготовки' }).waitFor();
    await page.getByRole('heading', { name: 'Проверочный суп', exact: true }).waitFor();
    pass('prepared output separate stock route');
    const recipe = '70000000-0000-4000-8000-000000000001';
    await goto(`/recipes/${recipe}?tab=variants`);
    await page.getByRole('button', { name: 'Создать личный вариант', exact: true }).click();
    await page.waitForURL(/\/edit$/);
    await page.getByRole('heading', { name: 'Редактор рецепта', exact: true }).waitFor();
    pass('public recipe personal variant');
    await goto(`/shopping?recipeId=${recipe}&servings=4`);
    await page.getByLabel('Новый список', { exact: true }).fill('На ужин');
    await page.getByRole('button', { name: 'Создать список', exact: true }).click();
    await page.waitForURL(/\/shopping\/[a-f0-9-]+/);
    await page.getByRole('button', { name: 'Подтвердить добавление', exact: true }).click();
    await page.waitForURL((url) => !url.search);
    await page.getByRole('checkbox').first().click();
    await page.waitForFunction(() => document.querySelector('input[type=checkbox]')?.checked === true);
    await shot('shopping-desktop');
    pass('recipe shopping preview confirmation and purchase mark');
    await goto(`/recipes/${recipe}`);
    await page.getByRole('heading', { name: 'Паста с томатами и базиликом', exact: true }).waitFor();
    await page.getByRole('button', { name: '♡ В закладки', exact: true }).waitFor();
    await page.waitForFunction((id) => localStorage.getItem('meal-planner-recipes-read-v1')?.includes(id), recipe);
    await context.setOffline(true);
    await page.getByText('Читать сохранённые рецепты без сети', { exact: true }).click();
    await page.getByRole('heading', { name: 'Сохранённые рецепты', exact: true }).waitFor();
    assert.match(await page.locator('details').innerText(), /Паста с томатами/);
    await context.setOffline(false);
    await mockKeepalive.reload({ waitUntil: 'domcontentloaded' });
    pass('actual offline network reader opens without fetching another route');
    await goto('/recipes/offline');
    await page.getByRole('heading', { name: 'Сохранённые рецепты', exact: true }).waitFor();
    await page.getByRole('heading', { name: 'Паста с томатами и базиликом', exact: true }).waitFor();
    pass('two-item offline reader populated from opened public recipe');
    await page.setViewportSize({ width: 390, height: 844 });
    await goto(`/recipes/${id}/edit`);
    await page.getByRole('heading', { name: 'Редактор рецепта', exact: true }).waitFor();
    await shot('editor-mobile');
    const saveButton = page.getByRole('button', { name: 'Сохранить черновик', exact: true });
    await saveButton.evaluate((button) => button.scrollIntoView({ block: 'center' }));
    assert.equal(
        await saveButton.evaluate((button) => {
            const r = button.getBoundingClientRect();
            return button.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
        }),
        true,
    );
    await page.screenshot({ path: fileURLToPath(new URL('recipes-workflow-editor-actions-mobile.png', qaRoot())) });
    pass('mobile editor save action is reachable and unobscured');
    await goto('/shopping');
    await page
        .getByRole('article')
        .filter({ hasText: 'На ужин' })
        .getByRole('link', { name: 'Открыть список', exact: true })
        .click();
    await page.getByRole('heading', { name: 'Товары', exact: true }).waitFor();
    await shot('shopping-mobile');
    pass('editor and shopping mobile no overflow');
    assert.deepEqual(errors, []);
    await writeFile(
        fileURLToPath(new URL('recipes-workflow-results.json', qaRoot())),
        JSON.stringify({ results, errors }, null, 2),
    );
} catch (error) {
    await page.screenshot({ path: fileURLToPath(new URL('recipes-workflow-failure.png', qaRoot())), fullPage: true });
    console.error(await page.locator('body').innerText());
    throw error;
} finally {
    await browser.close();
}
