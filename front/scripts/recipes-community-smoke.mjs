import { qaRoot } from '../../scripts/qa-output.mjs';
import { fileURLToPath } from 'node:url';
/* global document, innerWidth */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '@playwright/test');
const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(60000);
const errors = [];
const results = [];
page.on('pageerror', (error) => errors.push(error.message));
const goto = (path) => page.goto('http://localhost:3000' + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
const pass = (name) => {
    results.push(name);
    console.log('PASS ' + name);
};
async function shot(name) {
    await page.evaluate(() => document.fonts.ready);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ' overflow');
    await page.screenshot({ path: `${fileURLToPath(qaRoot())}recipes-community-${name}.png`, fullPage: true });
}
await mkdir(qaRoot(), { recursive: true });
try {
    await goto('/auth');
    await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.getByLabel('Электронная почта', { exact: true }).fill('user1@meal-planner.test');
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
    const keepalive = await context.newPage();
    await keepalive.goto('http://localhost:3000/dev/ui', { waitUntil: 'domcontentloaded' });
    await keepalive.reload({ waitUntil: 'domcontentloaded' });
    const recipe = '70000000-0000-4000-8000-000000000001';
    await goto(`/recipes/${recipe}?tab=comments`);
    await page.getByRole('button', { name: 'Оценить рецепт', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Оценить рецепт', exact: true }).isDisabled(), true);
    pass('rating and comments gated before confirmed public cooking');
    await goto(`/recipes/${recipe}/cook`);
    await page.getByRole('button', { name: 'Начать новое приготовление' }).click();
    await page.waitForURL(/attempt=/);
    await page.getByRole('button', { name: 'Готово — проверить расход' }).click();
    await page.getByLabel('Количество', { exact: true }).fill('250');
    await page.getByRole('combobox', { name: /^Место хранения/ }).selectOption({ label: 'Холодильник' });
    await page.getByRole('button', { name: 'Подтвердить расход и результат' }).click();
    await page.getByRole('heading', { name: 'Приготовление подтверждено', exact: true }).waitFor();
    await page.getByRole('link', { name: 'К обсуждению и оценке рецепта' }).click();
    await page.getByRole('button', { name: 'Оценить рецепт', exact: true }).click();
    await page.getByRole('button', { name: 'Подтвердить оценку', exact: true }).click();
    await page.getByText(/Ваша оценка: 5 из 5/).waitFor();
    await page.getByLabel('Текст комментария').fill('Приготовлено в браузерной проверке');
    await page.getByRole('button', { name: 'Сохранить комментарий', exact: true }).click();
    let comment = page.getByRole('article').filter({ hasText: 'Приготовлено в браузерной проверке' });
    await comment.getByRole('button', { name: 'Редактировать', exact: true }).click();
    await page.getByLabel('Текст комментария').fill('Комментарий после редактирования');
    await page.getByRole('button', { name: 'Сохранить комментарий', exact: true }).click();
    comment = page.getByRole('article').filter({ hasText: 'Комментарий после редактирования' });
    await comment.getByText('Отредактировано', { exact: true }).waitFor();
    await comment.getByRole('button', { name: 'Ответить', exact: true }).click();
    await page.getByLabel('Текст комментария').fill('Ответ на комментарий');
    await page.getByRole('button', { name: 'Сохранить комментарий', exact: true }).click();
    await shot('desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);
    await shot('mobile');
    pass('confirmed public cooking enables immutable vote and editable threaded comments');
    await page.getByRole('button', { name: 'Пожаловаться на рецепт', exact: true }).click();
    let reportDialog = page.getByRole('dialog', { name: 'Жалоба', exact: true });
    await reportDialog.getByRole('combobox', { name: /Причина/ }).selectOption('quality');
    await reportDialog.getByRole('button', { name: 'Отправить жалобу', exact: true }).click();
    await page.getByText('Жалоба отправлена на рассмотрение.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Пожаловаться на рецепт', exact: true }).click();
    reportDialog = page.getByRole('dialog', { name: 'Жалоба', exact: true });
    await reportDialog.getByRole('combobox', { name: /Причина/ }).selectOption('dangerous');
    await reportDialog.getByRole('button', { name: 'Отправить жалобу', exact: true }).click();
    await page.getByRole('heading', { name: 'Рецепт недоступен', exact: true }).waitFor();
    await goto('/reports');
    await page.getByRole('heading', { name: 'Мои жалобы на рецепты', exact: true }).waitFor();
    await page.getByRole('article').nth(1).waitFor();
    assert.equal(await page.getByRole('article').count(), 2);
    pass('noncritical report then critical hide; own reports remain accessible');
    assert.deepEqual(errors, []);
    await writeFile(
        fileURLToPath(new URL('recipes-community-results.json', qaRoot())),
        JSON.stringify({ results, errors }, null, 2),
    );
} catch (error) {
    await page.screenshot({ path: fileURLToPath(new URL('recipes-community-failure.png', qaRoot())), fullPage: true });
    console.error(await page.locator('body').innerText());
    throw error;
} finally {
    await browser.close();
}
