import assert from 'node:assert/strict';
import test from 'node:test';
import { contracts } from '../src/shared/api/contracts.generated.js';
import { createSeed } from '../src/mocks/model.js';
import { nutritionHandle } from '../src/mocks/nutrition.js';

const now = Date.parse('2026-10-08T12:00:00.000Z');
const success = (data: unknown) => Response.json(data);
const fail = (status: number, code = 'FAILED') => Response.json({ code }, { status });

function setup() {
    const state = createSeed();
    const userId = state.users.find((user) => user.login === 'pro1')!.id;
    const send = (
        path: string,
        method: string,
        input?: unknown,
        ifMatch: string | null = null,
        query = new URLSearchParams(),
    ) => nutritionHandle({ state, userId, path, method, input, ifMatch, query, now, success, fail })!;
    return { state, userId, send };
}

void test('mock nutrition profile and target history follow optimistic concurrency', async () => {
    const { send } = setup();
    const profile = contracts['PUT /api/v1/nutrition/profile'].success.shape.data.parse(
        await send('/api/v1/nutrition/profile', 'PUT', {
            goal: 'maintain',
            expectedVersion: null,
            idempotencyKey: crypto.randomUUID(),
        }).json(),
    );
    assert.equal(profile.profile?.version, 1);
    const targetBody = {
        effectiveFrom: '2026-10-08',
        energyKcal: '2000',
        proteinG: '100',
        fatG: null,
        carbohydrateG: null,
        fiberG: null,
        expectedProfileVersion: 1,
        idempotencyKey: crypto.randomUUID(),
    };
    const firstTarget = send('/api/v1/nutrition/targets', 'POST', targetBody, '"1"');
    assert.equal(firstTarget.status, 200);
    assert.equal(send('/api/v1/nutrition/targets', 'POST', targetBody, '"1"').status, 200);
    const value = contracts['GET /api/v1/nutrition/settings'].success.shape.data.parse(
        await send('/api/v1/nutrition/settings', 'GET').json(),
    );
    assert.equal(value.profile?.version, 2);
    assert.equal(value.currentTarget?.values.energyKcal, '2000');
    assert.equal(
        send(
            '/api/v1/nutrition/targets',
            'POST',
            {
                effectiveFrom: '2026-10-09',
                energyKcal: '2100',
                proteinG: null,
                fatG: null,
                carbohydrateG: null,
                fiberG: null,
                expectedProfileVersion: 1,
                idempotencyKey: crypto.randomUUID(),
            },
            '"1"',
        ).status,
        412,
    );
});

void test('mock analytics preserves unknown fields and exposes comparable progress only', async () => {
    const { state, userId, send } = setup();
    await send('/api/v1/nutrition/profile', 'PUT', {
        goal: 'custom',
        expectedVersion: null,
        idempotencyKey: crypto.randomUUID(),
    }).json();
    await send(
        '/api/v1/nutrition/targets',
        'POST',
        {
            effectiveFrom: '2026-10-01',
            energyKcal: '2000',
            proteinG: null,
            fatG: null,
            carbohydrateG: null,
            fiberG: null,
            expectedProfileVersion: 1,
            idempotencyKey: crypto.randomUUID(),
        },
        '"1"',
    ).json();
    state.diary.entries.push({
        userId,
        entry: contracts['GET /api/v1/diary'].success.shape.data.shape.items.element.parse({
            id: crypto.randomUUID(),
            eatenAt: '2026-10-08T08:00:00.000Z',
            meal: 'breakfast',
            state: 'confirmed',
            confirmationMethod: 'manual',
            proposalId: null,
            note: null,
            nutrition: {
                energyKcal: '1000',
                proteinG: null,
                fatG: null,
                carbohydrateG: null,
                fiberG: null,
            },
            completeness: 'partial',
            components: [],
            version: 1,
            createdAt: '2026-10-08T08:00:00.000Z',
        }),
    });
    const result = contracts['GET /api/v1/nutrition/analytics'].success.shape.data.parse(
        await send(
            '/api/v1/nutrition/analytics',
            'GET',
            undefined,
            null,
            new URLSearchParams('from=2026-10-01&to=2026-10-08'),
        ).json(),
    );
    assert.equal(result.days[0]?.nutrition.proteinG, null);
    assert.equal(result.days[0]?.progressPercent.energyKcal, 50);
    assert.equal(result.days[0]?.progressPercent.proteinG, null);
});

void test('former Pro can read saved nutrition but cannot change it', () => {
    const { state, userId, send } = setup();
    state.nutrition.profiles.push({
        userId,
        profile: contracts['GET /api/v1/nutrition/settings'].success.shape.data.shape.profile.unwrap().parse({
            id: crypto.randomUUID(),
            goal: 'maintain',
            version: 1,
            createdAt: '2026-09-01T00:00:00.000Z',
        }),
    });
    state.users.find((user) => user.id === userId)!.plan = 'free';
    state.subscription.trialHistory.push(userId);
    assert.equal(send('/api/v1/nutrition/settings', 'GET').status, 200);
    assert.equal(send('/api/v1/nutrition/profile', 'PUT', {}).status, 403);
});
