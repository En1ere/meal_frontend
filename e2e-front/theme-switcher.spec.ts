import { expect, test, type Page } from '@playwright/test';

const themes = ['coffee-light', 'coffee-dark', 'nature-light', 'nature-dark'] as const;

async function assertThemeControl(page: Page) {
    let switcher = page.getByLabel('Тема интерфейса').filter({ visible: true }).first();
    if (!(await switcher.isVisible().catch(() => false))) {
        await page.getByRole('button', { name: 'Ещё', exact: true }).click();
        switcher = page.getByLabel('Тема интерфейса').filter({ visible: true }).first();
    }
    await expect(switcher).toBeVisible({ timeout: 30_000 });
    await expect(switcher.locator('option')).toHaveCount(themes.length);
    for (const theme of themes) {
        await switcher.selectOption(theme);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        expect(await page.evaluate(() => localStorage.getItem('meal-theme'))).toBe(theme);
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'nature-dark');
}

async function login(page: Page) {
    await page.goto('/auth', { waitUntil: 'domcontentloaded' });
    const submit = page.getByRole('button', { name: 'Войти', exact: true });
    await expect(submit).toBeEnabled({ timeout: 30_000 });
    await page.getByLabel('Электронная почта').fill('pro1@meal-planner.test');
    await page.getByLabel('Пароль').fill('1');
    await submit.click();
    await page.waitForURL((url) => url.pathname === '/', { timeout: 30_000 });
}

test('applies and persists every public theme before hydration', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('meal-theme', 'nature-dark'));
    await page.goto('/auth', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'nature-dark');
    await assertThemeControl(page);
});

test('keeps the theme switcher functional in the authenticated shell', async ({ page }) => {
    await login(page);
    await assertThemeControl(page);
});
