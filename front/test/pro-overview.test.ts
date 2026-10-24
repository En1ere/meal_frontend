import assert from 'node:assert/strict';
import test from 'node:test';
import { contracts } from '../src/shared/api/contracts.generated.js';
import { createSeed } from '../src/mocks/model.js';
import { proOverviewHandle } from '../src/mocks/pro-overview.js';

const now = Date.parse('2026-10-07T12:00:00.000Z');
const success = (data: unknown) => Response.json({ data, meta: { requestId: crypto.randomUUID() } });
const fail = (status: number, code = 'FAILED') =>
    Response.json(
        { error: { code, message: 'Ошибка', details: null }, meta: { requestId: crypto.randomUUID() } },
        { status },
    );

async function overview(
    state: ReturnType<typeof createSeed>,
    userId: string,
): Promise<{ response: Response; body: unknown }> {
    const response = proOverviewHandle({
        state,
        userId,
        path: '/api/v1/pro/overview',
        method: 'GET',
        now,
        success,
        fail,
    })!;
    return { response, body: (await response.json()) as unknown };
}

void test('Pro fixture receives an active overview matching the generated contract', async () => {
    const state = createSeed();
    const user = state.users.find((candidate) => candidate.login === 'pro1')!;
    const { response, body } = await overview(state, user.id);
    assert.equal(response.status, 200);
    const parsed = contracts['GET /api/v1/pro/overview'].success.parse(body);
    assert.equal(parsed.data.access.mode, 'active');
    assert.equal(parsed.data.access.source, 'personal');
    assert.equal(parsed.data.diaryCount, 0);
    assert.equal(parsed.data.ai.debitOrder[0], 'subscription');
});

void test('never-Pro fixture is denied and expired trial keeps read-only history', async () => {
    const state = createSeed();
    const user = state.users.find((candidate) => candidate.login === 'user1')!;
    const denied = await overview(state, user.id);
    assert.equal(denied.response.status, 403);
    assert.equal((denied.body as { error: { code: string } }).error.code, 'PRO_REQUIRED');

    state.subscription.trialHistory.push(user.id);
    Object.assign(
        state.subscription.records.find((record) => record.userId === user.id)!,
        {
            version: 1,
            plan: 'pro',
            source: 'trial',
            subscriptionId: '20000000-0000-4000-8000-000000000010',
            period: null,
            startsAt: '2026-09-20T12:00:00.000Z',
            endsAt: '2026-09-27T12:00:00.000Z',
            autoRenew: false,
            downgradeToFreeAt: null,
        },
    );
    const historical = await overview(state, user.id);
    const parsed = contracts['GET /api/v1/pro/overview'].success.parse(historical.body);
    assert.equal(parsed.data.access.mode, 'read_only');
    assert.equal(parsed.data.access.reason, 'pro_expired');
    assert.equal(parsed.data.access.periodEndsAt, '2026-09-27T12:00:00.000Z');
});
