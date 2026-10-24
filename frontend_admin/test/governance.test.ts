import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeed } from '../src/mocks/model.js';
import { governanceHandle, applyScheduledGovernanceEffects } from '../src/mocks/governance.js';
import type { Principal } from '../src/shared/api/contracts.generated.js';
function setup() {
    const state = createSeed();
    const admin = state.users.find((u) => u.role === 'admin')!;
    const user = state.users.find((u) => !u.role)!;
    const now = Date.now();
    const actor: Principal = {
        id: admin.id,
        displayName: admin.name,
        context: 'admin',
        sessionId: crypto.randomUUID(),
        expiresAt: new Date(now + 3600000).toISOString(),
    };
    state.sessions.push({
        token: 'test',
        principal: actor,
        authenticatedAt: new Date(now).toISOString(),
        revoked: false,
        criticalConfirmedUntil: new Date(now + 1800000).toISOString(),
    });
    const send = (body: unknown, id = user.id, section = 'users') =>
        governanceHandle({
            state,
            actor,
            now,
            path: `/api/v1/admin/governance/${section}/${id}`,
            method: body === undefined ? 'GET' : 'POST',
            body,
            success: (data) => Response.json(data),
            fail: (status) => new Response(null, { status }),
        })!;
    const command = {
        version: '1',
        idempotencyKey: crypto.randomUUID(),
        action: 'ban',
        category: 'rules',
        scope: 'account',
        startsAt: null,
        endsAt: null,
        reason: 'Нарушение правил',
        privateNote: 'private',
        allowTemporaryBan: false,
        subscriptionDisposition: 'keep',
        subscriptionRecipientUserId: null,
        confirmed: true,
    };
    return { state, admin, user, actor, send, command };
}
await test('ban requires explicit category, critical window and cannot target sole admin', () => {
    const c = setup();
    assert.equal(c.send({ ...c.command, category: null }).status, 400);
    assert.equal(c.send(c.command, c.admin.id).status, 409);
    c.state.sessions[0]!.criticalConfirmedUntil = undefined;
    assert.equal(c.send(c.command).status, 403);
});
await test('ban preserves paid period, disables renewal and handles replay conflict', () => {
    const c = setup();
    c.state.admin.tables.subscriptions!.push({
        id: crypto.randomUUID(),
        owner_id: c.user.id,
        auto_renew: true,
        ends_at: '2028-01-01',
    });
    assert.equal(c.send(c.command).status, 200);
    assert.equal(c.send(c.command).status, 200);
    const sub = c.state.admin.tables.subscriptions!.at(-1)!;
    assert.equal(sub.auto_renew, false);
    assert.equal(sub.ends_at, '2028-01-01');
    assert.equal(c.send({ ...c.command, reason: 'changed' }).status, 409);
});
await test('account ban can transfer family Plus and notifies every active member', () => {
    const c = setup();
    const recipient = c.state.users.find((candidate) => !candidate.role && candidate.id !== c.user.id)!;
    const familyId = crypto.randomUUID();
    const subscriptionId = crypto.randomUUID();
    (c.state.admin.tables.subscriptions ??= []).push({
        id: subscriptionId,
        owner_id: c.user.id,
        status: 'active',
        auto_renew: true,
        version: '1',
    });
    (c.state.admin.tables.families ??= []).push({ id: familyId, name: 'Дом Plus', status: 'active', version: '1' });
    (c.state.admin.tables.family_coverages ??= []).push({
        id: crypto.randomUUID(),
        family_id: familyId,
        subscription_id: subscriptionId,
        selected_at: new Date().toISOString(),
        ends_at: null,
        version: '1',
    });
    (c.state.admin.tables.family_memberships ??= []).push(
        { id: crypto.randomUUID(), family_id: familyId, user_id: c.user.id, left_at: null, version: '1' },
        { id: crypto.randomUUID(), family_id: familyId, user_id: recipient.id, left_at: null, version: '1' },
    );
    const response = c.send({
        ...c.command,
        subscriptionDisposition: 'transfer',
        subscriptionRecipientUserId: recipient.id,
    });
    assert.equal(response.status, 200);
    assert.equal(c.state.admin.tables.subscriptions.find((item) => item.id === subscriptionId)?.owner_id, recipient.id);
    assert.equal(c.state.admin.tables.notifications?.filter((item) => item.category === 'family').length, 2);
});
await test('grant moderator defaults limited privileges and revokes only staff sessions', () => {
    const c = setup();
    const userSession = {
        ...c.state.sessions[0]!,
        principal: { ...c.actor, id: c.user.id, sessionId: crypto.randomUUID(), context: 'user' as const },
    };
    const staffSession = {
        ...c.state.sessions[0]!,
        principal: { ...c.actor, id: c.user.id, sessionId: crypto.randomUUID(), context: 'moderator' as const },
    };
    c.state.sessions.push(userSession, staffSession);
    assert.equal(c.send({ ...c.command, action: 'grantModerator' }).status, 200);
    assert.equal(c.user.role, 'moderator');
    assert.equal(
        c.state.admin.tables.staff_role_assignments!.find((r) => r.user_id === c.user.id)!.allow_temporary_ban,
        false,
    );
    assert.equal(userSession.revoked, false);
    assert.equal(staffSession.revoked, true);
});

await test('appeal resolution scopes target, rejects stale versions, replays and lifts only accepted sanction', () => {
    const c = setup();
    const sanction = c.state.admin.tables.sanctions![0]!;
    const appealId = crypto.randomUUID();
    (c.state.admin.tables.appeals ??= []).push({
        id: appealId,
        sanction_id: sanction.id!,
        status: 'pending',
        body: 'Please review',
        version: '1',
    });
    const command = { ...c.command, action: 'acceptAppeal', appealId, appealVersion: '1' };
    assert.equal(c.send({ ...command, appealVersion: '2' }, String(sanction.id), 'sanctions').status, 409);
    assert.equal(c.send({ ...command, appealId: crypto.randomUUID() }, String(sanction.id), 'sanctions').status, 404);
    assert.equal(c.send(command, String(sanction.id), 'sanctions').status, 200);
    assert.equal(c.send(command, String(sanction.id), 'sanctions').status, 200);
    assert.ok(sanction.revoked_at);
    assert.equal(c.state.admin.tables.appeals[0]!.response, command.reason);
    assert.equal(
        c.send(
            { ...command, version: '2', idempotencyKey: crypto.randomUUID(), action: 'rejectAppeal' },
            String(sanction.id),
            'sanctions',
        ).status,
        409,
    );
});
await test('rejected appeal retains restriction and requires public response', () => {
    const c = setup();
    const sanction = c.state.admin.tables.sanctions![0]!;
    const appealId = crypto.randomUUID();
    (c.state.admin.tables.appeals ??= []).push({
        id: appealId,
        sanction_id: sanction.id!,
        status: 'pending',
        version: '1',
    });
    const input = { ...c.command, action: 'rejectAppeal', appealId, appealVersion: '1' };
    assert.equal(c.send({ ...input, reason: '' }, String(sanction.id), 'sanctions').status, 400);
    assert.equal(c.send(input, String(sanction.id), 'sanctions').status, 200);
    assert.equal(sanction.revoked_at, null);
    assert.equal(c.state.admin.tables.appeals[0]!.status, 'rejected');
});

await test('scheduled account ban activates once at start and skips revoked restrictions', () => {
    const c = setup();
    const starts = Date.now() + 60000;
    const sanction = {
        id: crypto.randomUUID(),
        user_id: c.user.id,
        scope: 'account',
        starts_at: new Date(starts).toISOString(),
        ends_at: null,
        revoked_at: null,
    };
    c.state.admin.tables.sanctions!.push(sanction);
    const sub = { id: crypto.randomUUID(), owner_id: c.user.id, auto_renew: true };
    c.state.admin.tables.subscriptions!.push(sub);
    applyScheduledGovernanceEffects(c.state, starts - 1);
    assert.equal(sub.auto_renew, true);
    applyScheduledGovernanceEffects(c.state, starts);
    assert.equal(sub.auto_renew, false);
    sub.auto_renew = true;
    applyScheduledGovernanceEffects(c.state, starts + 1);
    assert.equal(sub.auto_renew, true);
});
