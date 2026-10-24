import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSeed } from '../src/mocks/model.js';
import { productsHandle, reference, canUseProduct } from '../src/mocks/products.js';
import { contracts } from '../src/shared/api/contracts.generated.js';
function setup() {
    const state = createSeed();
    const user = state.users[0]!.id;
    const other = state.users[1]!.id;
    const send = (path: string, input?: unknown, userId = user, id?: string, query = '') =>
        productsHandle({
            state,
            userId,
            path,
            method: input === undefined ? 'GET' : 'POST',
            params: id ? { id } : {},
            query: new URLSearchParams(query),
            input,
            success: (data) => Response.json(data),
            fail: (status) => Response.json({ status }, { status }),
        })!;
    return { state, user, other, send };
}
function proposal() {
    return {
        idempotencyKey: crypto.randomUUID(),
        name: 'Тестовый продукт',
        categoryId: reference.categories[0]!.id,
        unit: 'pack',
        brand: null,
        packageQuantity: '1',
        barcode: '4006381333931',
        compositionText: 'Состав с этикетки',
        kcal: '250',
        protein: '10',
        fat: '5',
        carbs: '30',
        nutritionBasisUnit: 'g',
        allergens: [],
        source: 'user',
        sourceText: null,
    };
}
void test('pending product is private to proposer and nutrition uses label basis independently of package unit', async () => {
    const { state, user, other, send } = setup();
    const result = contracts['POST /api/v1/products/proposals'].success.shape.data.parse(
        await send('/api/v1/products/proposals', proposal()).json(),
    );
    const p = result.product;
    assert.equal(p.status, 'pending');
    assert.equal(p.defaultUnit, 'pack');
    assert.equal(p.variants[0]?.products[0]?.nutrition?.basisUnit, 'g');
    assert.equal(p.variants[0]?.products[0]?.nutrition?.basisQuantity, '100');
    assert.equal(canUseProduct(state, user, p.id), true);
    assert.equal(canUseProduct(state, other, p.id), false);
    assert.equal(send('/api/v1/products/' + p.id, undefined, other, p.id).status, 404);
    const own = contracts['GET /api/v1/products'].success.shape.data.parse(
        await send('/api/v1/products', undefined, user, undefined, 'barcode=4006381333931').json(),
    );
    assert.equal(own.items.length, 1);
    const foreign = contracts['GET /api/v1/products'].success.shape.data.parse(
        await send('/api/v1/products', undefined, other, undefined, 'barcode=4006381333931').json(),
    );
    assert.equal(foreign.items.length, 0);
});
void test('proposal replay is stable and changed payload or barcode collision cannot create duplicates', async () => {
    const { state, send, other } = setup();
    const input = proposal();
    const first: unknown = await send('/api/v1/products/proposals', input).json();
    const count = state.products.items.length;
    assert.deepEqual(await send('/api/v1/products/proposals', input).json(), first);
    assert.equal(state.products.items.length, count);
    assert.equal(send('/api/v1/products/proposals', { ...input, name: 'Other' }).status, 409);
    assert.equal(
        send('/api/v1/products/proposals', { ...input, idempotencyKey: crypto.randomUUID() }, other).status,
        409,
    );
    assert.equal(state.products.items.length, count);
});
void test('invalid checksums, unknown categories and repeated allergens fail without mutation', () => {
    const { state, send } = setup();
    const count = state.products.items.length;
    const input = proposal();
    for (const patch of [
        { barcode: '4006381333932' },
        { categoryId: crypto.randomUUID() },
        {
            allergens: [
                { code: 'milk', status: 'contains' },
                { code: 'milk', status: 'unknown' },
            ],
        },
        { packageQuantity: '0' },
        { nutritionBasisUnit: 'pack' },
    ])
        assert.equal(send('/api/v1/products/proposals', { ...input, ...patch }).status, 400);
    assert.equal(state.products.items.length, count);
    assert.equal(Object.keys(state.products.replay).length, 0);
});
void test('account restriction blocks idempotent replay while keeping approved catalog readable', async () => {
    const { state, user, send } = setup();
    const input = proposal();
    assert.equal(send('/api/v1/products/proposals', input).status, 200);
    state.inventory.blocked.push(user);
    assert.equal(send('/api/v1/products/proposals', input).status, 403);
    const list = contracts['GET /api/v1/products'].success.shape.data.parse(await send('/api/v1/products').json());
    assert.ok(list.items.some((p) => p.status === 'approved'));
});

void test('catalog query matches backend trimming and strict validation', async () => {
    const { send } = setup();
    const result = contracts['GET /api/v1/products'].success.shape.data.parse(
        await send('/api/v1/products', undefined, undefined, undefined, 'q=%20%20Молоко%20%20').json(),
    );
    assert.equal(result.total, 1);
    assert.equal(send('/api/v1/products', undefined, undefined, undefined, 'extra=1').status, 400);
    assert.equal(send('/api/v1/products', undefined, undefined, undefined, 'barcode=').status, 400);
});
