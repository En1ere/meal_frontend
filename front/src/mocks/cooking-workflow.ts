import { z } from 'zod';
import usersFixture from '../../contracts/dev-users.json' with { type: 'json' };
import { contracts } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';
import { publicRecipeFixtures, type RecipeFixture } from './recipe-fixtures.js';
import { seedInventoryFixtures } from './inventory.js';
import { seedPreserveFixtures, preserveStockSnapshot } from './preserves.js';
import { recipeAvailability } from './recipe-domain.js';
import {
    cookingReminderSchedule,
    cookingNotificationTime,
    cookingArchiveHiddenAt,
} from './cooking-lifecycle-domain.js';
const attemptSchema = contracts['GET /api/v1/cooking-attempts/{id}'].success.shape.data.extend({
    archivedAt: z.iso.datetime().nullable().default(null),
    hideAfter: z.iso.datetime().nullable().default(null),
});
const reminderPreferencesSchema = z.object({
    enabled: z.boolean(),
    timezone: z.string().nullable(),
    quietHours: z.object({ start: z.literal('22:00'), end: z.literal('09:00') }),
});
const reminderSchema = z.object({
    id: z.uuid(),
    attemptId: z.uuid(),
    sequence: z.union([z.literal(1), z.literal(2)]),
    availableAt: z.iso.datetime(),
});
const stockSchema = contracts['GET /api/v1/cooking-attempts/stock-options'].success.shape.data.shape.items.element;
const listSchema = contracts['GET /api/v1/shopping-lists/{id}'].success.shape.data;
const recipeSchema = contracts['GET /api/v1/recipes/{id}'].success.shape.data.shape.recipe;
const preparedSchema = stockSchema.extend({
    portionQuantity: z.string().nullable(),
    fullServings: z.string().nullable(),
    expiryOn: z.string().nullable(),
    precision: z.enum(['exact', 'estimated']),
    createdAt: z.iso.datetime(),
});
export const cookingWorkflowStateSchema = z.object({
    reminderPreferences: z.record(z.string(), reminderPreferencesSchema).default({}),
    reminders: z.array(reminderSchema.extend({ userId: z.uuid() })).default([]),
    attempts: z.array(z.object({ userId: z.uuid(), attempt: attemptSchema, recipe: recipeSchema })),
    prepared: z.array(z.object({ userId: z.uuid(), batch: preparedSchema })),
    lists: z.array(z.object({ userId: z.uuid(), list: listSchema })),
    replay: z.record(z.string(), z.object({ hash: z.string(), data: z.unknown() })),
});
export type CookingWorkflowState = z.infer<typeof cookingWorkflowStateSchema>;
export const createCookingWorkflowState = (): CookingWorkflowState => ({
    reminderPreferences: {},
    reminders: [],
    attempts: [],
    prepared: [],
    lists: [],
    replay: {},
});
type Context = {
    state: MockState;
    userId: string | null;
    path: string;
    params: Record<string, string>;
    method: string;
    query: URLSearchParams;
    input: unknown;
    now: number;
    success: (data: unknown) => Response;
    fail: (status: number, code?: string) => Response;
    resolveRecipe?: (id: string) => RecipeFixture | null;
};
class Failure extends Error {
    constructor(readonly status: number) {
        super(String(status));
    }
}
const amount = (v: string) => {
    const [a = '0', b = ''] = v.split('.');
    return BigInt(a) * 100000000n + BigInt(b.padEnd(8, '0'));
};
const text = (v: bigint) =>
    `${v / 100000000n}${v % 100000000n ? '.' + (v % 100000000n).toString().padStart(8, '0').replace(/0+$/, '') : ''}`;
const defaultReminderPreferences = (userId: string) => ({
    enabled: true,
    timezone: usersFixture.users.some((user) => user.id === userId) ? 'Europe/Moscow' : null,
    quietHours: { start: '22:00' as const, end: '09:00' as const },
});
export function reconcileCookingMockLifecycle(state: CookingWorkflowState, userId: string, now: number) {
    const preferences = state.reminderPreferences[userId] ?? defaultReminderPreferences(userId);
    let nextDeliveryAt: string | undefined;
    for (const row of state.attempts) {
        const attempt = row.attempt;
        if (row.userId !== userId || !['active', 'paused'].includes(attempt.status)) continue;
        const schedule = cookingReminderSchedule(attempt.startedAt);
        if (Date.parse(schedule.archiveAt) <= now) {
            attempt.status = 'archived';
            attempt.archivedAt = schedule.archiveAt;
            attempt.hideAfter = cookingArchiveHiddenAt(schedule.archiveAt);
            attempt.version++;
            for (const step of attempt.steps) {
                step.timerDeadline = null;
                step.timerPausedSeconds = null;
            }
            continue;
        }
        if (!preferences.enabled || !preferences.timezone) continue;
        for (const [index, due] of [schedule.firstReminderAt, schedule.secondReminderAt].entries()) {
            const sequence = index === 0 ? 1 : 2;
            if (
                Date.parse(due) > now ||
                state.reminders.some(
                    (r) => r.userId === userId && r.attemptId === attempt.id && r.sequence === sequence,
                )
            )
                continue;
            const availableAt = (nextDeliveryAt ??= cookingNotificationTime(now, preferences.timezone));
            if (Date.parse(availableAt) >= Date.parse(schedule.archiveAt)) continue;
            state.reminders.push({ id: crypto.randomUUID(), attemptId: attempt.id, sequence, availableAt, userId });
        }
    }
}
export function handleCookingWorkflow(c: Context): Response | null {
    const { state, userId, path, params, method, query, input, now, success, fail } = c;
    const statistics = path.endsWith('/cooking-statistics');
    if (!path.startsWith('/api/v1/cooking-attempts') && !path.startsWith('/api/v1/shopping-lists') && !statistics)
        return null;
    const recipes = publicRecipeFixtures();
    const visibleRecipe = (id: string) =>
        c.resolveRecipe
            ? c.resolveRecipe(id)
            : state.recipeWorkspace.hidden.includes(id)
              ? null
              : (recipes.find((r) => r.id === id) ?? null);
    try {
        if (statistics) {
            const parsed = z
                .object({ servings: z.coerce.number().int().min(1).max(1000) })
                .strict()
                .parse(Object.fromEntries(query));
            const recipe = visibleRecipe(params.id!);
            if (!recipes.some((r) => r.id === recipe?.id && r.revisionId === recipe.revisionId)) throw new Failure(404);
            if (!recipe) throw new Failure(404);
            const values = state.cookingWorkflow.attempts
                .filter(
                    (r) =>
                        r.attempt.revisionId === recipe.revisionId &&
                        r.attempt.servings === parsed.servings &&
                        r.recipe.method === recipe.method &&
                        r.attempt.status === 'completed' &&
                        r.attempt.completedAt &&
                        r.attempt.confirmedDuration !== null &&
                        r.attempt.steps.every((s) => s.status === 'completed'),
                )
                .map((r) => r.attempt.confirmedDuration!)
                .sort((a, b) => a - b);
            const percentile = (p: number) => {
                if (values.length < 3) return null;
                const i = (values.length - 1) * p;
                return values[Math.floor(i)]! + (values[Math.ceil(i)]! - values[Math.floor(i)]!) * (i % 1);
            };
            return success({
                recipeId: recipe.id,
                revisionId: recipe.revisionId,
                servings: parsed.servings,
                sampleSize: values.length,
                medianSeconds: percentile(0.5),
                lowerQuartileSeconds: percentile(0.25),
                upperQuartileSeconds: percentile(0.75),
                outlierPolicy: 'pending-calibration',
            });
        }
        if (!userId) throw new Failure(401);
        seedInventoryFixtures(state.inventory, userId, now);
        seedPreserveFixtures(state, userId, now);
        if (method !== 'GET' && state.inventory.blocked.includes(userId)) throw new Failure(403);
        reconcileCookingMockLifecycle(state.cookingWorkflow, userId, now);
        const data = structuredClone(state.cookingWorkflow);
        const inventory = structuredClone(state.inventory);
        const preserves = structuredClone(state.preserves);
        const audit = (batch: {
            id: string;
            name: string;
            quantity: string | null;
            unit: string | null;
            version: number;
            locationId: string | null;
            ingredientId: string | null;
        }) => {
            const all = {
                openedAt: null,
                purchasedOn: null,
                expiryOn: null,
                packageState: 'opened',
                precision: 'estimated',
                quantitySource: 'recipe',
                confidence: null,
                pricePaidRub: null,
                storeName: null,
                barcode: null,
                scope: 'private',
                archivedAt: null,
                createdAt: new Date(now).toISOString(),
                ...batch,
            };
            return Object.fromEntries(
                [
                    'id',
                    'name',
                    'quantity',
                    'unit',
                    'version',
                    'locationId',
                    'ingredientId',
                    'openedAt',
                    'purchasedOn',
                    'expiryOn',
                    'packageState',
                    'precision',
                    'quantitySource',
                    'confidence',
                    'pricePaidRub',
                    'storeName',
                    'barcode',
                    'scope',
                    'archivedAt',
                    'createdAt',
                ].map((key) => [key, (all as Record<string, unknown>)[key]]),
            );
        };
        const movement = (before: unknown, after: unknown, quantityDelta: string) =>
            inventory.history.push({
                userId,
                movement: contracts['GET /api/v1/inventory-history'].success.shape.data.shape.items.element.parse({
                    id: crypto.randomUUID(),
                    action: 'cooking',
                    quantityDelta,
                    recordedAt: new Date(now).toISOString(),
                    effectiveAt: new Date(now).toISOString(),
                    actorId: userId,
                    before,
                    after,
                }),
            });
        const stocks = () =>
            [
                ...preserves.items
                    .filter(
                        (r) =>
                            r.userId === userId &&
                            !r.preserve.archivedAt &&
                            (r.preserve.quantity === null || amount(r.preserve.quantity) > 0n),
                    )
                    .map(({ preserve: p, batchVersion }) => ({
                        id: p.batchId,
                        name: p.name,
                        kind: 'preserve' as const,
                        quantity: p.quantity,
                        unit: p.unit,
                        version: batchVersion,
                        locationId: p.locationId,
                        ingredientId: null,
                        sourceRecipeId: p.recipeId,
                        preserveId: p.id,
                        containers: p.containers.map((j) => ({
                            id: j.id,
                            label: j.label,
                            quantity: j.remainingQuantity,
                            version: j.version,
                        })),
                    })),
                ...inventory.batches
                    .filter(
                        (r) =>
                            r.userId === userId &&
                            !r.batch.archivedAt &&
                            (r.batch.quantity === null || amount(r.batch.quantity) > 0n),
                    )
                    .map(({ batch }) => ({
                        id: batch.id,
                        name: batch.name,
                        kind: 'ingredient' as const,
                        quantity: batch.quantity,
                        unit: batch.unit,
                        version: batch.version,
                        locationId: batch.locationId,
                        ingredientId: batch.ingredientId,
                        sourceRecipeId: null,
                    })),
                ...data.prepared
                    .filter((r) => r.userId === userId && (r.batch.quantity === null || amount(r.batch.quantity) > 0n))
                    .map(({ batch }) => ({
                        id: batch.id,
                        name: batch.name,
                        kind: batch.kind,
                        quantity: batch.quantity,
                        unit: batch.unit,
                        version: batch.version,
                        locationId: batch.locationId,
                        ingredientId: batch.ingredientId,
                        sourceRecipeId: batch.sourceRecipeId,
                    })),
            ].slice(0, 1000);
        const replay = (target: string, body: { idempotencyKey: string }, work: () => unknown) => {
            const key = `${userId}:${path}:${target}:${body.idempotencyKey}`;
            const hash = JSON.stringify(body),
                prior = data.replay[key];
            if (prior) {
                if (prior.hash !== hash) throw new Failure(409);
                return prior.data;
            }
            const result = work();
            data.replay[key] = { hash, data: structuredClone(result) };
            state.cookingWorkflow = data;
            state.inventory = inventory;
            state.preserves = preserves;
            return result;
        };
        const getAttempt = () => {
            const row = data.attempts.find((r) => r.userId === userId && r.attempt.id === params.id);
            if (!row) throw new Failure(404);
            return row;
        };
        if (path === '/api/v1/cooking-attempts/reminder-preferences') {
            if (method === 'GET')
                return success(data.reminderPreferences[userId] ?? defaultReminderPreferences(userId));
            const body = contracts['POST /api/v1/cooking-attempts/reminder-preferences'].request.parse(input);
            if (body.timezone) {
                try {
                    new Intl.DateTimeFormat('en', { timeZone: body.timezone });
                } catch {
                    throw new Failure(400);
                }
            }
            return success(
                replay(userId, body, () => {
                    const previous = data.reminderPreferences[userId] ?? defaultReminderPreferences(userId);
                    const timezone = body.timezone ?? previous.timezone;
                    if (!timezone) throw new Failure(422);
                    const result = {
                        enabled: body.enabled,
                        timezone,
                        quietHours: { start: '22:00' as const, end: '09:00' as const },
                    };
                    data.reminderPreferences[userId] = result;
                    for (const reminder of data.reminders) {
                        if (reminder.userId === userId && Date.parse(reminder.availableAt) > now) {
                            reminder.availableAt = cookingNotificationTime(Date.parse(reminder.availableAt), timezone);
                        }
                    }
                    return result;
                }),
            );
        }
        if (path === '/api/v1/cooking-attempts/stock-options') return success({ items: stocks() });
        if (path === '/api/v1/cooking-attempts' && method === 'GET') {
            const { view } = z
                .object({ view: z.enum(['current', 'archive', 'all']).default('current') })
                .strict()
                .parse(Object.fromEntries(query));
            const preferences = data.reminderPreferences[userId] ?? defaultReminderPreferences(userId);
            return success({
                items: data.attempts
                    .filter(
                        (r) =>
                            r.userId === userId &&
                            (view === 'all' ||
                                (view === 'archive'
                                    ? r.attempt.status === 'archived'
                                    : r.attempt.status !== 'archived')) &&
                            (r.attempt.status !== 'archived' ||
                                (r.attempt.hideAfter !== null && Date.parse(r.attempt.hideAfter) > now)),
                    )
                    .map((r) => r.attempt)
                    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
                    .slice(0, 100),
                reminders: preferences.enabled
                    ? data.reminders
                          .filter(
                              (r) =>
                                  r.userId === userId &&
                                  Date.parse(r.availableAt) <= now &&
                                  data.attempts.some(
                                      (a) =>
                                          a.userId === userId &&
                                          a.attempt.id === r.attemptId &&
                                          ['active', 'paused'].includes(a.attempt.status),
                                  ),
                          )
                          .sort((a, b) => b.availableAt.localeCompare(a.availableAt) || a.id.localeCompare(b.id))
                          .slice(0, 100)
                          .map(({ id, attemptId, sequence, availableAt }) => ({ id, attemptId, sequence, availableAt }))
                    : [],
            });
        }
        if (path === '/api/v1/cooking-attempts' && method === 'POST') {
            const body = contracts['POST /api/v1/cooking-attempts'].request.parse(input);
            return success(
                replay('start', body, () => {
                    const recipe = visibleRecipe(body.recipeId);
                    if (!recipe || recipe.revisionId !== body.revisionId) throw new Failure(404);
                    const attempt = attemptSchema.parse({
                        id: crypto.randomUUID(),
                        recipeId: recipe.id,
                        revisionId: recipe.revisionId,
                        title: recipe.title,
                        servings: body.servings,
                        status: 'active',
                        version: 1,
                        startedAt: new Date(now).toISOString(),
                        completedAt: null,
                        confirmedDuration: null,
                        privateNote: null,
                        outputBatchIds: [],
                        steps: recipe.steps.map((s) => ({
                            position: s.position,
                            text: s.text,
                            durationSeconds: s.durationSeconds,
                            status: 'pending',
                            privateNote: null,
                            timerDeadline: null,
                            timerPausedSeconds: null,
                        })),
                    });
                    data.attempts.push({ userId, attempt, recipe: structuredClone(recipe) });
                    return attempt;
                }),
            );
        }
        if (path.startsWith('/api/v1/cooking-attempts/') && method === 'GET') return success(getAttempt().attempt);
        if (path.endsWith('/progress')) {
            const body = contracts['POST /api/v1/cooking-attempts/{id}/progress'].request.parse(input);
            return success(
                replay(params.id!, body, () => {
                    const attempt = getAttempt().attempt;
                    const actionAt = Date.parse(body.occurredAt);
                    if (actionAt > now + 5 * 60_000 || actionAt < now - 30 * 86_400_000) throw new Failure(422);
                    if (attempt.version !== body.version) throw new Failure(412);
                    if (!['active', 'paused'].includes(attempt.status)) throw new Failure(409);
                    if (new Set(body.steps.map((s) => s.position)).size !== body.steps.length) throw new Failure(422);
                    for (const step of body.steps) {
                        const existing = attempt.steps.find((s) => s.position === step.position);
                        if (!existing) throw new Failure(422);
                        Object.assign(existing, step);
                    }
                    if (body.timer) {
                        const t = body.timer,
                            step = attempt.steps.find((s) => s.position === t.position);
                        if (!step) throw new Failure(422);
                        const remaining = step.timerDeadline
                            ? Math.max(0, Math.ceil((Date.parse(step.timerDeadline) - actionAt) / 1000))
                            : (step.timerPausedSeconds ?? 0);
                        if (t.action === 'start' || t.action === 'resume') {
                            const seconds =
                                t.action === 'resume' ? remaining : (t.seconds ?? step.durationSeconds ?? 0);
                            if (seconds <= 0) throw new Failure(422);
                            for (const other of attempt.steps) {
                                other.timerDeadline = null;
                                other.timerPausedSeconds = null;
                            }
                            step.timerDeadline = new Date(actionAt + seconds * 1000).toISOString();
                        } else if (t.action === 'pause') {
                            step.timerDeadline = null;
                            step.timerPausedSeconds = remaining;
                        } else if (t.action === 'reset') {
                            step.timerDeadline = null;
                            step.timerPausedSeconds = null;
                        } else {
                            const seconds = Math.max(0, remaining + (t.seconds ?? 0));
                            if (step.timerDeadline)
                                step.timerDeadline = new Date(actionAt + seconds * 1000).toISOString();
                            else step.timerPausedSeconds = seconds;
                        }
                    }
                    attempt.status = body.status;
                    attempt.version++;
                    if (body.status === 'cancelled')
                        for (const step of attempt.steps) {
                            step.timerDeadline = null;
                            step.timerPausedSeconds = null;
                        }
                    return attempt;
                }),
            );
        }
        if (path.endsWith('/finalize')) {
            const body = contracts['POST /api/v1/cooking-attempts/{id}/finalize'].request.parse(input);
            if (
                new Set(body.inputs.map((i) => `${i.batchId}:${i.containerId ?? ''}`)).size !== body.inputs.length ||
                (body.outcome === 'failed' ? body.outputs.length !== 0 : !body.outputs.length)
            )
                throw new Failure(400);
            return success(
                replay(params.id!, body, () => {
                    const attempt = getAttempt().attempt;
                    if (attempt.version !== body.version) throw new Failure(412);
                    if (!['active', 'paused'].includes(attempt.status)) throw new Failure(409);
                    const sourceVersions = new Map<string, number>();
                    for (const use of body.inputs) {
                        if (amount(use.quantity) <= 0n) throw new Failure(400);
                        const preserved = preserves.items.find(
                            (r) => r.userId === userId && r.preserve.batchId === use.batchId && !r.preserve.archivedAt,
                        );
                        if (preserved) {
                            const p = preserved.preserve;
                            const originalVersion = sourceVersions.get(p.batchId) ?? preserved.batchVersion;
                            if (originalVersion !== use.version) throw new Failure(412);
                            sourceVersions.set(p.batchId, originalVersion);
                            if (!use.containerId || use.containerVersion === undefined) throw new Failure(422);
                            const jar = p.containers.find((j) => j.id === use.containerId);
                            if (!jar) throw new Failure(404);
                            if (jar.version !== use.containerVersion) throw new Failure(412);
                            if (jar.remainingQuantity === null) throw new Failure(409);
                            const remaining = amount(jar.remainingQuantity) - amount(use.quantity);
                            if (remaining < 0n) throw new Failure(422);
                            const before = preserveStockSnapshot(p, preserved.batchVersion);
                            const containerBefore = jar.remainingQuantity;
                            jar.remainingQuantity = text(remaining);
                            jar.depletedAt = remaining === 0n ? new Date(now).toISOString() : null;
                            jar.version++;
                            p.quantity = p.containers.some((j) => j.remainingQuantity === null)
                                ? null
                                : text(p.containers.reduce((sum, j) => sum + amount(j.remainingQuantity!), 0n));
                            p.version++;
                            preserved.batchVersion++;
                            movement(before, preserveStockSnapshot(p, preserved.batchVersion), `-${use.quantity}`);
                            preserves.history.push({
                                userId,
                                preserveId: p.id,
                                event: {
                                    id: crypto.randomUUID(),
                                    action: 'preserve.cooking-consumed',
                                    recordedAt: new Date(now).toISOString(),
                                    details: {
                                        containerId: jar.id,
                                        quantity: use.quantity,
                                        before: containerBefore,
                                        after: jar.remainingQuantity,
                                    },
                                },
                            });
                            continue;
                        }
                        if (use.containerId || use.containerVersion !== undefined) throw new Failure(422);
                        const batch =
                            inventory.batches.find(
                                (r) => r.userId === userId && r.batch.id === use.batchId && !r.batch.archivedAt,
                            )?.batch ??
                            data.prepared.find((r) => r.userId === userId && r.batch.id === use.batchId)?.batch;
                        if (!batch) throw new Failure(404);
                        if (batch.version !== use.version) throw new Failure(412);
                        if (batch.quantity === null) throw new Failure(409);
                        const remaining = amount(batch.quantity) - amount(use.quantity);
                        if (remaining < 0n) throw new Failure(422);
                        const before = structuredClone(audit(batch));
                        batch.quantity = text(remaining);
                        batch.version++;
                        movement(before, audit(batch), `-${use.quantity}`);
                    }
                    for (const output of body.outputs) {
                        if (
                            amount(output.quantity) <= 0n ||
                            (output.portionQuantity !== null && amount(output.portionQuantity) <= 0n)
                        )
                            throw new Failure(400);
                        if (
                            !['g', 'kg', 'ml', 'l', 'pcs', 'pack', 'serv'].includes(output.unit) ||
                            !inventory.locations.some((r) => r.userId === userId && r.location.id === output.locationId)
                        )
                            throw new Failure(422);
                        const batch = preparedSchema.parse({
                            id: crypto.randomUUID(),
                            name: output.name,
                            kind: 'prepared',
                            quantity: output.quantity,
                            unit: output.unit,
                            version: 1,
                            locationId: output.locationId,
                            ingredientId: null,
                            sourceRecipeId: attempt.recipeId,
                            portionQuantity: output.portionQuantity,
                            fullServings: output.portionQuantity
                                ? (amount(output.quantity) / amount(output.portionQuantity)).toString()
                                : null,
                            expiryOn: output.expiryOn,
                            precision: output.precision,
                            createdAt: new Date(now).toISOString(),
                        });
                        data.prepared.push({ userId, batch });
                        movement(null, audit(batch), output.quantity);
                        attempt.outputBatchIds.push(batch.id);
                    }
                    attempt.status = body.outcome;
                    attempt.completedAt = new Date(now).toISOString();
                    attempt.confirmedDuration = body.confirmedDuration;
                    attempt.privateNote = body.privateNote;
                    attempt.version++;
                    for (const step of attempt.steps) {
                        step.timerDeadline = null;
                        step.timerPausedSeconds = null;
                    }
                    return attempt;
                }),
            );
        }
        if (path === '/api/v1/shopping-lists/recipe-preview') {
            const parsed = z
                .object({
                    recipeId: z.uuid(),
                    servings: z.coerce.number().int().min(1).max(1000),
                    scope: z.enum(['private', 'family']).default('private'),
                })
                .strict()
                .parse(Object.fromEntries(query));
            const recipe = visibleRecipe(parsed.recipeId);
            if (!recipes.some((r) => r.id === recipe?.id && r.revisionId === recipe.revisionId)) throw new Failure(404);
            if (!recipe) throw new Failure(404);
            const available = recipeAvailability(
                recipe.ingredients,
                stocks().map((s) => ({ ...s, variantId: null, productId: null })),
                recipe.baseServings,
                parsed.servings,
            );
            return success({
                recipeId: parsed.recipeId,
                servings: parsed.servings,
                items: recipe.ingredients.flatMap((line) => {
                    const row = available.items.find((i) => i.id === line.id)!;
                    if (line.optional) return [];
                    let quantity: string | null = null;
                    if (row.requiredQuantity !== null && row.availableQuantity !== null) {
                        const missing = amount(row.requiredQuantity) - amount(row.availableQuantity);
                        if (missing <= 0n) return [];
                        quantity = text(missing);
                    } else if (!row.present) quantity = row.requiredQuantity;
                    else if (!row.needsQuantityCheck) return [];
                    return [
                        {
                            name: line.name,
                            quantity,
                            unit: line.unit,
                            ingredientId: line.ingredientId,
                            productId: line.productId,
                            allowAnalog: line.productId === null,
                            requirements: {},
                            estimatedPriceMinor: null,
                            needsQuantityCheck: row.needsQuantityCheck,
                            recipeOrigin: [{ revisionId: recipe.revisionId, portions: parsed.servings, quantity }],
                        },
                    ];
                }),
            });
        }
        return null;
    } catch (error) {
        if (error instanceof Failure) return fail(error.status);
        if (error instanceof z.ZodError) return fail(400);
        throw error;
    }
}
