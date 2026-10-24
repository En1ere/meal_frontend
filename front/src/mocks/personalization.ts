import { z } from 'zod';
import { contracts } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';
import { seedInventoryFixtures } from './inventory.js';
import { seedMealPlanFixtures } from './meal-plan.js';
import { seedShoppingReceiptFixtures } from './shopping-receipts.js';
import { consentRequiredCode, hasConsent } from './legal.js';

const onboarding = z.object({
    flow: z.enum(['quick', 'detailed', 'demo']).nullable(),
    status: z.enum(['not_started', 'in_progress', 'completed', 'skipped']),
    step: z.number().int(),
    totalSteps: z.number().int(),
});
const preferences = z.object({
    diets: z.array(z.string()),
    allergens: z.array(z.string()),
    dislikes: z.array(z.string()),
    allergenMode: z.enum(['warn', 'hide']),
    equipment: z.record(z.string(), z.enum(['yes', 'no', 'unknown'])),
    goals: z.array(z.string()),
});
const row = z.object({
    settingsVersion: z.number().int().positive(),
    profileVersion: z.number().int().positive(),
    timezone: z.string(),
    locale: z.literal('ru'),
    theme: z.string().nullable(),
    onboarding,
    preferences,
});
export const personalizationStateSchema = z.object({
    rows: z.record(z.string(), row),
    replay: z.record(z.string(), z.object({ input: z.string(), result: z.unknown() })),
});
export type PersonalizationState = z.infer<typeof personalizationStateSchema>;
export const createPersonalizationState = (): PersonalizationState => ({ rows: {}, replay: {} });

const catalog = {
    diets: [
        ['balanced', 'Сбалансированное'],
        ['mediterranean', 'Средиземноморское'],
        ['vegetarian', 'Вегетарианское'],
        ['vegan', 'Веганское'],
        ['low_carb', 'Низкоуглеводное'],
        ['spicy', 'Острые блюда'],
    ].map(([code, name]) => ({ code: code!, name: name! })),
    allergens: [
        ['peanut', 'Арахис'],
        ['milk', 'Молоко'],
        ['egg', 'Яйца'],
        ['gluten', 'Глютен'],
        ['fish', 'Рыба'],
        ['shellfish', 'Моллюски'],
        ['soy', 'Соя'],
        ['tree_nuts', 'Орехи'],
    ].map(([code, name]) => ({ code: code!, name: name! })),
    equipment: [
        ['oven', 'Духовка'],
        ['hob', 'Плита'],
        ['blender', 'Блендер'],
        ['microwave', 'Микроволновка'],
        ['multicooker', 'Мультиварка'],
        ['grill', 'Гриль'],
    ].map(([code, name]) => ({ code: code!, name: name! })),
    goals: [
        ['quick', 'Быстрее готовить'],
        ['less_waste', 'Меньше отходов'],
        ['variety', 'Больше разнообразия'],
        ['planning', 'Планировать заранее'],
    ].map(([code, name]) => ({ code: code!, name: name! })),
};
const defaults = () => ({
    settingsVersion: 1,
    profileVersion: 1,
    timezone: 'Europe/Moscow',
    locale: 'ru' as const,
    theme: null,
    onboarding: { flow: null, status: 'not_started' as const, step: 0, totalSteps: 0 },
    preferences: { diets: [], allergens: [], dislikes: [], allergenMode: 'warn' as const, equipment: {}, goals: [] },
});
export const personalizationRow = (state: MockState, userId: string) =>
    (state.personalization.rows[userId] ??= defaults());
const versioned = (value: object, version: number) => ({ ...value, version });
const total = (flow: string | null) => (flow === 'quick' ? 3 : flow === 'detailed' ? 5 : flow === 'demo' ? 7 : 0);
const localDate = (date: Date, timeZone: string) => {
    const parts = new Intl.DateTimeFormat('en', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
};
const replay = (state: MockState, key: string, input: unknown, run: () => unknown) => {
    const serialized = JSON.stringify(input);
    const old = state.personalization.replay[key];
    if (old) return old.input === serialized ? old.result : Symbol.for('conflict');
    const result = run();
    if (typeof result !== 'symbol') state.personalization.replay[key] = { input: serialized, result };
    return result;
};

export function personalizationHandle(c: {
    state: MockState;
    userId: string | null;
    path: string;
    method: string;
    input: unknown;
    now: number;
    success: (data: unknown) => Response;
    fail: (status: number, code?: string) => Response;
}): Response | null {
    const { state, userId, path, method, input, now, success, fail } = c;
    if (
        ![
            '/api/v1/home',
            '/api/v1/personalization',
            '/api/v1/personalization/onboarding',
            '/api/v1/personalization/preferences',
        ].includes(path)
    )
        return null;
    if (!userId) return fail(401);
    const settings = personalizationRow(state, userId);
    if (path === '/api/v1/personalization' && method === 'GET')
        return success({
            onboarding: versioned(settings.onboarding, settings.settingsVersion),
            preferences: versioned(settings.preferences, settings.settingsVersion),
            catalog,
        });
    if (path === '/api/v1/home' && method === 'GET') {
        seedInventoryFixtures(state.inventory, userId, now);
        seedMealPlanFixtures(state, userId, now);
        seedShoppingReceiptFixtures(state, userId, now);
        const today = localDate(new Date(now), settings.timezone);
        const tomorrowDate = new Date(`${today}T12:00:00Z`);
        tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
        const tomorrow = tomorrowDate.toISOString().slice(0, 10);
        const batches = state.inventory.batches.filter((x) => x.userId === userId && !x.batch.archivedAt);
        const plan = state.mealPlan.plans.find((x) => x.userId === userId)?.entries ?? [];
        return success(
            contracts['GET /api/v1/home'].success.shape.data.parse({
                recommendations: [],
                expiring: batches
                    .filter((x) => x.batch.expiryOn)
                    .sort((a, b) => a.batch.expiryOn!.localeCompare(b.batch.expiryOn!))
                    .slice(0, 3)
                    .map(({ batch }) => ({
                        id: batch.id,
                        name: batch.name,
                        expiryOn: batch.expiryOn,
                        daysLeft: Math.ceil(
                            (Date.parse(`${batch.expiryOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000,
                        ),
                    })),
                plan: plan
                    .filter((x) => x.date === today || x.date === tomorrow)
                    .slice(0, 6)
                    .map((x) => ({ id: x.id, date: x.date, meal: x.meal, title: x.recipe?.title ?? null })),
                inventoryCount: batches.length,
                activeShoppingLists: state.cookingWorkflow.lists.filter(
                    (x) => x.userId === userId && x.list.status === 'active',
                ).length,
                onboarding: versioned(settings.onboarding, settings.settingsVersion),
            }),
        );
    }
    if (method !== 'PUT') return fail(404);
    const parsed = path.endsWith('/onboarding')
        ? contracts['PUT /api/v1/personalization/onboarding'].request.safeParse(input)
        : contracts['PUT /api/v1/personalization/preferences'].request.safeParse(input);
    if (!parsed.success) return fail(400);
    const value = parsed.data;
    if (
        path.endsWith('/preferences') &&
        !hasConsent(state.legal, userId, 'special_category') &&
        (JSON.stringify((value as { allergens: string[] }).allergens) !==
            JSON.stringify(settings.preferences.allergens) ||
            (value as { allergenMode: string }).allergenMode !== settings.preferences.allergenMode)
    )
        return fail(403, consentRequiredCode('special_category'));
    const result = replay(state, `${userId}:${path}:${value.idempotencyKey}`, value, () => {
        if (value.expectedVersion !== settings.settingsVersion) return Symbol.for('version');
        settings.settingsVersion++;
        if (path.endsWith('/onboarding')) {
            const data = value as z.infer<(typeof contracts)['PUT /api/v1/personalization/onboarding']['request']>;
            settings.onboarding = {
                flow: data.flow,
                status: data.status,
                step: data.step,
                totalSteps: total(data.flow),
            };
            return versioned(settings.onboarding, settings.settingsVersion);
        }
        const data = value as z.infer<(typeof contracts)['PUT /api/v1/personalization/preferences']['request']>;
        settings.preferences = {
            diets: data.diets,
            allergens: data.allergens,
            dislikes: data.dislikes,
            allergenMode: data.allergenMode,
            equipment: data.equipment,
            goals: data.goals,
        };
        return versioned(settings.preferences, settings.settingsVersion);
    });
    if (result === Symbol.for('conflict')) return fail(409);
    if (result === Symbol.for('version')) return fail(412);
    return success(result);
}
