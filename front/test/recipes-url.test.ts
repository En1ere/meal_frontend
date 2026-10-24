import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    catalogState,
    catalogHref,
    detailState,
    safeCatalogReturn,
    scaleQuantity,
} from '../src/features/recipes/url-state.js';
void test('recipe URL states round-trip filters without mixing detail tabs', () => {
    const state = catalogState(new URLSearchParams('q=Паста&category=Супы&tab=inventory&page=3'));
    assert.deepEqual(catalogState(new URLSearchParams(catalogHref(state).split('?')[1])), state);
    assert.deepEqual(detailState(new URLSearchParams('tab=steps&servings=8'), 4), { tab: 'steps', servings: 8 });
    assert.equal(catalogState(new URLSearchParams('tab=steps&page=-1')).page, 1);
    assert.equal(detailState(new URLSearchParams('servings=1001'), 4).servings, 4);
});
void test('catalog back links reject external and unrelated locations', () => {
    for (const input of ['//evil.test', 'https://evil.test', '/recipes/secret', '/recipes%3fno'])
        assert.equal(safeCatalogReturn(input), '/recipes');
    assert.equal(safeCatalogReturn('/recipes?q=Паста&page=2'), '/recipes?q=%D0%9F%D0%B0%D1%81%D1%82%D0%B0&page=2');
});
void test('serving scale preserves unknown, zero and decimal values', () => {
    assert.equal(scaleQuantity(null, 4, 8), null);
    assert.equal(scaleQuantity('0', 4, 8), '0');
    assert.equal(scaleQuantity('0.1', 4, 3), '0.075');
    assert.equal(scaleQuantity('500', 4, 2), '250');
    assert.equal(scaleQuantity('1', 3, 1), '0.33333334');
    assert.equal(scaleQuantity('0.00000001', 3, 1), '0.00000001');
});
