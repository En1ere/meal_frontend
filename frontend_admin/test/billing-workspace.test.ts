import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeed } from '../src/mocks/model.js';
import { billingHandle, seedBillingFixtures, effectiveMockPlan } from '../src/mocks/billing-workspace.js';
import type { Principal } from '../src/shared/api/contracts.generated.js';
function setup() {
    const state = createSeed();
    seedBillingFixtures(state);
    let now = Date.now();
    const admin = state.users.find((u) => u.role === 'admin')!;
    const actor: Principal = {
        id: admin.id,
        displayName: admin.name,
        context: 'admin',
        sessionId: crypto.randomUUID(),
        expiresAt: new Date(now + 86400000).toISOString(),
    };
    state.sessions.push({
        token: 'billing-test',
        principal: actor,
        authenticatedAt: new Date(now).toISOString(),
        revoked: false,
        criticalConfirmedUntil: new Date(now + 1800000).toISOString(),
    });
    const owner = state.users.find((u) => u.plan === 'plus')!;
    const send = (body: unknown, id = owner.id, section = 'users') =>
        billingHandle({
            state,
            actor,
            now,
            path: `/api/v1/admin/billing/${section}/${id}`,
            method: body === undefined ? 'GET' : 'POST',
            body,
            success: (data) => Response.json(data),
            fail: (status) => new Response(null, { status }),
        })!;
    const command = {
        version: '1',
        idempotencyKey: crypto.randomUUID(),
        action: 'freeze',
        plan: 'plus',
        until: null,
        targetId: null,
        amountMinor: null,
        effect: 'preserve',
        reason: 'Test',
        confirmed: true,
        accessConfirmed: false,
    };
    return {
        state,
        owner,
        send,
        command,
        advance: () => {
            now += 60000;
        },
    };
}
await test('billing requires critical window and cannot grant over own active paid plan', () => {
    const c = setup();
    assert.equal(c.send({ ...c.command, action: 'grant', until: '2030-01-01T00:00:00.000Z' }).status, 409);
    c.state.sessions[0]!.criticalConfirmedUntil = undefined;
    assert.equal(c.send(c.command).status, 403);
});
await test('gift revocation preserves paid period', async () => {
    const c = setup();
    assert.equal(c.send({ ...c.command, action: 'extend', until: '2030-01-01T00:00:00.000Z' }).status, 200);
    const view = (await c.send(undefined).json()) as {
        version: string;
        periods: { id: string; source: string; endsAt: string; revoked: boolean }[];
    };
    const paid = view.periods.find((p) => p.source === 'paid')!;
    const gift = view.periods.find((p) => p.source === 'gift')!;
    assert.equal(
        c.send({
            ...c.command,
            version: view.version,
            idempotencyKey: crypto.randomUUID(),
            action: 'revokeGift',
            targetId: paid.id,
        }).status,
        409,
    );
    assert.equal(
        c.send({
            ...c.command,
            version: view.version,
            idempotencyKey: crypto.randomUUID(),
            action: 'revokeGift',
            targetId: gift.id,
        }).status,
        200,
    );
    const after = (await c.send(undefined).json()) as typeof view;
    assert.deepEqual(
        after.periods.find((p) => p.id === paid.id),
        paid,
    );
});
await test('freeze keeps quota and shifts expiry and refresh only by frozen duration', async () => {
    const c = setup();
    const before = (await c.send(undefined).json()) as {
        quota: number;
        refreshAt: string;
        periods: { endsAt: string }[];
    };
    assert.equal(c.send(c.command).status, 200);
    c.advance();
    assert.equal(
        c.send({ ...c.command, action: 'unfreeze', version: '2', idempotencyKey: crypto.randomUUID() }).status,
        200,
    );
    const after = (await c.send(undefined).json()) as typeof before;
    assert.equal(after.quota, before.quota);
    assert.equal(Date.parse(after.refreshAt) - Date.parse(before.refreshAt), 60000);
    assert.equal(Date.parse(after.periods[0]!.endsAt) - Date.parse(before.periods[0]!.endsAt), 60000);
});
await test('refund fails closed without a real payment provider and never mutates the ledger', async () => {
    const c = setup();
    const id = '71000000-0000-4000-8000-000000000001';
    const view = (await c.send(undefined, id, 'payments').json()) as { payment: { targetId: string } };
    const input = { ...c.command, action: 'refund', targetId: view.payment.targetId, amountMinor: '29900' };
    const before = structuredClone(c.state.admin.tables.billing_orders!.find((payment) => payment.id === id));
    const auditCount = c.state.admin.tables.audit_events?.length ?? 0;
    assert.equal(c.send(input, id, 'payments').status, 503);
    assert.deepEqual(
        c.state.admin.tables.billing_orders!.find((payment) => payment.id === id),
        before,
    );
    assert.equal(c.state.admin.tables.audit_events?.length ?? 0, auditCount);
});
await test('every refund target remains unavailable until payment integration is connected', async () => {
    const c = setup();
    for (const id of ['71000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000003']) {
        const view = (await c.send(undefined, id, 'payments').json()) as { payment: { targetId: string } };
        assert.equal(
            c.send(
                {
                    ...c.command,
                    action: 'refund',
                    targetId: view.payment.targetId,
                    amountMinor: '1',
                    effect: 'terminate',
                    accessConfirmed: true,
                },
                id,
                'payments',
            ).status,
            503,
        );
    }
});

await test('audience effective plan reflects Free grant and freeze for the supported Plus tier', () => {
    const c = setup();
    const user = c.state.users.find((u) => u.login === 'user2')!;
    const now = Date.now();
    assert.equal(effectiveMockPlan(c.state, user.id, now), 'free');
    assert.equal(
        c.send({ ...c.command, action: 'grant', plan: 'plus', until: '2030-01-01T00:00:00.000Z' }, user.id).status,
        200,
    );
    assert.equal(effectiveMockPlan(c.state, user.id, now + 1), 'plus');
    assert.equal(c.send({ ...c.command, version: '2', idempotencyKey: crypto.randomUUID() }, user.id).status, 200);
    assert.equal(effectiveMockPlan(c.state, user.id, now + 1), 'free');
});
