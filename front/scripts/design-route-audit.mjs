import { qaRoot } from '../../scripts/qa-output.mjs';
/* global document, innerWidth, innerHeight, getComputedStyle, HTMLInputElement */
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSync } from 'otplib';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '@playwright/test');
const origin = process.env.FRONT_QA_ORIGIN ?? 'http://localhost:3000';
const appRoot = fileURLToPath(new URL('../src/app/', import.meta.url));
const output = fileURLToPath(new URL('design-route-audit.json', qaRoot()));
const progressOutput = fileURLToPath(new URL('design-route-audit.progress.json', qaRoot()));
const failureDir = fileURLToPath(new URL('route-audit-failures/', qaRoot()));
const evidenceDir = fileURLToPath(new URL('route-audit-evidence/', qaRoot()));
const recheckPattern = process.env.FRONT_QA_RECHECK ? new RegExp(process.env.FRONT_QA_RECHECK) : null;
const capturePattern = process.env.FRONT_QA_CAPTURE ? new RegExp(process.env.FRONT_QA_CAPTURE) : null;
const onlyPattern = process.env.FRONT_QA_ONLY ? new RegExp(process.env.FRONT_QA_ONLY) : null;
const recipeId = '70000000-0000-4000-8000-000000000001';
const genericId = '00000000-0000-4000-8000-000000000001';

async function collectPages(directory, segments = []) {
    const entries = await readdir(directory, { withFileTypes: true });
    const routes = [];
    for (const entry of entries) {
        if (entry.isDirectory())
            routes.push(...(await collectPages(path.join(directory, entry.name), [...segments, entry.name])));
        else if (entry.name === 'page.tsx') routes.push('/' + segments.join('/'));
    }
    return routes;
}

function materialize(pattern) {
    return (
        pattern
            .replaceAll('[username]', 'user1')
            .replaceAll('[token]', 'invalid-preview-token')
            .replaceAll('[queue]', 'recipes')
            .replaceAll('[id]', pattern.startsWith('/recipes/') ? recipeId : genericId)
            .replaceAll('//', '/') || '/'
    );
}

function guestRoute(pattern) {
    return /^(\/about|\/auth(?:\/|$)|\/authors(?:\/|$)|\/community$|\/help$|\/legal(?:\/|$)|\/news(?:\/|$)|\/pricing$|\/recipes\/\[id\]$|\/moderation(?:\/|$)|\/dev\/mailbox$)/.test(
        pattern,
    );
}

async function login(page, account = 'pro1') {
    await page.goto(origin + '/auth', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.getByLabel('Электронная почта', { exact: true }).fill(`${account}@meal-planner.test`);
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/', { timeout: 60000 });
}

async function loginModerator(page) {
    await page.goto(origin + '/moderation/sign-in', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByText('Тестовые аккаунты', { exact: true }).waitFor();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.getByLabel('Электронная почта', { exact: true }).fill('moderator@meal-planner.test');
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/moderation/mfa', { timeout: 60000 });
    const secret = await page.locator('.enrollment code').textContent();
    assert.ok(secret);
    await page.getByLabel('Код из приложения').fill(generateSync({ secret, period: 30, digits: 6 }));
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    const recoveryConfirmation = page.getByLabel('Я сохранил резервные коды');
    await Promise.race([
        recoveryConfirmation.waitFor({ state: 'visible', timeout: 60000 }),
        page.waitForURL((url) => url.pathname === '/moderation', { timeout: 60000 }),
    ]);
    if (new URL(page.url()).pathname === '/moderation') return;
    if (await recoveryConfirmation.isVisible()) {
        await recoveryConfirmation.check();
        await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
    }
    await page.waitForURL((url) => url.pathname === '/moderation', { timeout: 60000 });
}

async function auditPage(page, pattern, viewportName) {
    const requested = materialize(pattern);
    const pageErrors = [];
    const apiErrors = [];
    const responseTasks = [];
    const onPageError = (error) => pageErrors.push(error.message);
    const onResponse = (response) => {
        if (response.status() < 400 || !response.url().includes('/api/')) return;
        responseTasks.push(
            response
                .text()
                .then((body) =>
                    apiErrors.push({ url: response.url(), status: response.status(), body: body.slice(0, 500) }),
                )
                .catch(() => undefined),
        );
    };
    page.on('pageerror', onPageError);
    page.on('response', onResponse);
    let navigationError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            // Dynamic error pages may schedule a client-side redirect after the
            // audit has already moved on. Detach the previous document first so
            // that a late router.replace() cannot abort the next route's goto().
            await page.goto('about:blank', { waitUntil: 'load', timeout: 15000 });
            await page.goto(origin + requested, { waitUntil: 'domcontentloaded', timeout: 60000 });
            navigationError = null;
            break;
        } catch (error) {
            navigationError = error instanceof Error ? error.message : String(error);
            if (attempt < 2) await page.waitForTimeout(1000);
        }
    }
    if (!navigationError) {
        await page
            .waitForFunction(() => !document.body.innerText.includes('Проверяем сессию'), undefined, { timeout: 15000 })
            .catch(() => undefined);
        await page.waitForTimeout(300);
    }
    let metrics;
    let metricsError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
            metrics = await page.evaluate(() => {
                const visible = (element) => {
                    const style = getComputedStyle(element);
                    const rect = element.getBoundingClientRect();
                    return (
                        style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0
                    );
                };
                const controls = Array.from(
                    document.querySelectorAll(
                        'button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, a.button, nav a',
                    ),
                )
                    .filter(visible)
                    .map((element) => {
                        const labelledTarget =
                            element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type)
                                ? element.closest('label')
                                : null;
                        const rect = (
                            labelledTarget && visible(labelledTarget) ? labelledTarget : element
                        ).getBoundingClientRect();
                        return {
                            tag: element.tagName,
                            text: (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 80),
                            width: Math.round(rect.width),
                            height: Math.round(rect.height),
                        };
                    })
                    .filter((control) => control.width < 44 || control.height < 44)
                    .slice(0, 20);
                const layers = Array.from(document.querySelectorAll('body *'))
                    .filter((element) => {
                        const position = getComputedStyle(element).position;
                        return visible(element) && (position === 'fixed' || position === 'sticky');
                    })
                    .map((element) => {
                        const rect = element.getBoundingClientRect();
                        return {
                            tag: element.tagName,
                            text: (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 50),
                            left: rect.left,
                            top: rect.top,
                            right: rect.right,
                            bottom: rect.bottom,
                        };
                    });
                const overlaps = [];
                for (let left = 0; left < layers.length; left++)
                    for (let right = left + 1; right < layers.length; right++) {
                        const a = layers[left];
                        const b = layers[right];
                        const area =
                            Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
                            Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
                        if (area > 16) overlaps.push({ a: a.text, b: b.text, area: Math.round(area) });
                    }
                return {
                    title: document.title,
                    heading: document.querySelector('h1')?.textContent?.trim() ?? null,
                    bodyText: document.body.innerText.slice(0, 500),
                    innerWidth,
                    innerHeight,
                    scrollWidth: document.documentElement.scrollWidth,
                    smallControls: controls,
                    fixedOverlaps: overlaps.slice(0, 10),
                };
            });
            metricsError = null;
            break;
        } catch (error) {
            metricsError = error instanceof Error ? error.message : String(error);
            await page.waitForTimeout(300);
        }
    }
    metrics ??= {
        title: '',
        heading: null,
        bodyText: '',
        innerWidth: 0,
        innerHeight: 0,
        scrollWidth: 0,
        smallControls: [],
        fixedOverlaps: [],
    };
    page.off('pageerror', onPageError);
    page.off('response', onResponse);
    await Promise.allSettled(responseTasks);
    const result = {
        pattern,
        requested,
        actual: new URL(page.url()).pathname,
        viewport: viewportName,
        navigationError,
        metricsError,
        pageErrors,
        apiErrors,
        ...metrics,
        horizontalOverflow: metrics.scrollWidth > metrics.innerWidth + 1,
    };
    if (result.navigationError || result.metricsError || result.pageErrors.length || result.horizontalOverflow) {
        const name = `${viewportName}-${pattern.replaceAll('/', '_').replaceAll('[', '').replaceAll(']', '') || '_root'}.png`;
        try {
            await page.screenshot({ path: path.join(failureDir, name), fullPage: true, timeout: 15000 });
        } catch (error) {
            result.screenshotError = error instanceof Error ? error.message : String(error);
        }
    }
    if (capturePattern?.test(pattern)) {
        const name = `${viewportName}-${pattern.replaceAll('/', '_').replaceAll('[', '').replaceAll(']', '') || '_root'}.png`;
        await page.screenshot({ path: path.join(evidenceDir, name), fullPage: true, timeout: 15000 });
    }
    return result;
}

async function readProgress() {
    try {
        const progress = JSON.parse(await readFile(progressOutput, 'utf8'));
        return Array.isArray(progress.results) ? progress.results : [];
    } catch {
        return [];
    }
}

async function saveProgress(patterns, results) {
    await writeFile(
        progressOutput,
        JSON.stringify(
            {
                routePatterns: patterns.length,
                completedChecks: results.length,
                results,
            },
            null,
            2,
        ),
    );
}

const patterns = (await collectPages(appRoot)).sort();
assert.equal(patterns.length, 117);
await mkdir(path.dirname(output), { recursive: true });
await mkdir(failureDir, { recursive: true });
await mkdir(evidenceDir, { recursive: true });
const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
});
const results = (await readProgress()).filter((result) => !recheckPattern?.test(result.pattern));
const completed = new Set(results.map((result) => `${result.viewport}:${result.pattern}`));
try {
    for (const viewport of [
        { name: 'desktop', width: 1440, height: 1000 },
        { name: 'mobile', width: 390, height: 844 },
    ]) {
        const authContext = await browser.newContext({ viewport });
        const authPage = await authContext.newPage();
        authPage.setDefaultTimeout(60000);
        await login(authPage);
        const familyContext = await browser.newContext({ viewport });
        const familyPage = await familyContext.newPage();
        familyPage.setDefaultTimeout(60000);
        await login(familyPage, 'plus1');
        const moderatorContext = await browser.newContext({ viewport });
        const moderatorPage = await moderatorContext.newPage();
        moderatorPage.setDefaultTimeout(60000);
        await loginModerator(moderatorPage);
        const guestContext = await browser.newContext({ viewport });
        const guestPage = await guestContext.newPage();
        guestPage.setDefaultTimeout(60000);
        for (const pattern of patterns) {
            if (onlyPattern && !onlyPattern.test(pattern)) continue;
            if (completed.has(`${viewport.name}:${pattern}`)) {
                console.log(`SKIP ${viewport.name} ${pattern}`);
                continue;
            }
            const target = pattern.startsWith('/moderation')
                ? moderatorPage
                : guestRoute(pattern)
                  ? guestPage
                  : pattern.startsWith('/family')
                    ? familyPage
                    : authPage;
            const result = await auditPage(target, pattern, viewport.name);
            results.push(result);
            completed.add(`${viewport.name}:${pattern}`);
            await saveProgress(patterns, results);
            console.log(
                `${result.horizontalOverflow || result.navigationError || result.metricsError || result.pageErrors.length ? 'FAIL' : 'PASS'} ${viewport.name} ${pattern}`,
            );
        }
        await authContext.close();
        await familyContext.close();
        await moderatorContext.close();
        await guestContext.close();
    }
} finally {
    await browser.close();
}
const summary = {
    routePatterns: patterns.length,
    checks: results.length,
    horizontalOverflow: results.filter((result) => result.horizontalOverflow).length,
    navigationErrors: results.filter((result) => result.navigationError).length,
    metricsErrors: results.filter((result) => result.metricsError).length,
    pageErrors: results.filter((result) => result.pageErrors.length).length,
    apiErrorPages: results.filter((result) => result.apiErrors?.length).length,
    smallControlPages: results.filter((result) => result.smallControls.length).length,
    fixedOverlapPages: results.filter((result) => result.fixedOverlaps.length).length,
};
await writeFile(output, JSON.stringify({ summary, results }, null, 2));
console.log(JSON.stringify(summary));
