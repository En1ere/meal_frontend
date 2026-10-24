import { z } from 'zod';
import type { MockState } from './model.js';
import { mockPersonalSubscription } from './subscription.js';
import { contracts } from '../shared/api/contracts.generated.js';

const noteSchema = contracts['GET /api/v1/family/notes/{id}'].success.shape.data;
const revisionSchema = contracts['GET /api/v1/family/notes/{id}/history'].success.shape.data.shape.items.element;
const chatMessageSchema = contracts['GET /api/v1/family/chat'].success.shape.data.shape.items.element;
const chatDraftSchema = contracts['GET /api/v1/family/chat'].success.shape.data.shape.draft.unwrap();
const invitationSchema = contracts['GET /api/v1/family/invitations'].success.shape.data.shape.items.element;

const memberSchema = z.strictObject({
    id: z.uuid(),
    userId: z.uuid(),
    joinedAt: z.iso.datetime(),
    stableOrder: z.number().int().positive(),
    leftAt: z.iso.datetime().nullable().default(null),
});
const familySchema = z.strictObject({
    id: z.uuid(),
    name: z.string(),
    version: z.number().int().positive(),
    ownerId: z.uuid().nullable(),
    archived: z.boolean().default(false),
    coverageBlocked: z.boolean().optional(),
    plan: z.enum(['plus', 'pro']),
    periodEndsAt: z.iso.datetime(),
    members: z.array(memberSchema),
});
export const familyStateSchema = z.strictObject({
    families: z.array(familySchema),
    replay: z.record(z.string(), z.strictObject({ input: z.string(), result: z.unknown() })),
    ownershipNotices: z
        .array(
            z.strictObject({
                notificationId: z.uuid(),
                transferId: z.uuid(),
                userId: z.uuid(),
                title: z.string(),
                body: z.string(),
                version: z.number().int().positive(),
                dismissed: z.boolean(),
            }),
        )
        .default([]),
    invitations: z
        .array(
            z.strictObject({
                familyId: z.uuid(),
                recipientId: z.uuid(),
                proposedBy: z.uuid(),
                token: z.string(),
                invitation: invitationSchema,
            }),
        )
        .default([]),
    notes: z.array(z.strictObject({ familyId: z.uuid(), note: noteSchema })).default([]),
    noteRevisions: z.array(z.strictObject({ noteId: z.uuid(), revision: revisionSchema })).default([]),
    chatThreadId: z.uuid().nullable().default(null),
    chatMessages: z.array(z.strictObject({ familyId: z.uuid(), message: chatMessageSchema })).default([]),
    chatDrafts: z.array(z.strictObject({ familyId: z.uuid(), userId: z.uuid(), draft: chatDraftSchema })).default([]),
    chatReadReceipts: z
        .array(
            z.strictObject({
                familyId: z.uuid(),
                userId: z.uuid(),
                messageId: z.uuid(),
                readAt: z.iso.datetime(),
            }),
        )
        .default([]),
    hiddenChatMessages: z.array(z.strictObject({ userId: z.uuid(), messageId: z.uuid() })).default([]),
    chatRevisions: z
        .array(z.strictObject({ messageId: z.uuid(), body: z.string(), revision: z.number().int().positive() }))
        .default([]),
    chatReactionActors: z
        .array(
            z.strictObject({
                messageId: z.uuid(),
                userId: z.uuid(),
                reaction: z.enum(['like', 'heart', 'laugh', 'surprise']),
            }),
        )
        .default([]),
});
export type FamilyState = z.infer<typeof familyStateSchema>;

const familyId = '50000000-0000-4000-8000-000000000001';
const plusOwner = '10000000-0000-4000-8000-000000000005';
const plusMember = '10000000-0000-4000-8000-000000000006';

export const createFamilyState = (): FamilyState => ({
    families: [
        {
            id: familyId,
            name: 'Дом Plus',
            version: 1,
            ownerId: plusOwner,
            archived: false,
            plan: 'plus',
            periodEndsAt: '2027-01-01T00:00:00.000Z',
            members: [
                {
                    id: '51000000-0000-4000-8000-000000000001',
                    userId: plusOwner,
                    joinedAt: '2026-09-01T08:00:00.000Z',
                    stableOrder: 1,
                    leftAt: null,
                },
                {
                    id: '51000000-0000-4000-8000-000000000002',
                    userId: plusMember,
                    joinedAt: '2026-09-02T08:00:00.000Z',
                    stableOrder: 2,
                    leftAt: null,
                },
            ],
        },
    ],
    replay: {},
    ownershipNotices: [],
    invitations: [],
    notes: [
        {
            familyId,
            note: noteSchema.parse({
                id: '52000000-0000-4000-8000-000000000001',
                kind: 'checklist',
                title: 'Покупки к выходным',
                body: 'Проверить запасы перед магазином',
                author: { userId: plusOwner, displayName: 'Юзер-плюс 1' },
                canEdit: true,
                archivedAt: null,
                createdAt: '2026-09-29T08:00:00.000Z',
                version: 1,
                items: [
                    {
                        id: '52100000-0000-4000-8000-000000000001',
                        position: 0,
                        text: 'Купить овощи',
                        checked: false,
                        checkedAt: null,
                        checkedBy: null,
                        version: 1,
                    },
                    {
                        id: '52100000-0000-4000-8000-000000000002',
                        position: 1,
                        text: 'Выбрать рецепт',
                        checked: true,
                        checkedAt: '2026-09-30T09:00:00.000Z',
                        checkedBy: { userId: plusMember, displayName: 'Юзер-плюс 2' },
                        version: 2,
                    },
                ],
            }),
        },
        {
            familyId,
            note: noteSchema.parse({
                id: '52000000-0000-4000-8000-000000000002',
                kind: 'note',
                title: 'Семейные предпочтения',
                body: 'По пятницам готовим без мяса.',
                author: { userId: plusMember, displayName: 'Юзер-плюс 2' },
                canEdit: true,
                archivedAt: null,
                createdAt: '2026-09-30T08:00:00.000Z',
                version: 1,
                items: [],
            }),
        },
    ],
    noteRevisions: [],
    chatThreadId: '53000000-0000-4000-8000-000000000001',
    chatMessages: [
        {
            familyId,
            message: chatMessageSchema.parse({
                id: '53100000-0000-4000-8000-000000000001',
                body: 'Кто сможет купить продукты к ужину?',
                author: { userId: plusOwner, displayName: 'Юзер-плюс 1' },
                sentAt: '2026-09-29T12:00:00.000Z',
                editedAt: null,
                removedForAllAt: null,
                replyTo: null,
                mentions: [],
                reactions: [{ reaction: 'like', count: 1, reactedByMe: false }],
                pinned: true,
                canEdit: true,
                canRemoveForAll: true,
                version: 1,
            }),
        },
        {
            familyId,
            message: chatMessageSchema.parse({
                id: '53100000-0000-4000-8000-000000000002',
                body: 'Я зайду после работы.',
                author: { userId: plusMember, displayName: 'Юзер-плюс 2' },
                sentAt: '2026-09-29T12:05:00.000Z',
                editedAt: null,
                removedForAllAt: null,
                replyTo: {
                    id: '53100000-0000-4000-8000-000000000001',
                    body: 'Кто сможет купить продукты к ужину?',
                    removedForAll: false,
                    author: { userId: plusOwner, displayName: 'Юзер-плюс 1' },
                },
                mentions: [{ userId: plusOwner, displayName: 'Юзер-плюс 1' }],
                reactions: [],
                pinned: false,
                canEdit: true,
                canRemoveForAll: true,
                version: 1,
            }),
        },
    ],
    chatDrafts: [],
    chatReadReceipts: [],
    hiddenChatMessages: [],
    chatRevisions: [],
    chatReactionActors: [{ messageId: '53100000-0000-4000-8000-000000000001', userId: plusMember, reaction: 'like' }],
});

const capability = (value: 'free' | 'plus' | 'pro') => ({
    family: value !== 'free',
    qr: value !== 'free',
    planningRange: value !== 'free',
    smartShopping: value !== 'free',
    familyChat: value !== 'free',
    familyNotes: value !== 'free',
    calendar: value === 'pro',
    finance: value === 'pro',
    diary: value === 'pro',
    aiMonthlyAllowance: value === 'pro' ? 120 : value === 'plus' ? 40 : 0,
});

export function mockEntitlement(state: MockState, userId: string) {
    const personal = mockPersonalSubscription(state, userId);
    const family = state.family.families.find(
        (item) => !item.archived && item.members.some((member) => member.userId === userId && !member.leftAt),
    );
    const effectivePlan = family && !family.coverageBlocked ? family.plan : personal.plan;
    return {
        plan: effectivePlan,
        source: family ? ('family' as const) : personal.source,
        subscriptionId: family ? family.ownerId : personal.subscriptionId,
        familyId: family?.id ?? null,
        periodEndsAt: family?.periodEndsAt ?? personal.periodEndsAt,
        graceEndsAt: null,
        capabilities: capability(effectivePlan),
    };
}

export function mockFamilyContext(state: MockState, userId: string) {
    const family = state.family.families.find(
        (item) => !item.archived && item.members.some((member) => member.userId === userId && !member.leftAt),
    );
    const entitlement = mockEntitlement(state, userId);
    if (!family) return { state: 'none' as const, entitlement, family: null, blockedReason: null };
    return {
        state: family.coverageBlocked ? ('blocked' as const) : ('active' as const),
        entitlement,
        family: {
            id: family.id,
            name: family.name,
            version: family.version,
            role: family.ownerId === userId ? ('owner' as const) : ('member' as const),
            memberCount: family.members.filter((member) => !member.leftAt).length,
            seatLimit: 4,
            members: family.members
                .filter((member) => !member.leftAt)
                .toSorted((left, right) => left.stableOrder - right.stableOrder)
                .map((member) => ({
                    id: member.id,
                    userId: member.userId,
                    displayName: state.users.find((user) => user.id === member.userId)?.name ?? 'Участник',
                    role: family.ownerId === member.userId ? ('owner' as const) : ('member' as const),
                    joinedAt: member.joinedAt,
                })),
        },
        blockedReason: family.coverageBlocked ? ('coverage_required' as const) : null,
    };
}

function aiQuotaRedistribution(
    state: MockState,
    family: FamilyState['families'][number],
    beforeUserIds: string[],
    afterUserIds: string[],
    currentUserId: string,
    apply = false,
) {
    const buckets = state.ai.buckets.filter(
        (bucket) => bucket.familyId === family.id && ['subscription', 'family_reserve'].includes(bucket.kind),
    );
    if (!buckets.length)
        return {
            applies: false,
            periodEndsAt: null,
            unspentActions: 0,
            memberCountBefore: beforeUserIds.length,
            memberCountAfter: afterUserIds.length,
            shareAfter: 0,
            familyReserveAfter: 0,
            currentUserBefore: 0,
            currentUserAfter: 0,
        };
    const unspentActions = buckets.reduce((sum, bucket) => sum + bucket.available, 0);
    const shareAfter = afterUserIds.length ? Math.floor(unspentActions / afterUserIds.length) : 0;
    const familyReserveAfter = unspentActions - shareAfter * afterUserIds.length;
    const currentUserBefore = buckets
        .filter((bucket) => bucket.kind === 'subscription' && bucket.userId === currentUserId)
        .reduce((sum, bucket) => sum + bucket.available, 0);
    if (apply) {
        const after = new Set(afterUserIds);
        const subscriptions = new Map(
            buckets
                .filter((bucket) => bucket.kind === 'subscription' && bucket.userId)
                .map((bucket) => [bucket.userId!, bucket]),
        );
        for (const userId of new Set([...subscriptions.keys(), ...afterUserIds])) {
            const bucket = subscriptions.get(userId);
            const target = after.has(userId) ? shareAfter : 0;
            if (bucket) {
                const delta = target - bucket.available;
                bucket.available = target;
                bucket.balance += delta;
                if (delta > 0) bucket.granted += delta;
            } else if (target) {
                state.ai.buckets.push({
                    id: crypto.randomUUID(),
                    userId,
                    familyId: family.id,
                    kind: 'subscription',
                    granted: target,
                    balance: target,
                    reserved: 0,
                    available: target,
                    requiresConfirmation: false,
                    expiresAt: family.periodEndsAt,
                });
            }
        }
        const reserve = buckets.find((bucket) => bucket.kind === 'family_reserve');
        if (reserve) {
            const delta = familyReserveAfter - reserve.available;
            reserve.available = familyReserveAfter;
            reserve.balance += delta;
            if (delta > 0) reserve.granted += delta;
        } else if (familyReserveAfter) {
            state.ai.buckets.push({
                id: crypto.randomUUID(),
                userId: null,
                familyId: family.id,
                kind: 'family_reserve',
                granted: familyReserveAfter,
                balance: familyReserveAfter,
                reserved: 0,
                available: familyReserveAfter,
                requiresConfirmation: true,
                expiresAt: family.periodEndsAt,
            });
        }
    }
    return {
        applies: true,
        periodEndsAt: family.periodEndsAt,
        unspentActions,
        memberCountBefore: beforeUserIds.length,
        memberCountAfter: afterUserIds.length,
        shareAfter,
        familyReserveAfter,
        currentUserBefore,
        currentUserAfter: afterUserIds.includes(currentUserId) ? shareAfter : 0,
    };
}

export function familyHandle(context: {
    state: MockState;
    userId: string | null;
    path: string;
    params: Record<string, string>;
    method: string;
    query?: URLSearchParams;
    input: unknown;
    now: number;
    success: (data: unknown) => Response;
    fail: (status: number) => Response;
}) {
    const { state, userId, path, params, method, input, now, success, fail } = context;
    const query = context.query ?? new URLSearchParams();
    if (!path.startsWith('/api/v1/family') && path !== '/api/v1/entitlements') return null;
    if (!userId) return fail(401);
    if (path === '/api/v1/entitlements' && method === 'GET') return success(mockEntitlement(state, userId));
    if (path === '/api/v1/family' && method === 'GET') return success(mockFamilyContext(state, userId));
    const ownFamily = state.family.families.find(
        (family) => !family.archived && family.members.some((member) => member.userId === userId && !member.leftAt),
    );
    const activeMembers = ownFamily?.members.filter((member) => !member.leftAt) ?? [];
    const ownMembership = activeMembers.find((member) => member.userId === userId);
    if (ownFamily?.coverageBlocked && /^\/api\/v1\/family\/(?:notes|chat)(?:\/|$)/.test(path)) return fail(403);
    const ranked = (members: typeof activeMembers) =>
        members.toSorted(
            (left, right) =>
                Date.parse(left.joinedAt) - Date.parse(right.joinedAt) ||
                left.stableOrder - right.stableOrder ||
                left.id.localeCompare(right.id),
        );
    const invitationMatch = /^\/api\/v1\/family\/invitations\/([^/]+)\/(approve|cancel)$/.exec(path);
    if (path === '/api/v1/family/invitations' && method === 'GET') {
        if (!ownFamily || !ownMembership) return fail(404);
        const owner = ownFamily.ownerId === userId;
        const items = state.family.invitations
            .filter((row) => row.familyId === ownFamily.id && (owner || row.proposedBy === userId))
            .map((row) => ({
                ...row.invitation,
                status:
                    row.invitation.status === 'pending' && Date.parse(row.invitation.expiresAt) <= now
                        ? ('expired' as const)
                        : row.invitation.status,
                proposedByMe: row.proposedBy === userId,
            }));
        return success({ items });
    }
    if (path === '/api/v1/family/invitations' && method === 'POST') {
        if (!ownFamily || !ownMembership) return fail(404);
        const request = contracts['POST /api/v1/family/invitations'].request.parse(input);
        const binding = `${userId}:family:invite:${request.idempotencyKey}`;
        const old = state.family.replay[binding];
        if (old) return old.input === JSON.stringify(request) ? success(old.result) : fail(409);
        if (ownFamily.version !== request.expectedVersion) return fail(412);
        const recipient = state.users.find(
            (candidate) => candidate.login.toLowerCase() === request.login.toLowerCase(),
        );
        if (!recipient || recipient.id === userId) return fail(404);
        const occupied = state.family.families.some(
            (family) =>
                !family.archived && family.members.some((member) => member.userId === recipient.id && !member.leftAt),
        );
        if (occupied) return fail(409);
        if (
            state.family.invitations.some(
                (row) =>
                    row.familyId === ownFamily.id &&
                    row.recipientId === recipient.id &&
                    ['proposed', 'pending'].includes(row.invitation.status) &&
                    Date.parse(row.invitation.expiresAt) > now,
            )
        )
            return fail(409);
        const isOwner = ownFamily.ownerId === userId;
        const token = crypto.randomUUID() + crypto.randomUUID().replaceAll('-', '');
        const invitation = invitationSchema.parse({
            id: crypto.randomUUID(),
            recipientLogin: recipient.login,
            recipientDisplayName: recipient.name,
            status: isOwner ? 'pending' : 'proposed',
            proposedByMe: true,
            expiresAt: new Date(now + 7 * 86_400_000).toISOString(),
            createdAt: new Date(now).toISOString(),
            version: 1,
        });
        const result = { invitation, token: isOwner ? token : null };
        state.family.invitations.push({
            familyId: ownFamily.id,
            recipientId: recipient.id,
            proposedBy: userId,
            token,
            invitation,
        });
        state.family.replay[binding] = { input: JSON.stringify(request), result: structuredClone(result) };
        return success(result);
    }
    if (invitationMatch && method === 'POST') {
        if (!ownFamily || !ownMembership) return fail(404);
        const action = invitationMatch[2] as 'approve' | 'cancel';
        const request =
            contracts[
                action === 'approve'
                    ? 'POST /api/v1/family/invitations/{invitationId}/approve'
                    : 'POST /api/v1/family/invitations/{invitationId}/cancel'
            ].request.parse(input);
        const row = state.family.invitations.find(
            (candidate) => candidate.familyId === ownFamily.id && candidate.invitation.id === invitationMatch[1],
        );
        if (!row) return fail(404);
        if (row.invitation.version !== request.expectedVersion) return fail(412);
        const owner = ownFamily.ownerId === userId;
        if ((action === 'approve' && !owner) || (action === 'cancel' && !owner && row.proposedBy !== userId))
            return fail(403);
        if (action === 'approve' && row.invitation.status !== 'proposed') return fail(409);
        if (action === 'cancel' && !['proposed', 'pending'].includes(row.invitation.status)) return fail(409);
        row.token = crypto.randomUUID() + crypto.randomUUID().replaceAll('-', '');
        row.invitation.status = action === 'approve' ? 'pending' : 'cancelled';
        row.invitation.expiresAt =
            action === 'approve' ? new Date(now + 7 * 86_400_000).toISOString() : row.invitation.expiresAt;
        row.invitation.version++;
        return success({
            invitation: { ...row.invitation, proposedByMe: row.proposedBy === userId },
            token: action === 'approve' ? row.token : null,
        });
    }
    if (path === '/api/v1/family/invitation-preview' && method === 'GET') {
        const token = query.get('token') ?? '';
        const row = state.family.invitations.find(
            (candidate) => candidate.token === token && candidate.recipientId === userId,
        );
        if (!row) return fail(404);
        const family = state.family.families.find((candidate) => candidate.id === row.familyId)!;
        const inviter = state.users.find((candidate) => candidate.id === row.proposedBy)!;
        const beforeUserIds = family.members.filter((member) => !member.leftAt).map((member) => member.userId);
        return success({
            familyName: family.name,
            familyVersion: family.version,
            inviterName: inviter.name,
            recipientLogin: row.invitation.recipientLogin,
            status:
                row.invitation.status === 'pending' && Date.parse(row.invitation.expiresAt) <= now
                    ? 'expired'
                    : row.invitation.status,
            expiresAt: row.invitation.expiresAt,
            aiQuotaRedistribution: aiQuotaRedistribution(
                state,
                family,
                beforeUserIds,
                [...beforeUserIds, userId],
                userId,
            ),
        });
    }
    if (path === '/api/v1/family/invitation-accept' && method === 'POST') {
        const request = contracts['POST /api/v1/family/invitation-accept'].request.parse(input);
        const binding = `${userId}:family:accept:${request.idempotencyKey}`;
        const old = state.family.replay[binding];
        if (old) return old.input === JSON.stringify(request) ? success(old.result) : fail(409);
        const row = state.family.invitations.find(
            (candidate) => candidate.token === request.token && candidate.recipientId === userId,
        );
        if (!row) return fail(404);
        if (row.invitation.status !== 'pending' || Date.parse(row.invitation.expiresAt) <= now) return fail(409);
        if (ownFamily) return fail(409);
        const family = state.family.families.find((candidate) => candidate.id === row.familyId && !candidate.archived);
        if (!family || family.members.filter((member) => !member.leftAt).length >= 4) return fail(409);
        if (family.version !== request.expectedFamilyVersion) return fail(412);
        const beforeUserIds = family.members.filter((member) => !member.leftAt).map((member) => member.userId);
        family.members.push({
            id: crypto.randomUUID(),
            userId,
            joinedAt: new Date(now).toISOString(),
            stableOrder: Math.max(0, ...family.members.map((member) => member.stableOrder)) + 1,
            leftAt: null,
        });
        aiQuotaRedistribution(state, family, beforeUserIds, [...beforeUserIds, userId], userId, true);
        family.version++;
        row.invitation.status = 'accepted';
        row.invitation.version++;
        const result = mockFamilyContext(state, userId);
        state.family.replay[binding] = { input: JSON.stringify(request), result: structuredClone(result) };
        return success(result);
    }
    if (path.startsWith('/api/v1/family/chat')) {
        if (!ownFamily || !ownMembership) return fail(404);
        const memberName = (id: string) => state.users.find((item) => item.id === id)?.name ?? 'Участник';
        const activeIds = new Set(activeMembers.map((member) => member.userId));
        const rows = state.family.chatMessages.filter((row) => row.familyId === ownFamily.id);
        const find = (id: string) => rows.find((row) => row.message.id === id);
        const project = (row: (typeof rows)[number]) => {
            const source = structuredClone(row.message);
            source.canEdit = source.author.userId === userId && !source.removedForAllAt;
            source.canRemoveForAll = source.canEdit;
            source.body = source.removedForAllAt ? '' : source.body;
            if (source.replyTo) {
                const parent = find(source.replyTo.id)?.message;
                if (parent) {
                    source.replyTo.body = parent.removedForAllAt ? '' : parent.body;
                    source.replyTo.removedForAll = !!parent.removedForAllAt;
                }
            }
            const actors = state.family.chatReactionActors.filter((item) => item.messageId === source.id);
            source.reactions = [...new Set(actors.map((item) => item.reaction))].map((reaction) => ({
                reaction,
                count: actors.filter((item) => item.reaction === reaction).length,
                reactedByMe: actors.some((item) => item.reaction === reaction && item.userId === userId),
            }));
            return chatMessageSchema.parse(source);
        };
        const remember = (binding: string, request: unknown, result: unknown) => {
            state.family.replay[binding] = { input: JSON.stringify(request), result: structuredClone(result) };
            return success(result);
        };
        const replay = (binding: string, request: unknown) => {
            const old = state.family.replay[binding];
            return old ? (old.input === JSON.stringify(request) ? success(old.result) : fail(409)) : null;
        };
        const visible = (row: (typeof rows)[number]) =>
            Date.parse(row.message.sentAt) >= Date.parse(ownMembership.joinedAt) &&
            !state.family.hiddenChatMessages.some(
                (item) => item.userId === userId && item.messageId === row.message.id,
            );
        const messageMatch = /^\/api\/v1\/family\/chat\/messages\/([^/]+)$/.exec(path);
        const removeMatch = /^\/api\/v1\/family\/chat\/messages\/([^/]+)\/remove$/.exec(path);
        const hideMatch = /^\/api\/v1\/family\/chat\/messages\/([^/]+)\/hide$/.exec(path);
        const reactionMatch = /^\/api\/v1\/family\/chat\/messages\/([^/]+)\/reaction$/.exec(path);
        const pinMatch = /^\/api\/v1\/family\/chat\/messages\/([^/]+)\/pin$/.exec(path);
        if (path === '/api/v1/family/chat' && method === 'GET') {
            const q = (query.get('q') ?? '').trim().toLocaleLowerCase('ru-RU');
            const before = query.get('before');
            const limit = Math.min(50, Math.max(1, Number(query.get('limit') ?? 30)));
            const candidates = rows
                .filter(visible)
                .filter((row) => !before || row.message.sentAt < before)
                .filter(
                    (row) =>
                        !q || (!row.message.removedForAllAt && row.message.body.toLocaleLowerCase('ru-RU').includes(q)),
                )
                .toSorted(
                    (left, right) =>
                        right.message.sentAt.localeCompare(left.message.sentAt) ||
                        right.message.id.localeCompare(left.message.id),
                )
                .slice(0, limit);
            const draft = state.family.chatDrafts.find(
                (item) => item.familyId === ownFamily.id && item.userId === userId,
            );
            return success({
                threadId: state.family.chatThreadId,
                joinedAt: ownMembership.joinedAt,
                items: candidates.toReversed().map(project),
                pinned: rows
                    .filter((row) => visible(row) && row.message.pinned)
                    .slice(0, 10)
                    .map(project),
                draft: draft?.draft ?? null,
                members: activeMembers.map((member) => ({
                    userId: member.userId,
                    displayName: memberName(member.userId),
                })),
                nextBefore: candidates.length === limit ? (candidates.at(-1)?.message.sentAt ?? null) : null,
            });
        }
        if (path === '/api/v1/family/chat/messages' && method === 'POST') {
            const request = contracts['POST /api/v1/family/chat/messages'].request.parse(input);
            const mentionUserIds = request.mentionUserIds ?? [];
            const binding = `${userId}:chat:send:${request.idempotencyKey}`;
            const old = replay(binding, request);
            if (old) return old;
            if (
                new Set(mentionUserIds).size !== mentionUserIds.length ||
                mentionUserIds.some((id) => !activeIds.has(id))
            )
                return fail(422);
            const reply = request.replyToId ? find(request.replyToId) : null;
            if (request.replyToId && (!reply || !visible(reply))) return fail(404);
            state.family.chatThreadId ??= crypto.randomUUID();
            const id = crypto.randomUUID();
            const row = {
                familyId: ownFamily.id,
                message: chatMessageSchema.parse({
                    id,
                    body: request.body,
                    author: { userId, displayName: memberName(userId) },
                    sentAt: new Date(now).toISOString(),
                    editedAt: null,
                    removedForAllAt: null,
                    replyTo: reply
                        ? {
                              id: reply.message.id,
                              body: reply.message.removedForAllAt ? '' : reply.message.body,
                              removedForAll: !!reply.message.removedForAllAt,
                              author: reply.message.author,
                          }
                        : null,
                    mentions: mentionUserIds.map((mentioned) => ({
                        userId: mentioned,
                        displayName: memberName(mentioned),
                    })),
                    reactions: [],
                    pinned: false,
                    canEdit: true,
                    canRemoveForAll: true,
                    version: 1,
                }),
            };
            state.family.chatMessages.push(row);
            state.family.chatRevisions.push({ messageId: id, body: request.body, revision: 1 });
            state.family.chatDrafts = state.family.chatDrafts.filter(
                (item) => item.familyId !== ownFamily.id || item.userId !== userId,
            );
            return remember(binding, request, { message: project(row) });
        }
        if (messageMatch && method === 'PUT') {
            const request = contracts['PUT /api/v1/family/chat/messages/{id}'].request.parse(input);
            const mentionUserIds = request.mentionUserIds ?? [];
            const binding = `${userId}:chat:edit:${messageMatch[1]}:${request.idempotencyKey}`;
            const old = replay(binding, request);
            if (old) return old;
            const row = find(messageMatch[1]!);
            if (!row || !visible(row)) return fail(404);
            if (row.message.author.userId !== userId || row.message.removedForAllAt) return fail(403);
            if (row.message.version !== request.expectedVersion) return fail(412);
            if (
                new Set(mentionUserIds).size !== mentionUserIds.length ||
                mentionUserIds.some((id) => !activeIds.has(id))
            )
                return fail(422);
            row.message.body = request.body;
            row.message.mentions = mentionUserIds.map((mentioned) => ({
                userId: mentioned,
                displayName: memberName(mentioned),
            }));
            row.message.editedAt = new Date(now).toISOString();
            row.message.version++;
            state.family.chatRevisions.push({
                messageId: row.message.id,
                body: row.message.body,
                revision: state.family.chatRevisions.filter((item) => item.messageId === row.message.id).length + 1,
            });
            return remember(binding, request, { message: project(row) });
        }
        if (removeMatch && method === 'POST') {
            const request = contracts['POST /api/v1/family/chat/messages/{id}/remove'].request.parse(input);
            const binding = `${userId}:chat:remove:${removeMatch[1]}:${request.idempotencyKey}`;
            const old = replay(binding, request);
            if (old) return old;
            const row = find(removeMatch[1]!);
            if (!row || !visible(row)) return fail(404);
            if (row.message.author.userId !== userId || row.message.removedForAllAt) return fail(403);
            if (row.message.version !== request.expectedVersion) return fail(412);
            state.family.chatRevisions.push({
                messageId: row.message.id,
                body: row.message.body,
                revision: state.family.chatRevisions.filter((item) => item.messageId === row.message.id).length + 1,
            });
            row.message.removedForAllAt = new Date(now).toISOString();
            row.message.pinned = false;
            row.message.version++;
            return remember(binding, request, { message: project(row) });
        }
        if (hideMatch && method === 'POST') {
            const request = contracts['POST /api/v1/family/chat/messages/{id}/hide'].request.parse(input);
            const binding = `${userId}:chat:hide:${hideMatch[1]}:${request.idempotencyKey}`;
            const old = replay(binding, request);
            if (old) return old;
            const row = find(hideMatch[1]!);
            if (!row || !visible(row)) return fail(404);
            state.family.hiddenChatMessages.push({ userId, messageId: row.message.id });
            return remember(binding, request, { message: null });
        }
        if (reactionMatch && method === 'POST') {
            const request = contracts['POST /api/v1/family/chat/messages/{id}/reaction'].request.parse(input);
            const binding = `${userId}:chat:reaction:${reactionMatch[1]}:${request.reaction}:${request.idempotencyKey}`;
            const old = replay(binding, request);
            if (old) return old;
            const row = find(reactionMatch[1]!);
            if (!row || !visible(row)) return fail(404);
            state.family.chatReactionActors = state.family.chatReactionActors.filter(
                (item) =>
                    item.messageId !== row.message.id || item.userId !== userId || item.reaction !== request.reaction,
            );
            if (request.active)
                state.family.chatReactionActors.push({
                    messageId: row.message.id,
                    userId,
                    reaction: request.reaction,
                });
            return remember(binding, request, { message: project(row) });
        }
        if (pinMatch && method === 'POST') {
            const request = contracts['POST /api/v1/family/chat/messages/{id}/pin'].request.parse(input);
            const binding = `${userId}:chat:pin:${pinMatch[1]}:${request.idempotencyKey}`;
            const old = replay(binding, request);
            if (old) return old;
            const row = find(pinMatch[1]!);
            if (!row || !visible(row)) return fail(404);
            if (row.message.removedForAllAt) return fail(409);
            row.message.pinned = request.pinned;
            return remember(binding, request, { message: project(row) });
        }
        if (path === '/api/v1/family/chat/draft' && method === 'PUT') {
            const request = contracts['PUT /api/v1/family/chat/draft'].request.parse(input);
            const binding = `${userId}:chat:draft:${request.idempotencyKey}`;
            const old = replay(binding, request);
            if (old) return old;
            const current = state.family.chatDrafts.find(
                (item) => item.familyId === ownFamily.id && item.userId === userId,
            );
            if ((current?.draft.version ?? null) !== request.expectedVersion) return fail(412);
            const draft = chatDraftSchema.parse({ body: request.body, version: (current?.draft.version ?? 0) + 1 });
            if (current) current.draft = draft;
            else state.family.chatDrafts.push({ familyId: ownFamily.id, userId, draft });
            return remember(binding, request, draft);
        }
        if (path === '/api/v1/family/chat/read' && method === 'POST') {
            const request = contracts['POST /api/v1/family/chat/read'].request.parse(input);
            const binding = `${userId}:chat:read:${request.idempotencyKey}`;
            const old = replay(binding, request);
            if (old) return old;
            const row = find(request.messageId);
            if (!row || !visible(row)) return fail(404);
            const receipt = state.family.chatReadReceipts.find(
                (item) => item.familyId === ownFamily.id && item.userId === userId,
            );
            const previous = receipt ? find(receipt.messageId) : null;
            if (!receipt) {
                state.family.chatReadReceipts.push({
                    familyId: ownFamily.id,
                    userId,
                    messageId: row.message.id,
                    readAt: new Date(now).toISOString(),
                });
            } else if (!previous || previous.message.sentAt < row.message.sentAt) {
                receipt.messageId = row.message.id;
                receipt.readAt = new Date(now).toISOString();
            }
            return remember(binding, request, { message: project(row) });
        }
        return fail(404);
    }
    if (path.startsWith('/api/v1/family/notes')) {
        if (!ownFamily || !ownMembership) return fail(404);
        const rows = state.family.notes.filter((row) => row.familyId === ownFamily.id);
        const project = (row: (typeof rows)[number]) => ({
            ...structuredClone(row.note),
            canEdit: row.note.author.userId === userId,
        });
        const detailMatch = /^\/api\/v1\/family\/notes\/([^/]+)$/.exec(path);
        const historyMatch = /^\/api\/v1\/family\/notes\/([^/]+)\/history$/.exec(path);
        const archiveMatch = /^\/api\/v1\/family\/notes\/([^/]+)\/archive$/.exec(path);
        const toggleMatch = /^\/api\/v1\/family\/notes\/([^/]+)\/items\/([^/]+)\/toggle$/.exec(path);
        const remember = (binding: string, request: unknown, result: unknown) => {
            state.family.replay[binding] = { input: JSON.stringify(request), result: structuredClone(result) };
            return success(result);
        };
        const replay = (binding: string, request: unknown) => {
            const old = state.family.replay[binding];
            return old ? (old.input === JSON.stringify(request) ? success(old.result) : fail(409)) : null;
        };
        const revision = (row: (typeof rows)[number]) => {
            const count = state.family.noteRevisions.filter((item) => item.noteId === row.note.id).length;
            state.family.noteRevisions.push({
                noteId: row.note.id,
                revision: revisionSchema.parse({
                    id: crypto.randomUUID(),
                    revision: count + 1,
                    actor: { userId, displayName: state.users.find((item) => item.id === userId)?.name ?? 'Участник' },
                    recordedAt: new Date(now).toISOString(),
                    snapshot: {
                        title: row.note.title,
                        body: row.note.body,
                        kind: row.note.kind,
                        archived: row.note.archivedAt !== null,
                        items: row.note.items.map((item) => ({ id: item.id, text: item.text, checked: item.checked })),
                    },
                }),
            });
        };
        if (path === '/api/v1/family/notes' && method === 'GET') {
            const tab = query.get('tab') === 'archived' ? 'archived' : 'active';
            const q = (query.get('q') ?? '').trim().toLocaleLowerCase('ru-RU');
            return success({
                items: rows
                    .map(project)
                    .filter(
                        (note) =>
                            (tab === 'archived' ? note.archivedAt !== null : note.archivedAt === null) &&
                            (!q ||
                                note.title.toLocaleLowerCase('ru-RU').includes(q) ||
                                note.body.toLocaleLowerCase('ru-RU').includes(q)),
                    ),
            });
        }
        if (path === '/api/v1/family/notes' && method === 'POST') {
            const request = contracts['POST /api/v1/family/notes'].request.parse(input);
            const binding = `${userId}:note:create:${request.idempotencyKey}`;
            const old = replay(binding, request);
            if (old) return old;
            const row = {
                familyId: ownFamily.id,
                note: noteSchema.parse({
                    id: crypto.randomUUID(),
                    kind: request.kind,
                    title: request.title,
                    body: request.body,
                    author: { userId, displayName: state.users.find((item) => item.id === userId)?.name ?? 'Участник' },
                    canEdit: true,
                    archivedAt: null,
                    createdAt: new Date(now).toISOString(),
                    version: 1,
                    items: request.items.map((item, position) => ({
                        id: item.id ?? crypto.randomUUID(),
                        position,
                        text: item.text,
                        checked: false,
                        checkedAt: null,
                        checkedBy: null,
                        version: 1,
                    })),
                }),
            };
            state.family.notes.push(row);
            revision(row);
            return remember(binding, request, project(row));
        }
        if (historyMatch && method === 'GET') {
            const row = rows.find((item) => item.note.id === historyMatch[1]);
            if (!row) return fail(404);
            return success({
                items: state.family.noteRevisions
                    .filter((item) => item.noteId === row.note.id)
                    .map((item) => item.revision)
                    .toSorted((left, right) => right.revision - left.revision),
            });
        }
        if (detailMatch && method === 'GET') {
            const row = rows.find((item) => item.note.id === detailMatch[1]);
            return row ? success(project(row)) : fail(404);
        }
        if (detailMatch && method === 'PUT') {
            const request = contracts['PUT /api/v1/family/notes/{id}'].request.parse(input);
            const binding = `${userId}:note:update:${detailMatch[1]}:${request.idempotencyKey}`;
            const old = replay(binding, request);
            if (old) return old;
            const row = rows.find((item) => item.note.id === detailMatch[1]);
            if (!row) return fail(404);
            if (row.note.author.userId !== userId) return fail(403);
            if (row.note.version !== request.expectedVersion) return fail(412);
            const previous = new Map(row.note.items.map((item) => [item.id, item]));
            if (request.items.some((item) => item.id && !previous.has(item.id))) return fail(422);
            row.note.kind = request.kind;
            row.note.title = request.title;
            row.note.body = request.body;
            row.note.items = request.items.map((item, position) => {
                const current = item.id ? previous.get(item.id) : undefined;
                return current
                    ? { ...current, position, text: item.text, version: current.version + 1 }
                    : {
                          id: crypto.randomUUID(),
                          position,
                          text: item.text,
                          checked: false,
                          checkedAt: null,
                          checkedBy: null,
                          version: 1,
                      };
            });
            row.note.version++;
            revision(row);
            return remember(binding, request, project(row));
        }
        if (archiveMatch && method === 'POST') {
            const request = contracts['POST /api/v1/family/notes/{id}/archive'].request.parse(input);
            const binding = `${userId}:note:archive:${archiveMatch[1]}:${request.idempotencyKey}`;
            const old = replay(binding, request);
            if (old) return old;
            const row = rows.find((item) => item.note.id === archiveMatch[1]);
            if (!row) return fail(404);
            if (row.note.author.userId !== userId) return fail(403);
            if (row.note.version !== request.expectedVersion) return fail(412);
            row.note.archivedAt = request.archived ? new Date(now).toISOString() : null;
            row.note.version++;
            revision(row);
            return remember(binding, request, project(row));
        }
        if (toggleMatch && method === 'POST') {
            const request = contracts['POST /api/v1/family/notes/{id}/items/{itemId}/toggle'].request.parse(input);
            const binding = `${userId}:note:toggle:${toggleMatch[1]}:${toggleMatch[2]}:${request.idempotencyKey}`;
            const old = replay(binding, request);
            if (old) return old;
            const row = rows.find((item) => item.note.id === toggleMatch[1]);
            if (!row) return fail(404);
            if (row.note.archivedAt || row.note.kind !== 'checklist') return fail(409);
            if (row.note.version !== request.expectedNoteVersion) return fail(412);
            const item = row.note.items.find((candidate) => candidate.id === toggleMatch[2]);
            if (!item) return fail(404);
            if (item.version !== request.expectedItemVersion) return fail(412);
            item.checked = request.checked;
            item.checkedAt = request.checked ? new Date(now).toISOString() : null;
            item.checkedBy = request.checked
                ? { userId, displayName: state.users.find((candidate) => candidate.id === userId)?.name ?? 'Участник' }
                : null;
            item.version++;
            row.note.version++;
            revision(row);
            return remember(binding, request, project(row));
        }
        return fail(404);
    }
    if (path === '/api/v1/family/leave-preview' && method === 'GET') {
        if (!ownFamily || !ownMembership) return fail(404);
        const candidates = ranked(activeMembers.filter((member) => member.id !== ownMembership.id));
        return success({
            familyId: ownFamily.id,
            familyVersion: ownFamily.version,
            role: ownFamily.ownerId === ownMembership.userId ? 'owner' : 'member',
            willArchive: activeMembers.length === 1,
            recommendedMembershipId: candidates[0]?.id ?? null,
            candidates: candidates.map((member) => ({
                id: member.id,
                userId: member.userId,
                displayName: state.users.find((user) => user.id === member.userId)?.name ?? 'Участник',
                role: ownFamily.ownerId === member.userId ? 'owner' : 'member',
                joinedAt: member.joinedAt,
            })),
            aiQuotaRedistribution: aiQuotaRedistribution(
                state,
                ownFamily,
                activeMembers.map((member) => member.userId),
                activeMembers.filter((member) => member.id !== ownMembership.id).map((member) => member.userId),
                userId,
            ),
        });
    }
    if (path === '/api/v1/family/ownership-notice' && method === 'GET') {
        const notice = state.family.ownershipNotices.find((item) => item.userId === userId && !item.dismissed);
        return success({
            notice: notice
                ? {
                      notificationId: notice.notificationId,
                      transferId: notice.transferId,
                      title: notice.title,
                      body: notice.body,
                      version: notice.version,
                  }
                : null,
        });
    }
    if (path === '/api/v1/family/ownership-notice/dismiss' && method === 'POST') {
        const request = input as { notificationId: string; expectedVersion: number; idempotencyKey: string };
        const notice = state.family.ownershipNotices.find(
            (item) => item.notificationId === request.notificationId && item.userId === userId,
        );
        if (!notice) return fail(404);
        const replayKey = `${userId}:notice:${request.idempotencyKey}`;
        const serialized = JSON.stringify(request);
        const old = state.family.replay[replayKey];
        if (old) return old.input === serialized ? success(old.result) : fail(409);
        if (notice.version !== request.expectedVersion) return fail(412);
        const result = { dismissed: !notice.dismissed };
        notice.dismissed = true;
        notice.version++;
        state.family.replay[replayKey] = { input: serialized, result };
        return success(result);
    }
    if (path === '/api/v1/family/leave' && method === 'POST') {
        const request = input as {
            expectedVersion: number;
            selection: 'automatic' | 'manual';
            successorMembershipId: string | null;
            idempotencyKey: string;
        };
        const replayKey = `${userId}:leave:${request.idempotencyKey}`;
        const serialized = JSON.stringify(request);
        const old = state.family.replay[replayKey];
        if (old) return old.input === serialized ? success(old.result) : fail(409);
        if (!ownFamily || !ownMembership) return fail(404);
        if (ownFamily.version !== request.expectedVersion) return fail(412);
        const owner = ownFamily.ownerId === ownMembership.userId;
        const candidates = ranked(activeMembers.filter((member) => member.id !== ownMembership.id));
        let successor = null as (typeof candidates)[number] | null;
        if (owner && candidates.length) {
            successor =
                request.selection === 'manual'
                    ? (candidates.find((member) => member.id === request.successorMembershipId) ?? null)
                    : (candidates[0] ?? null);
            if (!successor) return fail(412);
            ownFamily.ownerId = successor.userId;
            state.family.ownershipNotices.push({
                notificationId: crypto.randomUUID(),
                transferId: crypto.randomUUID(),
                userId: successor.userId,
                title: 'Вы стали владельцем семьи',
                body: 'Владение уже передано вам. Подтверждение не требуется.',
                version: 1,
                dismissed: false,
            });
        } else if (owner) {
            ownFamily.archived = true;
            ownFamily.ownerId = null;
        }
        aiQuotaRedistribution(
            state,
            ownFamily,
            activeMembers.map((member) => member.userId),
            activeMembers.filter((member) => member.id !== ownMembership.id).map((member) => member.userId),
            userId,
            true,
        );
        ownMembership.leftAt = new Date(now).toISOString();
        ownFamily.version++;
        const result = {
            familyId: ownFamily.id,
            archived: owner && !successor,
            leftMembershipId: ownMembership.id,
            successorMembershipId: successor?.id ?? null,
        };
        state.family.replay[replayKey] = { input: serialized, result };
        return success(result);
    }
    const removeMatch = /^\/api\/v1\/family\/members\/[^/]+\/remove$/.exec(path);
    if (removeMatch && method === 'POST') {
        const request = input as { expectedVersion: number; idempotencyKey: string };
        const replayKey = `${userId}:remove:${params.membershipId}:${request.idempotencyKey}`;
        const serialized = JSON.stringify(request);
        const old = state.family.replay[replayKey];
        if (old) return old.input === serialized ? success(old.result) : fail(409);
        if (!ownFamily || !ownMembership || ownFamily.ownerId !== ownMembership.userId) return fail(403);
        if (ownFamily.version !== request.expectedVersion) return fail(412);
        const target = activeMembers.find((member) => member.id === params.membershipId);
        if (!target) return fail(404);
        if (target.id === ownMembership.id) return fail(409);
        aiQuotaRedistribution(
            state,
            ownFamily,
            activeMembers.map((member) => member.userId),
            activeMembers.filter((member) => member.id !== target.id).map((member) => member.userId),
            target.userId,
            true,
        );
        target.leftAt = new Date(now).toISOString();
        ownFamily.version++;
        const result = mockFamilyContext(state, userId);
        state.family.replay[replayKey] = { input: serialized, result };
        return success(result);
    }
    if (path !== '/api/v1/family' || method !== 'POST') return fail(404);
    const parsedRequest = contracts['POST /api/v1/family'].request.parse(input);
    const request = { ...parsedRequest, name: z.string().trim().min(1).max(80).parse(parsedRequest.name) };
    const replayKey = `${userId}:${request.idempotencyKey}`;
    const serialized = JSON.stringify(request);
    const replay = state.family.replay[replayKey];
    if (replay) {
        if (replay.input !== serialized) return fail(409);
        return success(replay.result);
    }
    if (
        state.family.families.some(
            (family) => !family.archived && family.members.some((member) => member.userId === userId && !member.leftAt),
        )
    )
        return fail(409);
    const userPlan = mockPersonalSubscription(state, userId, now).plan;
    if (userPlan === 'free') return fail(403);
    const id = crypto.randomUUID();
    const joinedAt = new Date(now).toISOString();
    state.family.families.push({
        id,
        name: request.name,
        version: 2,
        ownerId: userId,
        archived: false,
        plan: userPlan,
        periodEndsAt: new Date(now + 30 * 86400000).toISOString(),
        members: [{ id: crypto.randomUUID(), userId, joinedAt, stableOrder: 1, leftAt: null }],
    });
    const result = mockFamilyContext(state, userId);
    state.family.replay[replayKey] = { input: serialized, result };
    return success(result);
}
