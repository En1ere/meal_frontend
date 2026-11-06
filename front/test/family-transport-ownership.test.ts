import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
    acceptFamilyInvitation,
    createFamily,
    createFamilyInvitation,
    createFamilyOwnershipRequest,
    decideFamilyInvitation,
    decideFamilyOwnershipRequest,
    dismissFamilyOwnershipNotice,
    leaveFamily,
    loadFamilyContext,
    loadFamilyInvitationPreview,
    loadFamilyInvitations,
    loadFamilyLeavePreview,
    loadFamilyOwnership,
    loadFamilyOwnershipNotice,
    loadFamilyOwnershipRequest,
    previewFamilyOwnership,
    removeFamilyMember,
} from '../src/features/family/api.js';

void test('family adapter preserves exact reads, prepared commands, action dispatch, projections and native errors', async () => {
    const calls: unknown[][] = [];
    const data = { marker: 'family-data' };
    const envelope = { data };
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            return Promise.resolve(envelope);
        },
    };
    const signal = new AbortController().signal;
    const command = { expectedVersion: 7, idempotencyKey: 'caller-key' } as never;

    assert.equal(await loadFamilyContext(transport as never, signal), data);
    assert.equal(await createFamily(transport as never, command), envelope);
    assert.equal(await loadFamilyInvitations(transport as never, signal), data);
    assert.equal(await createFamilyInvitation(transport as never, command), data);
    assert.equal(await decideFamilyInvitation(transport as never, 'approve', 'invitation-a', command), data);
    assert.equal(await decideFamilyInvitation(transport as never, 'cancel', 'invitation-a', command), data);
    assert.equal(await removeFamilyMember(transport as never, 'membership-a', command), data);
    assert.equal(await loadFamilyLeavePreview(transport as never, signal), data);
    assert.equal(await leaveFamily(transport as never, command), data);
    assert.equal(await loadFamilyInvitationPreview(transport as never, 'token-a', signal), data);
    assert.equal(await acceptFamilyInvitation(transport as never, command), data);
    assert.equal(await loadFamilyOwnership(transport as never, signal), data);
    assert.equal(await previewFamilyOwnership(transport as never, command), data);
    assert.equal(await createFamilyOwnershipRequest(transport as never, command), data);
    assert.equal(await loadFamilyOwnershipRequest(transport as never, 'token-a', signal), data);
    assert.equal(await decideFamilyOwnershipRequest(transport as never, 'accept', 'token-a', command), data);
    assert.equal(await decideFamilyOwnershipRequest(transport as never, 'decline', 'token-a', command), data);
    assert.equal(await decideFamilyOwnershipRequest(transport as never, 'cancel', 'token-a', command), data);
    assert.equal(await loadFamilyOwnershipNotice(transport as never, signal), data);
    assert.equal(await dismissFamilyOwnershipNotice(transport as never, command), data);

    assert.deepEqual(calls, [
        ['GET /api/v1/family', undefined, signal],
        ['POST /api/v1/family', command],
        ['GET /api/v1/family/invitations', undefined, signal],
        ['POST /api/v1/family/invitations', command],
        [
            'POST /api/v1/family/invitations/{invitationId}/approve',
            command,
            undefined,
            { invitationId: 'invitation-a' },
        ],
        ['POST /api/v1/family/invitations/{invitationId}/cancel', command, undefined, { invitationId: 'invitation-a' }],
        ['POST /api/v1/family/members/{membershipId}/remove', command, undefined, { membershipId: 'membership-a' }],
        ['GET /api/v1/family/leave-preview', undefined, signal],
        ['POST /api/v1/family/leave', command],
        ['GET /api/v1/family/invitation-preview', undefined, signal, undefined, { query: { token: 'token-a' } }],
        ['POST /api/v1/family/invitation-accept', command],
        ['GET /api/v1/family/ownership', undefined, signal],
        ['POST /api/v1/family/ownership/preview', command],
        ['POST /api/v1/family/ownership/requests', command],
        ['GET /api/v1/family/ownership/requests/{token}', undefined, signal, { token: 'token-a' }],
        ['POST /api/v1/family/ownership/requests/{token}/accept', command, undefined, { token: 'token-a' }],
        ['POST /api/v1/family/ownership/requests/{token}/decline', command, undefined, { token: 'token-a' }],
        ['POST /api/v1/family/ownership/requests/{token}/cancel', command, undefined, { token: 'token-a' }],
        ['GET /api/v1/family/ownership-notice', undefined, signal],
        ['POST /api/v1/family/ownership-notice/dismiss', command],
    ]);

    const error = new Error('transport failed');
    await assert.rejects(
        loadFamilyContext({ request: () => Promise.reject(error) } as never),
        (actual) => actual === error,
    );
});

void test('family consumers use the private adapter while UI keeps retries, versions, roles and cache orchestration', async () => {
    const [details, setup, invite, ownership, notice, adapter] = await Promise.all([
        readFile('src/features/family/family-details.tsx', 'utf8'),
        readFile('src/features/family/family-setup.tsx', 'utf8'),
        readFile('src/features/family/family-invite.tsx', 'utf8'),
        readFile('src/features/family/ownership.tsx', 'utf8'),
        readFile('src/features/family/ownership-notice.tsx', 'utf8'),
        readFile('src/features/family/api.ts', 'utf8'),
    ]);
    for (const source of [details, setup, invite, ownership, notice]) assert.doesNotMatch(source, /\.request\s*\(/u);

    assert.match(details, /loadFamilyInvitations\(api!, signal\)/u);
    assert.match(details, /decideFamilyInvitation\(api!, action, id,/u);
    assert.match(details, /loadFamilyContext\(api!\)/u);
    assert.match(details, /leaveFamily\(api!, attempt\.current\.body\)/u);
    assert.match(details, /keepExactAttempt\(null,/u);
    assert.match(details, /const result = await readback\(\)/u);
    assert.match(details, /family\.role === ['"]owner['"]/u);
    assert.match(setup, /createFamily\(api!, attempt\.current\.body\)/u);
    assert.match(setup, /loadFamilyContext\(api!\)/u);
    assert.match(setup, /keepExactAttempt\(attempt\.current,/u);
    assert.match(invite, /idempotencyKey: key\.current/u);
    assert.match(invite, /queryClient\.setQueryData\(familyKeys\.context/u);
    assert.match(ownership, /idempotencyKey: crypto\.randomUUID\(\)/u);
    assert.match(ownership, /queryClient\.invalidateQueries\(\{ queryKey: familyKeys\.all \}\)/u);
    assert.match(notice, /idempotencyKey: key\.current/u);
    assert.match(notice, /invalidateQueries\(\{ queryKey: notificationKeys\.root \}\)/u);
    assert.match(adapter, /action === ['"]approve['"]/u);
    assert.match(adapter, /action === ['"]accept['"]/u);
});
