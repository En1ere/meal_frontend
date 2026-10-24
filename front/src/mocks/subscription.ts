import { z } from 'zod';
import { contracts } from '../shared/api/contracts.generated.js';
import { ensureAiState } from './ai.js';
import type { MockState } from './model.js';

const user2 = '10000000-0000-4000-8000-000000000008';
const recordSchema = z.object({
    userId: z.uuid(),
    version: z.number().int().positive(),
    plan: z.enum(['free', 'plus', 'pro']),
    source: z.enum(['none', 'personal', 'trial', 'gift']),
    subscriptionId: z.uuid().nullable(),
    period: z.enum(['month', 'year']).nullable(),
    startsAt: z.iso.datetime().nullable(),
    endsAt: z.iso.datetime().nullable(),
    autoRenew: z.boolean(),
    downgradeToFreeAt: z.iso.datetime().nullable(),
    scheduledPlan: z.enum(['free', 'plus', 'pro']).nullable().default(null),
    scheduledPeriod: z.enum(['month', 'year']).nullable().default(null),
    scheduledEndsAt: z.iso.datetime().nullable().default(null),
});
const previewSchema = z.object({
    id: z.uuid(),
    userId: z.uuid(),
    kind: z.enum(['plus', 'downgrade', 'plan', 'renewal', 'combination']),
    expectedVersion: z.number().int().positive(),
    period: z.enum(['month', 'year']).nullable(),
    startsAt: z.iso.datetime().nullable(),
    endsAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    payload: z.record(z.string(), z.unknown()).default({}),
});
export const subscriptionStateSchema = z.object({
    records: z.array(recordSchema),
    previews: z.array(previewSchema),
    trialHistory: z.array(z.uuid()),
    familyHistory: z.array(z.uuid()),
    promotions: z.array(
        z.object({ id: z.uuid(), userId: z.uuid(), expiresAt: z.iso.datetime(), redeemed: z.boolean() }),
    ),
    combinations: z.array(
        z.object({
            id: z.uuid(),
            previewId: z.uuid(),
            familyId: z.uuid(),
            firstUserId: z.uuid(),
            secondUserId: z.uuid(),
            recipientId: z.uuid(),
            firstSubscriptionId: z.uuid(),
            secondSubscriptionId: z.uuid(),
            resultEndsAt: z.iso.datetime(),
            expiresAt: z.iso.datetime(),
            acceptedUserIds: z.array(z.uuid()),
            status: z.enum(['consent_pending', 'applied']),
        }),
    ),
    replay: z.record(z.string(), z.object({ input: z.string(), result: z.unknown() })),
});
export type SubscriptionState = z.infer<typeof subscriptionStateSchema>;
export const createSubscriptionState = (): SubscriptionState => ({
    records: [],
    previews: [],
    trialHistory: [],
    familyHistory: [user2],
    promotions: [
        {
            id: '61000000-0000-4000-8000-000000000001',
            userId: '10000000-0000-4000-8000-000000000007',
            expiresAt: '2099-01-01T00:00:00.000Z',
            redeemed: false,
        },
    ],
    combinations: [],
    replay: {},
});

type Context = {
    state: MockState;
    userId: string | null;
    path: string;
    method: string;
    input: unknown;
    now: number;
    success: (data: unknown) => Response;
    fail: (status: number, code?: string) => Response;
};

function ensureRecord(state: MockState, userId: string, now: number) {
    let record = state.subscription.records.find((item) => item.userId === userId);
    if (record) {
        const expires = record.endsAt ? Date.parse(record.endsAt) : Number.POSITIVE_INFINITY;
        const downgrade = record.downgradeToFreeAt ? Date.parse(record.downgradeToFreeAt) : Number.POSITIVE_INFINITY;
        if ((record.scheduledPlan === 'plus' || record.scheduledPlan === 'pro') && expires <= now) {
            record.plan = record.scheduledPlan;
            record.source = 'personal';
            record.subscriptionId = crypto.randomUUID();
            record.period = record.scheduledPeriod;
            record.startsAt = record.endsAt;
            record.endsAt = record.scheduledEndsAt;
            record.autoRenew = true;
            record.downgradeToFreeAt = null;
            record.scheduledPlan = null;
            record.scheduledPeriod = null;
            record.scheduledEndsAt = null;
            record.version++;
            const user = state.users.find((item) => item.id === userId);
            if (user) user.plan = record.plan;
            return record;
        }
        if ((!record.autoRenew && expires <= now) || downgrade <= now) {
            record.plan = 'free';
            record.source = 'none';
            record.subscriptionId = null;
            record.period = null;
            record.startsAt = null;
            record.endsAt = null;
            record.autoRenew = false;
            record.downgradeToFreeAt = null;
            record.scheduledPlan = null;
            record.scheduledPeriod = null;
            record.scheduledEndsAt = null;
            record.version++;
            const user = state.users.find((item) => item.id === userId);
            if (user) user.plan = 'free';
        }
        return record;
    }
    const user = state.users.find((item) => item.id === userId)!;
    const plan = user.plan === 'pro' ? 'pro' : user.plan === 'plus' ? 'plus' : 'free';
    record = {
        userId,
        version: 1,
        plan,
        source: plan === 'free' ? 'none' : 'personal',
        subscriptionId: plan === 'free' ? null : crypto.randomUUID(),
        period: plan === 'free' ? null : 'month',
        startsAt: plan === 'free' ? null : new Date(now - 7 * 86_400_000).toISOString(),
        endsAt: plan === 'free' ? null : new Date(now + 24 * 86_400_000).toISOString(),
        autoRenew: plan !== 'free',
        downgradeToFreeAt: null,
        scheduledPlan: null,
        scheduledPeriod: null,
        scheduledEndsAt: null,
    };
    state.subscription.records.push(record);
    return record;
}

export function mockPersonalSubscription(state: MockState, userId: string, now = Date.now()) {
    const record = ensureRecord(state, userId, now);
    return {
        plan: record.plan,
        source: record.source,
        subscriptionId: record.subscriptionId,
        periodEndsAt: record.endsAt,
    };
}

function familyCoverage(state: MockState, userId: string) {
    return state.family.families.find(
        (family) =>
            !family.archived && family.members.some((member) => member.userId === userId && member.leftAt === null),
    );
}

function trialReason(state: MockState, userId: string, record: ReturnType<typeof ensureRecord>) {
    const user = state.users.find((item) => item.id === userId);
    if (!user?.active) return 'account_inactive' as const;
    if (record.plan !== 'free' || familyCoverage(state, userId)) return 'active_subscription' as const;
    if (state.subscription.trialHistory.includes(userId)) return 'already_used' as const;
    if (
        state.subscription.familyHistory.includes(userId) ||
        state.family.families.some((family) => family.members.some((member) => member.userId === userId))
    )
        return 'family_history' as const;
    return null;
}

function overview(state: MockState, userId: string, now: number) {
    const record = ensureRecord(state, userId, now);
    ensureAiState(state, userId, now);
    const family = familyCoverage(state, userId);
    const current =
        family && (record.plan === 'free' || (family.plan === 'pro' && record.plan !== 'pro'))
            ? {
                  plan: family.plan,
                  source: 'family' as const,
                  subscriptionId: family.ownerId,
                  period: null,
                  startsAt: null,
                  endsAt: family.periodEndsAt,
                  autoRenew: false,
                  downgradeToFreeAt: null,
                  scheduledPlan: null,
              }
            : {
                  plan: record.plan,
                  source: record.source,
                  subscriptionId: record.subscriptionId,
                  period: record.period,
                  startsAt: record.startsAt,
                  endsAt: record.endsAt,
                  autoRenew: record.autoRenew,
                  downgradeToFreeAt: record.downgradeToFreeAt,
                  scheduledPlan: record.scheduledPlan,
              };
    const buckets = state.ai.buckets.filter(
        (bucket) => bucket.userId === userId || (!!family && bucket.familyId === family.id && bucket.userId === null),
    );
    const wired = buckets.map(({ userId: _userId, familyId: _familyId, requiresConfirmation: _confirm, ...bucket }) => {
        void _userId;
        void _familyId;
        void _confirm;
        return bucket;
    });
    const reason = trialReason(state, userId, record);
    const promotion = state.subscription.promotions.find(
        (item) => item.userId === userId && !item.redeemed && Date.parse(item.expiresAt) > now,
    );
    const ownFamily = state.family.families.find(
        (item) => !item.archived && item.members.some((member) => member.userId === userId && member.leftAt === null),
    );
    const candidates = ownFamily
        ? ownFamily.members.flatMap((member) => {
              if (member.userId === userId || member.leftAt) return [];
              const peer = ensureRecord(state, member.userId, now);
              const peerUser = state.users.find((item) => item.id === member.userId);
              return peer.plan === 'plus' && peer.source === 'personal' && peer.subscriptionId && peer.endsAt
                  ? [
                        {
                            userId: member.userId,
                            displayName: peerUser?.name ?? 'Участник семьи',
                            subscriptionId: peer.subscriptionId,
                            endsAt: peer.endsAt,
                        },
                    ]
                  : [];
          })
        : [];
    const pending = state.subscription.combinations.find(
        (item) => item.status === 'consent_pending' && (item.firstUserId === userId || item.secondUserId === userId),
    );
    return contracts['GET /api/v1/settings/subscription'].success.shape.data.parse({
        version: record.version,
        current,
        ai: {
            buckets: wired,
            total: wired.reduce((sum, bucket) => sum + bucket.balance, 0),
            reserved: wired.reduce((sum, bucket) => sum + bucket.reserved, 0),
            available: wired.reduce((sum, bucket) => sum + bucket.available, 0),
        },
        trial: { eligible: reason === null, reason, durationDays: 7, aiActions: 10 },
        prices: {
            plus: {
                month: { amountMinor: 39900, currency: 'RUB' },
                year: { amountMinor: 389900, currency: 'RUB' },
            },
            pro: {
                month: { amountMinor: 59900, currency: 'RUB' },
                year: { amountMinor: 589900, currency: 'RUB' },
            },
        },
        promotion: promotion
            ? {
                  offerId: promotion.id,
                  code: 'post_trial_pro_10',
                  expiresAt: promotion.expiresAt,
                  monthAmountMinor: 53900,
                  yearAmountMinor: 530900,
                  nextMonthAmountMinor: 59900,
                  nextYearAmountMinor: 589900,
              }
            : null,
        combination: {
            eligible: record.plan === 'plus' && record.source === 'personal' && candidates.length > 0,
            reason: !ownFamily
                ? 'not_in_family'
                : record.plan !== 'plus' || record.source !== 'personal'
                  ? 'personal_plus_required'
                  : candidates.length === 0
                    ? 'second_plus_required'
                    : null,
            familyId: ownFamily?.id ?? null,
            candidates,
            pending: pending
                ? {
                      previewId: pending.previewId,
                      combinationId: pending.id,
                      recipientId: pending.recipientId,
                      endsAt: pending.resultEndsAt,
                      acceptedUserIds: pending.acceptedUserIds,
                      requiredUserIds: [pending.firstUserId, pending.secondUserId].sort(),
                  }
                : null,
        },
    });
}

function replay(state: MockState, key: string, input: unknown, create: () => unknown, fail: Context['fail']): unknown {
    const signature = JSON.stringify(input);
    const existing = state.subscription.replay[key];
    if (existing) return existing.input === signature ? existing.result : fail(409, 'IDEMPOTENCY_CONFLICT');
    const result = create();
    if (result instanceof Response) return result;
    state.subscription.replay[key] = { input: signature, result };
    return result;
}

export function subscriptionHandle(context: Context): Response | null {
    const { state, userId, path, method, input, now, success, fail } = context;
    if (!path.startsWith('/api/v1/settings/subscription')) return null;
    if (!userId) return fail(401);
    const record = ensureRecord(state, userId, now);
    if (method === 'GET' && path === '/api/v1/settings/subscription') return success(overview(state, userId, now));
    if (method !== 'POST') return fail(404);
    if (path === '/api/v1/settings/subscription/trial/activate') {
        const body = contracts['POST /api/v1/settings/subscription/trial/activate'].request.parse(input);
        const result = replay(
            state,
            `trial:${userId}:${body.idempotencyKey}`,
            body,
            () => {
                if (record.version !== body.expectedVersion) return fail(412);
                if (trialReason(state, userId, record)) return fail(409, 'TRIAL_NOT_ELIGIBLE');
                const startsAt = new Date(now).toISOString();
                const endsAt = new Date(now + 7 * 86_400_000).toISOString();
                Object.assign(record, {
                    version: record.version + 1,
                    plan: 'pro',
                    source: 'trial',
                    subscriptionId: crypto.randomUUID(),
                    period: null,
                    startsAt,
                    endsAt,
                    autoRenew: false,
                    downgradeToFreeAt: null,
                    scheduledPlan: null,
                    scheduledPeriod: null,
                    scheduledEndsAt: null,
                });
                state.subscription.trialHistory.push(userId);
                const user = state.users.find((item) => item.id === userId)!;
                user.plan = 'pro';
                state.ai.buckets = state.ai.buckets.filter(
                    (bucket) => bucket.userId !== userId || !['trial', 'subscription'].includes(bucket.kind),
                );
                state.ai.buckets.push({
                    id: crypto.randomUUID(),
                    userId,
                    familyId: null,
                    kind: 'trial',
                    granted: 10,
                    balance: 10,
                    reserved: 0,
                    available: 10,
                    requiresConfirmation: false,
                    expiresAt: endsAt,
                });
                return overview(state, userId, now);
            },
            fail,
        );
        return result instanceof Response ? result : success(result);
    }
    if (path === '/api/v1/settings/subscription/plus/preview') {
        const body = contracts['POST /api/v1/settings/subscription/plus/preview'].request.parse(input);
        if (record.version !== body.expectedVersion) return fail(412);
        if (familyCoverage(state, userId) && record.plan === 'free') return fail(409, 'FAMILY_COVERED');
        const startsAt = new Date(now).toISOString();
        const endsAt = new Date(now + (body.period === 'year' ? 365 : 31) * 86_400_000).toISOString();
        const preview = {
            id: crypto.randomUUID(),
            userId,
            kind: 'plus' as const,
            expectedVersion: record.version,
            period: body.period,
            startsAt,
            endsAt,
            expiresAt: new Date(now + 10 * 60_000).toISOString(),
            payload: {},
        };
        state.subscription.previews.push(preview);
        return success({
            previewId: preview.id,
            expectedVersion: preview.expectedVersion,
            plan: 'plus',
            period: body.period,
            amountMinor: body.period === 'year' ? 389900 : 39900,
            currency: 'RUB',
            paymentMode: 'simulation',
            startsAt,
            endsAt,
            expiresAt: preview.expiresAt,
        });
    }
    if (path === '/api/v1/settings/subscription/plus/commit') {
        const body = contracts['POST /api/v1/settings/subscription/plus/commit'].request.parse(input);
        const result = replay(
            state,
            `plus:${userId}:${body.idempotencyKey}`,
            body,
            () => {
                const preview = state.subscription.previews.find(
                    (item) => item.id === body.previewId && item.userId === userId && item.kind === 'plus',
                );
                if (!preview || Date.parse(preview.expiresAt) <= now) return fail(409, 'PREVIEW_EXPIRED');
                if (record.version !== body.expectedVersion || preview.expectedVersion !== body.expectedVersion)
                    return fail(412);
                Object.assign(record, {
                    version: record.version + 1,
                    plan: 'plus',
                    source: 'personal',
                    subscriptionId: crypto.randomUUID(),
                    period: preview.period,
                    startsAt: preview.startsAt,
                    endsAt: preview.endsAt,
                    autoRenew: true,
                    downgradeToFreeAt: null,
                    scheduledPlan: null,
                });
                state.users.find((item) => item.id === userId)!.plan = 'plus';
                state.ai.buckets = state.ai.buckets.filter(
                    (bucket) => bucket.userId !== userId || !['trial', 'subscription'].includes(bucket.kind),
                );
                state.ai.buckets.push({
                    id: crypto.randomUUID(),
                    userId,
                    familyId: null,
                    kind: 'subscription',
                    granted: 40,
                    balance: 40,
                    reserved: 0,
                    available: 40,
                    requiresConfirmation: false,
                    expiresAt: preview.endsAt,
                });
                return overview(state, userId, now);
            },
            fail,
        );
        return result instanceof Response ? result : success(result);
    }
    if (path === '/api/v1/settings/subscription/plan/preview') {
        const body = contracts['POST /api/v1/settings/subscription/plan/preview'].request.parse(input);
        if (record.version !== body.expectedVersion) return fail(412);
        if (!(
            (record.plan === 'free' && (body.targetPlan === 'plus' || body.targetPlan === 'pro')) ||
            (record.plan === 'plus' && body.targetPlan === 'pro')
        ))
            return fail(409, 'PLAN_CHANGE_NOT_AVAILABLE');
        if (record.plan === 'free' && body.timing !== 'now') return fail(409, 'INVALID_TIMING');
        const startsAt = body.timing === 'period_end' && record.endsAt ? record.endsAt : new Date(now).toISOString();
        let endsAt = new Date(Date.parse(startsAt) + (body.period === 'year' ? 365 : 31) * 86_400_000).toISOString();
        const regular =
            body.targetPlan === 'pro'
                ? body.period === 'year'
                    ? 589900
                    : 59900
                : body.period === 'year'
                  ? 389900
                  : 39900;
        const offer = body.promotionOfferId
            ? state.subscription.promotions.find(
                  (item) =>
                      item.id === body.promotionOfferId &&
                      item.userId === userId &&
                      !item.redeemed &&
                      Date.parse(item.expiresAt) > now,
              )
            : undefined;
        if (body.promotionOfferId && (!offer || body.targetPlan !== 'pro' || record.plan !== 'free'))
            return fail(409, 'PROMOTION_NOT_AVAILABLE');
        let fullAmountMinor = offer ? (body.period === 'year' ? 530900 : 53900) : regular;
        const duration = record.startsAt && record.endsAt ? Date.parse(record.endsAt) - Date.parse(record.startsAt) : 0;
        const remaining = record.endsAt ? Math.max(0, Date.parse(record.endsAt) - now) : 0;
        const oldPrice = record.period === 'year' ? 389900 : 39900;
        const creditMinor =
            record.plan === 'plus' && body.timing === 'now' && duration > 0
                ? Math.floor((oldPrice * remaining) / duration)
                : 0;
        if (record.plan === 'plus' && body.timing === 'now' && duration > 0 && record.endsAt) {
            fullAmountMinor = Math.floor((regular * remaining) / duration);
            endsAt = record.endsAt;
        }
        const response = {
            previewId: crypto.randomUUID(),
            expectedVersion: record.version,
            operation:
                record.plan === 'free'
                    ? ('purchase' as const)
                    : body.timing === 'now'
                      ? ('upgrade' as const)
                      : ('scheduled_upgrade' as const),
            currentPlan: record.plan,
            targetPlan: body.targetPlan,
            period: body.period,
            timing: body.timing,
            fullAmountMinor,
            creditMinor,
            amountMinor: Math.max(0, fullAmountMinor - creditMinor),
            currency: 'RUB' as const,
            paymentMode: 'simulation' as const,
            promotionOfferId: body.promotionOfferId,
            startsAt,
            endsAt,
            nextChargeAt: endsAt,
            nextAmountMinor: regular,
            expiresAt: new Date(now + 10 * 60_000).toISOString(),
        };
        state.subscription.previews.push({
            id: response.previewId,
            userId,
            kind: 'plan',
            expectedVersion: record.version,
            period: body.period,
            startsAt,
            endsAt,
            expiresAt: response.expiresAt,
            payload: response,
        });
        return success(contracts['POST /api/v1/settings/subscription/plan/preview'].success.shape.data.parse(response));
    }
    if (path === '/api/v1/settings/subscription/plan/commit') {
        const body = contracts['POST /api/v1/settings/subscription/plan/commit'].request.parse(input);
        const result = replay(
            state,
            `plan:${userId}:${body.idempotencyKey}`,
            body,
            () => {
                const stored = state.subscription.previews.find(
                    (item) => item.id === body.previewId && item.userId === userId && item.kind === 'plan',
                );
                if (!stored || Date.parse(stored.expiresAt) <= now) return fail(409, 'PREVIEW_EXPIRED');
                if (record.version !== body.expectedVersion || stored.expectedVersion !== body.expectedVersion)
                    return fail(412);
                const preview = contracts['POST /api/v1/settings/subscription/plan/preview'].success.shape.data.parse(
                    stored.payload,
                );
                if (preview.operation === 'scheduled_upgrade') {
                    record.autoRenew = false;
                    record.scheduledPlan = preview.targetPlan;
                    record.scheduledPeriod = preview.period;
                    record.scheduledEndsAt = preview.endsAt;
                } else {
                    Object.assign(record, {
                        plan: preview.targetPlan,
                        source: 'personal' as const,
                        subscriptionId: crypto.randomUUID(),
                        period: preview.period,
                        startsAt: preview.startsAt,
                        endsAt: preview.endsAt,
                        autoRenew: true,
                        downgradeToFreeAt: null,
                        scheduledPlan: null,
                    });
                    state.users.find((item) => item.id === userId)!.plan = preview.targetPlan;
                    const ownedFamily = state.family.families.find(
                        (family) => family.ownerId === userId && !family.archived,
                    );
                    if (ownedFamily && preview.targetPlan === 'pro') {
                        ownedFamily.plan = 'pro';
                        ownedFamily.periodEndsAt = preview.endsAt;
                        const memberIds = ownedFamily.members
                            .filter((member) => member.leftAt === null)
                            .map((member) => member.userId);
                        state.ai.buckets = state.ai.buckets.filter(
                            (bucket) => bucket.kind !== 'subscription' || !memberIds.includes(bucket.userId ?? ''),
                        );
                        state.ai.seeded = state.ai.seeded.filter((id) => !memberIds.includes(id));
                    } else {
                        state.ai.buckets = state.ai.buckets.filter(
                            (bucket) => bucket.userId !== userId || !['trial', 'subscription'].includes(bucket.kind),
                        );
                        const allowance = preview.targetPlan === 'pro' ? 120 : 40;
                        state.ai.buckets.push({
                            id: crypto.randomUUID(),
                            userId,
                            familyId: null,
                            kind: 'subscription',
                            granted: allowance,
                            balance: allowance,
                            reserved: 0,
                            available: allowance,
                            requiresConfirmation: false,
                            expiresAt: preview.endsAt,
                        });
                    }
                    if (preview.promotionOfferId) {
                        const offer = state.subscription.promotions.find(
                            (item) => item.id === preview.promotionOfferId,
                        );
                        if (offer) offer.redeemed = true;
                    }
                }
                record.version++;
                return overview(state, userId, now);
            },
            fail,
        );
        return result instanceof Response ? result : success(result);
    }
    if (path === '/api/v1/settings/subscription/renewal/preview') {
        const body = contracts['POST /api/v1/settings/subscription/renewal/preview'].request.parse(input);
        if (record.version !== body.expectedVersion) return fail(412);
        if (
            (record.plan !== 'plus' && record.plan !== 'pro') ||
            record.source !== 'personal' ||
            !record.subscriptionId ||
            !record.endsAt ||
            !record.period
        )
            return fail(409, 'RENEWAL_NOT_AVAILABLE');
        const response = {
            previewId: crypto.randomUUID(),
            expectedVersion: record.version,
            subscriptionId: record.subscriptionId,
            plan: record.plan,
            enabled: body.enabled,
            nextChargeAt: record.endsAt,
            nextAmountMinor:
                record.plan === 'pro'
                    ? record.period === 'year'
                        ? 589900
                        : 59900
                    : record.period === 'year'
                      ? 389900
                      : 39900,
            currency: 'RUB' as const,
            paymentMode: 'simulation' as const,
            expiresAt: new Date(now + 10 * 60_000).toISOString(),
        };
        state.subscription.previews.push({
            id: response.previewId,
            userId,
            kind: 'renewal',
            expectedVersion: record.version,
            period: record.period,
            startsAt: record.startsAt,
            endsAt: record.endsAt,
            expiresAt: response.expiresAt,
            payload: response,
        });
        return success(response);
    }
    if (path === '/api/v1/settings/subscription/renewal/commit') {
        const body = contracts['POST /api/v1/settings/subscription/renewal/commit'].request.parse(input);
        const result = replay(
            state,
            `renewal:${userId}:${body.idempotencyKey}`,
            body,
            () => {
                const stored = state.subscription.previews.find(
                    (item) => item.id === body.previewId && item.userId === userId && item.kind === 'renewal',
                );
                if (!stored || Date.parse(stored.expiresAt) <= now) return fail(409, 'PREVIEW_EXPIRED');
                if (record.version !== body.expectedVersion) return fail(412);
                const preview = contracts[
                    'POST /api/v1/settings/subscription/renewal/preview'
                ].success.shape.data.parse(stored.payload);
                record.autoRenew = preview.enabled;
                record.version++;
                return overview(state, userId, now);
            },
            fail,
        );
        return result instanceof Response ? result : success(result);
    }
    if (path === '/api/v1/settings/subscription/combination/preview') {
        const body = contracts['POST /api/v1/settings/subscription/combination/preview'].request.parse(input);
        if (record.version !== body.expectedVersion) return fail(412);
        const family = familyCoverage(state, userId);
        const peer = ensureRecord(state, body.peerUserId, now);
        if (
            !family ||
            !family.members.some((member) => member.userId === body.peerUserId && member.leftAt === null) ||
            record.plan !== 'plus' ||
            peer.plan !== 'plus' ||
            !record.subscriptionId ||
            !peer.subscriptionId ||
            !record.endsAt ||
            !peer.endsAt
        )
            return fail(409, 'COMBINATION_NOT_AVAILABLE');
        const existing = state.subscription.combinations.find(
            (item) =>
                item.status !== 'applied' &&
                [item.firstSubscriptionId, item.secondSubscriptionId].some(
                    (id) => id === record.subscriptionId || id === peer.subscriptionId,
                ),
        );
        if (existing) return fail(409, 'COMBINATION_ALREADY_PENDING');
        const combo = {
            id: crypto.randomUUID(),
            previewId: crypto.randomUUID(),
            familyId: family.id,
            firstUserId: userId,
            secondUserId: body.peerUserId,
            recipientId: body.recipientId,
            firstSubscriptionId: record.subscriptionId,
            secondSubscriptionId: peer.subscriptionId,
            resultEndsAt: new Date(Math.max(Date.parse(record.endsAt), Date.parse(peer.endsAt))).toISOString(),
            expiresAt: new Date(now + 86_400_000).toISOString(),
            acceptedUserIds: [] as string[],
            status: 'consent_pending' as const,
        };
        state.subscription.combinations.push(combo);
        const response = {
            previewId: combo.previewId,
            combinationId: combo.id,
            expectedVersion: record.version,
            familyId: combo.familyId,
            firstUserId: userId,
            secondUserId: body.peerUserId,
            recipientId: body.recipientId,
            firstSubscriptionId: record.subscriptionId,
            secondSubscriptionId: peer.subscriptionId,
            firstEndsAt: record.endsAt,
            secondEndsAt: peer.endsAt,
            resultEndsAt: combo.resultEndsAt,
            amountMinor: 0 as const,
            currency: 'RUB' as const,
            requiredUserIds: [userId, body.peerUserId].sort(),
            expiresAt: combo.expiresAt,
        };
        state.subscription.previews.push({
            id: combo.previewId,
            userId,
            kind: 'combination',
            expectedVersion: record.version,
            period: null,
            startsAt: null,
            endsAt: combo.resultEndsAt,
            expiresAt: combo.expiresAt,
            payload: response,
        });
        return success(response);
    }
    if (path === '/api/v1/settings/subscription/combination/consent') {
        const body = contracts['POST /api/v1/settings/subscription/combination/consent'].request.parse(input);
        const result = replay(
            state,
            `combination:${userId}:${body.idempotencyKey}`,
            body,
            () => {
                const combo = state.subscription.combinations.find(
                    (item) => item.id === body.combinationId && item.previewId === body.previewId,
                );
                if (!combo || Date.parse(combo.expiresAt) <= now) return fail(409, 'PREVIEW_EXPIRED');
                if (
                    record.version !== body.expectedVersion ||
                    ![combo.firstUserId, combo.secondUserId].includes(userId)
                )
                    return fail(412);
                if (!combo.acceptedUserIds.includes(userId)) combo.acceptedUserIds.push(userId);
                const required = [combo.firstUserId, combo.secondUserId].sort();
                if (required.every((id) => combo.acceptedUserIds.includes(id))) {
                    combo.status = 'applied';
                    for (const id of required) {
                        const source = ensureRecord(state, id, now);
                        Object.assign(source, {
                            plan: 'free' as const,
                            source: 'none' as const,
                            subscriptionId: null,
                            period: null,
                            startsAt: null,
                            endsAt: null,
                            autoRenew: false,
                            downgradeToFreeAt: null,
                            scheduledPlan: null,
                            scheduledPeriod: null,
                            scheduledEndsAt: null,
                        });
                        source.version++;
                        const sourceUser = state.users.find((item) => item.id === id);
                        if (sourceUser) sourceUser.plan = 'free';
                    }
                    const recipient = ensureRecord(state, combo.recipientId, now);
                    Object.assign(recipient, {
                        plan: 'pro',
                        source: 'personal' as const,
                        subscriptionId: crypto.randomUUID(),
                        period: null,
                        startsAt: new Date(now).toISOString(),
                        endsAt: combo.resultEndsAt,
                        autoRenew: false,
                        downgradeToFreeAt: null,
                        scheduledPlan: null,
                        scheduledPeriod: null,
                        scheduledEndsAt: null,
                    });
                    state.users.find((item) => item.id === combo.recipientId)!.plan = 'pro';
                    state.ai.buckets = state.ai.buckets.filter(
                        (bucket) => bucket.kind !== 'subscription' || !required.includes(bucket.userId ?? ''),
                    );
                    state.ai.seeded = state.ai.seeded.filter((id) => !required.includes(id));
                    const family = state.family.families.find((item) => item.id === combo.familyId);
                    if (family) {
                        family.plan = 'pro';
                        family.periodEndsAt = combo.resultEndsAt;
                        family.ownerId = combo.recipientId;
                    }
                } else record.version++;
                return {
                    status: combo.status,
                    combinationId: combo.id,
                    acceptedUserIds: combo.acceptedUserIds,
                    requiredUserIds: required,
                    resultEndsAt: combo.resultEndsAt,
                    settings: overview(state, userId, now),
                };
            },
            fail,
        );
        return result instanceof Response ? result : success(result);
    }
    if (path === '/api/v1/settings/subscription/downgrade/preview') {
        const body = contracts['POST /api/v1/settings/subscription/downgrade/preview'].request.parse(input);
        if (record.version !== body.expectedVersion) return fail(412);
        if (
            (record.plan !== 'plus' && record.plan !== 'pro') ||
            record.source !== 'personal' ||
            !record.subscriptionId ||
            !record.endsAt ||
            (record.plan === 'plus' && body.targetPlan !== 'free')
        )
            return fail(409, 'DOWNGRADE_NOT_AVAILABLE');
        const previewId = crypto.randomUUID();
        const expiresAt = new Date(now + 10 * 60_000).toISOString();
        const response = {
            previewId,
            expectedVersion: record.version,
            subscriptionId: record.subscriptionId,
            currentPlan: record.plan,
            targetPlan: body.targetPlan,
            effectiveAt: record.endsAt,
            period: body.targetPlan === 'plus' ? record.period : null,
            amountMinor: body.targetPlan === 'plus' ? (record.period === 'year' ? 389900 : 39900) : 0,
            currency: 'RUB' as const,
            paymentMode: 'simulation' as const,
            endsAt:
                body.targetPlan === 'plus'
                    ? new Date(
                          Date.parse(record.endsAt) + (record.period === 'year' ? 365 : 31) * 86_400_000,
                      ).toISOString()
                    : null,
            expiresAt,
        };
        const preview = {
            id: previewId,
            userId,
            kind: 'downgrade' as const,
            expectedVersion: record.version,
            period: record.period,
            startsAt: null,
            endsAt: record.endsAt,
            expiresAt,
            payload: response,
        };
        state.subscription.previews.push(preview);
        return success(response);
    }
    if (path === '/api/v1/settings/subscription/downgrade/commit') {
        const body = contracts['POST /api/v1/settings/subscription/downgrade/commit'].request.parse(input);
        const result = replay(
            state,
            `downgrade:${userId}:${body.idempotencyKey}`,
            body,
            () => {
                const preview = state.subscription.previews.find(
                    (item) => item.id === body.previewId && item.userId === userId && item.kind === 'downgrade',
                );
                if (!preview || Date.parse(preview.expiresAt) <= now) return fail(409, 'PREVIEW_EXPIRED');
                if (record.version !== body.expectedVersion || preview.expectedVersion !== body.expectedVersion)
                    return fail(412);
                record.version++;
                record.autoRenew = false;
                record.downgradeToFreeAt = preview.payload.targetPlan === 'free' ? preview.endsAt : null;
                record.scheduledPlan = preview.payload.targetPlan === 'plus' ? 'plus' : 'free';
                record.scheduledPeriod = preview.payload.targetPlan === 'plus' ? preview.period : null;
                record.scheduledEndsAt =
                    preview.payload.targetPlan === 'plus' && typeof preview.payload.endsAt === 'string'
                        ? preview.payload.endsAt
                        : null;
                return overview(state, userId, now);
            },
            fail,
        );
        return result instanceof Response ? result : success(result);
    }
    return fail(404);
}
