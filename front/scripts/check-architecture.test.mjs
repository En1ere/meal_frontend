import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdir, mkdtemp, realpath, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeArchitecture } from './architecture-analyzer.mjs';

function findProjectsRoot(start) {
    let current = path.resolve(start);
    while (true) {
        if (path.basename(current).toLocaleLowerCase('en-US') === 'projects') return current;
        const parent = path.dirname(current);
        if (parent === current) return null;
        current = parent;
    }
}

const projectsRoot = findProjectsRoot(path.dirname(fileURLToPath(import.meta.url)));
if (!projectsRoot) throw new Error('Architecture fixtures require a repository ancestor directory named projects');

const permittedOutputRoot = path.join(projectsRoot, 'tempFiles');
let permittedOutputRootStats;
try {
    permittedOutputRootStats = await stat(permittedOutputRoot);
} catch {
    throw new Error(`Architecture fixture root is unavailable: ${permittedOutputRoot}`);
}
if (!permittedOutputRootStats.isDirectory())
    throw new Error(`Architecture fixture root is not a directory: ${permittedOutputRoot}`);

const canonicalPermittedOutputRoot = await realpath(permittedOutputRoot);
const outputRoot = process.env.QA_OUTPUT_DIR ? path.resolve(process.env.QA_OUTPUT_DIR) : canonicalPermittedOutputRoot;
await mkdir(outputRoot, { recursive: true });
const canonicalOutputRoot = await realpath(outputRoot);
const outputRootRelative = path.relative(canonicalPermittedOutputRoot, canonicalOutputRoot);
if (outputRootRelative.startsWith('..') || path.isAbsolute(outputRootRelative))
    throw new Error(`QA_OUTPUT_DIR must resolve inside ${canonicalPermittedOutputRoot}: ${canonicalOutputRoot}`);
const fixtureRoot = await mkdtemp(path.join(outputRoot, 'meal-frontend-architecture-'));

function verifyFixturePath(target) {
    const relative = path.relative(canonicalOutputRoot, target);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
        throw new Error(`Architecture fixture escaped QA_OUTPUT_DIR: ${target}`);
}

after(async () => {
    verifyFixturePath(fixtureRoot);
    await rm(fixtureRoot, { recursive: true, force: true });
});

let fixtureSequence = 0;
async function fixture(files, compilerOptions = {}) {
    fixtureSequence += 1;
    const root = path.join(fixtureRoot, `case-${fixtureSequence}`);
    verifyFixturePath(root);
    await mkdir(root, { recursive: true });
    await writeFile(
        path.join(root, 'tsconfig.json'),
        JSON.stringify({
            compilerOptions: {
                target: 'ES2023',
                module: 'ESNext',
                moduleResolution: 'Bundler',
                strict: true,
                baseUrl: '.',
                paths: { '@features/*': ['src/features/*'] },
                ...compilerOptions,
            },
            include: ['src/**/*.ts', 'src/**/*.tsx', '.next/types/**/*.ts'],
        }),
    );
    for (const [name, source] of Object.entries(files)) {
        const target = path.join(root, name);
        verifyFixturePath(target);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, source);
    }
    return analyzeArchitecture({ cwd: root });
}

test('accepts feature public APIs, nested APIs and the explicit dynamic mock boundary', async () => {
    const result = await fixture({
        'src/app/page.ts': [
            "import { client } from '../features/alpha/client';",
            "export { server } from '../features/alpha/server.js';",
            "export * from '../features/alpha/index.js';",
            "void import('../features/alpha/nested/client.js');",
        ].join('\n'),
        'src/widgets/panel.ts': "import { nested } from '../features/alpha/nested/client.js';",
        'src/mocks/api.ts': "void import('../features/ingest/mock.js');",
        'src/features/alpha/client.ts': 'export const client = true;',
        'src/features/alpha/server.ts': 'export const server = true;',
        'src/features/alpha/index.ts': 'export const index = true;',
        'src/features/alpha/nested/client.ts': 'export const nested = true;',
        'src/features/ingest/mock.ts': 'export const mock = true;',
    });
    assert.deepEqual(result.failures, []);
    assert.equal(result.metrics.dynamicImports, 2);
});

test('rejects every static, type, re-export and dynamic cross-feature syntax', async (context) => {
    const cases = {
        static: "import { value } from '../beta/internal.js';",
        'side effect': "import '../beta/internal.js';",
        'type import': "import type { Value } from '../beta/internal.js';",
        'named re-export': "export { value } from '../beta/internal.js';",
        'star re-export': "export * from '../beta/internal.js';",
        'type re-export': "export type { Value } from '../beta/internal.js';",
        dynamic: "void import('../beta/internal.js');",
        'import equals': "import value = require('../beta/internal.js');",
        require: "const value = require('../beta/internal.js');",
    };
    for (const [name, source] of Object.entries(cases))
        await context.test(name, async () => {
            const result = await fixture({
                'src/features/alpha/source.ts': source,
                'src/features/beta/internal.ts': 'export const value = true; export type Value = boolean;',
            });
            assert.ok(result.failures.some((failure) => failure.includes('cross-feature imports')));
        });
});

test('resolves aliases while preserving public API and upper-layer rules', async () => {
    const accepted = await fixture({
        'src/app/page.ts': "import { value } from '@features/alpha/client';",
        'src/features/alpha/client.ts': 'export const value = true;',
    });
    assert.deepEqual(accepted.failures, []);

    const rejected = await fixture({
        'src/app/page.ts': "import { value } from '@features/alpha/internal';",
        'src/features/alpha/internal.ts': 'export const value = true;',
    });
    assert.ok(rejected.failures.some((failure) => failure.includes('upper layers must use')));

    const crossFeature = await fixture({
        'src/features/alpha/source.ts': "import { value } from '@features/beta/internal';",
        'src/features/beta/internal.ts': 'export const value = true;',
    });
    assert.ok(crossFeature.failures.some((failure) => failure.includes('cross-feature imports')));
});

test('rejects app and widget deep imports', async () => {
    const result = await fixture({
        'src/app/page.ts': "import { value } from '../features/alpha/internal.js';",
        'src/widgets/panel.ts': "import { value } from '../features/alpha/internal.js';",
        'src/features/alpha/internal.ts': 'export const value = true;',
    });
    assert.equal(result.failures.filter((failure) => failure.includes('upper layers must use')).length, 2);
});

test('enforces both directions of the feature mock API boundary', async () => {
    const result = await fixture({
        'src/mocks/api.ts': "import { internal } from '../features/alpha/internal.js';",
        'src/app/page.ts': "import { mock } from '../features/alpha/mock.js';",
        'src/features/alpha/internal.ts': 'export const internal = true;',
        'src/features/alpha/mock.ts': 'export const mock = true;',
    });
    assert.ok(result.failures.some((failure) => failure.includes('mock composition must use')));
    assert.ok(result.failures.some((failure) => failure.includes('feature mock APIs are restricted')));
});

test('treats CSS assets as architecture edges', async () => {
    const result = await fixture({
        'src/features/alpha/source.ts': "import '../beta/styles.module.css';",
        'src/features/beta/styles.module.css': '.root { color: inherit; }',
    });
    assert.ok(result.failures.some((failure) => failure.includes('cross-feature imports')));
});

test('ignores import-like comments and strings', async () => {
    const result = await fixture({
        'src/features/alpha/source.ts': [
            "// import '../beta/internal.js';",
            'const example = "export * from \'../beta/internal.js\'";',
            'export { example };',
        ].join('\n'),
        'src/features/beta/internal.ts': 'export const value = true;',
    });
    assert.deepEqual(result.failures, []);
});

test('fails closed for nonliteral dynamic imports in layered source', async () => {
    const result = await fixture({
        'src/features/alpha/source.ts': "const target = '../beta/internal.js'; void import(target);",
    });
    assert.ok(result.failures.some((failure) => failure.includes('dynamic import specifier must be a string literal')));
});

test('collects only src and ignores generated or build poison files', async () => {
    const result = await fixture({
        'src/features/alpha/source.ts': 'export const value = true;',
        '.next/types/poison.ts': "import '../../src/features/beta/internal.js';",
        'dist/poison.ts': "import '../src/features/beta/internal.js';",
        'src/features/beta/internal.ts': 'export const value = true;',
    });
    assert.deepEqual(result.failures, []);
    assert.equal(result.metrics.files, 2);
});

test('rejects runtime dependency cycles with a zero-cycle baseline', async () => {
    const result = await fixture({
        'src/features/alpha/first.ts': "import { second } from './second.js'; export const first = second;",
        'src/features/alpha/second.ts': "import { first } from './first.js'; export const second = first;",
    });
    assert.equal(result.metrics.runtimeCycles, 1);
    assert.ok(result.failures.some((failure) => failure.includes('runtime dependency cycle')));
});

test('ignores type-only and asset edges in runtime cycle analysis', async () => {
    const result = await fixture({
        'src/features/alpha/first.ts': [
            "import type { Second } from './second.js';",
            "import './styles.module.css';",
            'export type First = Second;',
        ].join('\n'),
        'src/features/alpha/second.ts': "import type { First } from './first.js'; export type Second = First;",
        'src/features/alpha/styles.module.css': '.root { color: inherit; }',
    });
    assert.equal(result.metrics.runtimeCycles, 0);
    assert.deepEqual(result.failures, []);
});

test('resolves aliases when detecting runtime dependency cycles', async () => {
    const result = await fixture({
        'src/features/alpha/first.ts': "import { second } from '@features/alpha/second'; export const first = second;",
        'src/features/alpha/second.ts': "import { first } from '@features/alpha/first'; export const second = first;",
    });
    assert.equal(result.metrics.runtimeCycles, 1);
    assert.ok(result.failures.some((failure) => failure.includes('runtime dependency cycle')));
});

test('fails closed when a local runtime edge cannot be resolved', async () => {
    const result = await fixture({
        'src/features/alpha/source.ts': "import { missing } from './missing.js'; export { missing };",
    });
    assert.ok(result.failures.some((failure) => failure.includes('runtime import must resolve for cycle analysis')));
});
