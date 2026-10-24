import { z } from 'zod';
import { contracts } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';
import { mockDiaryAccess } from './diary.js';

const settingsSchema = contracts['GET /api/v1/nutrition/settings'].success.shape.data;
const profileSchema = settingsSchema.shape.profile.unwrap();
const targetSchema = settingsSchema.shape.currentTarget.unwrap();
const replaySchema = z.strictObject({ hash: z.string(), data: z.unknown() });

export const nutritionStateSchema = z.strictObject({
    profiles: z.array(z.strictObject({ userId: z.uuid(), profile: profileSchema })),
    targets: z.array(z.strictObject({ userId: z.uuid(), target: targetSchema })),
    replay: z.record(z.string(), replaySchema),
});
export type NutritionState = z.infer<typeof nutritionStateSchema>;
export const createNutritionState = (): NutritionState => ({ profiles: [], targets: [], replay: {} });

type Context = {
    state: MockState;
    userId: string | null;
    path: string;
    method: string;
    query: URLSearchParams;
    input: unknown;
    ifMatch: string | null;
    now: number;
    success: (data: unknown) => Response;
    fail: (status: number, code?: string) => Response;
};

const unknownNutrition = () => ({
    energyKcal: null as string | null,
    proteinG: null as string | null,
    fatG: null as string | null,
    carbohydrateG: null as string | null,
    fiberG: null as string | null,
});
const localDate = (value: string) => {
    const date = new Date(value);
    const pad = (part: number) => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const previousDay = (value: string) => {
    const date = new Date(`${value}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
};
const completeness = (value: ReturnType<typeof unknownNutrition>) => {
    const known = Object.values(value).filter((item) => item !== null).length;
    return known === 0 ? ('unknown' as const) : known === 5 ? ('complete' as const) : ('partial' as const);
};
const aggregate = (values: ReturnType<typeof unknownNutrition>[]) => {
    if (!values.length) return unknownNutrition();
    const output = unknownNutrition();
    for (const key of Object.keys(output) as (keyof typeof output)[]) {
        const items = values.map((value) => value[key]);
        output[key] = items.some((item) => item === null)
            ? null
            : String(items.reduce((sum, item) => sum + Number(item), 0));
    }
    return output;
};
const settings = (state: MockState, userId: string, access: NonNullable<ReturnType<typeof mockDiaryAccess>>) => {
    const profile = state.nutrition.profiles.find((row) => row.userId === userId)?.profile ?? null;
    const targets = state.nutrition.targets
        .filter((row) => row.userId === userId)
        .map((row) => row.target)
        .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom));
    return settingsSchema.parse({
        access,
        profile,
        currentTarget: targets[0] ?? null,
        targetHistory: targets,
        policy: { mode: 'manual_only', medicalAdvice: false, automaticTargetsAvailable: false },
    });
};

export function nutritionHandle(context: Context): Response | null {
    const { state, userId, path, method, query, input, ifMatch, now, success, fail } = context;
    if (!path.startsWith('/api/v1/nutrition/')) return null;
    if (!userId) return fail(401);
    const access = mockDiaryAccess(state, userId, now);
    if (!access) return fail(403, 'PRO_REQUIRED');
    if (method !== 'GET' && access.mode !== 'active') return fail(403, 'PRO_READ_ONLY');

    if (path === '/api/v1/nutrition/settings' && method === 'GET') return success(settings(state, userId, access));

    const replay = (target: string, key: string, body: unknown, create: () => unknown) => {
        const id = `${userId}:${target}:${key}`;
        const hash = JSON.stringify(body);
        const existing = state.nutrition.replay[id];
        if (existing) return existing.hash === hash ? success(existing.data) : fail(409, 'IDEMPOTENCY_CONFLICT');
        const data = create();
        if (data instanceof Response) return data;
        state.nutrition.replay[id] = { hash, data };
        return success(data);
    };

    if (path === '/api/v1/nutrition/profile' && method === 'PUT') {
        const parsed = contracts['PUT /api/v1/nutrition/profile'].request.safeParse(input);
        if (!parsed.success) return fail(400);
        return replay('profile', parsed.data.idempotencyKey, parsed.data, () => {
            const current = state.nutrition.profiles.find((row) => row.userId === userId);
            if (current && ifMatch !== `"${current.profile.version}"`) return fail(412, 'VERSION_MISMATCH');
            if (!current && parsed.data.expectedVersion !== null) return fail(412, 'VERSION_MISMATCH');
            if (current) {
                current.profile.goal = parsed.data.goal;
                current.profile.version++;
            } else {
                state.nutrition.profiles.push({
                    userId,
                    profile: profileSchema.parse({
                        id: crypto.randomUUID(),
                        goal: parsed.data.goal,
                        version: 1,
                        createdAt: new Date(now).toISOString(),
                    }),
                });
            }
            return settings(state, userId, access);
        });
    }

    if (path === '/api/v1/nutrition/targets' && method === 'POST') {
        const parsed = contracts['POST /api/v1/nutrition/targets'].request.safeParse(input);
        if (!parsed.success) return fail(400);
        return replay('target', parsed.data.idempotencyKey, parsed.data, () => {
            const profile = state.nutrition.profiles.find((row) => row.userId === userId)?.profile;
            if (!profile) return fail(409, 'PROFILE_REQUIRED');
            if (ifMatch !== `"${profile.version}"` || parsed.data.expectedProfileVersion !== profile.version)
                return fail(412, 'VERSION_MISMATCH');
            const current = state.nutrition.targets
                .filter((row) => row.userId === userId)
                .map((row) => row.target)
                .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0];
            if (current && parsed.data.effectiveFrom <= current.effectiveFrom) return fail(409, 'TARGET_DATE_CONFLICT');
            if (current) {
                current.effectiveTo = previousDay(parsed.data.effectiveFrom);
                current.version++;
            }
            state.nutrition.targets.push({
                userId,
                target: targetSchema.parse({
                    id: crypto.randomUUID(),
                    effectiveFrom: parsed.data.effectiveFrom,
                    effectiveTo: null,
                    values: {
                        energyKcal: parsed.data.energyKcal,
                        proteinG: parsed.data.proteinG,
                        fatG: parsed.data.fatG,
                        carbohydrateG: parsed.data.carbohydrateG,
                        fiberG: parsed.data.fiberG,
                    },
                    source: 'manual',
                    version: 1,
                    createdAt: new Date(now).toISOString(),
                }),
            });
            profile.version++;
            return settings(state, userId, access);
        });
    }

    if (path === '/api/v1/nutrition/analytics' && method === 'GET') {
        const parsed = z.strictObject({ from: z.iso.date(), to: z.iso.date() }).safeParse(Object.fromEntries(query));
        if (!parsed.success || parsed.data.from > parsed.data.to) return fail(400);
        const length = Math.floor((Date.parse(parsed.data.to) - Date.parse(parsed.data.from)) / 86400000) + 1;
        if (length > 92) return fail(400, 'PERIOD_TOO_LONG');
        const dataThrough =
            access.mode === 'read_only' && access.periodEndsAt && access.periodEndsAt.slice(0, 10) < parsed.data.to
                ? access.periodEndsAt.slice(0, 10)
                : parsed.data.to;
        const grouped = new Map<string, ReturnType<typeof unknownNutrition>[]>();
        for (const row of state.diary.entries) {
            if (row.userId !== userId || row.entry.state === 'archived') continue;
            const date = localDate(row.entry.eatenAt);
            if (date < parsed.data.from || date > dataThrough) continue;
            grouped.set(date, [...(grouped.get(date) ?? []), row.entry.nutrition]);
        }
        const targets = state.nutrition.targets
            .filter((row) => row.userId === userId)
            .map((row) => row.target)
            .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom));
        const days = [...grouped.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([date, entries]) => {
                const nutrition = aggregate(entries);
                const target =
                    targets.find(
                        (candidate) =>
                            candidate.effectiveFrom <= date &&
                            (candidate.effectiveTo === null || candidate.effectiveTo >= date),
                    ) ?? null;
                const progressPercent = Object.fromEntries(
                    Object.keys(nutrition).map((key) => {
                        const nutrient = key as keyof typeof nutrition;
                        const fact = nutrition[nutrient];
                        const goal = target?.values[nutrient] ?? null;
                        return [
                            nutrient,
                            fact === null || goal === null || Number(goal) <= 0
                                ? null
                                : (Number(fact) / Number(goal)) * 100,
                        ];
                    }),
                );
                return {
                    date,
                    entryCount: entries.length,
                    nutrition,
                    completeness: completeness(nutrition),
                    target,
                    progressPercent,
                };
            });
        return success(
            contracts['GET /api/v1/nutrition/analytics'].success.shape.data.parse({
                access,
                period: { ...parsed.data, dataThrough },
                days,
                summary: {
                    entryCount: days.reduce((sum, day) => sum + day.entryCount, 0),
                    daysWithEntries: days.length,
                    completeDays: days.filter((day) => day.completeness === 'complete').length,
                    partialDays: days.filter((day) => day.completeness === 'partial').length,
                    unknownDays: days.filter((day) => day.completeness === 'unknown').length,
                },
                disclaimer: 'informational_not_medical',
            }),
        );
    }

    return fail(404);
}
