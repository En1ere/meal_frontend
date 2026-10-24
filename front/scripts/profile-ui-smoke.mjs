import { qaRoot } from '../../scripts/qa-output.mjs';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '@playwright/test');
const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
});
const context = await browser.newContext({ viewport: { width: 1487, height: 1058 } });
const page = await context.newPage();
page.setDefaultTimeout(60000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const results = [];
const pass = (name) => {
    results.push(name);
    console.log('PASS ' + name);
};
const output = new URL('', qaRoot());
await mkdir(output, { recursive: true });
try {
    await page.goto('http://localhost:3000/profile', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForURL('**/auth?returnTo=%2Fprofile');
    await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    await page.getByLabel('Электронная почта', { exact: true }).fill('user1@meal-planner.test');
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL('**/profile');
    await page.getByText('user1@meal-planner.test', { exact: false }).waitFor();
    await page.getByText(/^Опубликованных рецептов: \d+$/).waitFor();
    await page.screenshot({ path: fileURLToPath(new URL('own-profile-desktop.png', output)), fullPage: true });
    pass('own profile authenticated returnTo, private email and published recipe counter');
    assert.equal(await page.getByLabel('Часовой пояс', { exact: true }).inputValue(), 'Europe/Moscow');
    await page.setViewportSize({ width: 393, height: 852 });
    await page.screenshot({ path: fileURLToPath(new URL('own-profile-mobile.png', output)), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.setViewportSize({ width: 1487, height: 1058 });
    await page.getByRole('link', { name: 'Посмотреть публичный профиль' }).click();
    await page.waitForURL('**/authors/user1');
    await page.getByRole('heading', { name: '@user1', exact: true }).waitFor();
    assert.equal(await page.getByText('user1@meal-planner.test', { exact: false }).count(), 0);
    await page.screenshot({ path: fileURLToPath(new URL('public-profile-desktop.png', output)), fullPage: true });
    pass('public profile has no private contact information');
    await page.setViewportSize({ width: 393, height: 852 });
    await page.screenshot({ path: fileURLToPath(new URL('public-profile-mobile.png', output)), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.goto('http://localhost:3000/authors/no-such-author');
    await page.getByRole('heading', { name: 'Профиль недоступен' }).waitFor();
    pass('missing author and responsive layout');
    await page.goto('http://localhost:3000/dev/ui');
    const block = page.getByTestId('block').locator('span[aria-hidden="true"]');
    const lines = page.getByTestId('lines').locator('span[aria-hidden="true"]');
    assert.equal(await block.count(), 1);
    assert.equal(await lines.count(), 4);
    assert.equal(
        await page.getByTestId('invalid-lines').locator(':scope > span > span[aria-hidden="true"]').count(),
        1,
    );
    const coffee = await block.evaluate((el) => getComputedStyle(el).backgroundImage);
    await page.evaluate(() => {
        document.documentElement.dataset.theme = 'nature-light';
    });
    const nature = await block.evaluate((el) => getComputedStyle(el).backgroundImage);
    assert.notEqual(coffee, nature);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await block.evaluate((el) => getComputedStyle(el).animationName), 'none');
    assert.equal(await page.getByRole('button', { name: 'Сохраняем…' }).isDisabled(), true);
    await page.getByRole('status').filter({ hasText: 'Загружаем страницу…' }).waitFor();
    await page.screenshot({ path: fileURLToPath(new URL('arc-loading-mobile.png', output)), fullPage: true });
    pass('Arc props, line clamp, theme colors, reduced motion and loader semantics');
    assert.deepEqual(errors, []);
    pass('no browser runtime errors');
} finally {
    await writeFile(new URL('profile-ui-results.json', output), JSON.stringify({ results, errors }, null, 2));
    await browser.close();
}
