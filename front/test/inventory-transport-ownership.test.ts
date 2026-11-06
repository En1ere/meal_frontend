import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
    createInventoryBatch,
    loadInventoryAtLocation,
    loadInventoryAttention,
    loadInventoryBatch,
    loadInventoryHistory,
    loadInventoryList,
    loadInventoryLocations,
    loadInventoryProducts,
    runInventoryBatchCommand,
    saveInventoryLocation,
} from '../src/features/inventory/api.js';

void test('inventory adapter preserves scoped reads, filters, projections and prepared commands', async () => {
    const calls: unknown[][] = [];
    const data = { items: ['item'], batch: { id: 'batch-a' }, total: 4, location: { id: 'location-a' } };
    const envelope = { data };
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            return Promise.resolve(envelope);
        },
    };
    const signal = new AbortController().signal;
    const command = { idempotencyKey: 'caller-key', version: 7 } as never;
    const filters = {
        q: 'milk',
        status: 'active',
        attention: 'all',
        days: '3',
        localDate: '2026-11-06',
        limit: '50',
        offset: '0',
        locationId: 'location-a',
    };
    const from = '2026-11-01';
    const to = '2026-11-06';
    const fromIso = new Date(`${from}T00:00:00`).toISOString();
    const toIso = new Date(
        new Date(`${to}T00:00:00`).setDate(new Date(`${to}T00:00:00`).getDate() + 1) - 1,
    ).toISOString();

    assert.equal(await loadInventoryProducts(transport as never, 'milk', signal), data);
    assert.equal(await loadInventoryLocations(transport as never, 'family', signal), data.items);
    assert.equal(await createInventoryBatch(transport as never, command, signal), envelope);
    assert.equal(await loadInventoryBatch(transport as never, 'private', 'batch-a', signal), data.batch);
    assert.equal(await runInventoryBatchCommand(transport as never, 'batch-a', command, signal, 7), envelope);
    assert.equal(
        await loadInventoryHistory(
            transport as never,
            'family',
            { batchId: 'batch-a', q: 'milk', action: 'consume', from, to, offset: 100 },
            signal,
        ),
        data,
    );
    assert.equal(await loadInventoryList(transport as never, 'private', filters, signal), data);
    assert.equal(await loadInventoryAttention(transport as never, 'family', '3', '2026-11-06', signal), 4);
    assert.equal(
        await loadInventoryAtLocation(transport as never, 'private', 'location-a', '2026-11-06', signal),
        data,
    );
    assert.equal(await saveInventoryLocation(transport as never, command, signal), envelope);
    assert.equal(await saveInventoryLocation(transport as never, command, signal, 7), envelope);

    assert.deepEqual(calls, [
        ['GET /api/v1/products', undefined, signal, undefined, { query: { q: 'milk', limit: '20' } }],
        ['GET /api/v1/inventory-locations', undefined, signal, undefined, { query: { scope: 'family' } }],
        ['POST /api/v1/inventory', command, signal],
        ['GET /api/v1/inventory/{id}', undefined, signal, { id: 'batch-a' }, { query: { scope: 'private' } }],
        ['POST /api/v1/inventory/{id}/command', command, signal, { id: 'batch-a' }, { ifMatch: 7 }],
        [
            'GET /api/v1/inventory-history',
            undefined,
            signal,
            undefined,
            {
                query: {
                    batchId: 'batch-a',
                    q: 'milk',
                    action: 'consume',
                    from: fromIso,
                    to: toIso,
                    limit: '100',
                    offset: '100',
                    scope: 'family',
                },
            },
        ],
        ['GET /api/v1/inventory', undefined, signal, undefined, { query: { ...filters, scope: 'private' } }],
        [
            'GET /api/v1/inventory',
            undefined,
            signal,
            undefined,
            {
                query: {
                    attention: 'expiring',
                    days: '3',
                    localDate: '2026-11-06',
                    status: 'active',
                    limit: '1',
                    scope: 'family',
                },
            },
        ],
        [
            'GET /api/v1/inventory',
            undefined,
            signal,
            undefined,
            { query: { locationId: 'location-a', localDate: '2026-11-06', limit: '100', scope: 'private' } },
        ],
        ['POST /api/v1/inventory-locations', command, signal, undefined, undefined],
        ['POST /api/v1/inventory-locations', command, signal, undefined, { ifMatch: 7 }],
    ]);

    const error = new Error('transport failed');
    await assert.rejects(
        loadInventoryLocations({ request: () => Promise.reject(error) } as never, 'private'),
        (actual) => actual === error,
    );
});

void test('inventory screens use the private adapter while UI retains retry and cache orchestration', async () => {
    const [create, detail, history, list, locations, adapter] = await Promise.all([
        readFile('src/features/inventory/create-page.tsx', 'utf8'),
        readFile('src/features/inventory/detail-page.tsx', 'utf8'),
        readFile('src/features/inventory/history-page.tsx', 'utf8'),
        readFile('src/features/inventory/list-page.tsx', 'utf8'),
        readFile('src/features/inventory/locations-page.tsx', 'utf8'),
        readFile('src/features/inventory/api.ts', 'utf8'),
    ]);

    for (const source of [create, detail, history, list, locations]) assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.match(create, /loadInventoryProducts\(api!, q, signal\)/u);
    assert.match(create, /createInventoryBatch\(/u);
    assert.match(detail, /loadInventoryBatch\(api!, scope, id, signal\)/u);
    assert.match(detail, /runInventoryBatchCommand\(/u);
    assert.match(history, /loadInventoryHistory\(api!, scope, \{ batchId, q, action, from, to, offset \}, signal\)/u);
    assert.match(list, /loadInventoryList\(api!, scope, filters, signal\)/u);
    assert.match(list, /loadInventoryAttention\(api!, scope, filters\.days, filters\.localDate, signal\)/u);
    assert.match(locations, /loadInventoryAtLocation\(api!, scope, selected, localDate\(\), signal\)/u);
    assert.match(locations, /saveInventoryLocation\(/u);

    assert.match(create, /attempt\.current = \{ key: crypto\.randomUUID\(\), fingerprint \}/u);
    assert.match(detail, /attempt\.current = \{ key: crypto\.randomUUID\(\), fingerprint \}/u);
    assert.match(locations, /attempt\.current = \{ key: crypto\.randomUUID\(\), fingerprint \}/u);
    assert.match(create, /idempotencyKey: attempt\.current\.key/u);
    assert.match(detail, /idempotencyKey: attempt\.current\.key/u);
    assert.match(locations, /idempotencyKey: attempt\.current\.key/u);
    assert.match(detail, /batch\.version/u);
    assert.match(locations, /rename && current \? current\.version : undefined/u);
    assert.match(create, /router\.push/u);
    assert.match(locations, /setSelected\(result\.data\.location\.id\)/u);
    assert.match(adapter, /ifMatch === undefined \? undefined : \{ ifMatch \}/u);
});
