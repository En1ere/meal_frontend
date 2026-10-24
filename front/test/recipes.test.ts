import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSeed } from '../src/mocks/model.js';
import { recipesHandle } from '../src/mocks/recipes.js';
import { publicRecipeFixtures } from '../src/mocks/recipe-fixtures.js';
import { recipeAvailability, scaleRecipeQuantity } from '../src/mocks/recipe-domain.js';
import { contracts } from '../src/shared/api/contracts.generated.js';
import { MockApi } from '../src/mocks/api.js';
import { MemoryRepository } from '../src/mocks/repository.js';
const id = '70000000-0000-4000-8000-000000000001';
function setup() {
    const state = createSeed(),
        userId = state.users[0]!.id;
    const send = (path = '/api/v1/recipes', user: string | null = userId, query = '', input?: unknown, recipeId = id) =>
        recipesHandle({
            state,
            userId: user,
            path,
            params: { id: recipeId },
            method: input ? 'POST' : 'GET',
            query: new URLSearchParams(query),
            input,
            now: Date.parse('2026-09-29T09:00:00Z'),
            success: (data) => Response.json(data),
            fail: (status) => Response.json({}, { status }),
        })!;
    return { state, userId, send };
}
void test('all public fixture details conform to wire schema; no personal projection is included', () => {
    for (const recipe of publicRecipeFixtures()) {
        contracts['GET /api/v1/recipes/{id}'].success.shape.data.parse({ recipe });
        assert.equal(recipe.availability, null);
        assert.equal(Object.hasOwn(recipe, 'bookmarked'), false);
        for (const variant of recipe.variants) assert.equal(variant.availability, null);
    }
});
void test('catalog filters before pagination, empty result remains valid and inventory requires a user', async () => {
    const { send } = setup();
    const data = contracts['GET /api/v1/recipes'].success.shape.data.parse(
        await send('/api/v1/recipes', null, 'category=mains&q=%D0%BF%D0%B0%D1%81%D1%82%D0%B0&limit=1&page=2').json(),
    );
    assert.equal(data.total, 3);
    assert.equal(data.items.length, 1);
    assert.equal(data.items[0]!.availability, null);
    assert.equal(send('/api/v1/recipes', null, 'tab=inventory').status, 401);
    for (const query of ['page=0', 'limit=101', 'unknown=1', 'tab=personal'])
        assert.equal(send('/api/v1/recipes', null, query).status, 400);
    const empty = contracts['GET /api/v1/recipes'].success.shape.data.parse(
        await send('/api/v1/recipes', null, 'q=nonexistent').json(),
    );
    assert.equal(empty.total, 0);
});
void test('bookmark desired-state retries are isolated by user and bind complete payload; bans prevent replay', async () => {
    const { send, state, userId } = setup();
    const request = { bookmarked: true, idempotencyKey: crypto.randomUUID() },
        path = `/api/v1/recipes/${id}/bookmark`;
    assert.equal(send(path, null, '', request).status, 401);
    for (let i = 0; i < 2; i++) assert.equal(send(path, userId, '', request).status, 200);
    assert.equal(state.recipes.bookmarks[userId]!.length, 1);
    assert.equal(send(path, userId, '', { ...request, bookmarked: false }).status, 409);
    const other = contracts['GET /api/v1/recipes/{id}/personal'].success.shape.data.parse(
        await send(`/api/v1/recipes/${id}/personal`, state.users[1]!.id, 'servings=4').json(),
    );
    assert.equal(other.bookmarked, false);
    state.inventory.blocked.push(userId);
    assert.equal(send(path, userId, '', request).status, 403);
    assert.equal(send(`/api/v1/recipes/${id}`, userId).status, 200);
});
void test('80 percent uses presence, counts unknown/insufficient stock and ignores optional ingredients', () => {
    const recipe = publicRecipeFixtures()[0]!;
    const ingredients = recipe.ingredients.map((entry, index) => ({
        ...entry,
        optional: false,
        ingredientId: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    }));
    const stocks = ingredients.slice(0, 4).map((entry, index) => ({
        ingredientId: entry.ingredientId,
        variantId: null,
        productId: null,
        sourceRecipeId: null,
        quantity: index === 1 ? null : '0.001',
        unit: entry.unit,
    }));
    const result = recipeAvailability(ingredients, stocks, 4, 8);
    assert.equal(result.presencePercent, 80);
    assert.equal(result.canPrepare, true);
    assert.equal(result.needsQuantityCheck, true);
    assert.equal(result.items[4]!.present, false);
    assert.equal(
        recipeAvailability([...ingredients, { ...ingredients[4]!, optional: true }], stocks, 4, 8).presencePercent,
        80,
    );
    assert.equal(scaleRecipeQuantity('1', 3, 1), '0.33333334');
});
void test('public mock HTTP detail bypasses authentication; personal data and writes never do', async () => {
    const origin = 'http://localhost:3000',
        api = new MockApi(new MemoryRepository(), { origin });
    const get = (path: string) => api.handle(new Request(origin + path));
    const detail = await get(`/api/v1/recipes/${id}`);
    assert.equal(detail.status, 200);
    contracts['GET /api/v1/recipes/{id}'].success.parse(await detail.json());
    assert.equal((await get(`/api/v1/recipes/${id}/personal?servings=4`)).status, 401);
    assert.equal((await get('/api/v1/recipes/70000000-0000-4000-8000-000000000099')).status, 404);
    const post = await api.handle(
        new Request(origin + `/api/v1/recipes/${id}/bookmark`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', origin },
            body: JSON.stringify({ bookmarked: true, idempotencyKey: crypto.randomUUID() }),
        }),
    );
    assert.equal(post.status, 403);
});
