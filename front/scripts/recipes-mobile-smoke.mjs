import { qaRoot } from '../../scripts/qa-output.mjs';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '@playwright/test');
const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const origin = 'http://localhost:3000';
const output = new URL('', qaRoot());
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
async function shot(name) {
    await page.evaluate(() => globalThis.document.fonts.ready);
    await page.waitForFunction(() => Array.from(globalThis.document.images).every((image) => image.complete));
    assert.ok(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth));
    await page.screenshot({ path: fileURLToPath(new URL(`recipes-${name}.png`, output)), fullPage: true });
}
try {
    await page.goto(origin + '/auth');
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Электронная почта', { exact: true }).fill('user1@meal-planner.test');
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
    await page.goto(origin + '/recipes/70000000-0000-4000-8000-000000000001');
    const title = page.getByRole('heading', { name: 'Паста с томатами и базиликом', exact: true });
    await title.waitFor();
    const hero = page.getByRole('img', { name: 'Паста с томатами и базиликом', exact: true });
    await hero.waitFor();
    const imageBox = await hero.boundingBox();
    const headingBox = await title.boundingBox();
    assert.ok(
        imageBox.y < headingBox.y && imageBox.x <= 1 && imageBox.width >= 389,
        'edge-to-edge photo precedes title',
    );
    const nutrition = page.locator('dl').filter({ has: page.getByText('Калории', { exact: true }) });
    const columns = await nutrition.evaluate(
        (element) => globalThis.getComputedStyle(element).gridTemplateColumns.split(' ').length,
    );
    assert.equal(columns, 4);
    await shot('detail-mobile');
    await page.goto(origin + '/recipes');
    await page.getByRole('heading', { name: 'Рецепты для вас', exact: true }).waitFor();
    await shot('catalog-mobile');
    await page.getByRole('button', { name: 'Фильтры', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await shot('filters-mobile');
    await dialog.getByRole('combobox', { name: /^Категория/ }).selectOption('soups');
    await dialog.getByRole('button', { name: 'Применить', exact: true }).click();
    await page.waitForURL('**/*category=soups*');
    await dialog.waitFor({ state: 'hidden' });
    assert.deepEqual(errors, []);
    const result = {
        imageBox,
        headingBox,
        nutritionColumns: columns,
        overflow: false,
        mobileFilterApplied: true,
        errors,
    };
    await writeFile(new URL('recipes-mobile-results.json', output), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
} finally {
    await browser.close();
}
