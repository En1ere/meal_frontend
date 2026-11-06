import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
    commitInventoryImport,
    loadIngestLocations,
    loadIngestProducts,
    type InventoryImportCommand,
} from '../src/features/inventory-ingest/api.js';

interface RecordedRequest {
    route: string;
    body: unknown;
    signal: AbortSignal | undefined;
    params: unknown;
    options: unknown;
}

void test('inventory ingest adapter preserves product discriminator, scope, signals and projections', async () => {
    const requests: RecordedRequest[] = [];
    const products = { items: [], total: 0 };
    const locations = [{ id: 'location-a', name: 'Fridge', type: 'fridge', version: 1 }];
    const transport = {
        request: (route: string, body?: unknown, signal?: AbortSignal, params?: unknown, options?: unknown) => {
            requests.push({ route, body, signal, params, options });
            return Promise.resolve({ data: route === 'GET /api/v1/products' ? products : { items: locations } });
        },
    };
    const signal = new AbortController().signal;

    assert.equal(await loadIngestProducts(transport as never, 'milk', undefined, signal), products);
    assert.equal(await loadIngestProducts(transport as never, '4600000000000', '4600000000000', signal), products);
    assert.equal(await loadIngestLocations(transport as never, 'family', signal), locations);
    assert.deepEqual(requests, [
        {
            route: 'GET /api/v1/products',
            body: undefined,
            signal,
            params: undefined,
            options: { query: { q: 'milk', limit: '20', offset: '0' } },
        },
        {
            route: 'GET /api/v1/products',
            body: undefined,
            signal,
            params: undefined,
            options: { query: { barcode: '4600000000000', limit: '20', offset: '0' } },
        },
        {
            route: 'GET /api/v1/inventory-locations',
            body: undefined,
            signal,
            params: undefined,
            options: { query: { scope: 'family' } },
        },
    ]);
});

void test('inventory import adapter forwards the same pending command and preserves data and error identity', async () => {
    const command = {
        rows: [],
        idempotencyKey: '00000000-0000-0000-0000-000000000001',
    } as unknown as InventoryImportCommand;
    const result = { items: [] };
    const requests: unknown[][] = [];
    const transport = {
        request: (...args: unknown[]) => {
            requests.push(args);
            return Promise.resolve({ data: result });
        },
    };

    assert.equal(await commitInventoryImport(transport as never, command), result);
    assert.deepEqual(requests, [['POST /api/v1/inventory/import/commit', command]]);
    assert.equal(requests[0]?.[1], command);

    const error = new Error('unknown outcome');
    await assert.rejects(
        commitInventoryImport({ request: () => Promise.reject(error) } as never, command),
        (actual) => actual === error,
    );
});

void test('inventory ingest UI keeps pending retry ownership while multipart upload flows stay untouched', async () => {
    const [review, adapter, importPage, scanPage] = await Promise.all([
        readFile('src/features/inventory-ingest/review.tsx', 'utf8'),
        readFile('src/features/inventory-ingest/api.ts', 'utf8'),
        readFile('src/features/inventory-ingest/import-page.tsx', 'utf8'),
        readFile('src/features/inventory-ingest/scan-page.tsx', 'utf8'),
    ]);

    assert.doesNotMatch(review, /\.request\s*\(/u);
    assert.match(review, /loadIngestProducts\(api!, search, row\.barcode, signal\)/u);
    assert.match(review, /loadIngestLocations\(api!, scope, signal\)/u);
    assert.match(review, /pendingCommand\.current \?\?= \{/u);
    assert.match(review, /commitInventoryImport\(api, pendingCommand\.current\)/u);
    assert.match(review, /idempotencyKey: crypto\.randomUUID\(\)/gu);
    assert.match(review, /mutation\.isError && !definiteFailure/u);
    assert.match(review, /invalidateQueries\(\{ queryKey: inventoryKeys\.root \}\)/u);
    assert.match(adapter, /inventoryScopeQuery\(scope\)/u);

    for (const source of [importPage, scanPage]) {
        assert.match(source, /const body = new FormData\(\)/u);
        assert.match(source, /upload\.current\?\.abort\(\)/u);
        assert.match(source, /upload\.current = new AbortController\(\)/u);
        assert.match(source, /api\.upload\(/u);
    }
});
