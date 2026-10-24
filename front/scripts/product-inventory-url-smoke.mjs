import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '@playwright/test');
const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
});
const page = await browser.newPage();
page.setDefaultTimeout(30000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const goto = (path) => page.goto('http://localhost:3000' + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
try {
    await goto('/auth');
    await page.evaluate(() => navigator.serviceWorker.ready);
    if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))))
        await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    await page.getByLabel('Электронная почта', { exact: true }).fill('user1@meal-planner.test');
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await goto('/products/10000000-0000-4000-8000-000000000001?tab=nutrition');
    const nutrition = page.getByRole('button', { name: 'Пищевая ценность', exact: true });
    await nutrition.waitFor();
    assert.equal(await nutrition.getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Аллергены и состав', exact: true }).click();
    await page.waitForURL('**/*tab=allergens');
    await page.reload();
    await page.getByRole('button', { name: 'Аллергены и состав', exact: true }).waitFor();
    assert.equal(
        await page.getByRole('button', { name: 'Аллергены и состав', exact: true }).getAttribute('aria-pressed'),
        'true',
    );
    await page.goBack();
    await page.waitForURL('**/*tab=nutrition');
    assert.equal(await nutrition.getAttribute('aria-pressed'), 'true');
    await page.goForward();
    await page.waitForURL('**/*tab=allergens');
    console.log('PASS product direct tab, reload, back and forward');
    await goto('/inventory?attention=unknown');
    const attention = page.getByRole('combobox', { name: /^Срок/ });
    await attention.waitFor();
    assert.equal(await attention.inputValue(), 'unknown');
    await attention.selectOption('expiring');
    await page.waitForURL('**/*attention=expiring*');
    await page.goBack();
    await page.waitForURL('**/*attention=unknown*');
    assert.equal(await attention.inputValue(), 'unknown');
    console.log('PASS inventory filter browser history');
    await goto('/inventory/history?q=Milk&action=purchase&from=2026-09-01');
    await page.getByLabel('Поиск продукта', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Поиск продукта', { exact: true }).inputValue(), 'Milk');
    assert.equal(await page.getByLabel('С даты', { exact: true }).inputValue(), '2026-09-01');
    const action = page.getByRole('combobox', { name: /^Операция/ });
    await action.selectOption('consume');
    await page.waitForURL('**/*action=consume*');
    await page.reload();
    await action.waitFor();
    assert.equal(await action.inputValue(), 'consume');
    await page.goBack();
    await page.waitForURL('**/*action=purchase*');
    assert.equal(await action.inputValue(), 'purchase');
    console.log('PASS history filters survive direct URL, reload and back');
    await goto('/inventory/new?q=Молоко');
    await page.getByLabel('Поиск в каталоге', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Поиск в каталоге', { exact: true }).inputValue(), 'Молоко');
    console.log('PASS new batch catalog search direct URL');
    assert.deepEqual(errors, []);
} finally {
    await browser.close();
}
