import { workspaceIngredientSource } from '../src/mocks/recipe-workspace-nutrition.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSeed } from '../src/mocks/model.js';
import { recipeWorkspaceHandle, workspaceRecipeFixture } from '../src/mocks/recipe-workspace.js';
import { contracts } from '../src/shared/api/contracts.generated.js';
const base = '/api/v1/recipe-workspace',
    publicId = '70000000-0000-4000-8000-000000000001';
function setup() {
    const state = createSeed(),
        userId = state.users[0]!.id;
    const send = (
        path = base,
        method = 'GET',
        input: unknown = undefined,
        user: string | null = userId,
        query = '',
    ) => {
        const segments = path.slice(base.length).split('/').filter(Boolean);
        return recipeWorkspaceHandle({
            state,
            userId: user,
            path,
            params: { id: segments[0] ?? '', commentId: segments[2] ?? '' },
            method,
            input,
            query: new URLSearchParams(query),
            now: Date.parse('2026-09-29T12:00:00Z'),
            success: (data) => Response.json(data),
            fail: (status) => Response.json({}, { status }),
        })!;
    };
    return { state, userId, send };
}
void test('draft create/save conflict/ownership, archive/restore and contract roundtrip', async () => {
    const { state, send, userId } = setup(),
        key = crypto.randomUUID();
    const created = contracts['POST /api/v1/recipe-workspace'].success.shape.data.parse(
        await send(base, 'POST', { idempotencyKey: key, document: {} }).json(),
    );
    assert.equal(created.recipe.document.title, '');
    assert.equal(send(`${base}/${created.recipe.id}`, 'GET', undefined, state.users[1]!.id).status, 404);
    const recipe = created.recipe,
        document = {
            ...recipe.document,
            title: 'Milk',
            ingredients: [
                {
                    ingredientId: '10000000-0000-4000-8000-000000000001',
                    variantId: null,
                    productId: null,
                    sourceRecipeId: null,
                    quantity: '200',
                    unit: 'ml',
                    optional: false,
                },
            ],
            steps: [{ text: 'Warm', durationSeconds: 30, temperature: null }],
        };
    const saved = contracts['PUT /api/v1/recipe-workspace/{id}'].success.shape.data.parse(
        await send(`${base}/${recipe.id}`, 'PUT', {
            idempotencyKey: crypto.randomUUID(),
            expectedVersion: 1,
            document,
        }).json(),
    );
    assert.equal(saved.recipe.version, 2);
    assert.equal(saved.recipe.nutrition.status, 'calculated');
    assert.equal(saved.recipe.nutrition.base?.kcal, '104');
    assert.equal(
        send(`${base}/${recipe.id}`, 'PUT', { idempotencyKey: crypto.randomUUID(), expectedVersion: 1, document })
            .status,
        409,
    );
    assert.equal(
        send(`${base}/${recipe.id}/archive`, 'POST', { idempotencyKey: crypto.randomUUID(), expectedVersion: 2 })
            .status,
        200,
    );
    assert.equal(workspaceRecipeFixture(state, userId, recipe.id), null);
    assert.equal(
        send(`${base}/${recipe.id}/restore`, 'POST', { idempotencyKey: crypto.randomUUID(), expectedVersion: 3 })
            .status,
        200,
    );
    assert.equal(workspaceRecipeFixture(state, userId, recipe.id)?.title, 'Milk');
});
void test('submission limits, duplicate replay and bans match backend guards', async () => {
    const { state, send, userId } = setup();
    state.recipeWorkspace.policy.submissionDailyLimit = 1;
    const variant = contracts['POST /api/v1/recipe-workspace/{id}/variant'].success.shape.data.parse(
        await send(`${base}/${publicId}/variant`, 'POST', { idempotencyKey: crypto.randomUUID() }).json(),
    ).recipe;
    const body = { idempotencyKey: crypto.randomUUID(), expectedVersion: 1 },
        path = `${base}/${variant.id}/submit`;
    assert.equal(send(path, 'POST', body).status, 200);
    assert.equal(send(path, 'POST', body).status, 200);
    assert.equal(state.recipeWorkspace.allowances.length, 1);
    state.inventory.blocked.push(userId);
    assert.equal(send(path, 'POST', body).status, 403);
});
void test('rating/comment without completed cooking deny without spending quota', () => {
    const { state, send } = setup();
    const idempotencyKey = crypto.randomUUID(),
        attemptId = crypto.randomUUID();
    assert.equal(
        send(`${base}/${publicId}/rating`, 'POST', { idempotencyKey, attemptId, value: 5, confirmed: true }).status,
        403,
    );
    assert.equal(
        send(`${base}/${publicId}/comments`, 'POST', { idempotencyKey, attemptId, body: 'Hi', replyToId: null }).status,
        403,
    );
    assert.equal(state.recipeWorkspace.allowances.length, 0);
});
void test('critical report hides recipe and own reporthistory remains accessible and private', async () => {
    const { state, send, userId } = setup();
    assert.equal(
        send(`${base}/${publicId}/reports`, 'POST', {
            idempotencyKey: crypto.randomUUID(),
            reason: 'dangerous',
            comment: null,
            commentId: null,
        }).status,
        200,
    );
    assert.equal(workspaceRecipeFixture(state, userId, publicId), null);
    const own = contracts['GET /api/v1/recipe-workspace/reports'].success.shape.data.parse(
        await send(`${base}/reports`).json(),
    );
    assert.equal(own.items.length, 1);
    const other = contracts['GET /api/v1/recipe-workspace/reports'].success.shape.data.parse(
        await send(`${base}/reports`, 'GET', undefined, state.users[1]!.id).json(),
    );
    assert.equal(other.items.length, 0);
});

void test('workspace mock source normalization honors SKU then variant then ingredient hierarchy', () => {
    const all = {
        productId: '10000000-0000-4000-8000-000000000011',
        variantId: '10000000-0000-4000-8000-000000000012',
        ingredientId: '10000000-0000-4000-8000-000000000013',
        sourceRecipeId: '10000000-0000-4000-8000-000000000014',
    };
    assert.deepEqual(workspaceIngredientSource(all), {
        productId: all.productId,
        variantId: null,
        ingredientId: null,
        sourceRecipeId: null,
    });
    assert.deepEqual(workspaceIngredientSource({ ...all, productId: null }), {
        productId: null,
        variantId: all.variantId,
        ingredientId: null,
        sourceRecipeId: null,
    });
    assert.deepEqual(workspaceIngredientSource({ ...all, productId: null, variantId: null }), {
        productId: null,
        variantId: null,
        ingredientId: all.ingredientId,
        sourceRecipeId: null,
    });
});

void test('family recipes are shared with members while only the author can edit', async () => {
    const { state, send } = setup();
    const owner = state.users.find((user) => user.login === 'plus1')!;
    const member = state.users.find((user) => user.login === 'plus2')!;
    const outsider = state.users.find((user) => user.login === 'user1')!;
    const created = contracts['POST /api/v1/recipe-workspace'].success.shape.data.parse(
        await send(
            base,
            'POST',
            { idempotencyKey: crypto.randomUUID(), scope: 'family', document: {} },
            owner.id,
        ).json(),
    ).recipe;
    assert.equal(created.availabilityScope, 'family');
    assert.equal(workspaceRecipeFixture(state, owner.id, created.id), null);
    const shared = contracts['GET /api/v1/recipe-workspace/{id}'].success.shape.data.parse(
        await send(`${base}/${created.id}`, 'GET', undefined, member.id, 'scope=family').json(),
    ).recipe;
    assert.equal(shared.authorLogin, owner.login);
    assert.equal(shared.canEdit, false);
    assert.equal(send(`${base}/${created.id}`, 'GET', undefined, outsider.id, 'scope=family').status, 404);
    assert.equal(
        send(
            `${base}/${created.id}`,
            'PUT',
            {
                idempotencyKey: crypto.randomUUID(),
                expectedVersion: created.version,
                document: created.document,
            },
            member.id,
        ).status,
        404,
    );
});

void test('edit preserves prior review and archive closes the active publication without republishing on restore', async () => {
    const { state, send } = setup();
    const created = contracts['POST /api/v1/recipe-workspace'].success.shape.data.parse(
        await send(base, 'POST', { idempotencyKey: crypto.randomUUID(), document: {} }).json(),
    ).recipe;
    const row = state.recipeWorkspace.recipes.find((item) => item.recipe.id === created.id)!;
    const r1 = row.recipe.revisionId;
    row.recipe.status = 'published';
    row.recipe.review = { revisionId: r1, status: 'published', publicReason: null };
    row.recipe.publication = { revisionId: r1, publishedAt: '2026-10-28T00:00:00.000Z' };
    const edited = contracts['PUT /api/v1/recipe-workspace/{id}'].success.shape.data.parse(
        await send(`${base}/${created.id}`, 'PUT', {
            idempotencyKey: crypto.randomUUID(),
            expectedVersion: 1,
            document: created.document,
        }).json(),
    ).recipe;
    assert.notEqual(edited.revisionId, r1);
    assert.equal(edited.review.revisionId, r1);
    assert.equal(edited.publication?.revisionId, r1);
    const archived = contracts['POST /api/v1/recipe-workspace/{id}/archive'].success.shape.data.parse(
        await send(`${base}/${created.id}/archive`, 'POST', {
            idempotencyKey: crypto.randomUUID(),
            expectedVersion: 2,
        }).json(),
    ).recipe;
    assert.equal(archived.review.revisionId, r1);
    assert.equal(archived.review.status, 'unpublished');
    assert.equal(archived.publication, null);
    const restored = contracts['POST /api/v1/recipe-workspace/{id}/restore'].success.shape.data.parse(
        await send(`${base}/${created.id}/restore`, 'POST', {
            idempotencyKey: crypto.randomUUID(),
            expectedVersion: 3,
        }).json(),
    ).recipe;
    assert.equal(restored.archived, false);
    assert.equal(restored.publication, null);
});

void test('critical hide closes the active old publication case instead of the newer editable revision', async () => {
    const { state, send } = setup();
    const created = contracts['POST /api/v1/recipe-workspace'].success.shape.data.parse(
        await send(base, 'POST', { idempotencyKey: crypto.randomUUID(), document: {} }).json(),
    ).recipe;
    const row = state.recipeWorkspace.recipes.find((item) => item.recipe.id === created.id)!;
    const r1 = row.recipe.revisionId;
    row.recipe.status = 'published';
    row.recipe.review = { revisionId: r1, status: 'published', publicReason: null };
    row.recipe.publication = { revisionId: r1, publishedAt: '2026-10-28T00:00:00.000Z' };
    const edited = contracts['PUT /api/v1/recipe-workspace/{id}'].success.shape.data.parse(
        await send(`${base}/${created.id}`, 'PUT', {
            idempotencyKey: crypto.randomUUID(),
            expectedVersion: 1,
            document: created.document,
        }).json(),
    ).recipe;
    assert.notEqual(edited.revisionId, r1);
    assert.equal(
        send(`${base}/${created.id}/reports`, 'POST', {
            idempotencyKey: crypto.randomUUID(),
            reason: 'dangerous',
            comment: null,
            commentId: null,
        }).status,
        200,
    );
    const hidden = state.recipeWorkspace.recipes.find((item) => item.recipe.id === created.id)!.recipe;
    assert.equal(hidden.review.revisionId, r1);
    assert.equal(hidden.review.status, 'hidden');
    assert.equal(hidden.publication, null);
});
