import { expect, test } from '@playwright/test';

for (const path of ['/dev/mailbox', '/dev/ui'] as const) {
    test(`${path} is unavailable from the production server`, async ({ page }) => {
        const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
        expect(response?.status(), `${path}: production document status`).toBe(404);
        await expect(page.locator('body')).not.toContainText(
            path === '/dev/mailbox' ? 'Тестовая почта' : 'Loading primitives',
        );
    });
}
