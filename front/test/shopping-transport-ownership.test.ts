import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
    loadShoppingEntitlements,
    loadShoppingHistory,
    loadShoppingList,
    loadShoppingLists,
    loadShoppingLocations,
    loadShoppingProduct,
    loadShoppingProducts,
    loadShoppingPurchase,
    loadShoppingReceipt,
    loadShoppingReceiptCapabilities,
    loadShoppingReceiptDuplicates,
    loadShoppingRecipePreview,
    previewPurchaseResolution,
    previewShoppingPurchase,
} from '../src/features/shopping/api.js';

void test('shopping adapter preserves exact reads, projections, prepared previews, signals and native errors', async () => {
    const calls: unknown[][] = [];
    const data = { items: ['item'], marker: 'data' };
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            return Promise.resolve({ data });
        },
    };
    const signal = new AbortController().signal;
    const query = { q: 'milk', status: 'active', cursor: 'next-a', scope: 'family' as const };
    const command = { version: 7, scope: 'family', lines: [], purchasedAt: '2026-11-06T12:00:00.000Z' } as never;

    assert.equal(await loadShoppingLists(transport as never, query, signal), data);
    assert.equal(await loadShoppingList(transport as never, 'list-a', 'family', signal), data);
    assert.equal(await loadShoppingHistory(transport as never, 'list-a', 'family', signal), data);
    assert.equal(await loadShoppingRecipePreview(transport as never, 'recipe-a', '4', 'family', signal), data);
    assert.equal(await loadShoppingProducts(transport as never, 'milk', signal), data);
    assert.equal(await loadShoppingProduct(transport as never, 'product-a', signal), data);
    assert.equal(await loadShoppingLocations(transport as never, 'family', signal), data.items);
    assert.equal(await loadShoppingPurchase(transport as never, 'purchase-a', 'family', signal), data);
    assert.equal(await previewPurchaseResolution(transport as never, 'purchase-a', command), data);
    assert.equal(await previewShoppingPurchase(transport as never, 'shopping', 'list-a', command, signal), data);
    assert.equal(await previewShoppingPurchase(transport as never, 'receipt', 'receipt-a', command, signal), data);
    assert.equal(await loadShoppingReceipt(transport as never, 'receipt-a', 'family', signal), data);
    assert.equal(await loadShoppingReceiptDuplicates(transport as never, 'receipt-a', 'family', signal), data);
    assert.equal(await loadShoppingEntitlements(transport as never, signal), data);
    assert.equal(await loadShoppingReceiptCapabilities(transport as never, signal), data);

    assert.deepEqual(calls, [
        ['GET /api/v1/shopping-lists', undefined, signal, undefined, { query }],
        ['GET /api/v1/shopping-lists/{id}', undefined, signal, { id: 'list-a' }, { query: { scope: 'family' } }],
        [
            'GET /api/v1/shopping-lists/{id}/history',
            undefined,
            signal,
            { id: 'list-a' },
            { query: { scope: 'family' } },
        ],
        [
            'GET /api/v1/shopping-lists/recipe-preview',
            undefined,
            signal,
            undefined,
            { query: { recipeId: 'recipe-a', servings: '4', scope: 'family' } },
        ],
        ['GET /api/v1/products', undefined, signal, undefined, { query: { q: 'milk', limit: '20' } }],
        ['GET /api/v1/products/{id}', undefined, signal, { id: 'product-a' }],
        ['GET /api/v1/inventory-locations', undefined, signal, undefined, { query: { scope: 'family' } }],
        ['GET /api/v1/purchases/{id}', undefined, signal, { id: 'purchase-a' }, { query: { scope: 'family' } }],
        ['POST /api/v1/purchases/{id}/resolve-preview', command, undefined, { id: 'purchase-a' }],
        ['POST /api/v1/shopping-lists/{id}/purchase-preview', command, signal, { id: 'list-a' }],
        ['POST /api/v1/receipts/{id}/intake-preview', command, signal, { id: 'receipt-a' }],
        ['GET /api/v1/receipts/{id}', undefined, signal, { id: 'receipt-a' }, { query: { scope: 'family' } }],
        [
            'GET /api/v1/receipts/{id}/duplicates',
            undefined,
            signal,
            { id: 'receipt-a' },
            { query: { scope: 'family' } },
        ],
        ['GET /api/v1/entitlements', undefined, signal],
        ['GET /api/v1/receipts/capabilities', undefined, signal],
    ]);
    assert.equal((calls[0]?.[4] as { query: unknown }).query, query);

    const error = new Error('transport failed');
    await assert.rejects(
        loadShoppingLists({ request: () => Promise.reject(error) } as never, query),
        (actual) => actual === error,
    );
});

void test('shopping consumers use the private adapter while UI keeps orchestration and recovery ownership', async () => {
    const [page, picker, lines, resolution, review, receiptDetail, receiptNew, command, adapter] = await Promise.all([
        readFile('src/features/shopping/page.tsx', 'utf8'),
        readFile('src/features/shopping/product-picker.tsx', 'utf8'),
        readFile('src/features/shopping/purchase-lines.tsx', 'utf8'),
        readFile('src/features/shopping/purchase-resolution.tsx', 'utf8'),
        readFile('src/features/shopping/purchase-review.tsx', 'utf8'),
        readFile('src/features/shopping/receipts/detail-page.tsx', 'utf8'),
        readFile('src/features/shopping/receipts/new-page.tsx', 'utf8'),
        readFile('src/features/shopping/use-command.ts', 'utf8'),
        readFile('src/features/shopping/api.ts', 'utf8'),
    ]);
    for (const source of [page, picker, lines, resolution, review, receiptDetail, receiptNew])
        assert.doesNotMatch(source, /\.request\s*\(/u);

    assert.match(page, /loadShoppingLists\(api!, query, signal\)/u);
    assert.match(page, /loadShoppingList\(api!, id!, scope, signal\)/u);
    assert.match(page, /loadShoppingHistory\(api!, id!, scope, signal\)/u);
    assert.match(page, /loadShoppingRecipePreview\(api!, recipeId!, servings, scope, signal\)/u);
    assert.match(page, /readOfflineSnapshotData/u);
    assert.match(page, /saveOfflineSnapshot/u);
    assert.match(picker, /scope === ['"]private['"] \|\| product\.status === ['"]approved['"]/u);
    assert.match(lines, /loadShoppingLocations\(api!, scope, signal\)/u);
    assert.match(resolution, /previewPurchaseResolution\(api, id,/u);
    assert.match(review, /previewShoppingPurchase\(api, ['"]shopping['"]/u);
    assert.match(review, /previewShoppingPurchase\(api, ['"]receipt['"]/u);
    assert.match(receiptDetail, /loadShoppingReceiptDuplicates\(api!, id, scope, signal\)/u);
    assert.match(receiptNew, /loadShoppingEntitlements\(api!, signal\)/u);
    assert.match(receiptNew, /api\.upload\(['"]POST \/api\/v1\/inventory\/ingest\/scan['"]/u);
    assert.match(receiptNew, /PDF · временно недоступен/u);
    assert.match(receiptNew, /cmd\.run\(['"]POST \/api\/v1\/receipts['"]/u);

    assert.match(command, /frozen\.current \?\?=/u);
    assert.match(command, /crypto\.randomUUID\(\)/u);
    assert.match(command, /queryClient\.invalidateQueries/u);
    assert.match(command, /e\.status === 401/u);
    assert.match(adapter, /kind === ['"]shopping['"]/u);
});
