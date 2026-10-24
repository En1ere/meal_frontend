import assert from 'node:assert/strict';
import test from 'node:test';
import { contracts } from '../src/shared/api/contracts.generated.js';
import { createSeed } from '../src/mocks/model.js';
import { diaryHandle, syncDiaryPortions } from '../src/mocks/diary.js';
import { mealPlanHandle } from '../src/mocks/meal-plan.js';

const now = Date.parse('2026-10-07T12:00:00.000Z');
const success = (data: unknown) => Response.json(data);
const fail = (status: number, code = 'FAILED') => Response.json({ code }, { status });

function setup(login = 'pro1') {
    const state = createSeed();
    const userId = state.users.find((user) => user.login === login)!.id;
    const send = (
        path: string,
        method: string,
        input?: unknown,
        params: Record<string, string> = {},
        ifMatch: string | null = null,
        query = new URLSearchParams(),
    ) => diaryHandle({ state, userId, path, method, input, params, ifMatch, query, now, success, fail })!;
    return { state, userId, send };
}

void test('active Pro creates a private entry idempotently and unknown nutrition stays null', async () => {
    const { state, userId, send } = setup();
    const body = {
        eatenAt: '2026-10-07T08:00:00.000Z',
        meal: 'breakfast',
        note: 'До тренировки',
        components: [
            {
                id: crypto.randomUUID(),
                source: { type: 'manual', name: 'Домашняя каша' },
                quantity: '250',
                unit: 'g',
            },
        ],
        idempotencyKey: crypto.randomUUID(),
    };
    const first = contracts['POST /api/v1/diary'].success.shape.data.parse(
        await send('/api/v1/diary', 'POST', body).json(),
    );
    const replay = contracts['POST /api/v1/diary'].success.shape.data.parse(
        await send('/api/v1/diary', 'POST', body).json(),
    );
    assert.deepEqual(replay, first);
    assert.equal(state.diary.entries.filter((row) => row.userId === userId).length, 1);
    assert.equal(first.entry.nutrition.energyKcal, null);

    const day = contracts['GET /api/v1/diary'].success.shape.data.parse(
        await send('/api/v1/diary', 'GET', undefined, {}, null, new URLSearchParams('date=2026-10-07')).json(),
    );
    assert.equal(day.summary.entryCount, 1);
    assert.equal(day.summary.nutrition.energyKcal, null);
});

void test('inventory source is debited once and replay cannot double-debit it', async () => {
    const { state, userId, send } = setup();
    const sources = contracts['GET /api/v1/diary/sources'].success.shape.data.parse(
        await send(
            '/api/v1/diary/sources',
            'GET',
            undefined,
            {},
            null,
            new URLSearchParams('type=inventory_batch'),
        ).json(),
    );
    const source = sources.items.find((item) => item.availableQuantity && Number(item.availableQuantity) >= 0.1)!;
    const before = state.inventory.batches.find((row) => row.userId === userId && row.batch.id === source.id)!.batch
        .quantity!;
    const body = {
        eatenAt: '2026-10-07T12:00:00.000Z',
        meal: 'lunch',
        note: null,
        components: [
            {
                id: crypto.randomUUID(),
                source: { type: 'inventory_batch', batchId: source.id, batchVersion: source.version! },
                quantity: '0.1',
                unit: source.unit,
            },
        ],
        idempotencyKey: crypto.randomUUID(),
    };
    assert.equal(send('/api/v1/diary', 'POST', body).status, 200);
    const after = state.inventory.batches.find((row) => row.userId === userId && row.batch.id === source.id)!.batch
        .quantity!;
    assert.equal(Math.round((Number(before) - Number(after)) * 100), 10);
    assert.equal(send('/api/v1/diary', 'POST', body).status, 200);
    assert.equal(
        state.inventory.batches.find((row) => row.userId === userId && row.batch.id === source.id)!.batch.quantity,
        after,
    );
});

void test('former Pro reads saved entries but cannot mutate them, never-Pro is denied', () => {
    const former = setup('user1');
    former.state.subscription.trialHistory.push(former.userId);
    assert.equal(
        former.send('/api/v1/diary', 'GET', undefined, {}, null, new URLSearchParams('date=2026-10-07')).status,
        200,
    );
    assert.equal(former.send('/api/v1/diary', 'POST', {}).status, 403);
    const never = setup('user1');
    assert.equal(
        never.send('/api/v1/diary', 'GET', undefined, {}, null, new URLSearchParams('date=2026-10-07')).status,
        403,
    );
});

void test('assigned portion is confirmed into the diary exactly once without a second stock debit', async () => {
    const { state, userId, send } = setup('plus1');
    state.users.find((user) => user.id === userId)!.plan = 'pro';
    const family = state.family.families.find((candidate) =>
        candidate.members.some((member) => member.userId === userId && member.leftAt === null),
    );
    assert.ok(family);
    const mealSend = (path: string, method: string, input?: unknown, query = new URLSearchParams()) =>
        mealPlanHandle({ state, userId, path, method, input, query, now, success, fail })!;
    const workspace = contracts['GET /api/v1/portions'].success.shape.data.parse(
        await mealSend('/api/v1/portions', 'GET', undefined, new URLSearchParams('scope=family')).json(),
    );
    const source = workspace.prepared[0]!;
    const before = source.quantity;
    const assigned = contracts['POST /api/v1/portions/assign'].success.shape.data.parse(
        await mealSend('/api/v1/portions/assign', 'POST', {
            scope: 'family',
            batchId: source.batchId,
            recipientUserId: userId,
            quantity: '1',
            expectedBatchVersion: source.version,
            idempotencyKey: crypto.randomUUID(),
        }).json(),
    );
    const proposal = assigned.proposals[0]!;
    const afterAssign = assigned.prepared[0]!.quantity;
    assert.notEqual(afterAssign, before);
    const response = send(
        `/api/v1/diary/portions/${proposal.id}/decision`,
        'POST',
        { decision: 'confirmed', expectedVersion: proposal.version, idempotencyKey: crypto.randomUUID() },
        { id: proposal.id },
        `"${proposal.version}"`,
    );
    assert.equal(response.status, 200);
    syncDiaryPortions(state, userId, now);
    syncDiaryPortions(state, userId, now);
    assert.equal(state.diary.entries.filter((row) => row.entry.proposalId === proposal.id).length, 1);
    assert.equal(
        state.mealPlan.portions.find((row) => row.ownerKey === family.id)!.workspace.prepared[0]!.quantity,
        afterAssign,
        'confirmation must not debit prepared stock again',
    );
});

void test('timeout creates one marked entry and former Pro can cancel it without restoring stock', () => {
    const { state, userId, send } = setup();
    const proposal = {
        id: crypto.randomUUID(),
        recipient: { userId, displayName: 'Pro' },
        source: { batchId: crypto.randomUUID(), name: 'Семейное рагу' },
        quantity: '1',
        unit: 'serv',
        state: 'pending' as const,
        availableAt: new Date(now - 90000000).toISOString(),
        dueAt: new Date(now - 3600000).toISOString(),
        decisionAt: null,
        version: 1,
    };
    state.mealPlan.portions.push({
        ownerKey: crypto.randomUUID(),
        workspace: { scope: 'family', prepared: [], proposals: [proposal] },
    });
    syncDiaryPortions(state, userId, now);
    const entry = state.diary.entries.find((row) => row.entry.proposalId === proposal.id)!.entry;
    assert.equal(entry.confirmationMethod, 'timeout');
    assert.equal(state.diary.entries.filter((row) => row.entry.proposalId === proposal.id).length, 1);
    state.users.find((user) => user.id === userId)!.plan = 'free';
    state.subscription.trialHistory.push(userId);
    const current = state.mealPlan.portions.at(-1)!.workspace.proposals[0]!;
    const cancelled = send(
        `/api/v1/diary/portions/${proposal.id}/decision`,
        'POST',
        { decision: 'cancelled', expectedVersion: current.version, idempotencyKey: crypto.randomUUID() },
        { id: proposal.id },
        `"${current.version}"`,
    );
    assert.equal(cancelled.status, 200);
    assert.equal(entry.state, 'archived');
});

void test('diary media upload fails closed and keeps diary state unchanged', () => {
    const { state, userId, send } = setup();
    const entry = contracts['GET /api/v1/diary'].success.shape.data.shape.items.element.parse({
        id: crypto.randomUUID(),
        eatenAt: new Date(now).toISOString(),
        meal: 'other',
        state: 'confirmed',
        confirmationMethod: 'manual',
        proposalId: null,
        note: null,
        nutrition: { energyKcal: null, proteinG: null, fatG: null, carbohydrateG: null, fiberG: null },
        completeness: 'unknown',
        components: [],
        version: 1,
        createdAt: new Date(now).toISOString(),
    });
    state.diary.entries.push({ userId, entry });
    const before = structuredClone(state.diary);
    const response = send(
        `/api/v1/diary/${entry.id}/media`,
        'POST',
        {
            fileName: 'meal.jpg',
            mimeType: 'image/jpeg',
            sizeBytes: 100,
            idempotencyKey: crypto.randomUUID(),
        },
        { id: entry.id },
    );
    assert.equal(response.status, 503);
    assert.deepEqual(state.diary, before);
});
