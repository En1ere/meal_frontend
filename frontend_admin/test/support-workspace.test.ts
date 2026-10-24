import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeed } from '../src/mocks/model.js';
import { supportHandle } from '../src/mocks/support-workspace.js';
import type { Principal } from '../src/shared/api/contracts.generated.js';
function setup() {
    const state = createSeed();
    const user = state.users.find((u) => u.role === 'admin')!;
    const actor: Principal = {
        id: user.id,
        displayName: user.name,
        context: 'admin',
        sessionId: crypto.randomUUID(),
        expiresAt: '2027-01-01T00:00:00.000Z',
    };
    const id = String(state.admin.tables.support_tickets![0]!.id);
    const send = (body: unknown, path = `/api/v1/admin/support/${id}/manage`, principal = actor) =>
        supportHandle({
            state,
            actor: principal,
            path,
            method: body === undefined ? 'GET' : 'POST',
            body,
            now: Date.now(),
            success: (data) => Response.json(data),
            fail: (status) => new Response(null, { status }),
        })!;
    return { state, actor, id, send };
}
await test('support private notes enforce idempotency, versions and context', () => {
    const c = setup();
    const input = {
        version: '1',
        idempotencyKey: crypto.randomUUID(),
        action: 'note',
        targetId: null,
        text: 'Private',
        attachments: [],
    };
    assert.equal(c.send(input).status, 200);
    assert.equal(c.send(input).status, 200);
    assert.equal(c.state.admin.tables.support_messages!.length, 1);
    assert.equal(c.send({ ...input, text: 'Different' }).status, 409);
    assert.equal(c.send({ ...input, idempotencyKey: crypto.randomUUID() }).status, 409);
    assert.equal(c.send(input, undefined, { ...c.actor, context: 'user' }).status, 403);
    assert.equal(c.state.admin.tables.support_messages![0]!.internal, true);
});
await test('support only edits own messages and retains first version', () => {
    const c = setup();
    c.send({
        version: '1',
        idempotencyKey: crypto.randomUUID(),
        action: 'note',
        targetId: null,
        text: 'Original',
        attachments: [],
    });
    const message = c.state.admin.tables.support_messages![0]!;
    const edit = {
        version: '2',
        idempotencyKey: crypto.randomUUID(),
        action: 'edit',
        targetId: message.id,
        text: 'Edited',
        attachments: [],
    };
    assert.equal(c.send(edit, undefined, { ...c.actor, id: crypto.randomUUID() }).status, 403);
    assert.equal(c.send(edit).status, 200);
    assert.equal(c.state.admin.tables.support_message_revisions![0]!.body, 'Original');
});
await test('support attachment actions fail closed without storage and scanner', () => {
    const c = setup();
    const input = {
        version: '1',
        idempotencyKey: crypto.randomUUID(),
        action: 'attach',
        targetId: null,
        text: 'Screen',
        attachments: [{ name: 'screen.mp4', type: 'video/mp4', size: 100, duration: null }],
    };
    const auditCount = c.state.admin.tables.audit_events?.length ?? 0;
    assert.equal(c.send(input).status, 503);
    assert.equal(c.state.admin.tables.support_messages!.length, 0);
    assert.deepEqual(c.state.admin.tables.support_attachments, []);
    assert.equal(
        c.send({ ...input, action: 'hide', targetId: crypto.randomUUID(), text: 'Опасный файл', attachments: [] })
            .status,
        503,
    );
    assert.equal(c.state.admin.tables.audit_events?.length ?? 0, auditCount);
});

await test('support workspace fixtures expose revisions only to staff and never download URLs', async () => {
    const c = setup();
    const path = `/api/v1/admin/support/${c.id}/workspace`;
    assert.equal(c.send(undefined, path, { ...c.actor, context: 'user' }).status, 403);
    const response = c.send(undefined, path);
    const data = (await response.json()) as {
        messages: { internal: boolean; edited: boolean; revisions: unknown[] }[];
        attachments: { status: string }[];
    };
    assert.ok(data.messages.some((m) => m.internal));
    assert.ok(data.messages.some((m) => m.edited && m.revisions.length === 1));
    assert.deepEqual(
        data.attachments.map((a) => a.status),
        ['pending', 'ready', 'rejected', 'hidden'],
    );
    assert.equal(JSON.stringify(data).includes('downloadUrl'), false);
    c.send(undefined, path);
    assert.equal(c.state.admin.tables.support_attachments!.length, 4);
});
