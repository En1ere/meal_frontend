import { qaRoot } from '../../scripts/qa-output.mjs';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '@playwright/test');
const origin = process.env.FRONT_QA_ORIGIN ?? 'http://127.0.0.1:3000';
const output = new URL('', qaRoot());
const iteration = process.env.CONSENT_ITERATION ?? 'adhoc';
if (!/^(?:I[1-3]|adhoc)$/u.test(iteration)) throw new Error(`Unsupported CONSENT_ITERATION: ${iteration}`);
const iterationOutput = new URL(`consent-iterations/${iteration}/`, output);
await mkdir(output, { recursive: true });
await mkdir(iterationOutput, { recursive: true });
const startedAt = new Date().toISOString();
const packageManifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
});
let context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
let page = await context.newPage();
page.setDefaultTimeout(30000);
const results = [];
const errors = [];
const apiFailures = [];
let fatalError = null;
let failureUrl = null;
let failureText = null;
const observePage = () => {
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
        const expectedUnauthenticatedProbe =
            response.status() === 401 && new URL(response.url()).pathname === '/api/v1/auth/me';
        if (response.url().includes('/api/v1/') && response.status() >= 400 && !expectedUnauthenticatedProbe)
            apiFailures.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    });
};
observePage();
const pass = (name) => {
    results.push(name);
    console.log(`PASS ${name}`);
};

async function goto(path) {
    await page.goto(origin + path, { waitUntil: 'domcontentloaded' });
}

async function ensureServiceWorker() {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            await page.evaluate(() => navigator.serviceWorker.ready);
            if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))))
                await page.reload({ waitUntil: 'domcontentloaded' });
            return;
        } catch (error) {
            if (
                !(error instanceof Error) ||
                !error.message.includes('Execution context was destroyed') ||
                attempt === 3
            )
                throw error;
            await page.waitForLoadState('domcontentloaded');
        }
    }
}

async function revokeIfGranted(kind, returnTo) {
    await goto(`/settings/privacy?consent=${kind}&returnTo=${encodeURIComponent(returnTo)}`);
    const card = page.locator(`section[aria-labelledby="consent-${kind}"]`);
    await card.waitFor();
    const revoke = card.getByRole('button', { name: 'Отозвать', exact: true });
    if ((await revoke.count()) > 0) {
        await revoke.click();
        await card.getByRole('button', { name: 'Ознакомился и согласен', exact: true }).waitFor();
    }
    await page.getByRole('link', { name: 'Вернуться к функции', exact: true }).click();
    await page.waitForURL(origin + returnTo);
}

async function loginFresh() {
    await goto('/auth');
    await ensureServiceWorker();
    await page.getByLabel('Электронная почта', { exact: true }).fill('plus1@meal-planner.test');
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL(origin + '/');
}

async function resetSession() {
    await context.close();
    context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    page = await context.newPage();
    page.setDefaultTimeout(30000);
    observePage();
    await loginFresh();
}

try {
    await loginFresh();

    await goto('/ai');
    const personal = page.getByRole('checkbox', {
        name: 'Использовать разрешённые данные профиля и личных запасов',
    });
    await page.getByText('Личные данные для AI заблокированы', { exact: true }).waitFor();
    assert.equal(await personal.isDisabled(), true);
    pass('AI personal-data option is blocked and explains how to grant consent');

    await page.getByRole('link', { name: 'Открыть документы и согласия', exact: true }).click();
    await page.waitForURL('**/settings/privacy?consent=ai_data_access&returnTo=/ai');
    const consentCard = page.getByRole('region', { name: 'Использование личных данных в AI', exact: true });
    await consentCard.getByRole('button', { name: 'Ознакомился и согласен', exact: true }).click();
    await consentCard.getByRole('button', { name: 'Отозвать', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Вернуться к функции', exact: true }).click();
    await page.waitForURL(origin + '/ai');
    assert.equal(await personal.isEnabled(), true);
    await personal.check();
    assert.equal(await personal.isChecked(), true);
    pass('granting AI consent returns to the feature and enables personal data');

    await goto('/settings/privacy?consent=ai_data_access&returnTo=/ai');
    await consentCard.getByRole('button', { name: 'Отозвать', exact: true }).click();
    await consentCard.getByRole('button', { name: 'Ознакомился и согласен', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Вернуться к функции', exact: true }).click();
    await page.waitForURL(origin + '/ai');
    assert.equal(await personal.isDisabled(), true);
    assert.equal(await personal.isChecked(), false);
    await page.getByText('Личные данные для AI заблокированы', { exact: true }).waitFor();
    await goto('/settings/privacy?consent=ai_data_access&returnTo=/ai');
    await consentCard.waitFor();
    await page.waitForTimeout(750);
    await consentCard.getByRole('button', { name: 'Ознакомился и согласен', exact: true }).click();
    await consentCard.getByRole('button', { name: 'Отозвать', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Вернуться к функции', exact: true }).click();
    await page.waitForURL(origin + '/ai');
    assert.equal(await personal.isEnabled(), true);
    await personal.check();
    assert.equal(await personal.isChecked(), true);
    pass('revoking AI consent blocks and clears personal data; reaccepting enables it again');

    await resetSession();
    await goto('/settings/preferences');
    const allergens = page.getByRole('group', { name: 'Аллергены', exact: true });
    await page
        .getByText('Настройка аллергенов заблокирована до отдельного согласия на данные о здоровье.', {
            exact: false,
        })
        .waitFor();
    assert.equal(await allergens.getByRole('checkbox').first().isDisabled(), true);
    await page.getByRole('link', { name: 'Ознакомиться и согласиться', exact: true }).click();
    const healthCard = page.getByRole('region', { name: 'Данные о здоровье и питании', exact: true });
    await page.waitForURL('**/settings/privacy?consent=special_category&returnTo=/settings/preferences');
    await healthCard.waitFor();
    await page.waitForTimeout(750);
    await healthCard.getByRole('button', { name: 'Ознакомился и согласен', exact: true }).click();
    await healthCard.getByRole('button', { name: 'Отозвать', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Вернуться к функции', exact: true }).click();
    await page.waitForURL(origin + '/settings/preferences');
    assert.equal(await allergens.getByRole('checkbox').first().isEnabled(), true);
    await goto('/settings/privacy?consent=special_category&returnTo=/settings/preferences');
    await healthCard.getByRole('button', { name: 'Отозвать', exact: true }).click();
    await healthCard.getByRole('button', { name: 'Ознакомился и согласен', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Вернуться к функции', exact: true }).click();
    await page.waitForURL(origin + '/settings/preferences');
    assert.equal(await allergens.getByRole('checkbox').first().isDisabled(), true);
    await goto('/settings/privacy?consent=special_category&returnTo=/settings/preferences');
    await healthCard.waitFor();
    await page.waitForTimeout(750);
    await healthCard.getByRole('button', { name: 'Ознакомился и согласен', exact: true }).click();
    await healthCard.getByRole('button', { name: 'Отозвать', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Вернуться к функции', exact: true }).click();
    await page.waitForURL(origin + '/settings/preferences');
    assert.equal(await allergens.getByRole('checkbox').first().isEnabled(), true);
    pass('special-category grant, revocation and reacceptance toggle allergen settings');

    await resetSession();
    await revokeIfGranted('dissemination', '/recipes/mine');
    const publicationBlocked = page.getByText('Новые публикации заблокированы', { exact: true });
    await publicationBlocked.waitFor();
    await page.getByRole('link', { name: 'Ознакомиться и согласиться', exact: true }).click();
    const publicationCard = page.locator('section[aria-labelledby="consent-dissemination"]');
    await publicationCard.waitFor();
    await page.waitForTimeout(750);
    await publicationCard.getByRole('button', { name: 'Ознакомился и согласен', exact: true }).click();
    await publicationCard.getByRole('button', { name: 'Отозвать', exact: true }).waitFor();
    await goto('/recipes/mine');
    await publicationBlocked.waitFor({ state: 'detached' });
    await goto('/settings/privacy?consent=dissemination&returnTo=/recipes/mine');
    await publicationCard.waitFor();
    await page.waitForTimeout(750);
    await publicationCard.getByRole('button', { name: 'Отозвать', exact: true }).click();
    await publicationCard.getByRole('button', { name: 'Ознакомился и согласен', exact: true }).waitFor();
    await goto('/recipes/mine');
    await publicationBlocked.waitFor();
    await goto('/settings/privacy?consent=dissemination&returnTo=/recipes/mine');
    await publicationCard.waitFor();
    await page.waitForTimeout(750);
    await publicationCard.getByRole('button', { name: 'Ознакомился и согласен', exact: true }).click();
    await publicationCard.getByRole('button', { name: 'Отозвать', exact: true }).waitFor();
    await goto('/recipes/mine');
    await publicationBlocked.waitFor({ state: 'detached' });
    pass('dissemination grant, revocation and reacceptance toggle publication controls');

    await resetSession();
    await revokeIfGranted('marketing', '/settings/notifications');
    const marketingState = page.getByText(/Маркетинговые сообщения:/u);
    await marketingState.filter({ hasText: 'не разрешены' }).waitFor();
    await page.getByRole('link', { name: 'Управлять согласием', exact: true }).click();
    const marketingCard = page.locator('section[aria-labelledby="consent-marketing"]');
    await marketingCard.waitFor();
    await page.waitForTimeout(750);
    await marketingCard.getByRole('button', { name: 'Ознакомился и согласен', exact: true }).click();
    await marketingCard.getByRole('button', { name: 'Отозвать', exact: true }).waitFor();
    await goto('/settings/notifications');
    await marketingState.filter({ hasText: 'разрешены' }).waitFor();
    await goto('/settings/privacy?consent=marketing&returnTo=/settings/notifications');
    await marketingCard.waitFor();
    await page.waitForTimeout(750);
    await marketingCard.getByRole('button', { name: 'Отозвать', exact: true }).click();
    await marketingCard.getByRole('button', { name: 'Ознакомился и согласен', exact: true }).waitFor();
    await goto('/settings/notifications');
    await marketingState.filter({ hasText: 'не разрешены' }).waitFor();
    await goto('/settings/privacy?consent=marketing&returnTo=/settings/notifications');
    await marketingCard.waitFor();
    await page.waitForTimeout(750);
    await marketingCard.getByRole('button', { name: 'Ознакомился и согласен', exact: true }).click();
    await marketingCard.getByRole('button', { name: 'Отозвать', exact: true }).waitFor();
    await goto('/settings/notifications');
    await marketingState.filter({ hasText: 'разрешены' }).waitFor();
    pass('marketing grant, revocation and reacceptance toggle eligibility without hiding service preferences');

    await goto('/settings/privacy');
    await page.getByText('Выдано', { exact: false }).first().waitFor();
    await page.getByText('Отозвано', { exact: false }).first().waitFor();
    assert.deepEqual(errors, []);
    assert.deepEqual(apiFailures, []);
    pass('consent grant and revocation are present in history without runtime errors');
} catch (error) {
    fatalError = error instanceof Error ? error.message : String(error);
    failureUrl = page.url();
    failureText = (
        await page
            .locator('body')
            .innerText()
            .catch(() => '')
    ).slice(0, 2000);
    console.error(`FAILED_URL ${failureUrl}`);
    console.error(`FAILED_BODY ${failureText}`);
    throw error;
} finally {
    const report = {
        version: 2,
        status: errors.length === 0 && fatalError === null ? 'passed' : 'failed',
        iteration,
        sourceVersion: packageManifest.version,
        startedAt,
        finishedAt: new Date().toISOString(),
        results,
        errors,
        apiFailures,
        fatalError,
        failureUrl,
        failureText,
    };
    const serializedReport = JSON.stringify(report, null, 2) + '\n';
    await writeFile(new URL('results.json', iterationOutput), serializedReport);
    await writeFile(new URL('legal-consent-gates-results.json', output), serializedReport);
    await browser.close();
}
