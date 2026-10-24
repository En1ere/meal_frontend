import { z } from 'zod';
import type { MockState } from './model.js';
import { contracts } from '../shared/api/contracts.generated.js';
import { mockFamilyContext } from './family.js';
import { mockPersonalSubscription } from './subscription.js';
const requestSchema = contracts['GET /api/v1/family/ownership/requests/{token}'].success.shape.data.shape.request;
export const ownershipStateSchema = z.object({
    requests: z.array(requestSchema),
    requestPreviews: z.record(z.string(), contracts['POST /api/v1/family/ownership/preview'].success.shape.data),
    previews: z.record(
        z.string(),
        z.object({
            userId: z.string(),
            targetId: z.string(),
            familyVersion: z.number(),
            after: z.enum(['active', 'blocked']),
        }),
    ),
    replay: z.record(z.string(), z.object({ input: z.string(), result: z.unknown() })),
});
export type OwnershipState = z.infer<typeof ownershipStateSchema>;
export const createOwnershipState = (): OwnershipState => ({
    requests: [],
    requestPreviews: {},
    previews: {},
    replay: {},
});
export function ownershipHandle(c: {
    state: MockState;
    userId: string | null;
    path: string;
    params: Record<string, string>;
    method: string;
    input: unknown;
    now: number;
    success: (data: unknown) => Response;
    fail: (status: number) => Response;
}): Response | null {
    const { state, userId, path, params, method, input, now, success, fail } = c;
    if (path !== '/api/v1/family/ownership' && !path.startsWith('/api/v1/family/ownership/')) return null;
    if (!userId) return fail(401);
    const context = mockFamilyContext(state, userId);
    const family = context.family;
    if (!family) return fail(404);
    const owner = family.members.find((member) => member.role === 'owner')!;
    const candidates = family.members.filter(
        (member) =>
            member.userId !== owner.userId &&
            state.users.some((user) => user.id === member.userId && user.active && user.verified),
    );
    const source = state.family.families.find((row) => row.id === family.id)!;
    const pending = state.ownership.requests.find((row) => row.familyId === family.id && row.status === 'pending');
    const reviewFor = (targetId: string) => {
        const to = candidates.find((member) => member.id === targetId);
        if (!to) return null;
        const plan = mockPersonalSubscription(state, to.userId, now);
        const before = context.state === 'blocked' ? ('blocked' as const) : ('active' as const);
        const after = plan.plan === 'free' ? ('blocked' as const) : ('active' as const);
        return {
            seatLimit: family.seatLimit,
            paidSeats: 0,
            memberCount: family.memberCount,
            coverage: { before, after, willChange: before !== after, blockedReason: null },
        };
    };
    if (path === '/api/v1/family/ownership' && method === 'GET') {
        if (family.role !== 'owner') return fail(403);
        return success({
            familyId: family.id,
            familyVersion: family.version,
            owner,
            candidates,
            seatLimit: family.seatLimit,
            paidSeats: 0,
            pendingRequest: pending ?? null,
        });
    }
    if (path === '/api/v1/family/ownership/preview' && method === 'POST') {
        if (family.role !== 'owner') return fail(403);
        const body = contracts['POST /api/v1/family/ownership/preview'].request.parse(input);
        if (body.expectedFamilyVersion !== family.version) return fail(412);
        const review = reviewFor(body.targetMembershipId),
            to = candidates.find((member) => member.id === body.targetMembershipId);
        if (!review || !to) return fail(422);
        const previewKey = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
        state.ownership.previews[previewKey] = {
            userId,
            targetId: to.id,
            familyVersion: family.version,
            after: review.coverage.after,
        };
        return success({
            familyId: family.id,
            familyVersion: family.version,
            from: owner,
            to,
            ...review,
            effects: { formerOwnerRemains: true, paidSeatsMoveWithFamily: true, personalSubscriptionsChange: false },
            previewKey,
            canSubmit: !pending,
            blockers: pending ? ['Уже есть ожидающий запрос'] : [],
        });
    }
    if (path === '/api/v1/family/ownership/requests' && method === 'POST') {
        if (family.role !== 'owner') return fail(403);
        const body = contracts['POST /api/v1/family/ownership/requests'].request.parse(input);
        const key = `${userId}:create:${body.idempotencyKey}`,
            signature = JSON.stringify(body),
            prior = state.ownership.replay[key];
        if (prior) return prior.input === signature ? success(prior.result) : fail(409);
        if (body.expectedFamilyVersion !== family.version) return fail(412);
        const frozen = state.ownership.previews[body.previewKey],
            to = candidates.find((member) => member.id === body.targetMembershipId),
            review = reviewFor(body.targetMembershipId);
        if (
            !frozen ||
            frozen.userId !== userId ||
            frozen.targetId !== body.targetMembershipId ||
            frozen.familyVersion !== family.version ||
            !to ||
            !review ||
            frozen.after !== review.coverage.after ||
            pending
        )
            return fail(409);
        const request = requestSchema.parse({
            id: crypto.randomUUID(),
            status: 'pending',
            version: 1,
            familyId: family.id,
            familyVersion: family.version,
            from: owner,
            to,
            createdAt: new Date(now).toISOString(),
            review,
        });
        state.ownership.requests.push(request);
        const preview = {
            familyId: family.id,
            familyVersion: family.version,
            from: owner,
            to,
            ...review,
            effects: {
                formerOwnerRemains: true as const,
                paidSeatsMoveWithFamily: true as const,
                personalSubscriptionsChange: false as const,
            },
            previewKey: body.previewKey,
            canSubmit: true,
            blockers: [],
        };
        state.ownership.requestPreviews[request.id] = preview;
        const result = { request, token: request.id, preview };
        state.ownership.replay[key] = { input: signature, result: structuredClone(result) };
        return success(result);
    }
    const request = state.ownership.requests.find((row) => row.id === params.token && row.familyId === family.id);
    if (!request || ![owner.userId, request.to.userId].includes(userId)) return fail(404);
    if (method === 'GET')
        return success({
            request: { ...request, familyVersion: family.version },
            token: request.id,
            preview: state.ownership.requestPreviews[request.id],
        });
    const action = path.split('/').at(-1);
    if (method !== 'POST' || !['accept', 'decline', 'cancel'].includes(action ?? '')) return fail(404);
    const body = contracts['POST /api/v1/family/ownership/requests/{token}/accept'].request.parse(input);
    const key = `${userId}:${request.id}:${action}:${body.idempotencyKey}`,
        signature = JSON.stringify(body),
        prior = state.ownership.replay[key];
    if (prior) return prior.input === signature ? success(prior.result) : fail(409);
    if ((action === 'cancel' && userId !== owner.userId) || (action !== 'cancel' && userId !== request.to.userId))
        return fail(403);
    if (request.status !== 'pending' || (action === 'accept' && owner.userId !== request.from.userId)) return fail(409);
    if (request.version !== body.expectedVersion) return fail(412);
    if (
        action === 'accept' &&
        (family.version !== body.expectedFamilyVersion || request.familyVersion !== family.version)
    )
        return fail(412);
    const review = reviewFor(request.to.id);
    if (!review) return fail(409);
    if (action === 'accept' && review.coverage.after !== request.review.coverage.after) return fail(409);
    request.status = action === 'accept' ? 'accepted' : action === 'decline' ? 'declined' : 'cancelled';
    request.version++;
    if (action === 'accept') {
        source.ownerId = request.to.userId;
        source.version++;
        source.coverageBlocked = review.coverage.after === 'blocked';
        const plan = mockPersonalSubscription(state, request.to.userId, now);
        if (plan.plan !== 'free') source.plan = plan.plan;
        if (plan.periodEndsAt) source.periodEndsAt = plan.periodEndsAt;
    }
    const result = {
        request: { ...request, familyVersion: source.version },
        token: request.id,
        family: mockFamilyContext(state, userId),
    };
    state.ownership.replay[key] = { input: signature, result: structuredClone(result) };
    return success(result);
}
