import test from 'node:test';
import assert from 'node:assert/strict';
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
    assert.deepEqual(inventoryKeys.forProduct('user-1', 'product-1'), ['inventory', 'product', 'user-1', 'product-1']);
    assert.deepEqual(inventoryKeys.locations('private', 'user-1'), ['inventory-locations', 'private', 'user-1']);
    assert.deepEqual(inventoryKeys.locations('family', 'user-1'), ['inventory-locations', 'family', 'user-1']);
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
