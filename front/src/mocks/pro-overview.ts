import { contracts } from '../shared/api/contracts.generated.js';
import { ensureAiState } from './ai.js';
import type { MockState } from './model.js';
import { mockPersonalSubscription } from './subscription.js';

type Context = {
    state: MockState;
    userId: string | null;
    path: string;
    method: string;
    now: number;
    success: (data: unknown) => Response;
    fail: (status: number, code?: string) => Response;
};

export function proOverviewHandle(context: Context): Response | null {
    const { state, userId, path, method, now, success, fail } = context;
    if (path !== '/api/v1/pro/overview') return null;
    if (method !== 'GET') return fail(404);
    if (!userId) return fail(401);

    const historicalEndsAt = state.subscription.records.find((record) => record.userId === userId)?.endsAt ?? null;
    const personal = mockPersonalSubscription(state, userId, now);
    const family = state.family.families.find(
        (candidate) =>
            !candidate.archived &&
            candidate.members.some((member) => member.userId === userId && member.leftAt === null),
    );
    const familyPro = family?.plan === 'pro';
    const active = personal.plan === 'pro' || familyPro;
    const historical = state.subscription.trialHistory.includes(userId);
    if (!active && !historical) return fail(403, 'PRO_REQUIRED');

    ensureAiState(state, userId, now);
    const buckets = state.ai.buckets
        .filter((bucket) => bucket.userId === userId || (familyPro && bucket.familyId === family.id))
        .map(({ userId: _userId, familyId: _familyId, ...bucket }) => {
            void _userId;
            void _familyId;
            return bucket;
        });
    const total = buckets.reduce((sum, bucket) => sum + bucket.balance, 0);
    const reserved = buckets.reduce((sum, bucket) => sum + bucket.reserved, 0);
    const profile = state.nutrition.profiles.find((row) => row.userId === userId)?.profile ?? null;
    const target = state.nutrition.targets
        .filter((row) => row.userId === userId)
        .map((row) => row.target)
        .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0];
    const missingFields = [
        ...(!profile ? (['nutrition_profile'] as const) : []),
        ...(!profile?.goal ? (['goal'] as const) : []),
        ...(!target?.values.energyKcal ? (['energy_kcal'] as const) : []),
        ...(!target?.values.proteinG ? (['protein_g'] as const) : []),
        ...(!target?.values.fatG ? (['fat_g'] as const) : []),
        ...(!target?.values.carbohydrateG ? (['carbohydrate_g'] as const) : []),
        ...(!target?.values.fiberG ? (['fiber_g'] as const) : []),
    ];
    const overview = contracts['GET /api/v1/pro/overview'].success.shape.data.parse({
        access: active
            ? {
                  mode: 'active',
                  reason: null,
                  source: familyPro ? 'family' : personal.source,
                  periodEndsAt: familyPro ? family.periodEndsAt : personal.periodEndsAt,
              }
            : {
                  mode: 'read_only',
                  reason: 'pro_expired',
                  source: 'history',
                  periodEndsAt: historicalEndsAt,
              },
        goal: profile?.goal ?? null,
        targets: target
            ? {
                  effectiveFrom: target.effectiveFrom,
                  effectiveTo: target.effectiveTo,
                  ...target.values,
              }
            : null,
        missingFields,
        diaryCount: state.diary.entries.filter((row) => row.userId === userId).length,
        expenseCount: state.finance.expenses.filter((row) => row.userId === userId).length,
        ai: {
            buckets,
            total,
            reserved,
            available: Math.max(0, total - reserved),
            debitOrder: ['subscription', 'transferred', 'family_reserve', 'trial', 'purchased'],
            packageOffer: {
                actions: 40,
                amountMinor: 19900,
                currency: 'RUB',
                purchaseMode: 'unavailable',
            },
        },
    });
    return success(overview);
}
