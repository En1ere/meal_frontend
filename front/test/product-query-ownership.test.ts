import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { productKeys as publicProductKeys } from '../src/entities/product/model.js';
import { productKeys } from '../src/entities/product/query-keys.js';
import {
    loadPrivateProductLocations,
    loadProduct,
    loadProductInventory,
    loadProductReference,
    submitProductProposal,
} from '../src/features/products/api.js';

void test('product entity preserves exact distinct projection tuples', () => {
    assert.equal(publicProductKeys, productKeys);
    assert.deepEqual(productKeys.ingestSearch(undefined, 'milk'), ['products', 'ingest', undefined, 'milk']);
    assert.deepEqual(productKeys.ingestSearch('user-a', '4600000000000'), [
        'products',
        'ingest',
        'user-a',
        '4600000000000',
    ]);
    assert.deepEqual(productKeys.editorSearch('user-a', 'milk'), ['products', 'editor', 'user-a', 'milk']);
    assert.deepEqual(productKeys.familyRecipeCatalog('user-a'), ['products', 'family-recipe', 'user-a']);
    assert.deepEqual(productKeys.detail(undefined, 'product-a'), ['product', undefined, 'product-a']);
    assert.deepEqual(productKeys.reference('user-a'), ['product-reference', 'user-a']);
    assert.notDeepEqual(productKeys.ingestSearch('user-a', 'milk'), productKeys.editorSearch('user-a', 'milk'));
});

void test('products adapter preserves cross-domain read projections and caller-owned proposal identity', async () => {
    const calls: unknown[][] = [];
    const reference = { categories: [], allergens: [] };
    const product = { id: 'product-a' };
    const inventory = { items: [], total: 0 };
    const locations = [{ id: 'location-a' }];
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            const route = args[0];
            const data =
                route === 'GET /api/v1/products/reference'
                    ? reference
                    : route === 'GET /api/v1/products/{id}' || route === 'POST /api/v1/products/proposals'
                      ? { product }
                      : route === 'GET /api/v1/inventory'
                        ? inventory
                        : { items: locations };
            return Promise.resolve({ data });
        },
    };
    const signal = new AbortController().signal;
    const command = { name: 'Milk', idempotencyKey: 'persistent-key' };

    assert.equal(await loadProductReference(transport as never, signal), reference);
    assert.equal(await submitProductProposal(transport as never, command as never, signal), product);
    assert.equal(await loadProduct(transport as never, 'product-a', signal), product);
    assert.equal(await loadProductInventory(transport as never, 'product-a', '2026-11-06', signal), inventory);
    assert.equal(await loadPrivateProductLocations(transport as never, signal), locations);

    assert.deepEqual(calls[0], ['GET /api/v1/products/reference', undefined, signal]);
    assert.deepEqual(calls[1], ['POST /api/v1/products/proposals', command, signal]);
    assert.equal(calls[1]?.[1], command);
    assert.deepEqual(calls[2], ['GET /api/v1/products/{id}', undefined, signal, { id: 'product-a' }]);
    assert.deepEqual(calls[3], [
        'GET /api/v1/inventory',
        undefined,
        signal,
        undefined,
        { query: { ingredientId: 'product-a', localDate: '2026-11-06', limit: '100' } },
    ]);
    assert.deepEqual(calls[4], [
        'GET /api/v1/inventory-locations',
        undefined,
        signal,
        undefined,
        { query: { scope: 'private' } },
    ]);

    const error = new Error('transport failed');
    await assert.rejects(
        loadProductReference({ request: () => Promise.reject(error) } as never),
        (actual) => actual === error,
    );
});

void test('product consumers use exact owners without changing transport projections or commands', async () => {
    const [ingest, ingestApi, editor, editorApi, familyDetail, recipeReadApi, detail, productNew, productsApi] =
        await Promise.all([
            readFile('src/features/inventory-ingest/review.tsx', 'utf8'),
            readFile('src/features/inventory-ingest/api.ts', 'utf8'),
            readFile('src/features/recipes/editor.tsx', 'utf8'),
            readFile('src/features/recipes/editor-api.ts', 'utf8'),
            readFile('src/features/recipes/family-detail.tsx', 'utf8'),
            readFile('src/features/recipes/read-api.ts', 'utf8'),
            readFile('src/features/products/product-detail.tsx', 'utf8'),
            readFile('src/features/products/product-new.tsx', 'utf8'),
            readFile('src/features/products/api.ts', 'utf8'),
        ]);
    const sources = [ingest, editor, familyDetail, detail, productNew];

    assert.equal(sources.flatMap((source) => source.match(/productKeys\./gu) ?? []).length, 5);
    for (const source of sources) {
        assert.doesNotMatch(source, /queryKey:\s*\[['"]products?(?:-reference)?['"]/u);
    }

    assert.match(ingest, /queryKey: productKeys\.ingestSearch\(session\.data\?\.id, search\)/u);
    assert.match(ingest, /loadIngestProducts\(api!, search, row\.barcode, signal\)/u);
    assert.match(ingestApi, /barcode && search === barcode/u);
    assert.match(ingestApi, /\{ barcode \} : \{ q: search \}/u);
    assert.match(ingestApi, /limit: ['"]20['"],\s*offset: ['"]0['"]/u);
    assert.match(ingestApi, /\)\s*\.data/u);

    assert.match(editor, /queryKey: productKeys\.editorSearch\(user\.data\?\.id, search\)/u);
    assert.match(editor, /loadRecipeEditorProducts\(api!, search, signal\)/u);
    assert.match(editorApi, /query: \{ q: search, limit: ['"]100['"] \}/u);
    assert.match(editorApi, /\)\s*\.data/u);
    assert.match(editorApi, /'POST \/api\/v1\/recipe-workspace'/u);
    assert.match(editor, /idempotencyKey: attempt\.current\.key/u);

    assert.match(familyDetail, /queryKey: productKeys\.familyRecipeCatalog\(session\.data\?\.id\)/u);
    assert.match(familyDetail, /loadFamilyRecipeProducts\(api!, signal\)/u);
    assert.match(recipeReadApi, /query: \{ limit: ['"]100['"] \}/u);
    assert.match(recipeReadApi, /\.data\s*\.items/u);

    assert.match(detail, /queryKey: productKeys\.detail\(user\.data\?\.id, id\)/u);
    assert.match(detail, /loadProduct\(api!, id, signal\)/u);
    assert.match(detail, /loadProductInventory\(api!, id, localDate\(\), signal\)/u);
    assert.match(detail, /loadPrivateProductLocations\(api!, signal\)/u);
    assert.doesNotMatch(detail, /\.request\s*\(/u);

    assert.match(productNew, /queryKey: productKeys\.reference\(user\.data\?\.id\)/u);
    assert.match(productNew, /loadProductReference\(api!, signal\)/u);
    assert.match(productNew, /submitProductProposal\(/u);
    assert.doesNotMatch(productNew, /\.request\s*\(/u);
    assert.match(productNew, /attempt\.current = \{ key: crypto\.randomUUID\(\), fingerprint \}/u);
    assert.match(productNew, /idempotencyKey: attempt\.current\.key/u);
    assert.match(productNew, /savedBody\.current = body/u);
    assert.match(productNew, /const abort = signal\(\)/u);
    assert.match(productNew, /if \(abort\.aborted\) return/u);
    assert.match(productNew, /setUncertain\(!\(err instanceof ApiError\) \|\| err\.status >= 500\)/u);
    assert.match(productNew, /err instanceof ApiError && err\.status < 500\) attempt\.current = null/u);
    assert.match(productNew, /invalidateQueries\(\{ queryKey: inventoryKeys\.productSearchRoot \}\)/u);
    assert.match(productNew, /router\.push\(`\/products\/\$\{product\.id\}`\)/u);

    for (const route of [
        'GET /api/v1/products/reference',
        'POST /api/v1/products/proposals',
        'GET /api/v1/products/{id}',
        'GET /api/v1/inventory',
        'GET /api/v1/inventory-locations',
    ])
        assert.ok(productsApi.includes(`'${route}'`) || productsApi.includes(`"${route}"`), `${route} is preserved`);
    assert.doesNotMatch(productsApi, /crypto\.randomUUID/u);
});
