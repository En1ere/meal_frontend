import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { shoppingKeys } from '../src/features/shopping/query-keys.js';
import { shoppingQueryRoots } from '../src/entities/shopping/query-keys.js';

void test('shopping receipt keys preserve exact capabilities, detail and duplicate projections', () => {
    assert.deepEqual(shoppingKeys.receiptCapabilities, ['receipt-capabilities']);
    assert.deepEqual(shoppingKeys.receipt(undefined, 'private', 'receipt-a'), [
        'receipts',
        undefined,
        'private',
        'receipt-a',
    ]);
    assert.deepEqual(shoppingKeys.receipt('user-a', 'family', 'receipt-b'), [
        'receipts',
        'user-a',
        'family',
        'receipt-b',
    ]);
    assert.deepEqual(shoppingKeys.receiptDuplicates('user-a', 'family', 'receipt-b'), [
        'receipts',
        'user-a',
        'family',
        'receipt-b',
        'duplicates',
    ]);
    assert.notDeepEqual(
        shoppingKeys.receipt('user-a', 'family', 'receipt-b'),
        shoppingKeys.receiptDuplicates('user-a', 'family', 'receipt-b'),
    );
});

void test('shopping list keys preserve exact filters, scope, optional ids and projection lifecycles', () => {
    const filters = { q: 'milk', status: 'active', cursor: 'next-a', scope: 'family' as const };
    const listKey = shoppingKeys.lists('user-a', filters);
    assert.deepEqual(listKey, ['shopping', 'user-a', 'lists', filters]);
    assert.equal(listKey[3], filters);
    assert.deepEqual(shoppingKeys.lists(undefined, { q: '', status: 'active', scope: 'private' }), [
        'shopping',
        undefined,
        'lists',
        { q: '', status: 'active', scope: 'private' },
    ]);
    assert.deepEqual(shoppingKeys.detail(null, 'private', undefined), ['shopping', null, 'private', undefined]);
    assert.deepEqual(shoppingKeys.detail(undefined, 'private', undefined), [
        'shopping',
        undefined,
        'private',
        undefined,
    ]);
    assert.deepEqual(shoppingKeys.history('user-a', 'family', 'list-a'), [
        'shopping',
        'user-a',
        'family',
        'list-a',
        'history',
    ]);
    assert.deepEqual(shoppingKeys.recipePreview(undefined, null, '1'), [
        'shopping',
        undefined,
        'recipe-preview',
        null,
        '1',
    ]);
    assert.deepEqual(shoppingKeys.recipePreview('user-a', 'recipe-a', '1000'), [
        'shopping',
        'user-a',
        'recipe-preview',
        'recipe-a',
        '1000',
    ]);
});

void test('shopping catalog and purchase keys preserve exact account, scope and discriminator tuples', () => {
    assert.deepEqual(shoppingKeys.catalogSearch(undefined, 'private', ''), [
        'shopping-catalog',
        undefined,
        'private',
        'search',
        '',
    ]);
    assert.deepEqual(shoppingKeys.catalogSearch('user-a', 'family', 'milk'), [
        'shopping-catalog',
        'user-a',
        'family',
        'search',
        'milk',
    ]);
    assert.deepEqual(shoppingKeys.catalogDetail('user-a', 'family', null), [
        'shopping-catalog',
        'user-a',
        'family',
        'detail',
        null,
    ]);
    assert.deepEqual(shoppingKeys.catalogDetail('user-a', 'private', 'ingredient-a'), [
        'shopping-catalog',
        'user-a',
        'private',
        'detail',
        'ingredient-a',
    ]);
    assert.deepEqual(shoppingKeys.purchase(undefined, 'private', 'purchase-a'), [
        'purchases',
        undefined,
        'private',
        'purchase-a',
    ]);
});

void test('catalog and purchase consumers use exact owners without changing transport or visibility', async () => {
    const [picker, purchase, command] = await Promise.all([
        readFile('src/features/shopping/product-picker.tsx', 'utf8'),
        readFile('src/features/shopping/purchase-resolution.tsx', 'utf8'),
        readFile('src/features/shopping/use-command.ts', 'utf8'),
    ]);

    assert.match(picker, /queryKey: shoppingKeys\.catalogSearch\(user\.data\?\.id, scope, q\)/u);
    assert.match(picker, /queryKey: shoppingKeys\.catalogDetail\(user\.data\?\.id, scope, ingredientId\)/u);
    assert.doesNotMatch(picker, /queryKey: \[['"]shopping-catalog['"]/u);
    assert.match(picker, /loadShoppingProducts\(api!, q, signal\)/u);
    assert.match(picker, /loadShoppingProduct\(api!, ingredientId!, signal\)/u);
    assert.match(picker, /scope === ['"]private['"] \|\| product\.status === ['"]approved['"]/u);
    assert.match(picker, /scope === ['"]private['"] \|\| detail\.data\?\.product\.status === ['"]approved['"]/u);

    assert.match(purchase, /queryKey: shoppingKeys\.purchase\(user\.data\?\.id, scope, id\)/u);
    assert.doesNotMatch(purchase, /queryKey: \[['"]purchases['"]/u);
    assert.match(purchase, /loadShoppingPurchase\(api!, id, scope, signal\)/u);
    assert.match(purchase, /enabled: !!api && !!user\.data/u);

    assert.match(command, /queryKey: shoppingQueryRoots\.root/u);
    assert.match(command, /queryKey: shoppingQueryRoots\.receiptsRoot/u);
    assert.match(command, /queryKey: shoppingQueryRoots\.purchasesRoot/u);
});

void test('shopping page uses exact owners without changing transport, offline or command behavior', async () => {
    const source = await readFile('src/features/shopping/page.tsx', 'utf8');

    assert.match(source, /queryKey: shoppingKeys\.lists\(owner, query\)/u);
    assert.match(source, /queryKey: shoppingKeys\.detail\(owner, scope, id\)/u);
    assert.match(source, /queryKey: shoppingKeys\.history\(owner, scope, id\)/u);
    assert.match(source, /queryKey: shoppingKeys\.recipePreview\(user\.data\?\.id, recipeId, servings\)/u);
    assert.doesNotMatch(source, /queryKey: \[['"]shopping['"]/u);

    assert.match(source, /loadShoppingLists\(api!, query, signal\)/u);
    assert.match(source, /loadShoppingList\(api!, id!, scope, signal\)/u);
    assert.match(source, /loadShoppingHistory\(api!, id!, scope, signal\)/u);
    assert.match(source, /loadShoppingRecipePreview\(api!, recipeId!, servings, scope, signal\)/u);
    assert.match(source, /q: search\.get\(['"]q['"]\) \?\? ['"]['"]/u);
    assert.match(source, /status: search\.get\(['"]status['"]\) \?\? ['"]active['"]/u);
    assert.match(
        source,
        /\.\.\.\(search\.get\(['"]cursor['"]\) \? \{ cursor: search\.get\(['"]cursor['"]\)! \} : \{\}\)/u,
    );
    assert.match(source, /const key = `shopping:lists:\$\{JSON\.stringify\(query\)\}`/u);
    assert.match(source, /readOfflineSnapshotData<Success<['"]GET \/api\/v1\/shopping-lists['"]>\[['"]data['"]\]>/u);
    assert.match(source, /readOfflineSnapshotData<List>\(owner!, key\)/u);
    assert.match(source, /typeof navigator !== ['"]undefined['"] && navigator\.onLine/u);
    assert.match(source, /cmd\.run\(['"]POST \/api\/v1\/shopping-lists['"], \{ title \}\)/u);
    assert.match(source, /'POST \/api\/v1\/shopping-lists\/\{id\}\/command'/u);
});

void test('receipt screens use private owners without changing read or command semantics', async () => {
    const [detail, create, command] = await Promise.all([
        readFile('src/features/shopping/receipts/detail-page.tsx', 'utf8'),
        readFile('src/features/shopping/receipts/new-page.tsx', 'utf8'),
        readFile('src/features/shopping/use-command.ts', 'utf8'),
    ]);

    assert.match(detail, /queryKey: shoppingKeys\.receipt\(user\.data\?\.id, scope, id\)/u);
    assert.match(detail, /queryKey: shoppingKeys\.receiptDuplicates\(user\.data\?\.id, scope, id\)/u);
    assert.match(create, /queryKey: shoppingKeys\.receiptCapabilities/u);
    assert.doesNotMatch(detail, /queryKey: \[['"]receipts['"]/u);
    assert.doesNotMatch(create, /queryKey: \[['"]receipt-capabilities['"]\]/u);

    assert.match(detail, /loadShoppingReceipt\(api!, id, scope, signal\)/u);
    assert.match(detail, /loadShoppingReceiptDuplicates\(api!, id, scope, signal\)/u);
    assert.match(detail, /detail\.data\?\.receipt\.status === ['"]draft['"]/u);
    assert.match(create, /loadShoppingReceiptCapabilities\(api!, signal\)/u);
    assert.match(create, /cmd\.run\(['"]POST \/api\/v1\/receipts['"]/u);
    assert.match(command, /body: \{ \.\.\.structuredClone\(body\), scope, idempotencyKey: crypto\.randomUUID\(\) \}/u);
    assert.match(command, /frozen\.current \?\?=/u);
    assert.match(command, /const operation = frozen\.current/u);

    assert.deepEqual(shoppingQueryRoots.root, ['shopping']);
    assert.deepEqual(shoppingQueryRoots.receiptsRoot, ['receipts']);
    assert.deepEqual(shoppingQueryRoots.purchasesRoot, ['purchases']);
    assert.doesNotMatch(command, /queryKey: \[key\]/u);
});

void test('purchase line editor has one private owner and keeps the review compatibility exports', async () => {
    const [lines, review, resolution] = await Promise.all([
        readFile('src/features/shopping/purchase-lines.tsx', 'utf8'),
        readFile('src/features/shopping/purchase-review.tsx', 'utf8'),
        readFile('src/features/shopping/purchase-resolution.tsx', 'utf8'),
    ]);

    assert.match(lines, /export function PurchaseLines/u);
    assert.match(lines, /export const emptyPurchaseLine/u);
    assert.match(lines, /queryKey: inventoryKeys\.locations\(scope, user\.data\?\.id\)/u);
    assert.match(lines, /loadShoppingLocations\(api!, scope, signal\)/u);
    assert.match(review, /export \{ PurchaseLines, emptyPurchaseLine \}/u);
    assert.match(review, /export type \{ PurchaseLine \}/u);
    assert.match(review, /from ['"]\.\/purchase-lines\.js['"]/u);
    assert.match(review, /from ['"]\.\/purchase-resolution\.js['"]/u);
    assert.match(resolution, /from ['"]\.\/purchase-lines\.js['"]/u);
    assert.doesNotMatch(resolution, /from ['"]\.\/purchase-review\.js['"]/u);
});
