import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { dirname, isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const version = 'meal-frontend-production-acceptance-v1';
export const devices = ['desktop-chromium', 'mobile-chromium'];
export const checks = [
    'health-live',
    'health-ready',
    'public-about',
    'public-community',
    'public-pricing',
    'public-not-found',
    'anonymous-auth',
    'protected-redirect',
    'external-return-to-blocked',
    'admin-anonymous-redirect',
    'no-mutation-requests',
    'no-runtime-errors',
];
const releaseNames = ['frontendRoot', 'frontendApp', 'backend', 'admin', 'openapiSnapshot'];
const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

function fail(message) {
    throw new Error(`Invalid production acceptance target: ${message}`);
}

function publicHttpsOrigin(value, name) {
    if (typeof value !== 'string') fail(`${name} must be a string`);
    let url;
    try {
        url = new URL(value);
    } catch {
        fail(`${name} must be an URL`);
    }
    if (
        url.protocol !== 'https:' ||
        url.origin !== value ||
        url.username ||
        url.password ||
        isIP(url.hostname) !== 0 ||
        url.hostname === 'localhost'
    )
        fail(`${name} must be a public HTTPS origin`);
    return value;
}

export function validateTarget(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('expected an object');
    const allowed = new Set([
        'version',
        'publicOrigin',
        'adminOrigin',
        'apiOrigin',
        'release',
        'allowMutations',
        'acknowledgedAt',
    ]);
    const extra = Object.keys(raw).filter((key) => !allowed.has(key));
    if (extra.length) fail(`unexpected fields: ${extra.join(', ')}`);
    if (raw.version !== version) fail(`version must be ${version}`);
    if (raw.allowMutations !== false) fail('allowMutations must be false');
    if (typeof raw.acknowledgedAt !== 'string' || Number.isNaN(Date.parse(raw.acknowledgedAt)))
        fail('acknowledgedAt must be an ISO timestamp');
    if (!raw.release || typeof raw.release !== 'object' || Array.isArray(raw.release)) fail('release is required');
    if (
        Object.keys(raw.release).length !== releaseNames.length ||
        releaseNames.some((name) => !/^\d+\.\d+\.\d+$/.test(raw.release[name] ?? ''))
    )
        fail(`release must contain only semver fields: ${releaseNames.join(', ')}`);
    return {
        version,
        publicOrigin: publicHttpsOrigin(raw.publicOrigin, 'publicOrigin'),
        adminOrigin: publicHttpsOrigin(raw.adminOrigin, 'adminOrigin'),
        apiOrigin: publicHttpsOrigin(raw.apiOrigin, 'apiOrigin'),
        release: Object.fromEntries(releaseNames.map((name) => [name, raw.release[name]])),
        allowMutations: false,
        acknowledgedAt: new Date(raw.acknowledgedAt).toISOString(),
    };
}

export function createPlan(target = null) {
    return {
        version,
        status: target ? 'ready_to_execute' : 'blocked',
        reason: target ? null : 'target_not_provided',
        readOnly: true,
        willStartBrowser: false,
        willSendMutationRequests: false,
        devices,
        checks,
        target,
    };
}

export function browserLaunchOptions(environment = process.env) {
    const executablePath = environment.PLAYWRIGHT_EXECUTABLE_PATH?.trim();
    if (!executablePath) return { headless: true };
    if (!isAbsolute(executablePath)) fail('PLAYWRIGHT_EXECUTABLE_PATH must be absolute');
    return { headless: true, executablePath };
}

async function runDevice(browser, deviceName, descriptor, target) {
    const context = await browser.newContext({ ...descriptor, serviceWorkers: 'block' });
    const page = await context.newPage();
    const mutationRequests = [];
    const runtimeErrors = [];
    page.on('pageerror', () => runtimeErrors.push('page_error'));
    await context.route('**/*', async (route) => {
        const method = route.request().method().toUpperCase();
        if (!safeMethods.has(method)) {
            mutationRequests.push({ method });
            await route.abort('blockedbyclient');
            return;
        }
        await route.continue();
    });
    const results = [];
    const result = (check, passed) => results.push({ device: deviceName, check, passed: Boolean(passed) });
    const responseOk = async (url) => {
        const response = await context.request.get(url, { failOnStatusCode: false });
        return response.status() >= 200 && response.status() < 300;
    };
    const visit = (origin, path) => page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded' });
    try {
        result('health-live', await responseOk(`${target.apiOrigin}/health/live`));
        result('health-ready', await responseOk(`${target.apiOrigin}/health/ready`));
        for (const [check, path] of [
            ['public-about', '/about'],
            ['public-community', '/community'],
            ['public-pricing', '/pricing'],
        ])
            result(check, (await visit(target.publicOrigin, path))?.ok());
        result(
            'public-not-found',
            (await visit(target.publicOrigin, '/__production-acceptance-missing__'))?.status() === 404,
        );
        result('anonymous-auth', (await visit(target.publicOrigin, '/auth'))?.ok());
        await visit(target.publicOrigin, '/settings');
        await page.waitForURL((url) => url.pathname.startsWith('/auth'), { timeout: 5_000 }).catch(() => undefined);
        result('protected-redirect', new URL(page.url()).pathname.startsWith('/auth'));
        await visit(target.publicOrigin, '/auth?returnTo=https%3A%2F%2Fexample.invalid%2Fescape');
        result('external-return-to-blocked', new URL(page.url()).origin === target.publicOrigin);
        await visit(target.adminOrigin, '/admin');
        await page.waitForURL((url) => url.pathname.startsWith('/auth'), { timeout: 5_000 }).catch(() => undefined);
        result('admin-anonymous-redirect', new URL(page.url()).pathname.startsWith('/auth'));
        result('no-mutation-requests', mutationRequests.length === 0);
        result('no-runtime-errors', runtimeErrors.length === 0);
    } finally {
        await context.close();
    }
    return { results, mutationRequests, runtimeErrors };
}

export async function executeAcceptance(target) {
    const validated = validateTarget(target);
    const { chromium, devices: playwrightDevices } = await import('@playwright/test');
    const browser = await chromium.launch(browserLaunchOptions());
    try {
        const runs = [
            await runDevice(browser, 'desktop-chromium', playwrightDevices['Desktop Chrome'], validated),
            await runDevice(browser, 'mobile-chromium', playwrightDevices['Pixel 7'], validated),
        ];
        const results = runs.flatMap((run) => run.results);
        const mutationRequests = runs.flatMap((run) => run.mutationRequests);
        const runtimeErrors = runs.flatMap((run) => run.runtimeErrors);
        const passed = results.length === devices.length * checks.length && results.every((item) => item.passed);
        return {
            version,
            status: passed ? 'passed' : 'failed',
            evidence: passed
                ? { version, target: validated, executedAt: new Date().toISOString(), mutationRequests: 0, results }
                : null,
            results,
            mutationRequests,
            runtimeErrors,
        };
    } finally {
        await browser.close();
    }
}

function option(name) {
    const index = process.argv.indexOf(name);
    return index === -1 ? null : process.argv[index + 1];
}

async function main() {
    const execute = process.argv.includes('--execute');
    const targetPath = option('--target');
    const outputPath = option('--output');
    if (!execute) {
        const target = targetPath ? validateTarget(JSON.parse(await readFile(resolve(targetPath), 'utf8'))) : null;
        console.log(JSON.stringify(createPlan(target), null, 2));
        return;
    }
    if (!targetPath || !outputPath) throw new Error('--execute requires --target and --output');
    const target = JSON.parse(await readFile(resolve(targetPath), 'utf8'));
    const report = await executeAcceptance(target);
    const absoluteOutput = resolve(outputPath);
    await mkdir(dirname(absoluteOutput), { recursive: true });
    await writeFile(absoluteOutput, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
    console.log(JSON.stringify({ status: report.status, output: absoluteOutput }, null, 2));
    if (report.status !== 'passed') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
