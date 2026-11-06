import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { familyProjectionKeys } from '../src/features/family/query-keys.js';

void test('family projection keys preserve exact account, version, token and prefix tuples', () => {
    assert.deepEqual(familyProjectionKeys.invitations(undefined), ['family-invitations', undefined]);
    assert.deepEqual(familyProjectionKeys.invitations('user-1'), ['family-invitations', 'user-1']);
    assert.deepEqual(familyProjectionKeys.invitationPreview(undefined, 'token-1'), [
        'family-invitation-preview',
        undefined,
        'token-1',
    ]);
    assert.deepEqual(familyProjectionKeys.invitationPreview('user-1', 'token-1'), [
        'family-invitation-preview',
        'user-1',
        'token-1',
    ]);
    assert.deepEqual(familyProjectionKeys.leavePreviewRoot('user-1'), ['family-leave-preview', 'user-1']);
    assert.deepEqual(familyProjectionKeys.leavePreview('user-1', 7), ['family-leave-preview', 'user-1', 7]);
    assert.deepEqual(familyProjectionKeys.ownershipRoot, ['family-ownership']);
    assert.deepEqual(familyProjectionKeys.ownership(undefined), ['family-ownership', undefined]);
    assert.deepEqual(familyProjectionKeys.ownership('user-1'), ['family-ownership', 'user-1']);
    assert.deepEqual(familyProjectionKeys.ownershipRequest(undefined, 'token-1'), [
        'family-ownership-request',
        undefined,
        'token-1',
    ]);
    assert.deepEqual(familyProjectionKeys.ownershipRequest('user-1', 'token-1'), [
        'family-ownership-request',
        'user-1',
        'token-1',
    ]);
    assert.deepEqual(familyProjectionKeys.ownershipNotice, ['family-ownership-notice']);
});

void test('family consumers use exact owners while preserving commands, recovery and notification invalidation', async () => {
    const [details, invite, ownership, notice] = await Promise.all([
        readFile('src/features/family/family-details.tsx', 'utf8'),
        readFile('src/features/family/family-invite.tsx', 'utf8'),
        readFile('src/features/family/ownership.tsx', 'utf8'),
        readFile('src/features/family/ownership-notice.tsx', 'utf8'),
    ]);

    assert.match(details, /queryKey: familyProjectionKeys\.invitations\(userId\)/u);
    assert.match(details, /queryKey: familyProjectionKeys\.leavePreview\(userId, family\.version\)/u);
    assert.match(details, /queryKey: familyProjectionKeys\.leavePreviewRoot\(userId\)/u);
    assert.match(details, /familyProjectionKeys\.leavePreview\(userId, context\.family\.version\)/u);
    assert.doesNotMatch(details, /\[['"]family-(?:invitations|leave-preview)['"]/u);
    assert.match(details, /leaveFamily\(api!, attempt\.current\.body\)/u);
    assert.match(details, /expectedVersion: preview\.data\.familyVersion/u);
    assert.match(details, /keepExactAttempt\(null,/u);
    assert.match(details, /const result = await readback\(\)/u);

    assert.match(invite, /queryKey: familyProjectionKeys\.invitationPreview\(session\.data\?\.id, token\)/u);
    assert.doesNotMatch(invite, /\[['"]family-invitation-preview['"]/u);
    assert.match(invite, /acceptFamilyInvitation\(api!,/u);
    assert.match(invite, /expectedFamilyVersion: preview\.data!\.familyVersion/u);
    assert.match(invite, /idempotencyKey: key\.current/u);

    assert.match(ownership, /queryKey: familyProjectionKeys\.ownership\(session\.data\?\.id\)/u);
    assert.match(ownership, /const queryKey = familyProjectionKeys\.ownershipRequest\(session\.data\?\.id, token\)/u);
    assert.match(ownership, /queryKey: familyProjectionKeys\.ownershipRoot/u);
    assert.doesNotMatch(ownership, /\[['"]family-ownership/u);
    assert.match(ownership, /expectedFamilyVersion: value\.familyVersion/u);
    assert.match(ownership, /idempotencyKey: crypto\.randomUUID\(\)/u);
    assert.match(ownership, /queryClient\.setQueryData\(queryKey,/u);

    assert.match(notice, /queryKey: familyProjectionKeys\.ownershipNotice/u);
    assert.match(notice, /queryClient\.setQueryData\(familyProjectionKeys\.ownershipNotice,/u);
    assert.doesNotMatch(notice, /\[['"]family-ownership-notice['"]\]/u);
    assert.match(notice, /invalidateQueries\(\{ queryKey: notificationKeys\.root \}\)/u);
    assert.match(notice, /dismissFamilyOwnershipNotice\(api!,/u);
    assert.match(notice, /idempotencyKey: key\.current/u);
});
