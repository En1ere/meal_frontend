import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminHandle } from '../src/mocks/admin-api.js';
import { createSeed } from '../src/mocks/model.js';
import type { Principal } from '../src/shared/api/contracts.generated.js';

await test('admin mock detail projects roles/payment attempts and audits reads with original request ID', async () => {
    const state = createSeed(),
        admin = state.users.find((user) => user.role === 'admin')!;
    const actor: Principal = {
        id: admin.id,
        displayName: admin.name,
        sessionId: crypto.randomUUID(),
        context: 'admin',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
    };
    const requestId = crypto.randomUUID();
    const run = (path: string, body: unknown = {}, method = 'GET') =>
        adminHandle({
            state,
            actor,
            requestId,
            path,
            body,
            method,
            now: Date.now(),
            success: (data) => Response.json(data),
            fail: (status) => new Response(null, { status }),
        });
    const access = (await run(`/api/v1/admin/access/${actor.id}`).json()) as {
        item: { fields: { key: string; value: string | null }[] };
    };
    assert.equal(access.item.fields.find((field) => field.key === 'activeStaffRoles')?.value, 'admin');
    const paymentId = state.admin.tables.billing_orders![0]!.id;
    const payment = (await run(`/api/v1/admin/payments/${paymentId}`).json()) as typeof access;
    assert.equal(payment.item.fields.find((field) => field.key === 'paymentAttemptCount')?.value, '1');
    assert.equal(payment.item.fields.find((field) => field.key === 'latestPaymentStatus')?.value, 'pending');
    assert.equal(state.admin.tables.audit_events!.at(-1)!.request_id, requestId);
    assert.equal(state.admin.tables.audit_events!.at(-1)!.action, 'admin.detail.read');
    assert.equal(state.admin.tables.audit_events!.at(-1)!.target_type, 'payments');
    const count = state.admin.tables.audit_events!.length;
    assert.equal(run(`/api/v1/admin/payments/${crypto.randomUUID()}`).status, 404);
    assert.equal(state.admin.tables.audit_events!.length, count);
    run('/api/v1/admin/notification-preferences');
    assert.equal(state.admin.tables.audit_events!.at(-1)!.action, 'admin.notifications.read');
});

await test('admin mock support idempotent replay audits again without duplicating the reply', () => {
    const state = createSeed(),
        admin = state.users.find((user) => user.role === 'admin')!;
    const actor: Principal = {
        id: admin.id,
        displayName: admin.name,
        sessionId: crypto.randomUUID(),
        context: 'admin',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
    };
    const ticket = state.admin.tables.support_tickets![0]!;
    const body = { body: 'Ответ', version: ticket.version, idempotencyKey: crypto.randomUUID() };
    const run = () =>
        adminHandle({
            state,
            actor,
            path: `/api/v1/admin/support/${ticket.id}/reply`,
            body,
            method: 'POST',
            now: Date.now(),
            success: (data) => Response.json(data),
            fail: (status) => new Response(null, { status }),
        });
    assert.equal(run().status, 200);
    assert.equal(run().status, 200);
    assert.equal(state.admin.tables.support_messages!.length, 1);
    const events = state.admin.tables.audit_events!.filter((event) => event.action === 'admin.support.reply');
    assert.equal(events.length, 2);
    assert.equal(events[0]!.target_type, 'admin_action');
});
