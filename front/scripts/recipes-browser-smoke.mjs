import { qaRoot } from '../../scripts/qa-output.mjs';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '@playwright/test');
const origin = 'http://localhost:3000',
    recipe = '/recipes/70000000-0000-4000-8000-000000000001',
    title = 'Паста с томатами и базиликом';
const output = new URL('', qaRoot());
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
});
const context = await browser.newContext({ viewport: { width: 1487, height: 1058 } });
const page = await context.newPage();
page.setDefaultTimeout(60000);
const results = [],
    errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const goto = (path) => page.goto(origin + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
const heading = (name) => page.getByRole('heading', { name, exact: true }).first().waitFor();
const pass = (name) => {
    results.push(name);
    console.log('PASS ' + name);
};
async function shot(name) {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
    const viewport = await page.evaluate(() => ({
        innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        offenders: Array.from(document.querySelectorAll('body *'))
            .map((element) => {
                const rect = element.getBoundingClientRect();
                return {
                    tag: element.tagName,
                    className: element.className,
                    text: element.textContent?.trim().slice(0, 60),
                    left: Math.round(rect.left),
                    right: Math.round(rect.right),
                };
            })
            .filter((element) => element.left < -1 || element.right > innerWidth + 1)
            .slice(0, 12),
    }));
    assert.ok(viewport.scrollWidth <= viewport.innerWidth + 1, `${name} overflow ${JSON.stringify(viewport)}`);
    await page.screenshot({ path: fileURLToPath(new URL('recipes-' + name + '.png', output)), fullPage: true });
}
try {
    const ssrContext = await browser.newContext({ javaScriptEnabled: false });
    const ssr = await ssrContext.newPage();
    const response = await ssr.goto(origin + recipe);
    assert.equal(response.status(), 200);
    const ssrHtml = await ssr.content();
    assert.match(ssrHtml, new RegExp(title));
    assert.match(ssrHtml, /Ингредиенты/);
    assert.equal(await ssr.getByRole('button', { name: /В закладках/ }).count(), 0);
    await ssrContext.close();
    pass('public recipe rendered without JavaScript and without private bookmark');
    await goto(recipe);
    await heading(title);
    await page.getByRole('link', { name: 'Войдите', exact: true }).waitFor();
    await shot('detail-guest-desktop');
    pass('guest public detail and login invitation');
    const missing = await goto('/recipes/70000000-0000-4000-8000-000000000099');
    assert.equal(missing.status(), 404);
    pass('missing public recipe returns HTTP 404');
    await goto('/auth');
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Электронная почта', { exact: true }).fill('user1@meal-planner.test');
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
    await goto('/recipes');
    await heading('Рецепты');
    await page.getByRole('heading', { name: 'Рецепты для вас', exact: true }).waitFor();
    await shot('catalog-desktop');
    assert.ok(
        await page
            .locator('main img')
            .evaluateAll(
                (images) => images.length >= 5 && images.every((image) => image.complete && image.naturalWidth > 0),
            ),
    );
    pass('catalog cards and local food images load');
    await page
        .getByRole('navigation', { name: 'Подборка рецептов' })
        .getByRole('link', { name: 'Новые', exact: true })
        .click();
    await page.waitForURL('**/*tab=new*');
    const pagination = page.getByRole('navigation', { name: 'Страницы рецептов' });
    await pagination.getByText(/^Страница 1 · всего \d+$/).waitFor();
    const next = pagination.getByRole('link', { name: 'Далее', exact: true });
    if (await next.count()) {
        await next.click();
        await page.waitForURL('**/*page=2*');
        await page.reload();
        await page
            .getByRole('navigation', { name: 'Страницы рецептов' })
            .getByRole('link', { name: 'Назад', exact: true })
            .click();
        await page.waitForURL((url) => url.pathname === '/recipes' && !url.searchParams.has('page'));
    }
    pass('catalog pagination state and available controls via URL');
    await goto('/recipes');
    await heading('Рецепты');
    await page.getByLabel('Найти рецепт', { exact: true }).fill('Паста');
    await page.getByRole('button', { name: 'Найти', exact: true }).click();
    await page.waitForURL('**/*q=*');
    await page.reload();
    await page.getByLabel('Найти рецепт', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Найти рецепт', { exact: true }).inputValue(), 'Паста');
    await page
        .getByRole('navigation', { name: 'Категории' })
        .getByRole('link', { name: 'Основные блюда', exact: true })
        .click();
    await page.waitForURL('**/*category=mains*');
    await page
        .getByRole('navigation', { name: 'Подборка рецептов' })
        .getByRole('link', { name: 'Новые', exact: true })
        .click();
    await page.waitForURL('**/*tab=new*');
    await page.reload();
    await page.getByRole('navigation', { name: 'Подборка рецептов' }).waitFor();
    assert.equal(
        await page
            .getByRole('navigation', { name: 'Подборка рецептов' })
            .getByRole('link', { name: 'Новые', exact: true })
            .getAttribute('aria-current'),
        'true',
    );
    await page.goBack();
    await page.waitForURL((url) => !url.searchParams.has('tab') && url.searchParams.get('category') === 'mains');
    pass('catalog query/category/tab survive reload and browser Back');
    await goto('/recipes?page=2');
    await heading('Рецепты');
    await page.waitForFunction(() => !document.querySelector('[aria-busy=true]'));
    assert.equal(new URL(page.url()).searchParams.get('page'), '2');
    await page.reload();
    await heading('Рецепты');
    assert.equal(new URL(page.url()).searchParams.get('page'), '2');
    pass('catalog page direct URL survives reload');
    await goto(recipe);
    await heading(title);
    await page.getByRole('button', { name: '♡ В закладки', exact: true }).click();
    await page.getByRole('button', { name: '♥ В закладках', exact: true }).waitFor();
    await page.reload();
    await page.getByRole('button', { name: '♥ В закладках', exact: true }).waitFor();
    pass('bookmark persists across reload for current account');
    await page.getByLabel('Порции', { exact: true }).fill('8');
    await page.getByLabel('Порции', { exact: true }).press('Enter');
    await page.waitForURL('**/*servings=8*');
    await page.reload();
    await page.getByLabel('Порции', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Порции', { exact: true }).inputValue(), '8');
    await page.getByRole('navigation', { name: 'Разделы рецепта' }).getByRole('link', { name: /^Шаги/ }).click();
    await page.waitForURL('**/*tab=steps*');
    await page.reload();
    await page.getByRole('navigation', { name: 'Разделы рецепта' }).waitFor();
    assert.equal(
        await page
            .getByRole('navigation', { name: 'Разделы рецепта' })
            .getByRole('link', { name: /^Шаги/ })
            .getAttribute('aria-current'),
        'true',
    );
    await page.goBack();
    await page.waitForURL((url) => !url.searchParams.has('tab'));
    assert.equal(await page.getByLabel('Порции', { exact: true }).inputValue(), '8');
    pass('detail servings and tabs persist through reload and Back');
    await shot('detail-desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);
    await shot('detail-mobile');
    await goto('/recipes');
    await heading('Рецепты');
    await shot('catalog-mobile');
    await page.getByRole('button', { name: 'Фильтры', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await shot('filters-mobile');
    await dialog.getByRole('combobox', { name: /^Категория/ }).selectOption('soups');
    await dialog.getByRole('button', { name: 'Применить', exact: true }).click();
    await page.waitForURL('**/*category=soups*');
    await dialog.waitFor({ state: 'hidden' });
    pass('mobile catalog/detail and filter sheet without horizontal overflow');
    await goto('/settings/account');
    await page.getByRole('button', { name: 'Выйти', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/auth');
    await goto(recipe);
    await heading(title);
    await page.getByRole('link', { name: 'Войдите', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: /В закладках/ }).count(), 0);
    pass('logout removes personal bookmark and inventory view');
    assert.deepEqual(errors, []);
} catch (error) {
    console.log('FAILED', page.url());
    console.log((await page.locator('body').innerText()).slice(0, 5000));
    await page.screenshot({ path: fileURLToPath(new URL('recipes-failure.png', output)), fullPage: true });
    throw error;
} finally {
    await writeFile(new URL('recipes-browser-results.json', output), JSON.stringify({ results, errors }, null, 2));
    await browser.close();
}
