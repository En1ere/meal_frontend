import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSeed } from '../src/mocks/model.js';
import { preservesHandle } from '../src/mocks/preserves.js';

const now = Date.parse('2026-10-01T10:00:00.000Z');
const plus = '10000000-0000-4000-8000-000000000005';
const free = '10000000-0000-4000-8000-000000000007';

async function call(
    state: ReturnType<typeof createSeed>,
    userId: string,
    path: string,
    method: string,
    params: Record<string, string>,
    input?: unknown,
    query = 'localDate=2026-10-01',
) {
    const response = preservesHandle({
        state,
        userId,
        path,
        params,
        method,
        query: new URLSearchParams(query),
        input,
        now,
        success: (data) => Response.json(data),
        fail: (status) => Response.json({}, { status }),
    })!;
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

await test('Plus issues a minimal offline QR label and replays the same command', async () => {
    const state = createSeed();
    const list = await call(state, plus, '/api/v1/preserves', 'GET', {});
    const preserve = (list.body.items as Array<{ id: string; version: number; capabilities: { qr: boolean } }>)[0]!;
    assert.equal(preserve.capabilities.qr, true);
    const path = `/api/v1/preserves/${preserve.id}/qr-label`;
    const input = { preserveVersion: preserve.version, idempotencyKey: crypto.randomUUID() };
    const first = await call(state, plus, path, 'POST', { id: preserve.id }, input);
    const second = await call(state, plus, path, 'POST', { id: preserve.id }, input);
    assert.equal(first.status, 200);
    assert.deepEqual(first.body, second.body);
    const payload = (first.body.label as { payload: Record<string, unknown> }).payload;
    assert.deepEqual(Object.keys(payload).sort(), [
        'appUrl',
        'createdOn',
        'expiryOn',
        'id',
        'name',
        'schemaVersion',
        'type',
    ]);
    assert.equal(state.preserves.qrLabels.length, 1);
});

await test('family preserve and its QR label are shared between active family members', async () => {
    const state = createSeed();
    const member = '10000000-0000-4000-8000-000000000006';
    const list = await call(
        state,
        plus,
        '/api/v1/preserves',
        'GET',
        {},
        undefined,
        'localDate=2026-10-01&scope=family',
    );
    const preserve = (list.body.items as Array<{ id: string; version: number; scope: string }>)[0]!;
    assert.equal(preserve.scope, 'family');
    const path = `/api/v1/preserves/${preserve.id}/qr-label`;
    const issued = await call(
        state,
        plus,
        path,
        'POST',
        { id: preserve.id },
        {
            preserveVersion: preserve.version,
            scope: 'family',
            idempotencyKey: crypto.randomUUID(),
        },
    );
    assert.equal(issued.status, 200);
    const read = await call(state, member, path, 'GET', { id: preserve.id }, undefined, 'scope=family');
    assert.deepEqual(read.body.label, issued.body.label);
});

await test('Free can inspect the capability but cannot issue a QR label', async () => {
    const state = createSeed();
    const list = await call(state, free, '/api/v1/preserves', 'GET', {});
    const preserve = (list.body.items as Array<{ id: string; version: number; capabilities: { qr: boolean } }>)[0]!;
    assert.equal(preserve.capabilities.qr, false);
    const path = `/api/v1/preserves/${preserve.id}/qr-label`;
    const read = await call(state, free, path, 'GET', { id: preserve.id });
    assert.deepEqual(read.body.capability, { available: false, reason: 'requires-plus' });
    const denied = await call(
        state,
        free,
        path,
        'POST',
        { id: preserve.id },
        {
            preserveVersion: preserve.version,
            idempotencyKey: crypto.randomUUID(),
        },
    );
    assert.equal(denied.status, 403);
});

await test('preserve create keeps command metadata out of the persisted response', async () => {
    const state = createSeed();
    const input = {
        name: 'Черничное варенье',
        type: 'jam',
        createdOn: '2026-10-01',
        expiryOn: null,
        shelfLifeDays: null,
        locationId: null,
        unit: 'pcs',
        volumePerUnit: null,
        notes: null,
        tags: [],
        ingredients: [],
        imageUrl: null,
        scope: 'private',
        recipeRevisionId: null,
        containers: [{ label: 'Банка 1', quantity: '3' }],
        idempotencyKey: crypto.randomUUID(),
    };
    const created = await call(state, free, '/api/v1/preserves', 'POST', {}, input);
    assert.equal(created.status, 200);
    const preserve = created.body.preserve as Record<string, unknown>;
    assert.equal(preserve.name, input.name);
    assert.equal(preserve.quantity, '3');
    assert.equal('idempotencyKey' in preserve, false);
});
