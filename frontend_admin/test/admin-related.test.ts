import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeed } from '../src/mocks/model.js';
import { relatedCollections, relatedPage, relatedRows } from '../src/mocks/admin-related.js';
import { adminHandle } from '../src/mocks/admin-api.js';
import type { Principal } from '../src/shared/api/contracts.generated.js';

const actor: Principal = {
    id: '10000000-0000-4000-8000-000000000001',
    displayName: 'Admin',
    context: 'admin',
    sessionId: crypto.randomUUID(),
    expiresAt: '2030-01-01T00:00:00.000Z',
};
await test('related collections isolate parent and explicitly deny unknown collections', () => {
    const state = createSeed(),
        payment = String(state.admin.tables.billing_orders![0]!.id);
    assert.equal(relatedCollections('payments').length, 4);
    assert.equal(relatedPage(state, 'payments', payment, 'attempts', {}, actor).data?.items.length, 1);
    assert.equal(relatedPage(state, 'payments', crypto.randomUUID(), 'attempts', {}, actor).status, 404);
    for (const collection of ['password_credentials', 'constructor', '__proto__'])
        assert.equal(relatedPage(state, 'payments', payment, collection, {}, actor).status, 404);
    state.admin.tables.payment_attempts!.push({
        ...state.admin.tables.payment_attempts![0]!,
        id: crypto.randomUUID(),
        order_id: crypto.randomUUID(),
    });
    assert.equal(relatedRows(state, 'payments', payment, 'attempts').length, 1);
});
await test('related quota joins and recipe revisions follow actual foreign keys', () => {
    const state = createSeed(),
        subscription = String(state.admin.tables.subscriptions![0]!.id),
        item = String(state.admin.tables.moderation_cases![0]!.id);
    assert.equal(relatedRows(state, 'subscriptions', subscription, 'ai-buckets').length, 1);
    assert.equal(relatedRows(state, 'subscriptions', subscription, 'ai-ledger').length, 1);
    assert.equal(relatedRows(state, 'queues', item, 'recipe-revisions').length, 1);
    state.admin.tables.moderation_cases![0]!.recipe_revision_id = null;
    assert.equal(relatedRows(state, 'queues', item, 'recipe-revisions').length, 0);
    assert.equal(state.admin.tables.sanctions![0]!.user_id, state.users.find((user) => user.login === 'user1')!.id);
});
await test('related cursor binds parent, collection, page size and session', () => {
    const state = createSeed(),
        payment = String(state.admin.tables.billing_orders![0]!.id);
    state.admin.tables.payment_attempts!.push({ ...state.admin.tables.payment_attempts![0]!, id: crypto.randomUUID() });
    const first = relatedPage(state, 'payments', payment, 'attempts', { limit: 1 }, actor);
    assert.ok(first.data?.nextCursor);
    const cursor = first.data.nextCursor;
    const second = relatedPage(state, 'payments', payment, 'attempts', { limit: 1, cursor }, actor);
    assert.equal(second.status, 200);
    assert.notEqual(first.data.items[0]!.id, second.data?.items[0]!.id);
    assert.equal(relatedPage(state, 'payments', payment, 'attempts', { limit: 2, cursor }, actor).status, 400);
    assert.equal(relatedPage(state, 'payments', payment, 'refunds', { limit: 1, cursor }, actor).status, 400);
    assert.equal(
        relatedPage(
            state,
            'payments',
            payment,
            'attempts',
            { limit: 1, cursor },
            { ...actor, sessionId: crypto.randomUUID() },
        ).status,
        400,
    );
});
await test('related safe fields omit provider payload and auth secrets; successful read audits once', async () => {
    const state = createSeed(),
        payment = String(state.admin.tables.billing_orders![0]!.id);
    state.admin.tables.payment_attempts![0]!.provider_ref = 'SECRET';
    const count = state.admin.tables.audit_events!.length;
    const response = adminHandle({
        state,
        actor,
        path: `/api/v1/admin/payments/${payment}/related/attempts/search`,
        method: 'POST',
        body: {},
        now: Date.now(),
        success: (data) => Response.json(data),
        fail: (status) => new Response(null, { status }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.text()).includes('SECRET'), false);
    assert.equal(state.admin.tables.audit_events!.length, count + 1);
    assert.equal(state.admin.tables.audit_events!.at(-1)!.target_id, payment);
    assert.equal(state.admin.tables.audit_events!.at(-1)!.action, 'admin.detail.read');
});
await test('support command creates one related history event and replay does not duplicate it', () => {
    const state = createSeed(),
        ticket = state.admin.tables.support_tickets![0]!,
        before = state.admin.tables.support_events!.length;
    const input = { body: 'Проверим', version: '1', idempotencyKey: crypto.randomUUID() };
    const call = () =>
        adminHandle({
            state,
            actor,
            path: `/api/v1/admin/support/${ticket.id}/reply`,
            method: 'POST',
            body: input,
            now: Date.now(),
            success: (data) => Response.json(data),
            fail: (status) => new Response(null, { status }),
        });
    assert.equal(call().status, 200);
    assert.equal(call().status, 200);
    assert.equal(state.admin.tables.support_events!.length, before + 1);
    assert.equal(relatedRows(state, 'support', String(ticket.id), 'events').at(-1)!.kind, 'reply');
});
