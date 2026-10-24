import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed } from '../src/mocks/model.js';
import { freeAiHandle } from '../src/mocks/free-ai.js';
import { contracts } from '../src/shared/api/contracts.generated.js';

function invoke(state: ReturnType<typeof createSeed>, path: string, method: string, body: unknown, critical = false) {
    return freeAiHandle({
        state,
        path,
        method,
        body,
        critical,
        now: Date.parse('2026-10-01T10:00:00.000Z'),
        success: (data) =>
            new Response(JSON.stringify({ data, meta: { requestId: '00000000-0000-4000-8000-000000000001' } }), {
                status: 200,
            }),
        fail: (status, code) => new Response(JSON.stringify({ code }), { status }),
    })!;
}

await test('Free AI workspace exposes buckets and keeps grants critical and idempotent', async () => {
    const state = createSeed();
    const user = state.users.find((entry) => entry.plan === 'free')!;
    const path = `/api/v1/admin/free-ai/users/${user.id}`;
    const initial = contracts['GET /api/v1/admin/free-ai/users/{id}'].success.parse(
        await invoke(state, path, 'GET', {}).json(),
    );
    assert.equal(initial.data.user.id, user.id);
    assert.equal(initial.data.available, 7);

    const command = {
        expectedUserVersion: '1',
        actions: 25,
        expiresAt: '2026-12-01T10:00:00.000Z',
        reason: 'Проверка Free-сценария',
        idempotencyKey: crypto.randomUUID(),
        confirmed: true as const,
    };
    assert.equal(invoke(state, `${path}/grants`, 'POST', command).status, 403);
    const first = invoke(state, `${path}/grants`, 'POST', command, true);
    assert.equal(first.status, 200);
    const result = contracts['POST /api/v1/admin/free-ai/users/{id}/grants'].success.parse(await first.json());
    assert.equal(result.data.granted, 25);
    const replay = contracts['POST /api/v1/admin/free-ai/users/{id}/grants'].success.parse(
        await invoke(state, `${path}/grants`, 'POST', command, true).json(),
    );
    assert.equal(replay.data.bucketId, result.data.bucketId);
    const after = contracts['GET /api/v1/admin/free-ai/users/{id}'].success.parse(
        await invoke(state, path, 'GET', {}).json(),
    );
    assert.equal(after.data.available, 32);
    assert.equal(state.admin.tables.audit_events?.at(-1)?.action, 'admin.free-ai.granted');
    assert.equal(invoke(state, `${path}/grants`, 'POST', { ...command, actions: 26 }, true).status, 409);
});

await test('Free AI workspace rejects expired grants and unknown users', () => {
    const state = createSeed();
    const user = state.users.find((entry) => entry.plan === 'free')!;
    const command = {
        expectedUserVersion: '1',
        actions: 1,
        expiresAt: '2026-09-01T10:00:00.000Z',
        reason: 'Просроченная выдача',
        idempotencyKey: crypto.randomUUID(),
        confirmed: true as const,
    };
    assert.equal(invoke(state, `/api/v1/admin/free-ai/users/${user.id}/grants`, 'POST', command, true).status, 409);
    assert.equal(
        invoke(state, '/api/v1/admin/free-ai/users/00000000-0000-4000-8000-000000000099', 'GET', {}).status,
        404,
    );
});
