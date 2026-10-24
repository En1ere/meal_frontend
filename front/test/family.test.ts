import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSeed } from '../src/mocks/model.js';
import { familyHandle, familyStateSchema, mockEntitlement, mockFamilyContext } from '../src/mocks/family.js';

const plusOwner = '10000000-0000-4000-8000-000000000005';
const plusMember = '10000000-0000-4000-8000-000000000006';
const freeUser = '10000000-0000-4000-8000-000000000007';
const proUser = '10000000-0000-4000-8000-000000000003';

await test('Plus fixtures expose the same family and equal household visibility', () => {
    const state = createSeed();
    assert.equal(familyStateSchema.safeParse(state.family).success, true);
    const owner = mockFamilyContext(state, plusOwner);
    const member = mockFamilyContext(state, plusMember);
    assert.equal(owner.state, 'active');
    assert.equal(member.state, 'active');
    assert.equal(owner.family?.id, member.family?.id);
    assert.equal(owner.family?.role, 'owner');
    assert.equal(member.family?.role, 'member');
    assert.deepEqual(owner.family?.members, member.family?.members);
});

await test('Free stays personal while Plus receives agreed quota and family features', () => {
    const state = createSeed();
    const free = mockEntitlement(state, freeUser);
    const plus = mockEntitlement(state, plusMember);
    assert.equal(free.plan, 'free');
    assert.equal(free.capabilities.family, false);
    assert.equal(free.capabilities.aiMonthlyAllowance, 0);
    assert.equal(mockFamilyContext(state, freeUser).state, 'none');
    assert.equal(plus.plan, 'plus');
    assert.equal(plus.source, 'family');
    assert.equal(plus.capabilities.aiMonthlyAllowance, 40);
    assert.equal(plus.capabilities.calendar, false);
});

const call = async (
    state: ReturnType<typeof createSeed>,
    userId: string,
    path: string,
    method: string,
    input: unknown = undefined,
    params: Record<string, string> = {},
    query = new URLSearchParams(),
) => {
    const response = familyHandle({
        state,
        userId,
        path,
        params,
        method,
        query,
        input,
        now: Date.parse('2026-10-01T10:00:00.000Z'),
        success: (data) => Response.json(data),
        fail: (status) => new Response(null, { status }),
    })!;
    const rawBody = await response.text();
    return {
        status: response.status,
        body: rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {},
    };
};

await test('family creation trims its name, replays once and rejects existing or ineligible membership', async () => {
    const state = createSeed();
    const input = {
        name: '  Новый дом  ',
        idempotencyKey: crypto.randomUUID(),
    };
    const created = await call(state, proUser, '/api/v1/family', 'POST', input);
    const replay = await call(state, proUser, '/api/v1/family', 'POST', input);
    assert.equal(created.status, 200);
    assert.deepEqual(replay.body, created.body);
    assert.equal((created.body.family as { name: string }).name, 'Новый дом');
    assert.equal(state.family.families.filter((family) => !family.archived).length, 2);

    const existing = await call(state, plusOwner, '/api/v1/family', 'POST', {
        name: 'Вторая семья',
        idempotencyKey: crypto.randomUUID(),
    });
    const ineligible = await call(state, freeUser, '/api/v1/family', 'POST', {
        name: 'Семья Free',
        idempotencyKey: crypto.randomUUID(),
    });
    assert.equal(existing.status, 409);
    assert.equal(ineligible.status, 403);
});

await test('owner automatic leave transfers ownership, archives membership and creates one important notice', async () => {
    const state = createSeed();
    const preview = await call(state, plusOwner, '/api/v1/family/leave-preview', 'GET');
    assert.equal(preview.body.recommendedMembershipId, '51000000-0000-4000-8000-000000000002');
    const left = await call(state, plusOwner, '/api/v1/family/leave', 'POST', {
        expectedVersion: 1,
        selection: 'automatic',
        successorMembershipId: null,
        idempotencyKey: '90000000-0000-4000-8000-000000000011',
    });
    assert.equal(left.status, 200);
    assert.equal(mockFamilyContext(state, plusOwner).state, 'none');
    assert.equal(mockFamilyContext(state, plusMember).family?.role, 'owner');
    const notice = await call(state, plusMember, '/api/v1/family/ownership-notice', 'GET');
    assert.equal((notice.body.notice as { title: string }).title, 'Вы стали владельцем семьи');
});

await test('only owner removes another active membership and history remains archived', async () => {
    const state = createSeed();
    const denied = await call(
        state,
        plusMember,
        '/api/v1/family/members/51000000-0000-4000-8000-000000000001/remove',
        'POST',
        { expectedVersion: 1, idempotencyKey: '90000000-0000-4000-8000-000000000012' },
        { membershipId: '51000000-0000-4000-8000-000000000001' },
    );
    assert.equal(denied.status, 403);
    const removed = await call(
        state,
        plusOwner,
        '/api/v1/family/members/51000000-0000-4000-8000-000000000002/remove',
        'POST',
        { expectedVersion: 1, idempotencyKey: '90000000-0000-4000-8000-000000000013' },
        { membershipId: '51000000-0000-4000-8000-000000000002' },
    );
    assert.equal(removed.status, 200);
    assert.equal(mockFamilyContext(state, plusMember).state, 'none');
    assert.ok(state.family.families[0]?.members[1]?.leftAt);
});

await test('owner invitation is bound to exact login and recipient accepts it once', async () => {
    const state = createSeed();
    const invited = await call(state, plusOwner, '/api/v1/family/invitations', 'POST', {
        login: 'user1',
        expectedVersion: 1,
        idempotencyKey: crypto.randomUUID(),
    });
    assert.equal(invited.status, 200);
    const token = invited.body.token as string;
    assert.ok(token);
    const foreignPreview = await call(
        state,
        plusMember,
        '/api/v1/family/invitation-preview',
        'GET',
        undefined,
        {},
        new URLSearchParams({ token }),
    );
    assert.equal(foreignPreview.status, 404);
    const recipientPreview = await call(
        state,
        freeUser,
        '/api/v1/family/invitation-preview',
        'GET',
        undefined,
        {},
        new URLSearchParams({ token }),
    );
    const accepted = await call(state, freeUser, '/api/v1/family/invitation-accept', 'POST', {
        token,
        expectedFamilyVersion: recipientPreview.body.familyVersion,
        idempotencyKey: crypto.randomUUID(),
    });
    assert.equal(accepted.status, 200);
    assert.equal(mockFamilyContext(state, freeUser).family?.memberCount, 3);
});

await test('member proposal needs owner approval before it can be accepted', async () => {
    const state = createSeed();
    const candidate = '10000000-0000-4000-8000-000000000008';
    const proposed = await call(state, plusMember, '/api/v1/family/invitations', 'POST', {
        login: 'user2',
        expectedVersion: 1,
        idempotencyKey: crypto.randomUUID(),
    });
    assert.equal(proposed.body.token, null);
    const invitation = proposed.body.invitation as { id: string; version: number };
    const approved = await call(
        state,
        plusOwner,
        `/api/v1/family/invitations/${invitation.id}/approve`,
        'POST',
        { expectedVersion: invitation.version, idempotencyKey: crypto.randomUUID() },
        { invitationId: invitation.id },
    );
    assert.ok(approved.body.token);
    const candidatePreview = await call(
        state,
        candidate,
        '/api/v1/family/invitation-preview',
        'GET',
        undefined,
        {},
        new URLSearchParams({ token: approved.body.token as string }),
    );
    const accepted = await call(state, candidate, '/api/v1/family/invitation-accept', 'POST', {
        token: approved.body.token,
        expectedFamilyVersion: candidatePreview.body.familyVersion,
        idempotencyKey: crypto.randomUUID(),
    });
    assert.equal(accepted.status, 200);
});

await test('family notes are shared, author-owned and checklist marks are collaborative', async () => {
    const state = createSeed();
    const list = await call(state, plusMember, '/api/v1/family/notes', 'GET');
    const notes = list.body.items as Array<{
        id: string;
        author: { userId: string };
        version: number;
        items: Array<{ id: string; version: number; checked: boolean }>;
    }>;
    assert.equal(notes.length, 2);
    const checklist = notes.find((note) => note.author.userId === plusOwner)!;
    const denied = await call(state, plusMember, `/api/v1/family/notes/${checklist.id}`, 'PUT', {
        kind: 'checklist',
        title: 'Чужое изменение',
        body: '',
        items: checklist.items.map((item) => ({ id: item.id, text: 'Пункт' })),
        expectedVersion: checklist.version,
        idempotencyKey: crypto.randomUUID(),
    });
    assert.equal(denied.status, 403);
    const target = checklist.items.find((item) => !item.checked)!;
    const toggled = await call(
        state,
        plusMember,
        `/api/v1/family/notes/${checklist.id}/items/${target.id}/toggle`,
        'POST',
        {
            expectedNoteVersion: checklist.version,
            expectedItemVersion: target.version,
            checked: true,
            idempotencyKey: crypto.randomUUID(),
        },
    );
    assert.equal(toggled.status, 200);
    assert.equal(
        (toggled.body.items as Array<{ id: string; checked: boolean }>).find((item) => item.id === target.id)?.checked,
        true,
    );
    const history = await call(state, plusOwner, `/api/v1/family/notes/${checklist.id}/history`, 'GET');
    assert.equal((history.body.items as unknown[]).length, 1);
});

await test('note author creates and archives a text note with idempotent replay', async () => {
    const state = createSeed();
    const input = {
        kind: 'note',
        title: 'Маршрут',
        body: 'Забрать заказ после работы',
        items: [],
        idempotencyKey: crypto.randomUUID(),
    } as const;
    const created = await call(state, plusMember, '/api/v1/family/notes', 'POST', input);
    const replay = await call(state, plusMember, '/api/v1/family/notes', 'POST', input);
    assert.deepEqual(created.body, replay.body);
    const note = created.body as { id: string; version: number };
    const archived = await call(state, plusMember, `/api/v1/family/notes/${note.id}/archive`, 'POST', {
        expectedVersion: note.version,
        archived: true,
        idempotencyKey: crypto.randomUUID(),
    });
    assert.ok((archived.body as { archivedAt: string | null }).archivedAt);
});

await test('family chat shares messages, keeps author controls and supports collaborative reactions and pins', async () => {
    const state = createSeed();
    const initial = await call(state, plusMember, '/api/v1/family/chat', 'GET');
    const messages = initial.body.items as Array<{
        id: string;
        author: { userId: string };
        version: number;
        pinned: boolean;
        reactions: Array<{ reaction: string; count: number; reactedByMe: boolean }>;
    }>;
    assert.equal(messages.length, 2);
    const ownerMessage = messages.find((item) => item.author.userId === plusOwner)!;
    const denied = await call(state, plusMember, `/api/v1/family/chat/messages/${ownerMessage.id}`, 'PUT', {
        body: 'Чужая правка',
        mentionUserIds: [],
        expectedVersion: ownerMessage.version,
        idempotencyKey: crypto.randomUUID(),
    });
    assert.equal(denied.status, 403);
    const reacted = await call(state, plusOwner, `/api/v1/family/chat/messages/${ownerMessage.id}/reaction`, 'POST', {
        reaction: 'heart',
        active: true,
        idempotencyKey: crypto.randomUUID(),
    });
    assert.equal(
        ((reacted.body.message as { reactions: Array<{ reaction: string; count: number }> }).reactions ?? []).find(
            (item) => item.reaction === 'heart',
        )?.count,
        1,
    );
    const pinned = await call(state, plusMember, `/api/v1/family/chat/messages/${ownerMessage.id}/pin`, 'POST', {
        pinned: false,
        idempotencyKey: crypto.randomUUID(),
    });
    assert.equal((pinned.body.message as { pinned: boolean }).pinned, false);
});

await test('chat send replays once, validates mentions and preserves reply tombstone after author removal', async () => {
    const state = createSeed();
    const input = {
        body: 'Ужин будет готов в восемь',
        replyToId: '53100000-0000-4000-8000-000000000001',
        mentionUserIds: [plusOwner],
        idempotencyKey: crypto.randomUUID(),
    };
    const created = await call(state, plusMember, '/api/v1/family/chat/messages', 'POST', input);
    const replay = await call(state, plusMember, '/api/v1/family/chat/messages', 'POST', input);
    assert.deepEqual(created.body, replay.body);
    const own = created.body.message as { id: string; version: number };
    const removed = await call(state, plusMember, `/api/v1/family/chat/messages/${own.id}/remove`, 'POST', {
        expectedVersion: own.version,
        idempotencyKey: crypto.randomUUID(),
    });
    assert.equal((removed.body.message as { body: string; removedForAllAt: string | null }).body, '');
    assert.ok((removed.body.message as { removedForAllAt: string | null }).removedForAllAt);
    const invalidMention = await call(state, plusMember, '/api/v1/family/chat/messages', 'POST', {
        ...input,
        mentionUserIds: [freeUser],
        idempotencyKey: crypto.randomUUID(),
    });
    assert.equal(invalidMention.status, 422);
});

await test('chat history starts at membership and personal hide does not affect another family member', async () => {
    const state = createSeed();
    state.family.chatMessages.push({
        familyId: state.family.families[0]!.id,
        message: structuredClone(state.family.chatMessages[0]!.message),
    });
    state.family.chatMessages.at(-1)!.message.id = crypto.randomUUID();
    state.family.chatMessages.at(-1)!.message.sentAt = '2026-08-01T00:00:00.000Z';
    const visible = await call(state, plusMember, '/api/v1/family/chat', 'GET');
    assert.equal((visible.body.items as unknown[]).length, 2);
    const target = (visible.body.items as Array<{ id: string }>)[0]!;
    await call(state, plusMember, `/api/v1/family/chat/messages/${target.id}/hide`, 'POST', {
        idempotencyKey: crypto.randomUUID(),
    });
    const memberView = await call(state, plusMember, '/api/v1/family/chat', 'GET');
    const ownerView = await call(state, plusOwner, '/api/v1/family/chat', 'GET');
    assert.equal((memberView.body.items as unknown[]).length, 1);
    assert.equal((ownerView.body.items as unknown[]).length, 2);
});

await test('chat pagination has stable cursors and read receipts advance without regressing', async () => {
    const state = createSeed();
    const template = state.family.chatMessages[0]!;
    for (let index = 0; index < 35; index++) {
        const row = structuredClone(template);
        row.message.id = `53200000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
        row.message.body = `Сообщение ${index}`;
        row.message.sentAt = new Date(Date.parse('2026-09-29T13:00:00.000Z') + index * 60_000).toISOString();
        state.family.chatMessages.push(row);
    }
    const first = await call(
        state,
        plusMember,
        '/api/v1/family/chat',
        'GET',
        undefined,
        {},
        new URLSearchParams({ limit: '10' }),
    );
    const firstItems = first.body.items as Array<{ id: string; sentAt: string }>;
    const nextBefore = first.body.nextBefore as string;
    assert.equal(firstItems.length, 10);
    assert.ok(nextBefore);
    const second = await call(
        state,
        plusMember,
        '/api/v1/family/chat',
        'GET',
        undefined,
        {},
        new URLSearchParams({ limit: '10', before: nextBefore }),
    );
    const secondItems = second.body.items as Array<{ id: string; sentAt: string }>;
    assert.equal(secondItems.length, 10);
    assert.equal(new Set([...firstItems, ...secondItems].map((item) => item.id)).size, 20);

    const latest = firstItems.at(-1)!;
    const readKey = crypto.randomUUID();
    const marked = await call(state, plusMember, '/api/v1/family/chat/read', 'POST', {
        messageId: latest.id,
        idempotencyKey: readKey,
    });
    const replay = await call(state, plusMember, '/api/v1/family/chat/read', 'POST', {
        messageId: latest.id,
        idempotencyKey: readKey,
    });
    assert.deepEqual(marked.body, replay.body);
    assert.equal(state.family.chatReadReceipts[0]?.messageId, latest.id);
    await call(state, plusMember, '/api/v1/family/chat/read', 'POST', {
        messageId: secondItems[0]!.id,
        idempotencyKey: crypto.randomUUID(),
    });
    assert.equal(state.family.chatReadReceipts[0]?.messageId, latest.id);
});
