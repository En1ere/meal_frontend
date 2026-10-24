import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSeed } from '../src/mocks/model.js';
import { handleCookingWorkflow } from '../src/mocks/cooking-workflow.js';
import { shoppingReceiptsHandle } from '../src/mocks/shopping-receipts.js';
import { publicRecipeFixtures } from '../src/mocks/recipe-fixtures.js';
import { ensureRecipeProducts } from '../src/mocks/recipes.js';
import { contracts } from '../src/shared/api/contracts.generated.js';
const recipe = publicRecipeFixtures()[0]!;
const now = Date.parse('2026-09-29T10:00:00.000Z');
function setup() {
    const state = createSeed(),
        userId = state.users[0]!.id;
    ensureRecipeProducts(state);
    const send = (
        path: string,
        input?: unknown,
        id = recipe.id,
        user: string | null = userId,
        query = '',
        itemId = '',
    ) => {
        const context = {
            state,
            userId: user,
            path,
            params: { id, itemId },
            input,
            method: input ? 'POST' : 'GET',
            query: new URLSearchParams(query),
            now,
            success: (data: unknown) => Response.json(data),
            fail: (status: number) => Response.json({}, { status }),
        };
        return shoppingReceiptsHandle(context) ?? handleCookingWorkflow(context)!;
    };
    const start = async () =>
        contracts['POST /api/v1/cooking-attempts'].success.shape.data.parse(
            await send('/api/v1/cooking-attempts', {
                recipeId: recipe.id,
                revisionId: recipe.revisionId,
                servings: 2,
                idempotencyKey: crypto.randomUUID(),
            }).json(),
        );
    return { state, userId, send, start };
}
void test('cooking start/progress persists deadline, does not debit and blocks foreign access', async () => {
    const { state, userId, send, start } = setup();
    const attempt = await start(),
        inventory = JSON.stringify(state.inventory.batches);
    const position = attempt.steps[0]!.position;
    const response = send(
        '/api/v1/cooking-attempts/{id}/progress',
        {
            version: 1,
            idempotencyKey: crypto.randomUUID(),
            occurredAt: new Date(now).toISOString(),
            status: 'paused',
            steps: [],
            timer: { position, action: 'start', seconds: 60 },
        },
        attempt.id,
    );
    assert.equal(response.status, 200);
    const updated = contracts['POST /api/v1/cooking-attempts/{id}/progress'].success.shape.data.parse(
        await response.json(),
    );
    assert.equal(updated.steps[0]!.timerDeadline, '2026-09-29T10:01:00.000Z');
    assert.equal(JSON.stringify(state.inventory.batches), inventory);
    assert.equal(
        send('/api/v1/cooking-attempts/{id}', undefined, attempt.id, state.users.find((u) => u.id !== userId)!.id)
            .status,
        404,
    );
});
void test('failed cooking consumes only confirmed actual amount, no output, replay once, blocked account denied', async () => {
    const { state, userId, send, start } = setup();
    const attempt = await start(),
        source = state.inventory.batches.find((r) => r.userId === userId && r.batch.quantity !== null)!;
    const quantity = source.batch.quantity!;
    const input = {
        version: 1,
        idempotencyKey: crypto.randomUUID(),
        outcome: 'failed',
        confirmedDuration: 30,
        privateNote: null,
        inputs: [{ batchId: source.batch.id, version: source.batch.version, quantity }],
        outputs: [],
    };
    assert.equal(send('/api/v1/cooking-attempts/{id}/finalize', input, attempt.id).status, 200);
    assert.equal(state.inventory.batches.find((r) => r.batch.id === source.batch.id)!.batch.quantity, '0');
    const history = state.inventory.history.length;
    assert.equal(send('/api/v1/cooking-attempts/{id}/finalize', input, attempt.id).status, 200);
    assert.equal(state.inventory.history.length, history);
    assert.equal(state.cookingWorkflow.prepared.length, 0);
    state.inventory.blocked.push(userId);
    assert.equal(send('/api/v1/cooking-attempts/{id}/finalize', input, attempt.id).status, 403);
});
void test('completion creates prepared stock; less than a full serving retains physical quantity', async () => {
    const { state, userId, send, start } = setup();
    const attempt = await start();
    const locationId = state.inventory.locations.find((l) => l.userId === userId)!.location.id;
    const input = {
        version: 1,
        idempotencyKey: crypto.randomUUID(),
        outcome: 'completed',
        confirmedDuration: 90,
        privateNote: null,
        inputs: [],
        outputs: [
            {
                name: 'Soup',
                quantity: '50',
                unit: 'g',
                locationId,
                expiryOn: null,
                precision: 'exact',
                portionQuantity: '100',
            },
        ],
    };
    assert.equal(send('/api/v1/cooking-attempts/{id}/finalize', input, attempt.id).status, 200);
    assert.equal(state.cookingWorkflow.prepared[0]!.batch.fullServings, '0');
    assert.equal(state.cookingWorkflow.prepared[0]!.batch.quantity, '50');
    const stocks = contracts['GET /api/v1/cooking-attempts/stock-options'].success.shape.data.parse(
        await send('/api/v1/cooking-attempts/stock-options').json(),
    );
    assert.ok(stocks.items.some((r) => r.kind === 'prepared'));
});
void test('finalization validates every input/output before committing state', async () => {
    const { state, userId, send, start } = setup();
    const attempt = await start(),
        source = state.inventory.batches.find((r) => r.userId === userId && r.batch.quantity !== null)!;
    const before = JSON.stringify(state.inventory);
    const result = send(
        '/api/v1/cooking-attempts/{id}/finalize',
        {
            version: 1,
            idempotencyKey: crypto.randomUUID(),
            outcome: 'completed',
            confirmedDuration: 90,
            privateNote: null,
            inputs: [{ batchId: source.batch.id, version: source.batch.version, quantity: source.batch.quantity }],
            outputs: [
                {
                    name: 'Soup',
                    quantity: '50',
                    unit: 'g',
                    locationId: crypto.randomUUID(),
                    expiryOn: null,
                    precision: 'exact',
                    portionQuantity: null,
                },
            ],
        },
        attempt.id,
    );
    assert.equal(result.status, 422);
    assert.equal(JSON.stringify(state.inventory), before);
});
void test('shopping preview is read only, lists persist edited and purchased items without adding stock', async () => {
    const { state, send } = setup();
    assert.equal(
        send(
            '/api/v1/shopping-lists/recipe-preview',
            undefined,
            recipe.id,
            undefined,
            `recipeId=${recipe.id}&servings=2`,
        ).status,
        200,
    );
    assert.equal(state.cookingWorkflow.lists.length, 0);
    const list = contracts['POST /api/v1/shopping-lists'].success.shape.data.parse(
        await send('/api/v1/shopping-lists', { title: 'Store', idempotencyKey: crypto.randomUUID() }).json(),
    );
    const fields = { name: 'Milk', quantity: '1', unit: 'l', ingredientId: null, productId: null, allowAnalog: true };
    const added = contracts['POST /api/v1/shopping-lists/{id}/items'].success.shape.data.parse(
        await send(
            '/api/v1/shopping-lists/{id}/items',
            { version: 1, idempotencyKey: crypto.randomUUID(), items: [fields] },
            list.id,
        ).json(),
    );
    const count = state.inventory.batches.length;
    assert.equal(
        send(
            '/api/v1/shopping-lists/{id}/items/{itemId}',
            { version: 1, idempotencyKey: crypto.randomUUID(), fields, status: 'purchased' },
            list.id,
            undefined,
            '',
            added.items[0]!.id,
        ).status,
        200,
    );
    assert.equal(state.inventory.batches.length, count);
    assert.equal(
        state.cookingWorkflow.lists.find((entry) => entry.list.id === list.id)!.list.items[0]!.status,
        'purchased',
    );
});
void test('hidden public recipe cannot start cooking, preview purchases or expose statistics', () => {
    const { state, send } = setup();
    state.recipeWorkspace.hidden.push(recipe.id);
    assert.equal(
        send('/api/v1/cooking-attempts', {
            recipeId: recipe.id,
            revisionId: recipe.revisionId,
            servings: 1,
            idempotencyKey: crypto.randomUUID(),
        }).status,
        404,
    );
    assert.equal(
        send(
            '/api/v1/shopping-lists/recipe-preview',
            undefined,
            recipe.id,
            undefined,
            `recipeId=${recipe.id}&servings=1`,
        ).status,
        404,
    );
    assert.equal(send('/api/v1/recipes/{id}/cooking-statistics', undefined, recipe.id, null, 'servings=1').status, 404);
    const denied = handleCookingWorkflow({
        state,
        userId: state.users[0]!.id,
        path: '/api/v1/cooking-attempts',
        params: {},
        method: 'POST',
        query: new URLSearchParams(),
        input: { recipeId: recipe.id, revisionId: recipe.revisionId, servings: 1, idempotencyKey: crypto.randomUUID() },
        now,
        resolveRecipe: () => null,
        success: (data) => Response.json(data),
        fail: (status) => new Response(null, { status }),
    });
    assert.equal(denied?.status, 404);
});
void test('shopping reference changes replace identity and reject foreign or mismatched SKU', async () => {
    const { state, userId, send } = setup();
    const list = contracts['POST /api/v1/shopping-lists'].success.shape.data.parse(
        await send('/api/v1/shopping-lists', { title: 'Store', idempotencyKey: crypto.randomUUID() }).json(),
    );
    const reference = state.products.items[0]!;
    const fields = {
        name: 'Item',
        quantity: null,
        unit: null,
        ingredientId: reference.product.id,
        productId: null,
        allowAnalog: true,
    };
    const added = contracts['POST /api/v1/shopping-lists/{id}/items'].success.shape.data.parse(
        await send(
            '/api/v1/shopping-lists/{id}/items',
            { version: 1, idempotencyKey: crypto.randomUUID(), items: [fields] },
            list.id,
        ).json(),
    );
    const replaced = contracts['POST /api/v1/shopping-lists/{id}/items/{itemId}'].success.shape.data.parse(
        await send(
            '/api/v1/shopping-lists/{id}/items/{itemId}',
            {
                version: 1,
                idempotencyKey: crypto.randomUUID(),
                fields: { ...fields, ingredientId: null },
                status: 'pending',
            },
            list.id,
            undefined,
            '',
            added.items[0]!.id,
        ).json(),
    );
    assert.notEqual(replaced.items[0]!.id, added.items[0]!.id);
    assert.equal(replaced.items[0]!.version, 1);
    const skuId = crypto.randomUUID();
    reference.product.variants.push({
        id: crypto.randomUUID(),
        name: 'Variant',
        products: [
            {
                id: skuId,
                name: 'SKU',
                brand: null,
                packageQuantity: null,
                packageUnit: 'g',
                barcodes: [],
                nutrition: null,
                allergens: [],
            },
        ],
    });
    reference.authorId = state.users.find((u) => u.id !== userId)!.id;
    reference.product.status = 'pending';
    assert.equal(
        send(
            '/api/v1/shopping-lists/{id}/items',
            {
                version: replaced.version,
                idempotencyKey: crypto.randomUUID(),
                items: [{ ...fields, ingredientId: null, productId: skuId }],
            },
            list.id,
        ).status,
        422,
    );
    reference.authorId = null;
    const otherIngredient = state.products.items.find((p) => p.product.id !== reference.product.id)!.product.id;
    assert.equal(
        send(
            '/api/v1/shopping-lists/{id}/items',
            {
                version: replaced.version,
                idempotencyKey: crypto.randomUUID(),
                items: [{ ...fields, ingredientId: otherIngredient, productId: skuId }],
            },
            list.id,
        ).status,
        422,
    );
});

void test('family shopping, receipts and purchases require active membership and preserve scope isolation', async () => {
    const { state, send } = setup();
    const owner = state.users.find((user) => user.login === 'plus1')!.id;
    const member = state.users.find((user) => user.login === 'plus2')!.id;
    const outsider = state.users.find((user) => user.login === 'user1')!.id;
    const missing = '00000000-0000-4000-8000-000000000099';
    const created = contracts['POST /api/v1/shopping-lists'].success.shape.data.parse(
        await send(
            '/api/v1/shopping-lists',
            {
                title: 'Общие покупки',
                scope: 'family',
                idempotencyKey: crypto.randomUUID(),
            },
            undefined,
            owner,
        ).json(),
    );
    assert.equal(created.scope, 'family');
    const shared = send('/api/v1/shopping-lists/{id}', undefined, created.id, member, 'scope=family');
    assert.equal(shared.status, 200);
    assert.equal(((await shared.json()) as { id: string }).id, created.id);
    const renamed = send(
        '/api/v1/shopping-lists/{id}/command',
        {
            version: created.version,
            action: 'rename',
            title: 'Общие покупки семьи',
            scope: 'family',
            idempotencyKey: crypto.randomUUID(),
        },
        created.id,
        member,
    );
    assert.equal(renamed.status, 200);
    assert.equal(((await renamed.json()) as { title: string }).title, 'Общие покупки семьи');
    assert.equal(send('/api/v1/shopping-lists/{id}', undefined, missing, member, 'scope=family').status, 404);
    const history = send('/api/v1/shopping-lists/{id}/history', undefined, created.id, member, 'scope=family');
    assert.equal(history.status, 200);
    assert.equal(((await history.json()) as { items: unknown[] }).items.length, 2);
    const personalList = contracts['POST /api/v1/shopping-lists'].success.shape.data.parse(
        await send(
            '/api/v1/shopping-lists',
            { title: 'Личные покупки', idempotencyKey: crypto.randomUUID() },
            undefined,
            owner,
        ).json(),
    );
    assert.equal(send('/api/v1/shopping-lists/{id}', undefined, personalList.id, owner, 'scope=family').status, 404);
    assert.equal(send('/api/v1/shopping-lists/{id}', undefined, created.id, owner).status, 404);

    const receiptInput = {
        idempotencyKey: crypto.randomUUID(),
        source: { kind: 'photo' as const, storageStatus: 'deferred' as const, reference: 'family.jpg' },
        ocrText: 'Молоко',
        lines: [
            {
                id: crypto.randomUUID(),
                name: 'Молоко',
                quantity: '1',
                unit: 'l',
                ingredientId: null,
                productId: null,
                locationId: null,
                isFood: true,
                intake: false,
                shoppingItemId: null,
                expiryOn: null,
            },
        ],
    };
    const receipt = contracts['POST /api/v1/receipts'].success.shape.data.parse(
        await send('/api/v1/receipts', { ...receiptInput, scope: 'family' }, undefined, owner).json(),
    );
    assert.equal(send('/api/v1/receipts/{id}', undefined, receipt.receipt.id, member, 'scope=family').status, 200);
    assert.equal(send('/api/v1/receipts/{id}', undefined, missing, member, 'scope=family').status, 404);
    const personalReceipt = contracts['POST /api/v1/receipts'].success.shape.data.parse(
        await send(
            '/api/v1/receipts',
            { ...receiptInput, idempotencyKey: crypto.randomUUID() },
            undefined,
            owner,
        ).json(),
    );
    assert.equal(
        send('/api/v1/receipts/{id}', undefined, personalReceipt.receipt.id, owner, 'scope=family').status,
        404,
    );
    assert.equal(send('/api/v1/receipts/{id}', undefined, receipt.receipt.id, owner).status, 404);

    const familyPurchaseId = 'a2000001-0000-4000-8000-000000000001';
    const personalPurchaseId = 'a2000001-0000-4000-8000-000000000005';
    assert.equal(send('/api/v1/purchases/{id}', undefined, familyPurchaseId, member, 'scope=family').status, 200);
    assert.equal(send('/api/v1/purchases/{id}', undefined, missing, member, 'scope=family').status, 404);
    assert.equal(send('/api/v1/purchases/{id}', undefined, personalPurchaseId, owner).status, 200);
    assert.equal(send('/api/v1/purchases/{id}', undefined, personalPurchaseId, owner, 'scope=family').status, 404);
    assert.equal(send('/api/v1/purchases/{id}', undefined, familyPurchaseId, owner).status, 404);

    const beforeDenied = JSON.stringify({
        shoppingReceipts: state.shoppingReceipts,
        cookingWorkflow: state.cookingWorkflow,
        inventory: state.inventory,
    });
    assert.equal(send('/api/v1/shopping-lists/{id}', undefined, created.id, outsider, 'scope=family').status, 404);
    assert.equal(
        send(
            '/api/v1/shopping-lists/{id}/command',
            {
                version: 2,
                action: 'rename',
                title: 'Чужое изменение',
                scope: 'family',
                idempotencyKey: crypto.randomUUID(),
            },
            created.id,
            outsider,
        ).status,
        404,
    );
    assert.equal(send('/api/v1/receipts/{id}', undefined, receipt.receipt.id, outsider, 'scope=family').status, 404);
    assert.equal(
        send(
            '/api/v1/receipts/{id}/edit',
            { version: 1, lines: receipt.receipt.lines, scope: 'family', idempotencyKey: crypto.randomUUID() },
            receipt.receipt.id,
            outsider,
        ).status,
        404,
    );
    assert.equal(send('/api/v1/purchases/{id}', undefined, familyPurchaseId, outsider, 'scope=family').status, 404);
    assert.equal(
        send('/api/v1/purchases/{id}/resolve-preview', { scope: 'family' }, familyPurchaseId, outsider).status,
        404,
    );
    assert.equal(
        send(
            '/api/v1/shopping-lists',
            { title: 'Недоступная семья', scope: 'family', idempotencyKey: crypto.randomUUID() },
            undefined,
            outsider,
        ).status,
        404,
    );
    assert.equal(
        JSON.stringify({
            shoppingReceipts: state.shoppingReceipts,
            cookingWorkflow: state.cookingWorkflow,
            inventory: state.inventory,
        }),
        beforeDenied,
    );

    state.family.families[0]!.coverageBlocked = true;
    assert.equal(send('/api/v1/shopping-lists/{id}', undefined, created.id, owner, 'scope=family').status, 403);
});

void test('active Pro saves an electronic receipt and creates private finance records only on commit', async () => {
    const { state, userId, send } = setup();
    state.users.find((user) => user.id === userId)!.plan = 'pro';
    const capabilities = contracts['GET /api/v1/receipts/capabilities'].success.shape.data.parse(
        await send('/api/v1/receipts/capabilities').json(),
    );
    assert.deepEqual(capabilities, {
        photo: true,
        electronicLink: true,
        pdfUpload: false,
        ocrAdapter: false,
        pdfUnavailableReason: 'storage_not_configured',
    });
    const ingredient = recipe.ingredients.find((item) => item.ingredientId && item.unit)!;
    const line = {
        id: crypto.randomUUID(),
        name: ingredient.name,
        quantity: '1',
        unit: ingredient.unit,
        ingredientId: ingredient.ingredientId,
        productId: null,
        locationId: null,
        isFood: true,
        intake: false,
        shoppingItemId: null,
        expiryOn: null,
        amountMinor: 12990,
        originalAmountMinor: 14990,
        discountMinor: 2000,
    };
    const created = contracts['POST /api/v1/receipts'].success.shape.data.parse(
        await send('/api/v1/receipts', {
            idempotencyKey: crypto.randomUUID(),
            source: {
                kind: 'electronic_link',
                storageStatus: 'not_required',
                reference: 'https://example.test/receipt/1',
            },
            ocrText: ingredient.name,
            lines: [line],
            financial: {
                totalMinor: 12990,
                discountMinor: 2000,
                storeName: 'Магазин',
                paymentMethod: 'card',
                fiscalNumber: 'FN-1',
                fiscalDocumentNumber: 'FD-2',
                financeConsent: true,
            },
        }).json(),
    );
    assert.equal(state.finance.expenses.length, 0);
    const purchasedAt = new Date(now).toISOString();
    const preview = contracts['POST /api/v1/receipts/{id}/intake-preview'].success.shape.data.parse(
        await send(
            '/api/v1/receipts/{id}/intake-preview',
            { version: 1, purchasedAt, lines: [line], scope: 'private' },
            created.receipt.id,
        ).json(),
    );
    assert.equal(
        send(
            '/api/v1/receipts/{id}/commit',
            {
                version: 1,
                purchasedAt,
                lines: [line],
                previewToken: preview.previewToken,
                idempotencyKey: crypto.randomUUID(),
                scope: 'private',
            },
            created.receipt.id,
        ).status,
        200,
    );
    assert.equal(state.finance.expenses.length, 1);
    assert.equal(state.finance.expenses[0]?.expense.source, 'receipt');
    assert.equal(state.finance.observations[0]?.observation.source, 'receipt');
    assert.equal(state.finance.observations[0]?.observation.eligibleForAggregate, false);
});
