import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeQueryKeys, createQueryKeySnapshot, loadQueryKeySnapshot } from './query-key-analyzer.mjs';
import { resolveTestOutputRoot } from './test-output-root.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontRoot = path.resolve(scriptDirectory, '..');
const canonicalOutputRoot = await resolveTestOutputRoot(scriptDirectory, 'Query-key');
const fixtureRoot = await mkdtemp(path.join(canonicalOutputRoot, 'meal-frontend-query-keys-'));

function verifyFixturePath(target) {
    const relative = path.relative(canonicalOutputRoot, target);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
        throw new Error(`Query-key fixture escaped QA_OUTPUT_DIR: ${target}`);
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
                paths: { '@alpha/*': ['src/features/alpha/*'], '@entities/*': ['src/entities/*'] },
            },
            include: ['src/**/*.ts', 'src/**/*.tsx', '.next/types/**/*.ts'],
        }),
        ...files,
    });
    return root;
}

const analyzeFixture = (root, baseline = null) => analyzeQueryKeys({ cwd: root, baseline });

test('detects direct hook and QueryClient literal operations with deterministic shapes', async () => {
    const root = await createFixture({
        'src/features/alpha/page.ts': [
            "import { useQuery } from '@tanstack/react-query';",
            'declare const id: string;',
            'declare const queryClient: { invalidateQueries(value: unknown): void; setQueryData(key: unknown, value: unknown): void };',
            "useQuery({ queryKey: ['alpha', id] });",
            "queryClient.invalidateQueries({ queryKey: ['alpha'] });",
            "queryClient.setQueryData(['alpha', id], null);",
        ].join('\n'),
    });
    const result = await analyzeFixture(root);
    assert.deepEqual(result.failures, []);
    assert.equal(result.metrics.rawSites, 4);
    assert.equal(result.rawSiteCounts.get('features/alpha/page.ts|queryKey|["alpha",*]'), 1);
    assert.equal(result.rawSiteCounts.get('features/alpha/page.ts|invalidateQueries|["alpha"]'), 1);
    assert.equal(result.rawSiteCounts.get('features/alpha/page.ts|queryKey|["alpha"]'), 1);
    assert.equal(result.rawSiteCounts.get('features/alpha/page.ts|setQueryData|["alpha",*]'), 1);
});

test('resolves local identifiers through as-const and parenthesized chains once', async () => {
    const root = await createFixture({
        'src/features/alpha/page.ts': [
            "import { useQuery } from '@tanstack/react-query';",
            'declare const id: string;',
            "const key = (((['alpha', id] as const)));",
            'declare const queryClient: { invalidateQueries(value: unknown): void };',
            'useQuery({ queryKey: key });',
            'queryClient.invalidateQueries({ queryKey: key });',
        ].join('\n'),
    });
    const result = await analyzeFixture(root);
    assert.deepEqual(result.failures, []);
    assert.equal(result.metrics.rawSites, 1);
    assert.equal(result.rawSiteCounts.get('features/alpha/page.ts|localKey|["alpha",*]'), 1);
});

test('accepts alias imports only from canonical entity and same-feature owners', async () => {
    const root = await createFixture({
        'src/entities/session/model.ts':
            "export const sessionKeys = { user: (id: string) => ['session', id] as const };",
        'src/features/alpha/query-keys.ts':
            "export const alphaKeys = { detail: (id: string) => ['alpha', id] as const };",
        'src/features/alpha/page.ts': [
            "import { useQuery } from '@tanstack/react-query';",
            "import { alphaKeys } from '@alpha/query-keys';",
            "import { sessionKeys } from '@entities/session/model';",
            'declare const id: string;',
            'useQuery({ queryKey: alphaKeys.detail(id) });',
            'useQuery({ queryKey: sessionKeys.user(id) });',
        ].join('\n'),
    });
    const result = await analyzeFixture(root);
    assert.deepEqual(result.failures, []);
    assert.equal(result.metrics.rawSites, 0);
    assert.equal(result.metrics.legacyFactorySites, 0);
});

test('rejects an arbitrary helper even when it returns the same tuple', async () => {
    const root = await createFixture({
        'src/features/alpha/key-helper.ts': "export const alphaKey = (id: string) => ['alpha', id] as const;",
        'src/features/alpha/page.ts': [
            "import { useQuery } from '@tanstack/react-query';",
            "import { alphaKey } from './key-helper.js';",
            'declare const id: string;',
            'useQuery({ queryKey: alphaKey(id) });',
        ].join('\n'),
    });
    const emptyBaseline = {
        version: 1,
        metrics: { rawSites: 0, rawFiles: 0, rawContexts: 0, legacyFactorySites: 0 },
        rawSites: {},
        legacyFactories: {},
    };
    const result = await analyzeFixture(root, emptyBaseline);
    assert.equal(result.metrics.rawSites, 0);
    assert.ok(result.failures.some((failure) => failure.includes('legacyFactories: new or increased debt')));
});

test('fails on a new fingerprint and multiplicity increase', async () => {
    const root = await createFixture({
        'src/features/alpha/page.ts': [
            'declare const queryClient: { invalidateQueries(value: unknown): void };',
            "queryClient.invalidateQueries({ queryKey: ['alpha'] });",
        ].join('\n'),
    });
    const accepted = await analyzeFixture(root);
    const baseline = createQueryKeySnapshot(accepted);
    await writeFixtureFiles(root, {
        'src/features/alpha/page.ts': [
            'declare const queryClient: { invalidateQueries(value: unknown): void };',
            "queryClient.invalidateQueries({ queryKey: ['alpha'] });",
            "queryClient.invalidateQueries({ queryKey: ['alpha'] });",
            "queryClient.invalidateQueries({ queryKey: ['beta'] });",
        ].join('\n'),
    });
    const result = await analyzeFixture(root, baseline);
    assert.ok(result.failures.some((failure) => failure.includes('accepted 1')));
    assert.ok(result.failures.some((failure) => failure.includes('["beta"]')));
});

test('requires an intentional snapshot update after debt decreases', async () => {
    const root = await createFixture({
        'src/features/alpha/page.ts': [
            'declare const queryClient: { invalidateQueries(value: unknown): void };',
            "queryClient.invalidateQueries({ queryKey: ['alpha'] });",
            "queryClient.invalidateQueries({ queryKey: ['alpha'] });",
        ].join('\n'),
    });
    const accepted = await analyzeFixture(root);
    const baseline = createQueryKeySnapshot(accepted);
    await writeFixtureFiles(root, {
        'src/features/alpha/page.ts': [
            'declare const queryClient: { invalidateQueries(value: unknown): void };',
            "queryClient.invalidateQueries({ queryKey: ['alpha'] });",
        ].join('\n'),
    });
    const decreased = await analyzeFixture(root, baseline);
    assert.ok(decreased.failures.some((failure) => failure.includes('stale baseline')));
    const updated = await analyzeFixture(root, createQueryKeySnapshot(decreased));
    assert.deepEqual(updated.failures, []);
});

test('ignores mocks, tests, generated contracts and build output', async () => {
    const poison = "declare const useQuery: (value: unknown) => void; useQuery({ queryKey: ['poison'] });";
    const root = await createFixture({
        'src/features/alpha/page.ts':
            "declare const useQuery: (value: unknown) => void; useQuery({ queryKey: ['alpha'] });",
        'src/mocks/poison.ts': poison,
        'src/generated/poison.ts': poison,
        'src/features/alpha/page.test.ts': poison,
        'src/shared/api/contracts.generated.ts': poison,
        '.next/types/poison.ts': poison,
        'dist/poison.ts': poison,
    });
    const result = await analyzeFixture(root);
    assert.deepEqual(result.failures, []);
    assert.equal(result.metrics.rawSites, 1);
    assert.equal(result.metrics.rawFiles, 1);
});

test('real production baseline remains exact and accepted', async () => {
    const baseline = await loadQueryKeySnapshot(path.join(scriptDirectory, 'query-key-baseline.json'));
    const result = await analyzeQueryKeys({ cwd: frontRoot, baseline });
    assert.deepEqual(result.failures, []);
    assert.deepEqual(result.metrics, {
        rawSites: 0,
        rawFiles: 0,
        rawContexts: 0,
        legacyFactorySites: 0,
    });
});
