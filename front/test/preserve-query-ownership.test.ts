import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { preserveKeys as publicPreserveKeys } from '../src/entities/preserve/model.js';
import { preserveKeys } from '../src/entities/preserve/query-keys.js';
import {
    loadPreserveDetail,
    loadPreserveHistory,
    loadPreserveList,
    loadPreserveLocations,
    loadPreserveQrLabel,
    loadPreserveSourceRecipe,
    previewPreserveConsumption,
} from '../src/features/preserves/api.js';

void test('preserve entity preserves exact roots, tuples and filter identity', () => {
    const filters = { q: 'jam', page: '2' };
    const list = preserveKeys.list('user-a', 'family', filters);

    assert.equal(publicPreserveKeys, preserveKeys);
    assert.deepEqual(preserveKeys.root, ['preserves']);
    assert.deepEqual(preserveKeys.list(undefined, 'private', filters), [
        'preserves',
        undefined,
        'private',
        'list',
        filters,
    ]);
    assert.deepEqual(list, ['preserves', 'user-a', 'family', 'list', filters]);
    assert.equal(list[4], filters);
    assert.deepEqual(preserveKeys.detail('user-a', 'private', 'preserve-a'), [
        'preserves',
        'user-a',
        'private',
        'preserve-a',
    ]);
    assert.deepEqual(preserveKeys.history('user-a', 'family', 'preserve-a', 3), [
        'preserves',
        'user-a',
        'family',
        'preserve-a',
        'history',
        3,
    ]);
    assert.deepEqual(preserveKeys.qrLabel('preserve-a'), ['preserves', 'preserve-a', 'qr-label']);
});

void test('preserve adapter preserves filters, scope, pagination, signals, projections and native errors', async () => {
    const calls: unknown[][] = [];
    const envelope = { data: { preserve: { id: 'preserve-a' } } };
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            return Promise.resolve(envelope);
        },
    };
    const signal = new AbortController().signal;
    const filters = { q: 'jam', page: '2' };
    const command = { version: 3, idempotencyKey: 'caller-key' } as never;

    assert.equal(await loadPreserveList(transport as never, filters, '2026-11-06', 'family', signal), envelope.data);
    assert.equal(await loadPreserveLocations(transport as never, 'family', signal), envelope.data);
    assert.equal(await loadPreserveDetail(transport as never, 'preserve-a', 'family', signal), envelope.data);
    assert.equal(await loadPreserveHistory(transport as never, 'preserve-a', 'family', 3, signal), envelope.data);
    assert.equal(await previewPreserveConsumption(transport as never, 'preserve-a', command, signal), envelope.data);
    assert.equal(await loadPreserveQrLabel(transport as never, 'preserve-a', 'family', signal), envelope.data);
    assert.equal(await loadPreserveSourceRecipe(transport as never, 'recipe-a', signal), envelope);

    assert.deepEqual(calls, [
        [
            'GET /api/v1/preserves',
            undefined,
            signal,
            undefined,
            { query: { q: 'jam', page: '2', localDate: '2026-11-06', limit: '20', scope: 'family' } },
        ],
        ['GET /api/v1/inventory-locations', undefined, signal, undefined, { query: { scope: 'family' } }],
        ['GET /api/v1/preserves/{id}', undefined, signal, { id: 'preserve-a' }, { query: { scope: 'family' } }],
        [
            'GET /api/v1/preserves/{id}/history',
            undefined,
            signal,
            { id: 'preserve-a' },
            { query: { page: '3', limit: '20', scope: 'family' } },
        ],
        ['POST /api/v1/preserves/{id}/consume-preview', command, signal, { id: 'preserve-a' }],
        [
            'GET /api/v1/preserves/{id}/qr-label',
            undefined,
            signal,
            { id: 'preserve-a' },
            { query: { scope: 'family' } },
        ],
        ['GET /api/v1/recipe-workspace/{id}', undefined, signal, { id: 'recipe-a' }],
    ]);

    const error = new Error('transport failed');
    await assert.rejects(
        loadPreserveDetail({ request: () => Promise.reject(error) } as never, 'preserve-a', 'private'),
        (actual) => actual === error,
    );
});

void test('preserve consumers use exact owners for reads and ordered command invalidations', async () => {
    const [list, detail, form, qrLabel, adapter, command, cooking] = await Promise.all([
        readFile('src/features/preserves/list.tsx', 'utf8'),
        readFile('src/features/preserves/detail.tsx', 'utf8'),
        readFile('src/features/preserves/form.tsx', 'utf8'),
        readFile('src/features/preserves/qr-label.tsx', 'utf8'),
        readFile('src/features/preserves/api.ts', 'utf8'),
        readFile('src/features/preserves/use-command.ts', 'utf8'),
        readFile('src/features/recipes/cooking.tsx', 'utf8'),
    ]);

    assert.match(list, /queryKey: preserveKeys\.list\(user\.data\?\.id, scope, query\)/u);
    assert.match(list, /loadPreserveList\(api!, query, localDate\(\), scope, signal\)/u);
    assert.match(detail, /queryKey: preserveKeys\.detail\(user\.data\?\.id, scope, id\)/u);
    assert.match(detail, /queryKey: preserveKeys\.history\(user\.data\?\.id, scope, id, historyPage\)/u);
    assert.match(detail, /loadPreserveHistory\(api!, id, scope, historyPage, signal\)/u);
    assert.match(qrLabel, /queryKey: preserveKeys\.qrLabel\(preserve\.id\)/u);
    assert.match(qrLabel, /loadPreserveQrLabel\(api!, preserve\.id, scope, querySignal\)/u);
    assert.match(adapter, /query: \{ \.\.\.filters, localDate, limit: ['"]20['"], scope \}/u);
    assert.match(adapter, /query: \{ page: String\(page\), limit: ['"]20['"], scope \}/u);
    assert.equal(
        [list, detail, form, qrLabel].reduce(
            (count, source) => count + (source.match(/\.request\s*\(/gu)?.length ?? 0),
            0,
        ),
        0,
    );
    assert.doesNotMatch(adapter, /crypto\.randomUUID/u);
    assert.match(qrLabel, /new Blob\(\[svg\]/u);
    assert.match(qrLabel, /window\.open\(['"]['"], ['"]_blank['"]\)/u);
    assert.match(detail, /e instanceof ApiError && e\.status === 404/u);
    assert.match(form, /Введённые поля сохранены/u);
    for (const operation of [
        'GET /api/v1/preserves',
        'GET /api/v1/inventory-locations',
        'GET /api/v1/preserves/{id}',
        'GET /api/v1/preserves/{id}/history',
        'POST /api/v1/preserves/{id}/consume-preview',
        'GET /api/v1/preserves/{id}/qr-label',
        'GET /api/v1/recipe-workspace/{id}',
    ])
        assert.ok(
            adapter.includes(`'${operation}'`) || adapter.includes(`"${operation}"`),
            `${operation} is preserved`,
        );
    assert.match(command, /queryClient\.removeQueries\(\{ queryKey: preserveKeys\.root \}\)/u);
    assert.match(cooking, /queryClient\.invalidateQueries\(\{ queryKey: preserveKeys\.root \}\)/u);
    assert.match(command, /queryKey: preserveKeys\.root/u);
    assert.match(command, /queryKey: recipeQueryRoots\.cookingRoot/u);
    assert.match(command, /queryKey: inventoryKeys\.root/u);
    assert.match(command, /queryKey: inventoryKeys\.historyRoot/u);
    assert.match(command, /queryKey: recipeQueryRoots\.workspaceRoot/u);
    assert.doesNotMatch(command, /queryKey: \[key\]/u);
    assert.match(command, /scope, idempotencyKey: crypto\.randomUUID\(\)/u);
    assert.match(command, /e instanceof ApiError && e\.status === 412/u);
});
