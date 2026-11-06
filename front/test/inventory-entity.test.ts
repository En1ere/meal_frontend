import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inventoryScopeQuery, places } from '../src/entities/inventory/model.js';
import { inventoryKeys } from '../src/entities/inventory/query-keys.js';
import { expiryText } from '../src/entities/inventory/presentation.js';
import { units } from '../src/entities/measurement/model.js';
import { dateText, localDate } from '../src/shared/lib/date.js';
import { inventoryBase } from '../src/entities/inventory/routes.js';

void test('measurement and inventory reference dictionaries preserve exact wire codes', () => {
    assert.deepEqual(units, { g: 'г', kg: 'кг', ml: 'мл', l: 'л', pcs: 'шт.', pack: 'уп.', serv: 'порц.' });
    assert.deepEqual(places, {
        fridge: 'Холодильник',
        freezer: 'Морозилка',
        cabinet: 'Шкаф',
        pantry: 'Кладовая',
        shelf: 'Полка',
    });
});

void test('inventory scope and query keys keep private and family caches isolated', () => {
    assert.deepEqual(inventoryScopeQuery('private'), { scope: 'private' });
    assert.deepEqual(inventoryScopeQuery('family'), { scope: 'family' });
    assert.equal(inventoryBase('private'), '/inventory');
    assert.equal(inventoryBase('family'), '/family/inventory');
    assert.deepEqual(inventoryKeys.root, ['inventory']);
    const filters = {
        q: 'milk',
        status: 'active',
        attention: 'all',
        days: '3',
        localDate: '2026-11-05',
        limit: '50',
        offset: '0',
        locationId: 'location-1',
    };
    const listKey = inventoryKeys.list('private', undefined, filters);
    assert.deepEqual(listKey, ['inventory', 'private', undefined, filters]);
    assert.equal(listKey[3], filters);
    assert.deepEqual(inventoryKeys.list('family', 'user-1', filters), ['inventory', 'family', 'user-1', filters]);
    assert.deepEqual(inventoryKeys.batch('private', undefined, 'batch-1'), [
        'inventory',
        'private',
        'batch',
        undefined,
        'batch-1',
    ]);
    assert.deepEqual(inventoryKeys.batch('family', 'user-1', 'batch-1'), [
        'inventory',
        'family',
        'batch',
        'user-1',
        'batch-1',
    ]);
    assert.deepEqual(inventoryKeys.atLocation('private', undefined, 'location-1'), [
        'inventory',
        'private',
        'location',
        undefined,
        'location-1',
    ]);
    assert.deepEqual(inventoryKeys.atLocation('family', 'user-1', 'location-1'), [
        'inventory',
        'family',
        'location',
        'user-1',
        'location-1',
    ]);
    assert.deepEqual(inventoryKeys.cookingReview(undefined, 'attempt-1'), [
        'inventory',
        undefined,
        'cooking-review',
        'attempt-1',
    ]);
    assert.deepEqual(inventoryKeys.cookingReview('user-1', 'attempt-1'), [
        'inventory',
        'user-1',
        'cooking-review',
        'attempt-1',
    ]);
    assert.deepEqual(inventoryKeys.forProduct('user-1', 'product-1'), ['inventory', 'product', 'user-1', 'product-1']);
    assert.deepEqual(inventoryKeys.attentionRoot, ['inventory-attention']);
    assert.deepEqual(inventoryKeys.attention('private', undefined, '3', '2026-11-05'), [
        'inventory-attention',
        'private',
        undefined,
        '3',
        '2026-11-05',
    ]);
    assert.deepEqual(inventoryKeys.attention('family', 'user-1', '7', '2026-11-06'), [
        'inventory-attention',
        'family',
        'user-1',
        '7',
        '2026-11-06',
    ]);
    assert.deepEqual(inventoryKeys.historyRoot, ['inventory-history']);
    assert.deepEqual(inventoryKeys.history('private', undefined, undefined, '', '', '', '', 0), [
        'inventory-history',
        'private',
        undefined,
        undefined,
        '',
        '',
        '',
        '',
        0,
    ]);
    assert.deepEqual(
        inventoryKeys.history('family', 'user-1', 'batch-1', 'milk', 'consume', '2026-11-01', '2026-11-05', 100),
        ['inventory-history', 'family', 'user-1', 'batch-1', 'milk', 'consume', '2026-11-01', '2026-11-05', 100],
    );
    assert.deepEqual(inventoryKeys.productSearchRoot, ['inventory-products']);
    assert.deepEqual(inventoryKeys.productSearch(undefined, ''), ['inventory-products', undefined, '']);
    assert.deepEqual(inventoryKeys.productSearch('user-1', 'milk'), ['inventory-products', 'user-1', 'milk']);
    assert.deepEqual(inventoryKeys.locationsRoot, ['inventory-locations']);
    assert.deepEqual(inventoryKeys.locations('private', 'user-1'), ['inventory-locations', 'private', 'user-1']);
    assert.deepEqual(inventoryKeys.locations('family', 'user-1'), ['inventory-locations', 'family', 'user-1']);
    assert.deepEqual(inventoryKeys.preserveLocations(undefined, 'private'), [
        'inventory-locations',
        undefined,
        'private',
    ]);
    assert.deepEqual(inventoryKeys.preserveLocations('user-1', 'family'), ['inventory-locations', 'user-1', 'family']);
    assert.deepEqual(inventoryKeys.cookingLocations(undefined), ['inventory-locations', undefined]);
    assert.deepEqual(inventoryKeys.cookingLocations('user-1'), ['inventory-locations', 'user-1']);
    assert.notDeepEqual(
        inventoryKeys.preserveLocations('user-1', 'private'),
        inventoryKeys.locations('private', 'user-1'),
    );
    assert.notDeepEqual(inventoryKeys.cookingLocations('user-1'), inventoryKeys.locations('private', 'user-1'));
});

void test('inventory dates remain local-calendar based and deterministic around expiry', () => {
    const now = new Date(2026, 0, 2, 23, 30);
    assert.equal(localDate(now), '2026-01-02');
    assert.equal(dateText(null), 'Не указана');
    assert.equal(dateText('2026-01-02'), '02.01.2026');
    assert.equal(expiryText(null, now), 'Срок не указан');
    assert.equal(expiryText('2026-01-01', now), 'Срок истёк');
    assert.equal(expiryText('2026-01-02', now), 'Истекает сегодня');
    assert.equal(expiryText('2026-01-05', now), 'Через 3 дн.');
});

void test('broad invalidations use the inventory owner without changing command markers', async () => {
    const [diary, diaryApi, create, detail, inventoryApi, cooking] = await Promise.all([
        readFile('src/features/diary/diary-page.tsx', 'utf8'),
        readFile('src/features/diary/api.ts', 'utf8'),
        readFile('src/features/inventory/create-page.tsx', 'utf8'),
        readFile('src/features/inventory/detail-page.tsx', 'utf8'),
        readFile('src/features/inventory/api.ts', 'utf8'),
        readFile('src/features/recipes/cooking.tsx', 'utf8'),
    ]);
    assert.deepEqual(
        [diary, create, detail, cooking].map(
            (source) => source.match(/invalidateQueries\(\{ queryKey: inventoryKeys\.root \}\)/gu)?.length ?? 0,
        ),
        [1, 1, 2, 1],
    );
    for (const source of [diary, create, detail, cooking]) {
        assert.doesNotMatch(source, /invalidateQueries\(\{ queryKey: \[['"]inventory['"]\] \}\)/u);
    }

    assert.match(diary, /createDiaryEntry\(api!,/u);
    assert.match(diaryApi, /'POST \/api\/v1\/diary'/u);
    assert.match(diaryApi, /idempotencyKey: crypto\.randomUUID\(\)/u);
    assert.match(diary, /queryKey: proOverviewKeys\.root/u);

    assert.match(create, /createInventoryBatch\(/u);
    assert.match(inventoryApi, /'POST \/api\/v1\/inventory'/u);
    assert.match(create, /idempotencyKey: attempt\.current\.key/u);
    assert.match(create, /queryKey: inventoryKeys\.attentionRoot/u);

    assert.match(detail, /runInventoryBatchCommand\(/u);
    assert.match(inventoryApi, /'POST \/api\/v1\/inventory\/\{id\}\/command'/u);
    assert.match(detail, /version: batch\.version/u);
    assert.match(detail, /idempotencyKey: attempt\.current\.key/u);
    assert.match(detail, /queryKey: inventoryKeys\.historyRoot/u);
    assert.match(detail, /queryKey: inventoryKeys\.attentionRoot/u);

    assert.match(cooking, /'POST \/api\/v1\/cooking-attempts\/\{id\}\/finalize'/u);
    assert.match(cooking, /queryKey: recipeKeys\.cookingRoot/u);
    assert.match(cooking, /queryKey: preserveKeys\.root/u);
    assert.match(cooking, /queryKey: recipeKeys\.personalRoot/u);
});

void test('factory-compatible location caches use inventory owners and preserve incompatible tuples', async () => {
    const [create, detail, list, locations, inventoryApi, preserveDetail, preserveForm, preserveList, cooking] =
        await Promise.all([
            readFile('src/features/inventory/create-page.tsx', 'utf8'),
            readFile('src/features/inventory/detail-page.tsx', 'utf8'),
            readFile('src/features/inventory/list-page.tsx', 'utf8'),
            readFile('src/features/inventory/locations-page.tsx', 'utf8'),
            readFile('src/features/inventory/api.ts', 'utf8'),
            readFile('src/features/preserves/detail.tsx', 'utf8'),
            readFile('src/features/preserves/form.tsx', 'utf8'),
            readFile('src/features/preserves/list.tsx', 'utf8'),
            readFile('src/features/recipes/cooking.tsx', 'utf8'),
        ]);

    assert.deepEqual(
        [create, detail, list, locations].map(
            (source) => source.match(/queryKey: inventoryKeys\.locations\(scope, user\.data\?\.id\)/gu)?.length ?? 0,
        ),
        [1, 1, 1, 1],
    );
    for (const source of [create, detail, list, locations])
        assert.doesNotMatch(source, /queryKey: \[['"]inventory-locations['"], scope, user\.data\?\.id\]/u);

    assert.match(locations, /invalidateQueries\(\{ queryKey: inventoryKeys\.locationsRoot \}\)/u);
    assert.doesNotMatch(locations, /invalidateQueries\(\{ queryKey: \[['"]inventory-locations['"]\] \}\)/u);
    assert.match(locations, /saveInventoryLocation\(/u);
    assert.match(inventoryApi, /'POST \/api\/v1\/inventory-locations'/u);
    assert.match(locations, /const fingerprint = JSON\.stringify\(body\)/u);
    assert.match(locations, /attempt\.current = \{ key: crypto\.randomUUID\(\), fingerprint \}/u);
    assert.match(locations, /\{ \.\.\.body, idempotencyKey: attempt\.current\.key \}/u);
    assert.match(locations, /rename && current \? current\.version : undefined/u);
    assert.match(locations, /queryKey: inventoryKeys\.atLocation\(scope, user\.data\?\.id, selected\)/u);

    for (const source of [preserveDetail, preserveForm, preserveList])
        assert.match(source, /queryKey: inventoryKeys\.preserveLocations\(user\.data\?\.id, scope\)/u);
    assert.match(cooking, /queryKey: inventoryKeys\.cookingLocations\(user\.data\?\.id\)/u);
});

void test('scoped inventory projections use exact owners without changing reads or legacy location shapes', async () => {
    const [
        detail,
        list,
        locations,
        inventoryApi,
        cooking,
        cookingApi,
        preserveDetail,
        preserveForm,
        preserveList,
        preserveApi,
    ] = await Promise.all([
        readFile('src/features/inventory/detail-page.tsx', 'utf8'),
        readFile('src/features/inventory/list-page.tsx', 'utf8'),
        readFile('src/features/inventory/locations-page.tsx', 'utf8'),
        readFile('src/features/inventory/api.ts', 'utf8'),
        readFile('src/features/recipes/cooking.tsx', 'utf8'),
        readFile('src/features/recipes/cooking-read-api.ts', 'utf8'),
        readFile('src/features/preserves/detail.tsx', 'utf8'),
        readFile('src/features/preserves/form.tsx', 'utf8'),
        readFile('src/features/preserves/list.tsx', 'utf8'),
        readFile('src/features/preserves/api.ts', 'utf8'),
    ]);

    assert.match(detail, /queryKey: inventoryKeys\.batch\(scope, user\.data\?\.id, id\)/u);
    assert.match(list, /queryKey: inventoryKeys\.list\(scope, user\.data\?\.id, filters\)/u);
    assert.match(locations, /queryKey: inventoryKeys\.atLocation\(scope, user\.data\?\.id, selected\)/u);
    assert.match(cooking, /queryKey: inventoryKeys\.cookingReview\(user\.data\?\.id, attempt\.id\)/u);
    for (const source of [detail, list, locations, cooking])
        assert.doesNotMatch(source, /queryKey: \[['"]inventory['"]/u);

    assert.match(detail, /loadInventoryBatch\(api!, scope, id, signal\)/u);
    assert.match(list, /loadInventoryList\(api!, scope, filters, signal\)/u);
    assert.match(locations, /loadInventoryAtLocation\(api!, scope, selected, localDate\(\), signal\)/u);
    assert.match(inventoryApi, /'GET \/api\/v1\/inventory\/\{id\}'/u);
    assert.match(inventoryApi, /query: inventoryScopeQuery\(scope\)/u);
    assert.match(inventoryApi, /query: \{ \.\.\.filters, \.\.\.inventoryScopeQuery\(scope\) \}/u);
    assert.match(inventoryApi, /locationId/u);
    assert.match(inventoryApi, /limit: ['"]100['"]/u);
    assert.match(cooking, /loadCookingStockOptions\(api!, signal\)/u);
    assert.match(cookingApi, /'GET \/api\/v1\/cooking-attempts\/stock-options'/u);
    assert.match(cooking, /invalidateQueries\(\{ queryKey: inventoryKeys\.root \}\)/u);

    for (const source of [preserveDetail, preserveForm, preserveList]) {
        assert.match(source, /queryKey: inventoryKeys\.preserveLocations\(user\.data\?\.id, scope\)/u);
        assert.doesNotMatch(source, /queryKey: \[['"]inventory-locations['"]/u);
        assert.match(source, /loadPreserveLocations\(api!, scope, signal\)/u);
    }
    assert.match(preserveApi, /'GET \/api\/v1\/inventory-locations'/u);
    assert.match(preserveApi, /query: \{ scope \}/u);
    assert.match(preserveApi, /\)\s*\.data/u);
    assert.match(cooking, /queryKey: inventoryKeys\.cookingLocations\(user\.data\?\.id\)/u);
    assert.doesNotMatch(cooking, /queryKey: \[['"]inventory-locations['"]/u);
    assert.match(cooking, /loadCookingLocations\(api!, signal\)/u);
    assert.match(cookingApi, /transport\.request\(['"]GET \/api\/v1\/inventory-locations['"], undefined, signal\)/u);
});

void test('attention, history and product-search keys use exact owners without changing commands', async () => {
    const [create, detail, list, history, inventoryApi, productNew, productsApi, preserveCommand, shoppingCommand] =
        await Promise.all([
            readFile('src/features/inventory/create-page.tsx', 'utf8'),
            readFile('src/features/inventory/detail-page.tsx', 'utf8'),
            readFile('src/features/inventory/list-page.tsx', 'utf8'),
            readFile('src/features/inventory/history-page.tsx', 'utf8'),
            readFile('src/features/inventory/api.ts', 'utf8'),
            readFile('src/features/products/product-new.tsx', 'utf8'),
            readFile('src/features/products/api.ts', 'utf8'),
            readFile('src/features/preserves/use-command.ts', 'utf8'),
            readFile('src/features/shopping/use-command.ts', 'utf8'),
        ]);

    assert.match(create, /queryKey: inventoryKeys\.productSearch\(user\.data\?\.id, q\)/u);
    assert.match(create, /invalidateQueries\(\{ queryKey: inventoryKeys\.attentionRoot \}\)/u);
    assert.match(detail, /invalidateQueries\(\{ queryKey: inventoryKeys\.historyRoot \}\)/u);
    assert.match(detail, /invalidateQueries\(\{ queryKey: inventoryKeys\.attentionRoot \}\)/u);
    assert.match(
        list,
        /queryKey: inventoryKeys\.attention\(scope, user\.data\?\.id, filters\.days, filters\.localDate\)/u,
    );
    assert.match(
        history,
        /queryKey: inventoryKeys\.history\(scope, user\.data\?\.id, batchId, q, action, from, to, offset\)/u,
    );
    assert.match(productNew, /invalidateQueries\(\{ queryKey: inventoryKeys\.productSearchRoot \}\)/u);

    for (const source of [create, detail, list, history, productNew])
        assert.doesNotMatch(source, /\[['"]inventory-(?:attention|history|products)['"]/u);

    assert.match(create, /loadInventoryProducts\(api!, q, signal\)/u);
    assert.match(inventoryApi, /'GET \/api\/v1\/products'/u);
    assert.match(inventoryApi, /query: \{ q, limit: ['"]20['"] \}/u);
    assert.match(inventoryApi, /'POST \/api\/v1\/inventory'/u);
    assert.match(create, /idempotencyKey: attempt\.current\.key/u);
    assert.match(list, /loadInventoryAttention\(/u);
    assert.match(inventoryApi, /attention: ['"]expiring['"]/u);
    assert.match(inventoryApi, /status: ['"]active['"]/u);
    assert.match(inventoryApi, /limit: ['"]1['"]/u);
    assert.match(history, /loadInventoryHistory\(/u);
    assert.match(inventoryApi, /'GET \/api\/v1\/inventory-history'/u);
    assert.match(inventoryApi, /\.\.\.\(batchId \? \{ batchId \} : \{\}\)/u);
    assert.match(inventoryApi, /offset: String\(offset\)/u);
    assert.match(productsApi, /'POST \/api\/v1\/products\/proposals'/u);
    assert.match(productNew, /submitProductProposal\(/u);
    assert.match(productNew, /\{ \.\.\.body, idempotencyKey: attempt\.current\.key \}/u);

    for (const source of [preserveCommand, shoppingCommand]) {
        assert.match(source, /queryKey: inventoryKeys\.root/u);
        assert.match(source, /queryKey: inventoryKeys\.historyRoot/u);
        assert.doesNotMatch(source, /queryKey: \[key\]/u);
    }
});
