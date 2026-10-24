import { expect, test, type Page } from '@playwright/test';

async function ensureServiceWorker(page: Page) {
    await page.evaluate(() => navigator.serviceWorker.ready);
    if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) await page.reload();
    await page.evaluate(async () => {
        await fetch('/api/v1/auth/me', { credentials: 'include' });
    });
}

async function login(page: Page, returnTo = '/', beforeSubmit?: () => Promise<void>) {
    await page.goto(returnTo === '/' ? '/auth' : `/auth?returnTo=${encodeURIComponent(returnTo)}`);
    await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    await ensureServiceWorker(page);
    await beforeSubmit?.();
    await page.getByLabel('Электронная почта', { exact: true }).fill('user1@meal-planner.test');
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL((url) => url.pathname === returnTo);
    await expect(page.getByRole('link', { name: /^Профиль:/u })).toBeVisible({ timeout: 30_000 });
}

async function setAiConsent(page: Page, enabled: boolean) {
    await page.evaluate(
        (nextEnabled) =>
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
                        const user = state.users.find((candidate: { login: string }) => candidate.login === 'user1');
                        const consent = state.legal[user.id].consents.ai_data_access;
                        consent.enabled = nextEnabled;
                        consent.revision += 1;
                        consent.changedAt = new Date().toISOString();
                        consent.document = null;
                        store.put(state, 'current');
                    };
                    transaction.oncomplete = () => {
                        database.close();
                        resolve();
                    };
                    transaction.onabort = () => reject(transaction.error);
                };
            }),
        enabled,
    );
}

test('AI run is blocked with a consent CTA when backend reports revocation after preview', async ({ page }) => {
    await login(page, '/ai', () => setAiConsent(page, true));
    await page.getByLabel('Запрос').fill('Что приготовить из моих запасов?');
    await page.getByLabel('Использовать разрешённые данные профиля и личных запасов').check();
    await page.getByLabel('Я принимаю правила использования и списания AI-действий').check();
    await page.getByRole('button', { name: 'Рассчитать стоимость' }).click();
    await expect(page.getByRole('heading', { name: 'Подтвердите запуск' })).toBeVisible();

    await setAiConsent(page, false);
    await page.getByRole('button', { name: 'Подтвердить и запустить' }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'Согласие было отозвано после предпросмотра' });
    await expect(alert).toBeVisible();
    await expect(alert.getByRole('link', { name: 'Ознакомиться и согласиться' })).toHaveAttribute(
        'href',
        '/settings/privacy?consent=ai_data_access&returnTo=/ai',
    );
    await expect(page.getByRole('heading', { name: 'Подтвердите запуск' })).toBeVisible();
});
