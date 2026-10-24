import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSeed } from '../src/mocks/model.js';
import { inventoryHandle } from '../src/mocks/inventory.js';
import { contracts } from '../src/shared/api/contracts.generated.js';
const now = Date.parse('2026-09-28T12:00:00Z');
function setup() {
    const state = createSeed();
    const user = state.users[0]!.id;
    return {
        state,
        user,
        send: (path: string, input?: unknown, id?: string, header?: string, userId = user) =>
            inventoryHandle({
                state,
                userId,
                path,
                method: input === undefined ? 'GET' : 'POST',
                query: new URLSearchParams('localDate=2026-09-28'),
                params: id ? { id } : {},
                input,
                ifMatch: header,
                now,
                success: (data) => Response.json(data),
                fail: (status) => Response.json({ status }, { status }),
            })!,
    };
}
void test('personal fixtures and commands are isolated between users', async () => {
    const { state, user, send } = setup();
    const response: unknown = await send('/api/v1/inventory').json();
    const list = contracts['GET /api/v1/inventory'].success.shape.data.parse(response);
    assert.equal(list.items.length, 4);
    const other = state.users.find((row) => row.id !== user)!.id;
    const batch = list.items[0]!;
    assert.equal(send(`/api/v1/inventory/${batch.id}`, undefined, batch.id, undefined, other).status, 404);
    assert.equal(
        send(
            `/api/v1/inventory/${batch.id}/command`,
            { action: 'archive', version: 1, scope: 'private', idempotencyKey: crypto.randomUUID() },
            batch.id,
            '"1"',
            other,
        ).status,
        404,
    );
});
void test('consumption has stable retry result, rejects stale version and changed-key-body', async () => {
    const { send } = setup();
    const list = contracts['GET /api/v1/inventory'].success.shape.data.parse(await send('/api/v1/inventory').json());
    const batch = list.items.find((row) => row.quantity === '0.75')!;
    const body = {
        action: 'consume',
        version: 1,
        scope: 'private',
        idempotencyKey: crypto.randomUUID(),
        quantity: '0.1',
    };
    const path = `/api/v1/inventory/${batch.id}/command`;
    const first: unknown = await send(path, body, batch.id, '"1"').json();
    assert.deepEqual(await send(path, body, batch.id, '"1"').json(), first);
    assert.equal(send(path, { ...body, quantity: '0.2' }, batch.id, '"1"').status, 409);
    assert.equal(send(path, { ...body, idempotencyKey: crypto.randomUUID() }, batch.id, '"1"').status, 412);
    assert.equal(send(path, { ...body, idempotencyKey: crypto.randomUUID() }, batch.id).status, 428);
});
void test('bulk import validates every row and rolls back earlier rows on failure', async () => {
    const { state, send } = setup();
    const list = contracts['GET /api/v1/inventory'].success.shape.data.parse(await send('/api/v1/inventory').json());
    const { id, version, archivedAt, createdAt, ...fields } = list.items[0]!;
    void id;
    void version;
    void archivedAt;
    void createdAt;
    const before = state.inventory.batches.length;
    const history = state.inventory.history.length;
    const valid = { ...fields, idempotencyKey: crypto.randomUUID() };
    const invalid = { ...valid, idempotencyKey: crypto.randomUUID(), ingredientId: crypto.randomUUID() };
    assert.equal(
        send('/api/v1/inventory/import/commit', { rows: [valid, invalid], idempotencyKey: crypto.randomUUID() }).status,
        422,
    );
    assert.equal(state.inventory.batches.length, before);
    assert.equal(state.inventory.history.length, history);
});
void test('sanction keeps reads available and blocks replay of earlier write', () => {
    const { state, user, send } = setup();
    const body = {
        action: 'create',
        name: 'Морозилка',
        type: 'freezer',
        scope: 'private',
        idempotencyKey: crypto.randomUUID(),
    };
    assert.equal(send('/api/v1/inventory-locations', body).status, 200);
    state.inventory.blocked.push(user);
    assert.equal(send('/api/v1/inventory-locations').status, 200);
    assert.equal(send('/api/v1/inventory-locations', body).status, 403);
});

void test('history filters before pagination and reports full filtered count', async () => {
    const { state, user, send } = setup();
    send('/api/v1/inventory');
    const response = inventoryHandle({
        state,
        userId: user,
        path: '/api/v1/inventory-history',
        method: 'GET',
        query: new URLSearchParams('q=Молоко&action=purchase&limit=1&offset=1&from=2026-09-28T00%3A00%3A00Z'),
        params: {},
        input: undefined,
        ifMatch: undefined,
        now,
        success: (data) => Response.json(data),
        fail: (status) => Response.json({ status }, { status }),
    })!;
    const data = contracts['GET /api/v1/inventory-history'].success.shape.data.parse(await response.json());
    assert.equal(data.total, 2);
    assert.equal(data.items.length, 1);
    assert.equal(data.offset, 1);
    assert.equal(data.limit, 1);
});

void test('family inventory is shared by active members and remains isolated from personal inventory', async () => {
    const state = createSeed();
    const owner = '10000000-0000-4000-8000-000000000005';
    const member = '10000000-0000-4000-8000-000000000006';
    const request = (userId: string, scope: 'private' | 'family', path = '/api/v1/inventory') =>
        inventoryHandle({
            state,
            userId,
            path,
            method: 'GET',
            query: new URLSearchParams(`localDate=2026-09-28&scope=${scope}`),
            params: {},
            input: undefined,
            ifMatch: undefined,
            now,
            success: (data) => Response.json(data),
            fail: (status) => Response.json({ status }, { status }),
        })!;
    const ownerFamily = contracts['GET /api/v1/inventory'].success.shape.data.parse(
        await request(owner, 'family').json(),
    );
    const memberFamily = contracts['GET /api/v1/inventory'].success.shape.data.parse(
        await request(member, 'family').json(),
    );
    const ownerPersonal = contracts['GET /api/v1/inventory'].success.shape.data.parse(
        await request(owner, 'private').json(),
    );
    assert.deepEqual(
        memberFamily.items.map((item) => item.id),
        ownerFamily.items.map((item) => item.id),
    );
    assert.equal(
        ownerFamily.items.every((item) => item.scope === 'family'),
        true,
    );
    assert.equal(
        ownerPersonal.items.every((item) => item.scope === 'private'),
        true,
    );
    assert.notDeepEqual(
        ownerPersonal.items.map((item) => item.id),
        ownerFamily.items.map((item) => item.id),
    );
});
