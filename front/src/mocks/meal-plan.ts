import { z } from 'zod';
import { contracts } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';
import { publicRecipeFixtures } from './recipe-fixtures.js';
import { seedInventoryFixtures } from './inventory.js';
import { mockFamilyContext } from './family.js';
import { syncDiaryPortions } from './diary.js';
import { priceFor } from './finance.js';

const planSchema = contracts['GET /api/v1/meal-plan'].success.shape.data;
const entrySchema = planSchema.shape.entries.element;
type AutomationPreview = z.infer<(typeof contracts)['POST /api/v1/meal-plan/automation-preview']['success']>['data'];
type PreviewOptimization = AutomationPreview['optimization'];
type PreviewWarning = NonNullable<PreviewOptimization>['warnings'][number];
const portionWorkspaceSchema = contracts['GET /api/v1/portions'].success.shape.data;
const rowSchema = z.object({
    userId: z.uuid(),
    id: z.uuid(),
    version: z.number().int().positive(),
    revision: z.number().int().positive(),
    timezone: z.string(),
    entries: z.array(entrySchema),
});
export const mealPlanStateSchema = z.object({
    plans: z.array(rowSchema),
    portions: z.array(z.strictObject({ ownerKey: z.uuid(), workspace: portionWorkspaceSchema })),
    seeded: z.array(z.string()),
    replay: z.record(z.string(), z.object({ input: z.string(), result: z.unknown() })),
});
export type MealPlanState = z.infer<typeof mealPlanStateSchema>;
export const createMealPlanState = (): MealPlanState => ({ plans: [], portions: [], seeded: [], replay: {} });

type Entry = z.infer<typeof entrySchema>;
type Selection = {
    scope: 'private' | 'family' | undefined;
    view: 'day' | 'week' | 'range' | 'calendar';
    date: string;
    endDate: string | undefined;
    timezone: string;
};
const selectionOf = (value: {
    scope?: 'private' | 'family' | undefined;
    view?: 'day' | 'week' | 'range' | 'calendar' | undefined;
    date: string;
    endDate?: string | undefined;
    timezone: string;
}): Selection => ({
    scope: value.scope,
    view: value.view ?? 'week',
    date: value.date,
    endDate: value.endDate,
    timezone: value.timezone,
});
type Context = {
    state: MockState;
    userId: string | null;
    path: string;
    method: string;
    query: URLSearchParams;
    input: unknown;
    now: number;
    success: (data: unknown) => Response;
    fail: (status: number) => Response;
};
class Failure extends Error {
    constructor(readonly status: number) {
        super(String(status));
    }
}
const amount = (value: string) => {
    const [whole = '0', fraction = ''] = value.split('.');
    return BigInt(whole) * 100000000n + BigInt(fraction.padEnd(8, '0'));
};
const text = (value: bigint) =>
    `${value / 100000000n}${value % 100000000n ? '.' + (value % 100000000n).toString().padStart(8, '0').replace(/0+$/, '') : ''}`;
const digest = (value: unknown) => {
    const source = JSON.stringify(value);
    return Array.from({ length: 8 }, (_, seed) => {
        let hash = (2166136261 ^ seed) >>> 0;
        for (let index = 0; index < source.length; index++) hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
        return (hash >>> 0).toString(16).padStart(8, '0');
    }).join('');
};
const createPreview = (value: unknown, now: number) => {
    const expires = now + 600000;
    return {
        previewToken: `${expires.toString(16).padStart(16, '0')}${digest({ value, expires }).slice(0, 48)}`,
        expiresAt: new Date(expires).toISOString(),
    };
};
const validPreview = (token: string, value: unknown, now: number) => {
    const expires = Number.parseInt(token.slice(0, 16), 16);
    return (
        Number.isSafeInteger(expires) &&
        expires >= now &&
        expires <= now + 600000 &&
        token === `${expires.toString(16).padStart(16, '0')}${digest({ value, expires }).slice(0, 48)}`
    );
};
const stableId = (value: unknown) => {
    const hex = digest(value).slice(0, 32).split('');
    hex[12] = '4';
    hex[16] = ['8', '9', 'a', 'b'][Number.parseInt(hex[16]!, 16) % 4]!;
    return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`;
};
function range(selection: Selection) {
    if (selection.view === 'range') return { startsOn: selection.date, endsOn: selection.endDate! };
    const selected = new Date(`${selection.date}T00:00:00Z`);
    if (selection.view === 'calendar') {
        const start = new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth(), 1));
        const end = new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth() + 1, 0));
        return { startsOn: start.toISOString().slice(0, 10), endsOn: end.toISOString().slice(0, 10) };
    }
    const start = new Date(selected);
    if (selection.view === 'week') start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    const end = new Date(start);
    if (selection.view === 'week') end.setUTCDate(end.getUTCDate() + 6);
    return { startsOn: start.toISOString().slice(0, 10), endsOn: end.toISOString().slice(0, 10) };
}
function weeklyDates(startsOn: string, endsOn: string, weekdays: readonly number[]) {
    const selected = new Set(weekdays);
    const result: string[] = [];
    for (let value = startsOn; value <= endsOn;) {
        const date = new Date(`${value}T12:00:00Z`);
        if (selected.has(date.getUTCDay())) result.push(value);
        date.setUTCDate(date.getUTCDate() + 1);
        value = date.toISOString().slice(0, 10);
    }
    return result;
}
function seed(state: MockState, ownerKey: string, actorId: string, scope: 'private' | 'family', now: number) {
    if (state.mealPlan.seeded.includes(ownerKey)) return;
    state.mealPlan.seeded.push(ownerKey);
    seedInventoryFixtures(state.inventory, ownerKey, actorId, scope, now);
    const monday = new Date(now);
    monday.setUTCHours(0, 0, 0, 0);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const recipes = publicRecipeFixtures();
    state.mealPlan.plans.push({
        userId: ownerKey,
        id: crypto.randomUUID(),
        version: 1,
        revision: 1,
        timezone: 'Europe/Moscow',
        entries: [
            entrySchema.parse({
                id: crypto.randomUUID(),
                date: monday.toISOString().slice(0, 10),
                meal: 'dinner',
                portions: 2,
                locked: true,
                slotState: 'recipe',
                note: 'Первый демонстрационный план',
                recipe: { id: recipes[0]!.id, revisionId: recipes[0]!.revisionId, title: recipes[0]!.title },
                assignments:
                    scope === 'family'
                        ? (mockFamilyContext(state, actorId).family?.members ?? []).map((member) => ({
                              userId: member.userId,
                              displayName: member.displayName,
                              portions: 1,
                          }))
                        : [
                              {
                                  userId: actorId,
                                  displayName: state.users.find((user) => user.id === actorId)?.name ?? 'Пользователь',
                                  portions: 2,
                              },
                          ],
                version: 1,
            }),
            entrySchema.parse({
                id: crypto.randomUUID(),
                date: new Date(monday.getTime() + 86400000).toISOString().slice(0, 10),
                meal: 'lunch',
                portions: 1,
                locked: false,
                slotState: 'outside',
                note: 'Обед вне дома',
                recipe: null,
                assignments: [],
                version: 1,
            }),
        ],
    });
    const unit = 'serv';
    state.mealPlan.portions.push({
        ownerKey,
        workspace: portionWorkspaceSchema.parse({
            scope,
            prepared: [
                {
                    batchId: stableId({ ownerKey, kind: 'prepared' }),
                    outputId: stableId({ ownerKey, kind: 'output' }),
                    attemptId: stableId({ ownerKey, kind: 'attempt' }),
                    name: 'Овощное рагу',
                    quantity: '4',
                    unit,
                    version: 1,
                },
            ],
            proposals: [],
        }),
    });
}
export function seedMealPlanFixtures(state: MockState, userId: string, now: number) {
    seed(state, userId, userId, 'private', now);
}
function project(row: z.infer<typeof rowSchema>, selection: Selection) {
    const dates = range(selection);
    return planSchema.parse({
        id: row.id,
        scope: selection.scope ?? 'private',
        version: row.version,
        revision: row.revision,
        timezone: row.timezone,
        ...dates,
        view: selection.view,
        selectedDate: selection.date,
        entries: row.entries.filter((entry) => entry.date >= dates.startsOn && entry.date <= dates.endsOn),
    });
}
function apply(
    state: MockState,
    row: z.infer<typeof rowSchema>,
    input: z.infer<(typeof contracts)['POST /api/v1/meal-plan/change-preview']['request']>,
) {
    const entries = structuredClone(row.entries);
    if (input.mutation.action === 'remove') {
        const index = entries.findIndex((entry) => entry.id === input.mutation.entryId);
        if (index < 0) throw new Failure(404);
        entries.splice(index, 1);
        return { entries, proposedEntry: null };
    }
    const mutation = input.mutation;
    const selection = selectionOf(input.selection);
    const dates = range(selection);
    if (mutation.date < dates.startsOn || mutation.date > dates.endsOn) throw new Failure(422);
    const index = mutation.entryId ? entries.findIndex((entry) => entry.id === mutation.entryId) : -1;
    if (mutation.entryId && index < 0) throw new Failure(404);
    const recipe =
        mutation.slotState === 'recipe'
            ? publicRecipeFixtures().find(
                  (candidate) => candidate.id === mutation.recipeId && candidate.revisionId === mutation.revisionId,
              )
            : null;
    if (mutation.slotState === 'recipe' && !recipe) throw new Failure(404);
    const old = index >= 0 ? entries[index]! : null;
    const proposedEntry = entrySchema.parse({
        id: old?.id ?? stableId({ userId: row.userId, mutation }),
        date: mutation.date,
        meal: mutation.meal,
        portions: mutation.portions,
        locked: mutation.locked,
        slotState: mutation.slotState,
        note: mutation.note,
        recipe: recipe ? { id: recipe.id, revisionId: recipe.revisionId, title: recipe.title } : null,
        assignments:
            mutation.assignments?.map((assignment) => ({
                ...assignment,
                displayName: state.users.find((user) => user.id === assignment.userId)?.name ?? 'Участник',
            })) ??
            old?.assignments ??
            [],
        version: old ? old.version + 1 : 1,
    });
    if (index >= 0) entries.splice(index, 1, proposedEntry);
    else entries.push(proposedEntry);
    entries.sort((a, b) => a.date.localeCompare(b.date) || a.meal.localeCompare(b.meal) || a.id.localeCompare(b.id));
    return { entries, proposedEntry };
}
function impact(state: MockState, userId: string, entries: Entry[]) {
    const used = new Map<string, bigint>();
    const items: Array<{
        entryRef: string;
        ingredientId: string | null;
        name: string;
        requiredQuantity: string | null;
        reservedQuantity: string | null;
        missingQuantity: string | null;
        unit: string | null;
        needsQuantityCheck: boolean;
    }> = [];
    const recipes = publicRecipeFixtures();
    for (const entry of entries) {
        const recipe = entry.recipe
            ? recipes.find((candidate) => candidate.revisionId === entry.recipe!.revisionId)
            : null;
        if (!recipe) continue;
        for (const ingredient of recipe.ingredients.filter((line) => !line.optional)) {
            const required = ingredient.quantity
                ? text((amount(ingredient.quantity) * BigInt(entry.portions)) / BigInt(recipe.baseServings))
                : null;
            if (!required || !ingredient.ingredientId || !ingredient.unit) {
                items.push({
                    entryRef: entry.id,
                    ingredientId: ingredient.ingredientId,
                    name: ingredient.name,
                    requiredQuantity: required,
                    reservedQuantity: null,
                    missingQuantity: null,
                    unit: ingredient.unit,
                    needsQuantityCheck: true,
                });
                continue;
            }
            let available = state.inventory.batches
                .filter(
                    (row) =>
                        row.userId === userId &&
                        !row.batch.archivedAt &&
                        row.batch.ingredientId === ingredient.ingredientId &&
                        row.batch.unit === ingredient.unit &&
                        row.batch.quantity !== null,
                )
                .reduce((sum, row) => sum + amount(row.batch.quantity!), 0n);
            available -= used.get(`${ingredient.ingredientId}:${ingredient.unit}`) ?? 0n;
            if (available < 0n) available = 0n;
            const need = amount(required);
            const reserved = available < need ? available : need;
            used.set(
                `${ingredient.ingredientId}:${ingredient.unit}`,
                (used.get(`${ingredient.ingredientId}:${ingredient.unit}`) ?? 0n) + reserved,
            );
            const unknown = state.inventory.batches.some(
                (row) =>
                    row.userId === userId &&
                    !row.batch.archivedAt &&
                    row.batch.ingredientId === ingredient.ingredientId &&
                    row.batch.unit === ingredient.unit &&
                    row.batch.quantity === null,
            );
            items.push({
                entryRef: entry.id,
                ingredientId: ingredient.ingredientId,
                name: ingredient.name,
                requiredQuantity: required,
                reservedQuantity: text(reserved),
                missingQuantity: text(need - reserved),
                unit: ingredient.unit,
                needsQuantityCheck: unknown && reserved < need,
            });
        }
    }
    return { items, estimatedPriceMinor: null, priceComplete: false };
}
function shoppingItems(result: ReturnType<typeof impact>) {
    const groups = new Map<
        string,
        {
            ingredientId: string | null;
            name: string;
            quantity: string | null;
            unit: string | null;
            needsQuantityCheck: boolean;
            entryIds: string[];
        }
    >();
    for (const item of result.items) {
        if (item.missingQuantity === '0' && !item.needsQuantityCheck) continue;
        const key = `${item.ingredientId ?? item.name}:${item.unit ?? ''}`;
        const old = groups.get(key);
        groups.set(key, {
            ingredientId: item.ingredientId,
            name: item.name,
            quantity:
                item.missingQuantity === null || old?.quantity === null
                    ? null
                    : text(amount(old?.quantity ?? '0') + amount(item.missingQuantity)),
            unit: item.unit,
            needsQuantityCheck: item.needsQuantityCheck || (old?.needsQuantityCheck ?? false),
            entryIds: [...new Set([...(old?.entryIds ?? []), item.entryRef])],
        });
    }
    return [...groups.values()];
}

export function mealPlanHandle(context: Context): Response | null {
    if (!context.path.startsWith('/api/v1/meal-plan') && !context.path.startsWith('/api/v1/portions')) return null;
    const { state, userId, method, path, input, now, success, fail } = context;
    try {
        if (!userId) throw new Failure(401);
        const bodyScope =
            typeof input === 'object' && input
                ? 'scope' in input
                    ? String(input.scope)
                    : 'selection' in input &&
                        typeof input.selection === 'object' &&
                        input.selection &&
                        'scope' in input.selection
                      ? String(input.selection.scope)
                      : 'private'
                : 'private';
        const requestedScope = (context.query.get('scope') ?? bodyScope) === 'family' ? 'family' : 'private';
        const family = mockFamilyContext(state, userId);
        if (requestedScope === 'family' && (family.state === 'none' || !family.family)) throw new Failure(404);
        if (requestedScope === 'family' && family.state !== 'active') throw new Failure(403);
        const ownerKey = requestedScope === 'family' ? family.family!.id : userId;
        const smart =
            requestedScope === 'family' ||
            ['plus', 'pro'].includes(state.users.find((candidate) => candidate.id === userId)?.plan ?? 'free');
        seed(state, ownerKey, userId, requestedScope, now);
        const row = state.mealPlan.plans.find((candidate) => candidate.userId === ownerKey)!;
        if (path.startsWith('/api/v1/portions')) {
            const stored = state.mealPlan.portions.find((candidate) => candidate.ownerKey === ownerKey)!;
            for (const proposal of stored.workspace.proposals)
                syncDiaryPortions(state, proposal.recipient.userId, now, false);
            if (method === 'GET') return success(stored.workspace);
            if (state.inventory.blocked.includes(userId)) throw new Failure(403);
            if (path.endsWith('/assign')) {
                const request = contracts['POST /api/v1/portions/assign'].request.parse(input);
                const binding = `${ownerKey}:portion:assign:${request.idempotencyKey}`;
                const fingerprint = JSON.stringify(request);
                const replay = state.mealPlan.replay[binding];
                if (replay) return replay.input === fingerprint ? success(replay.result) : fail(409);
                const memberIds =
                    requestedScope === 'family' ? family.family!.members.map((member) => member.userId) : [userId];
                if (!memberIds.includes(request.recipientUserId)) throw new Failure(422);
                const source = stored.workspace.prepared.find((item) => item.batchId === request.batchId);
                if (!source) throw new Failure(404);
                if (source.version !== request.expectedBatchVersion) throw new Failure(412);
                if (source.quantity === null || amount(source.quantity) < amount(request.quantity))
                    throw new Failure(422);
                source.quantity = text(amount(source.quantity) - amount(request.quantity));
                source.version++;
                stored.workspace.proposals.unshift({
                    id: crypto.randomUUID(),
                    recipient: {
                        userId: request.recipientUserId,
                        displayName:
                            state.users.find((item) => item.id === request.recipientUserId)?.name ?? 'Участник',
                    },
                    source: { batchId: source.batchId, name: source.name },
                    quantity: request.quantity,
                    unit: source.unit,
                    state: 'pending',
                    availableAt: new Date(now).toISOString(),
                    dueAt: new Date(now + 86400000).toISOString(),
                    decisionAt: null,
                    version: 1,
                });
                const result = structuredClone(stored.workspace);
                state.mealPlan.replay[binding] = { input: fingerprint, result };
                return success(result);
            }
            const match = /^\/api\/v1\/portions\/([^/]+)\/decision$/.exec(path);
            if (!match) throw new Failure(404);
            const request = contracts['POST /api/v1/portions/{id}/decision'].request.parse(input);
            const binding = `${ownerKey}:portion:decision:${match[1]}:${request.idempotencyKey}`;
            const fingerprint = JSON.stringify(request);
            const replay = state.mealPlan.replay[binding];
            if (replay) return replay.input === fingerprint ? success(replay.result) : fail(409);
            const proposal = stored.workspace.proposals.find((item) => item.id === match[1]);
            if (!proposal) throw new Failure(404);
            if (proposal.recipient.userId !== userId) throw new Failure(403);
            if (proposal.version !== request.expectedVersion) throw new Failure(412);
            const allowed =
                (proposal.state === 'pending' && ['confirmed', 'refused'].includes(request.decision)) ||
                (proposal.state === 'auto_confirmed' && request.decision === 'cancelled');
            if (!allowed) throw new Failure(409);
            proposal.state = request.decision;
            proposal.decisionAt = new Date(now).toISOString();
            proposal.version++;
            syncDiaryPortions(state, userId, now, false);
            const result = structuredClone(stored.workspace);
            state.mealPlan.replay[binding] = { input: fingerprint, result };
            return success(result);
        }
        if (method === 'GET') {
            const selection = z
                .object({
                    scope: z.enum(['private', 'family']).default('private'),
                    view: z.enum(['day', 'week', 'range', 'calendar']).default('week'),
                    date: z.iso.date(),
                    endDate: z.iso.date().optional(),
                    timezone: z.string(),
                })
                .strict()
                .parse(Object.fromEntries(context.query));
            if (selection.view === 'range' && !smart) throw new Failure(403);
            if (selection.view === 'calendar' && !family.entitlement.capabilities.calendar) throw new Failure(403);
            return success(project(row, selectionOf(selection)));
        }
        if (state.inventory.blocked.includes(userId)) throw new Failure(403);
        if (path.endsWith('/change-preview') || path.endsWith('/change-commit')) {
            const commit = path.endsWith('/change-commit')
                ? contracts['POST /api/v1/meal-plan/change-commit'].request.parse(input)
                : null;
            const request = commit
                ? { version: commit.version, selection: commit.selection, mutation: commit.mutation }
                : contracts['POST /api/v1/meal-plan/change-preview'].request.parse(input);
            if (request.selection.view === 'range' && !smart) throw new Failure(403);
            if (request.selection.view === 'calendar' && !family.entitlement.capabilities.calendar)
                throw new Failure(403);
            const binding = commit ? `${userId}:change:${commit.idempotencyKey}` : null;
            const fingerprint = commit ? JSON.stringify(commit) : null;
            const replay = binding ? state.mealPlan.replay[binding] : null;
            if (replay) return replay.input === fingerprint ? success(replay.result) : fail(409);
            if (row.version !== request.version) throw new Failure(412);
            const changed = apply(state, row, request);
            const result = impact(state, ownerKey, changed.entries);
            const previewValue = { userId, ownerKey, version: row.version, request, result };
            if (path.endsWith('/change-preview')) {
                const preview = createPreview(previewValue, now);
                return success({
                    ...preview,
                    proposedEntry: changed.proposedEntry,
                    impact: result,
                });
            }
            if (!commit) throw new Failure(400);
            if (!validPreview(commit.previewToken, previewValue, now)) throw new Failure(409);
            row.entries = changed.entries;
            row.version++;
            row.revision++;
            row.timezone = commit.selection.timezone;
            const response = project(row, selectionOf(commit.selection));
            state.mealPlan.replay[binding!] = { input: fingerprint!, result: structuredClone(response) };
            return success(response);
        }
        if (path.endsWith('/automation-preview') || path.endsWith('/automation-commit')) {
            if (!smart) throw new Failure(403);
            const commit = path.endsWith('/automation-commit')
                ? contracts['POST /api/v1/meal-plan/automation-commit'].request.parse(input)
                : null;
            const request = commit
                ? { version: commit.version, selection: commit.selection, rule: commit.rule }
                : contracts['POST /api/v1/meal-plan/automation-preview'].request.parse(input);
            const binding = commit ? `${userId}:automation:${commit.idempotencyKey}` : null;
            const fingerprint = commit ? JSON.stringify(commit) : null;
            const replay = binding ? state.mealPlan.replay[binding] : null;
            if (replay) return replay.input === fingerprint ? success(replay.result) : fail(409);
            if (row.version !== request.version) throw new Failure(412);
            const dates = range(selectionOf(request.selection));
            if (request.rule.optimization && !family.entitlement.capabilities.calendar) throw new Failure(403);
            const requestedRecipes = [
                { recipeId: request.rule.recipeId, revisionId: request.rule.revisionId },
                ...(request.rule.optimization ? (request.rule.alternatives ?? []) : []),
            ];
            let recipes = requestedRecipes.map((reference) =>
                publicRecipeFixtures().find(
                    (candidate) => candidate.id === reference.recipeId && candidate.revisionId === reference.revisionId,
                ),
            );
            if (recipes.some((recipe) => !recipe)) throw new Failure(404);
            let optimization: PreviewOptimization = null;
            if (request.rule.optimization) {
                const target = state.nutrition.targets
                    .filter((row) => row.userId === userId && row.target.effectiveFrom <= dates.startsOn)
                    .sort((left, right) => right.target.effectiveFrom.localeCompare(left.target.effectiveFrom))[0]
                    ?.target.values;
                const assessed = (recipes as NonNullable<(typeof recipes)[number]>[]).map((recipe) => {
                    const required = recipe.ingredients.filter((line) => !line.optional);
                    const priced = required.map((line) => {
                        const price =
                            line.ingredientId && line.unit
                                ? priceFor(state, userId, line.ingredientId, line.unit, null)
                                : null;
                        return { line, price };
                    });
                    const priceComplete =
                        priced.length > 0 &&
                        priced.every(({ line, price }) => line.quantity !== null && price !== null);
                    const estimatedPriceMinor = priceComplete
                        ? Math.round(
                              priced.reduce(
                                  (sum, { line, price }) =>
                                      sum +
                                      (Number(line.quantity) * request.rule.portions * Number(price!.amountMinor)) /
                                          recipe.baseServings,
                                  0,
                              ),
                          )
                        : null;
                    const values = recipe.nutrition
                        ? [
                              recipe.nutrition.kcal,
                              recipe.nutrition.protein,
                              recipe.nutrition.fat,
                              recipe.nutrition.carbs,
                          ]
                        : [null, null, null, null];
                    const nutritionCompletenessPercent = values.filter((value) => value !== null).length * 25;
                    const pairs = recipe.nutrition
                        ? [
                              [recipe.nutrition.kcal, target?.energyKcal],
                              [recipe.nutrition.protein, target?.proteinG],
                              [recipe.nutrition.fat, target?.fatG],
                              [recipe.nutrition.carbs, target?.carbohydrateG],
                          ].filter(
                              (pair): pair is [string, string] =>
                                  typeof pair[0] === 'string' && typeof pair[1] === 'string' && Number(pair[1]) > 0,
                          )
                        : [];
                    const targetShare = request.rule.optimization!.targetMealSharePercent / 100;
                    const nutritionTargetDeviationPercent = pairs.length
                        ? Number(
                              (
                                  pairs.reduce(
                                      (sum, [actual, expected]) =>
                                          sum +
                                          Math.abs(
                                              Number(actual) * request.rule.portions - Number(expected) * targetShare,
                                          ) /
                                              (Number(expected) * targetShare),
                                      0,
                                  ) /
                                  pairs.length /
                                  0.01
                              ).toFixed(1),
                          )
                        : null;
                    const expiringIngredientCount = required.filter((line) =>
                        state.inventory.batches.some(
                            (row) =>
                                row.userId === ownerKey &&
                                !row.batch.archivedAt &&
                                row.batch.ingredientId === line.ingredientId &&
                                row.batch.unit === line.unit &&
                                row.batch.expiryOn !== null &&
                                row.batch.expiryOn <= dates.endsOn,
                        ),
                    ).length;
                    return {
                        recipe,
                        estimatedPriceMinor,
                        priceComplete,
                        nutritionCompletenessPercent,
                        nutritionTargetDeviationPercent,
                        expiringIngredientCount,
                    };
                });
                assessed.sort((left, right) => {
                    for (const priority of request.rule.optimization!.priorities) {
                        if (priority === 'expiry' && left.expiringIngredientCount !== right.expiringIngredientCount)
                            return right.expiringIngredientCount - left.expiringIngredientCount;
                        if (priority === 'nutrition') {
                            if (
                                left.nutritionTargetDeviationPercent !== null &&
                                right.nutritionTargetDeviationPercent !== null &&
                                left.nutritionTargetDeviationPercent !== right.nutritionTargetDeviationPercent
                            )
                                return left.nutritionTargetDeviationPercent - right.nutritionTargetDeviationPercent;
                            if (
                                left.nutritionTargetDeviationPercent === null &&
                                right.nutritionTargetDeviationPercent !== null
                            )
                                return 1;
                            if (
                                left.nutritionTargetDeviationPercent !== null &&
                                right.nutritionTargetDeviationPercent === null
                            )
                                return -1;
                            if (left.nutritionCompletenessPercent !== right.nutritionCompletenessPercent)
                                return right.nutritionCompletenessPercent - left.nutritionCompletenessPercent;
                        }
                        if (priority === 'budget') {
                            if (left.estimatedPriceMinor === null && right.estimatedPriceMinor !== null) return 1;
                            if (left.estimatedPriceMinor !== null && right.estimatedPriceMinor === null) return -1;
                            if (left.estimatedPriceMinor !== null && right.estimatedPriceMinor !== null) {
                                const leftOver = left.estimatedPriceMinor > request.rule.optimization!.maxBudgetMinor!;
                                const rightOver =
                                    right.estimatedPriceMinor > request.rule.optimization!.maxBudgetMinor!;
                                if (leftOver !== rightOver) return leftOver ? 1 : -1;
                                if (left.estimatedPriceMinor !== right.estimatedPriceMinor)
                                    return left.estimatedPriceMinor - right.estimatedPriceMinor;
                            }
                        }
                    }
                    return left.recipe.title.localeCompare(right.recipe.title, 'ru');
                });
                recipes = assessed.map((item) => item.recipe);
                const warnings = new Set<PreviewWarning>();
                if (assessed.some((item) => !item.priceComplete)) warnings.add('missing_prices');
                if (assessed.some((item) => item.nutritionCompletenessPercent < 100)) warnings.add('missing_nutrition');
                if (!target) warnings.add('missing_nutrition_target');
                optimization = {
                    mode: 'deterministic-v1',
                    priorities: request.rule.optimization.priorities,
                    candidates: assessed.map((item, index) => ({
                        recipeId: item.recipe.id,
                        revisionId: item.recipe.revisionId,
                        title: item.recipe.title,
                        rank: index + 1,
                        estimatedPriceMinor: item.estimatedPriceMinor,
                        priceComplete: item.priceComplete,
                        nutritionCompletenessPercent: item.nutritionCompletenessPercent,
                        nutritionTargetDeviationPercent: item.nutritionTargetDeviationPercent,
                        expiringIngredientCount: item.expiringIngredientCount,
                    })),
                    warnings: [...warnings],
                };
            }
            const entries = structuredClone(row.entries);
            const proposedEntries: Entry[] = [];
            const conflicts: Array<{ date: string; meal: Entry['meal']; existingEntryId: string; locked: boolean }> =
                [];
            const requestedAssignments =
                request.rule.assignments ??
                (requestedScope === 'private' ? [{ userId, portions: request.rule.portions }] : []);
            const allowedUsers =
                requestedScope === 'family' ? family.family!.members.map((member) => member.userId) : [userId];
            if (requestedAssignments.some((assignment) => !allowedUsers.includes(assignment.userId)))
                throw new Failure(422);
            const assignments = requestedAssignments.map((assignment) => ({
                ...assignment,
                displayName: state.users.find((candidate) => candidate.id === assignment.userId)?.name ?? 'Участник',
            }));
            let proposedIndex = 0;
            for (const date of weeklyDates(dates.startsOn, dates.endsOn, request.rule.weekdays)) {
                const existing = entries.find((entry) => entry.date === date && entry.meal === request.rule.meal);
                if (existing)
                    conflicts.push({
                        date,
                        meal: request.rule.meal,
                        existingEntryId: existing.id,
                        locked: existing.locked,
                    });
                else {
                    const recipe = recipes[proposedIndex % recipes.length]!;
                    proposedIndex++;
                    const entry = entrySchema.parse({
                        id: stableId({ ownerKey, automation: request.rule, date }),
                        date,
                        meal: request.rule.meal,
                        portions: request.rule.portions,
                        locked: false,
                        slotState: 'recipe',
                        note: null,
                        recipe: { id: recipe.id, revisionId: recipe.revisionId, title: recipe.title },
                        assignments,
                        version: 1,
                    });
                    proposedEntries.push(entry);
                    entries.push(entry);
                }
            }
            entries.sort(
                (left, right) =>
                    left.date.localeCompare(right.date) ||
                    left.meal.localeCompare(right.meal) ||
                    left.id.localeCompare(right.id),
            );
            const calculated = impact(state, ownerKey, entries);
            const previewValue = {
                userId,
                ownerKey,
                version: row.version,
                request,
                proposed: proposedEntries.map((entry) => ({
                    id: entry.id,
                    revisionId: entry.recipe?.revisionId ?? null,
                })),
                conflicts,
                impact: calculated,
                optimization,
            };
            if (!commit) {
                const preview = createPreview(previewValue, now);
                return success({
                    ...preview,
                    occurrences: proposedEntries.length,
                    proposedEntries,
                    conflicts,
                    impact: calculated,
                    optimization,
                });
            }
            if (!validPreview(commit.previewToken, previewValue, now)) throw new Failure(409);
            if (!proposedEntries.length) throw new Failure(422);
            row.entries = entries;
            row.version++;
            row.revision++;
            row.timezone = request.selection.timezone;
            const response = project(row, selectionOf(request.selection));
            state.mealPlan.replay[binding!] = { input: fingerprint!, result: structuredClone(response) };
            return success(response);
        }
        if (!smart) throw new Failure(403);
        const commit = path.endsWith('/shopping-commit')
            ? contracts['POST /api/v1/meal-plan/shopping-commit'].request.parse(input)
            : null;
        const request = commit
            ? { version: commit.version, selection: commit.selection }
            : contracts['POST /api/v1/meal-plan/shopping-preview'].request.parse(input);
        if (request.selection.view === 'calendar' && !family.entitlement.capabilities.calendar) throw new Failure(403);
        const binding = commit ? `${userId}:shopping:${commit.idempotencyKey}` : null;
        const fingerprint = commit ? JSON.stringify(commit) : null;
        const replay = binding ? state.mealPlan.replay[binding] : null;
        if (replay) return replay.input === fingerprint ? success(replay.result) : fail(409);
        if (row.version !== request.version) throw new Failure(412);
        const dates = range(selectionOf(request.selection));
        const entries = row.entries.filter((entry) => entry.date >= dates.startsOn && entry.date <= dates.endsOn);
        const selected = new Set(entries.map((entry) => entry.id));
        const calculated = impact(state, ownerKey, row.entries);
        const selectedImpact = { ...calculated, items: calculated.items.filter((item) => selected.has(item.entryRef)) };
        const items = shoppingItems(selectedImpact);
        const previewValue = { userId, planId: row.id, version: row.version, request, items };
        if (path.endsWith('/shopping-preview')) {
            const preview = createPreview(previewValue, now);
            return success({
                ...preview,
                items,
                estimatedPriceMinor: null,
                priceComplete: false,
            });
        }
        if (!commit) throw new Failure(400);
        if (!validPreview(commit.previewToken, previewValue, now)) throw new Failure(409);
        if (!items.length) throw new Failure(422);
        const listId = crypto.randomUUID();
        const list = contracts['GET /api/v1/shopping-lists/{id}'].success.shape.data.parse({
            id: listId,
            title: commit.title,
            version: 1,
            status: 'active',
            createdAt: new Date(now).toISOString(),
            items: items.map((item, position) => ({
                id: crypto.randomUUID(),
                version: 1,
                name: item.name,
                quantity: item.quantity,
                unit: item.unit,
                ingredientId: item.ingredientId,
                productId: null,
                allowAnalog: true,
                status: 'pending',
                position,
                manual: false,
                requirements: { needsQuantityCheck: item.needsQuantityCheck },
                estimatedPriceMinor: null,
                recipeOrigin: item.entryIds.flatMap((entryId) => {
                    const entry = row.entries.find((candidate) => candidate.id === entryId);
                    const lines = selectedImpact.items.filter(
                        (candidate) =>
                            candidate.entryRef === entryId &&
                            candidate.ingredientId === item.ingredientId &&
                            candidate.unit === item.unit,
                    );
                    return entry?.recipe
                        ? lines
                              .filter((line) => line.missingQuantity !== '0')
                              .map((line) => ({
                                  revisionId: entry.recipe!.revisionId,
                                  portions: entry.portions,
                                  quantity: line.missingQuantity,
                              }))
                        : [];
                }),
                origin: [],
                allocatedQuantity: null,
            })),
        });
        state.cookingWorkflow.lists.push({ userId: ownerKey, list });
        const response = { listId };
        state.mealPlan.replay[binding!] = { input: fingerprint!, result: response };
        return success(response);
    } catch (error) {
        if (error instanceof z.ZodError) return fail(400);
        if (error instanceof Failure) return fail(error.status);
        throw error;
    }
}
