import { expect, test, type Page } from '@playwright/test';

async function ensureServiceWorker(page: Page) {
    await page.evaluate(() => navigator.serviceWorker.ready);
    if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) await page.reload();
}

async function login(page: Page, returnTo = '/') {
    const target = new URL(returnTo, 'http://localhost:3000');
    await page.goto(returnTo === '/' ? '/auth' : `/auth?returnTo=${encodeURIComponent(returnTo)}`);
    await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    await ensureServiceWorker(page);
    await page.getByLabel('Электронная почта', { exact: true }).fill('pro1@meal-planner.test');
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL((url) => url.pathname === target.pathname && url.search === target.search, {
        timeout: 60_000,
    });
}

async function expirePersonalSubscription(page: Page) {
    await page.evaluate(
        () =>
            new Promise<void>((resolve, reject) => {
                const open = indexedDB.open('meal-planner-api-v1-mock', 1);
                open.onerror = () => reject(open.error);
                open.onsuccess = () => {
                    const database = open.result;
                    const transaction = database.transaction('state', 'readwrite');
                    const store = transaction.objectStore('state');
                    const read = store.get('current');
                    read.onerror = () => reject(read.error);
                    read.onsuccess = () => {
                        const state = read.result;
                        const user = state.users.find((candidate: { login: string }) => candidate.login === 'pro1');
                        const record = state.subscription.records.find(
                            (candidate: { userId: string }) => candidate.userId === user.id,
                        );
                        if (!record || record.autoRenew) {
                            reject(new Error('Expected a persisted personal subscription with disabled renewal'));
                            return;
                        }
                        record.endsAt = '2000-01-01T00:00:00.000Z';
                        store.put(state, 'current');
                    };
                    transaction.oncomplete = () => {
                        database.close();
                        resolve();
                    };
                    transaction.onabort = () => reject(transaction.error);
                };
            }),
    );
}

test('disabled Pro renewal expires to Free after the paid boundary and survives reload', async ({ page }) => {
    await login(page, '/settings/subscription');
    await expect(page.getByRole('heading', { name: 'Подписка и квоты' })).toBeVisible();
    const currentPlan = page.locator('section[aria-labelledby="current-plan-title"]');
    await expect(currentPlan).toContainText('Pro');

    await page.getByRole('button', { name: 'Отключить продление', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Отключить продление', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    const renewal = page.getByRole('region', { name: 'Продление', exact: true });
    await expect(renewal).toContainText('Выключено');
    await expect(page.getByRole('button', { name: 'Включить продление', exact: true })).toBeVisible();

    await expirePersonalSubscription(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Проверяем сессию', { exact: true })).toHaveCount(0, { timeout: 30_000 });
    await expect(currentPlan).toContainText('Free');
    await expect(currentPlan).toContainText('Бесплатно');
    await expect(page.getByRole('button', { name: 'Отключить продление', exact: true })).toHaveCount(0);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('section[aria-labelledby="current-plan-title"]')).toContainText('Free');
});
