import test from 'node:test';
import assert from 'node:assert/strict';
import { productView, updateViewUrl } from '../src/features/products/url-state.js';
import { historyView, historyViewUrl } from '../src/features/inventory/url-state.js';

void test('product direct URL restores tab, variant and SKU; unknown selection falls back safely', () => {
    const variants = [
        { id: 'v1', products: [{ id: 's1' }] },
        { id: 'v2', products: [{ id: 's2' }] },
    ];
    assert.deepEqual(productView(new URLSearchParams('tab=nutrition&variant=v1&sku=s1'), variants), {
        tab: 'nutrition',
        variantId: 'v1',
        skuId: 's1',
    });
    assert.deepEqual(productView(new URLSearchParams('tab=garbage&variant=v1&sku=s2'), variants), {
        tab: 'about',
        variantId: 'v1',
        skuId: '',
    });
    const changed = updateViewUrl('/products/id', new URLSearchParams('tab=allergens&variant=v1&sku=s1'), {
        variant: 'v2',
        sku: null,
    });
    assert.equal(changed, '/products/id?tab=allergens&variant=v2');
    assert.equal(updateViewUrl('/products/id', new URLSearchParams('tab=source'), { tab: null }), '/products/id');
});
void test('history filter changes preserve independent URL state and reset pagination/selection together', () => {
    const changed = historyViewUrl(
        '/inventory/batches/id',
        new URLSearchParams('tab=details&history_offset=100&history_event=event1&history_action=purchase'),
        'action',
        'consume',
        'history_',
    );
    assert.equal(changed, '/inventory/batches/id?tab=details&history_action=consume');
    assert.equal(
        historyViewUrl(
            '/inventory/history',
            new URLSearchParams('q=Milk&action=consume&event=event1'),
            'offset',
            '100',
        ),
        '/inventory/history?q=Milk&action=consume&offset=100',
    );
});
void test('history links restore filters without turning invalid dates or offsets into invalid requests', () => {
    assert.deepEqual(
        historyView(new URLSearchParams('q=Milk&action=purchase&from=2026-09-20&to=2026-09-29&offset=100&event=e1')),
        { q: 'Milk', action: 'purchase', from: '2026-09-20', to: '2026-09-29', offset: 100, selected: 'e1' },
    );
    const invalid = historyView(new URLSearchParams('from=2026-02-30&to=oops&offset=-1'));
    assert.equal(invalid.from, '');
    assert.equal(invalid.to, '');
    assert.equal(invalid.offset, 0);
});
