import { qaRoot } from '../../scripts/qa-output.mjs';
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { generateSync } from 'otplib';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '@playwright/test');
const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const output = new URL('', qaRoot());
await mkdir(output, { recursive: true });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.setDefaultTimeout(20000);
try {
    await page.goto('http://localhost:3002/settings/recipes');
    await page.getByLabel('Логин', { exact: true }).fill('admin');
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
    const secret = await page.locator('.enrollment code').textContent();
    await page.getByLabel('Код из приложения', { exact: true }).fill(generateSync({ secret }));
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await page.getByRole('heading', { name: 'Сохраните резервные коды' }).waitFor();
    const recovery = await page.locator('.recovery-codes code').allTextContents();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await page.getByRole('heading', { name: 'Рецепты и антиспам', exact: true }).waitFor();
    await page.getByLabel('Отправок рецептов на модерацию за 24 часа').fill('12');
    await page.getByRole('button', { name: 'Сохранить ограничения' }).click();
    await page.getByRole('alert').filter({ hasText: 'Подтвердите' }).waitFor();
    await page.getByRole('button', { name: 'Подтвердить резервным кодом' }).click();
    await page.getByLabel('Резервный код подтверждения').fill(recovery[0]);
    await page.getByRole('button', { name: 'Подтвердить критичные действия' }).click();
    await page.getByRole('status').filter({ hasText: 'Действия подтверждены' }).waitFor();
    await page.getByRole('button', { name: 'Сохранить ограничения' }).click();
    await page.getByRole('button', { name: 'Перечитать настройки' }).click();
    assert.equal(await page.getByLabel('Отправок рецептов на модерацию за 24 часа').inputValue(), '12');
    for (const [name, viewport] of [
        ['desktop', { width: 1440, height: 1000 }],
        ['mobile', { width: 390, height: 844 }],
    ]) {
        await page.setViewportSize(viewport);
        assert.ok(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth));
        await page.screenshot({ path: fileURLToPath(new URL(`recipe-policy-${name}.png`, output)), fullPage: true });
    }
    assert.deepEqual(errors, []);
    await writeFile(
        new URL('recipe-policy-results.json', output),
        JSON.stringify(
            {
                passed: [
                    'guest guard and returnTo',
                    'MFA enrollment',
                    'critical guard',
                    'persist and read settings',
                    'desktop/mobile no overflow',
                ],
                errors,
            },
            null,
            2,
        ),
    );
    console.log('PASS recipe policy desktop/mobile workflow');
} finally {
    await browser.close();
}
