import assert from 'node:assert/strict';
import test from 'node:test';
import { aiAppealsHandle } from '../src/mocks/ai-appeals.js';
import { createSeed } from '../src/mocks/model.js';
import { contracts } from '../src/shared/api/contracts.generated.js';

const user1 = '10000000-0000-4000-8000-000000000007';
const user2 = '10000000-0000-4000-8000-000000000008';

function request(
    state: ReturnType<typeof createSeed>,
    userId: string | null,
    path: string,
    method = 'GET',
    input: unknown = undefined,
) {
    return aiAppealsHandle({
        state,
        userId,
        path,
        method,
        input,
        now: Date.parse('2026-10-14T00:00:00.000Z'),
        success: (data) => Response.json({ data, meta: { requestId: '61000000-0000-4000-8000-000000000099' } }),
        fail: (status) => Response.json({ error: { code: 'TEST', message: 'Test failure' } }, { status }),
    })!;
}

void test('fixture restriction creates one private appeal with replay and a valid detail route', async () => {
    const state = createSeed();
    const list = contracts['GET /api/v1/ai/appeals'].success.parse(
        await request(state, user1, '/api/v1/ai/appeals').json(),
    ).data;
    assert.equal(list.restriction?.id, '61000000-0000-4000-8000-000000000001');
    assert.equal(list.items.length, 0);

    const body = {
        sanctionId: list.restriction.id,
        body: 'Прошу пересмотреть ограничение.',
        idempotencyKey: '61000000-0000-4000-8000-000000000002',
    };
    const created = contracts['POST /api/v1/ai/appeals'].success.parse(
        await request(state, user1, '/api/v1/ai/appeals', 'POST', body).json(),
    ).data;
    const replay = contracts['POST /api/v1/ai/appeals'].success.parse(
        await request(state, user1, '/api/v1/ai/appeals', 'POST', body).json(),
    ).data;
    assert.equal(replay.appeal.id, created.appeal.id);
    assert.equal(state.aiAppeals.appeals.length, 1);
    assert.equal(state.support.tickets.filter((ticket) => ticket.ticket.category === 'ai_appeal').length, 1);

    const detailPath = `/api/v1/ai/appeals/${created.appeal.id}`;
    assert.equal(request(state, user1, detailPath).status, 200);
    assert.equal(request(state, user2, detailPath).status, 404);
    assert.equal(request(state, user1, '/api/v1/ai/appeals', 'POST', body).status, 200);
    assert.equal(
        request(state, user1, '/api/v1/ai/appeals', 'POST', {
            ...body,
            body: 'Другой текст с тем же ключом.',
        }).status,
        409,
    );
});

void test('restriction fixture is isolated from other users and unauthenticated requests', async () => {
    const state = createSeed();
    const other = contracts['GET /api/v1/ai/appeals'].success.parse(
        await request(state, user2, '/api/v1/ai/appeals').json(),
    ).data;
    assert.equal(other.restriction, null);
    assert.deepEqual(other.items, []);
    assert.equal(request(state, null, '/api/v1/ai/appeals').status, 401);
});
