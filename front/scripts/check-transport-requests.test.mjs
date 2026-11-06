import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdir, mkdtemp, realpath, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    analyzeTransportRequests,
    createTransportRequestSnapshot,
    loadTransportRequestSnapshot,
} from './transport-request-analyzer.mjs';

function findProjectsRoot(start) {
    let current = path.resolve(start);
    while (true) {
        if (path.basename(current).toLocaleLowerCase('en-US') === 'projects') return current;
        const parent = path.dirname(current);
        if (parent === current) return null;
        current = parent;
    }
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontRoot = path.resolve(scriptDirectory, '..');
const projectsRoot = findProjectsRoot(scriptDirectory);
if (!projectsRoot) throw new Error('Transport-request fixtures require a repository ancestor directory named projects');
const permittedOutputRoot = path.join(projectsRoot, 'tempFiles');
let permittedOutputRootStats;
try {
    permittedOutputRootStats = await stat(permittedOutputRoot);
} catch {
    throw new Error(`Transport-request fixture root is unavailable: ${permittedOutputRoot}`);
}
if (!permittedOutputRootStats.isDirectory())
    throw new Error(`Transport-request fixture root is not a directory: ${permittedOutputRoot}`);
const canonicalPermittedOutputRoot = await realpath(permittedOutputRoot);
const outputRoot = process.env.QA_OUTPUT_DIR ? path.resolve(process.env.QA_OUTPUT_DIR) : canonicalPermittedOutputRoot;
await mkdir(outputRoot, { recursive: true });
const canonicalOutputRoot = await realpath(outputRoot);
const outputRootRelative = path.relative(canonicalPermittedOutputRoot, canonicalOutputRoot);
if (outputRootRelative.startsWith('..') || path.isAbsolute(outputRootRelative))
    throw new Error(`QA_OUTPUT_DIR must resolve inside ${canonicalPermittedOutputRoot}: ${canonicalOutputRoot}`);
const fixtureRoot = await mkdtemp(path.join(outputRoot, 'meal-frontend-transport-requests-'));

function verifyFixturePath(target) {
    const relative = path.relative(canonicalOutputRoot, target);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
        throw new Error(`Transport-request fixture escaped QA_OUTPUT_DIR: ${target}`);
}

after(async () => {
    verifyFixturePath(fixtureRoot);
    await rm(fixtureRoot, { recursive: true, force: true });
});

let fixtureSequence = 0;
async function writeFixtureFiles(root, files) {
    for (const [name, source] of Object.entries(files)) {
        const target = path.join(root, name);
        verifyFixturePath(target);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, source);
    }
}

async function createFixture(files) {
    fixtureSequence += 1;
    const root = path.join(fixtureRoot, `case-${fixtureSequence}`);
    verifyFixturePath(root);
    await mkdir(root, { recursive: true });
    await writeFixtureFiles(root, {
        'tsconfig.json': JSON.stringify({
            compilerOptions: {
                target: 'ES2023',
                module: 'ESNext',
                moduleResolution: 'Bundler',
                strict: true,
                baseUrl: '.',
                paths: { '@api/*': ['src/shared/api/*'] },
            },
            include: ['src/**/*.ts', 'src/**/*.tsx', '.next/types/**/*.ts'],
        }),
        ...files,
    });
    return root;
}

test('detects every supported verb, multiline, optional, element and local alias call', async () => {
    const root = await createFixture({
        'src/features/alpha/page.tsx': [
            'declare const api: { request(route: string): Promise<unknown> };',
            'const client = (api);',
            "api.request('GET /api/v1/alpha');",
            "client.request(\n'POST /api/v1/alpha'\n);",
            "api?.request('PUT /api/v1/alpha');",
            "api['request']('PATCH /api/v1/alpha');",
        ].join('\n'),
    });
    const result = await analyzeTransportRequests({ cwd: root });
    assert.deepEqual(result.failures, []);
    assert.deepEqual(result.metrics, {
        sites: 4,
        files: 1,
        contexts: 1,
        featureSites: 4,
        entitySites: 0,
        reads: 1,
        commands: 3,
        literalSites: 4,
        computedSites: 0,
    });
});

test('resolves ApiClient path aliases and computed conditional, identifier and template routes', async () => {
    const root = await createFixture({
        'src/shared/api/client.ts':
            'export class ApiClient { request(route: string): Promise<unknown> { throw route; } }',
        'src/features/alpha/page.tsx': [
            "import type { ApiClient as Client } from '@api/client';",
            'declare const client: Client;',
            'declare const flag: boolean;',
            "const route = flag ? 'POST /api/v1/alpha/a' : 'POST /api/v1/alpha/b';",
            'client.request(route);',
            "client.request(flag ? 'GET /api/v1/alpha/a' : 'GET /api/v1/alpha/b');",
            'const id = "a";',
            'client.request(`DELETE /api/v1/alpha/${id}`);',
        ].join('\n'),
    });
    const result = await analyzeTransportRequests({ cwd: root });
    assert.deepEqual(result.failures, []);
    assert.equal(result.metrics.sites, 3);
    assert.equal(result.metrics.computedSites, 3);
    assert.equal(result.metrics.reads, 1);
    assert.equal(result.metrics.commands, 2);
});

test('fails closed for unresolved, malformed and mixed read-command routes', async () => {
    const root = await createFixture({
        'src/features/alpha/page.tsx': [
            'declare const api: { request(route: string): Promise<unknown> };',
            'declare const route: string;',
            'declare const flag: boolean;',
            'api.request(route);',
            "api.request('GET /outside');",
            "api.request(flag ? 'GET /api/v1/alpha' : 'POST /api/v1/alpha');",
        ].join('\n'),
    });
    const result = await analyzeTransportRequests({ cwd: root });
    assert.equal(result.metrics.sites, 0);
    assert.ok(result.failures.some((failure) => failure.includes('unresolved transport route')));
    assert.ok(result.failures.some((failure) => failure.includes('invalid transport route')));
    assert.ok(result.failures.some((failure) => failure.includes('must not mix read and command')));
});

test('ignores unrelated request methods, comments, tests, mocks, generated, server-only and build output', async () => {
    const poison = "declare const api: { request(route: string): void }; api.request('GET /api/v1/poison');";
    const root = await createFixture({
        'src/features/alpha/page.tsx': [
            'declare const analytics: { request(route: string): void };',
            "analytics.request('GET /api/v1/not-api-client');",
            "// api.request('GET /api/v1/comment');",
            'const example = "api.request(\'GET /api/v1/string\')";',
            'void example;',
        ].join('\n'),
        'src/features/alpha/page.test.tsx': poison,
        'src/features/alpha/__tests__/page.tsx': poison,
        'src/mocks/page.tsx': poison,
        'src/generated/page.tsx': poison,
        'src/entities/alpha/contracts.generated.tsx': poison,
        'src/features/server/page.tsx': "import 'server-only';\n" + poison,
        '.next/types/poison.tsx': poison,
    });
    const result = await analyzeTransportRequests({ cwd: root });
    assert.deepEqual(result.failures, []);
    assert.equal(result.metrics.sites, 0);
});

test('blocks new fingerprints and multiplicity increases', async () => {
    const root = await createFixture({
        'src/features/alpha/page.tsx':
            "declare const api: { request(route: string): void }; api.request('GET /api/v1/alpha');",
    });
    const accepted = await analyzeTransportRequests({ cwd: root });
    const baseline = createTransportRequestSnapshot(accepted);
    await writeFixtureFiles(root, {
        'src/features/alpha/page.tsx': [
            'declare const api: { request(route: string): void };',
            "api.request('GET /api/v1/alpha');",
            "api.request('GET /api/v1/alpha');",
            "api.request('POST /api/v1/beta');",
        ].join('\n'),
    });
    const result = await analyzeTransportRequests({ cwd: root, baseline });
    assert.ok(result.failures.some((failure) => failure.includes('accepted 1')));
    assert.ok(result.failures.some((failure) => failure.includes('POST /api/v1/beta')));
});

test('requires an intentional snapshot update after debt decreases', async () => {
    const root = await createFixture({
        'src/features/alpha/page.tsx': [
            'declare const api: { request(route: string): void };',
            "api.request('GET /api/v1/alpha');",
            "api.request('GET /api/v1/alpha');",
        ].join('\n'),
    });
    const baseline = createTransportRequestSnapshot(await analyzeTransportRequests({ cwd: root }));
    await writeFixtureFiles(root, {
        'src/features/alpha/page.tsx':
            "declare const api: { request(route: string): void }; api.request('GET /api/v1/alpha');",
    });
    const decreased = await analyzeTransportRequests({ cwd: root, baseline });
    assert.ok(decreased.failures.some((failure) => failure.includes('stale baseline')));
    const updated = await analyzeTransportRequests({
        cwd: root,
        baseline: createTransportRequestSnapshot(decreased),
    });
    assert.deepEqual(updated.failures, []);
});

test('real production baseline remains exact and accepted', async () => {
    const baseline = await loadTransportRequestSnapshot(path.join(scriptDirectory, 'transport-request-baseline.json'));
    const result = await analyzeTransportRequests({ cwd: frontRoot, baseline });
    assert.deepEqual(result.failures, []);
    assert.deepEqual(result.metrics, {
        sites: 0,
        files: 0,
        contexts: 0,
        featureSites: 0,
        entitySites: 0,
        reads: 0,
        commands: 0,
        literalSites: 0,
        computedSites: 0,
    });
});
