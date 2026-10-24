import { z } from 'zod';
import { contracts } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';
import { seedInventoryFixtures } from './inventory.js';
import { publicRecipeFixtures } from './recipe-fixtures.js';
import { mockPersonalSubscription } from './subscription.js';

const entrySchema = contracts['GET /api/v1/diary'].success.shape.data.shape.items.element;
const replaySchema = z.strictObject({ hash: z.string(), data: z.unknown() });
export const diaryStateSchema = z.strictObject({
    entries: z.array(z.strictObject({ userId: z.uuid(), entry: entrySchema })),
    replay: z.record(z.string(), replaySchema),
});
export type DiaryState = z.infer<typeof diaryStateSchema>;
export const createDiaryState = (): DiaryState => ({ entries: [], replay: {} });

type Context = {
    state: MockState;
    userId: string | null;
    path: string;
    method: string;
    query: URLSearchParams;
    params: Record<string, string>;
    input: unknown;
    ifMatch: string | null;
    now: number;
    success: (data: unknown) => Response;
    fail: (status: number, code?: string) => Response;
};

const unknownNutrition = () => ({
    energyKcal: null,
    proteinG: null,
    fatG: null,
    carbohydrateG: null,
    fiberG: null,
});
const decimal = (value: string) => {
    const [whole, fraction = ''] = value.split('.');
    return BigInt(whole ?? '0') * 100000000n + BigInt(fraction.padEnd(8, '0'));
};
const decimalText = (value: bigint) => {
    const fraction = (value % 100000000n).toString().padStart(8, '0').replace(/0+$/, '');
    return `${value / 100000000n}${fraction ? `.${fraction}` : ''}`;
};
const hash = (value: unknown) => JSON.stringify(value);
const localDate = (value: string) => {
    const date = new Date(value);
    const pad = (part: number) => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

function ensurePortionEntry(
    state: MockState,
    userId: string,
    proposal: MockState['mealPlan']['portions'][number]['workspace']['proposals'][number],
    method: 'manual' | 'timeout',
    now: number,
) {
    if (state.diary.entries.some((row) => row.entry.proposalId === proposal.id)) return;
    state.diary.entries.push({
        userId,
        entry: entrySchema.parse({
            id: crypto.randomUUID(),
            eatenAt: proposal.availableAt,
            meal: 'other',
            state: 'confirmed',
            confirmationMethod: method,
            proposalId: proposal.id,
            note: null,
            nutrition: unknownNutrition(),
            completeness: 'unknown',
            components: [
                {
                    id: crypto.randomUUID(),
                    source: {
                        type: 'portion_proposal',
                        id: proposal.id,
                        name: proposal.source.name,
                        scope: 'private',
                    },
                    quantity: proposal.quantity,
                    unit: proposal.unit,
                    nutrition: unknownNutrition(),
                    completeness: 'unknown',
                    confidence: 'unconfirmed',
                },
            ],
            version: 1,
            createdAt: new Date(now).toISOString(),
        }),
    });
}

export function syncDiaryPortions(
    state: MockState,
    userId: string,
    now: number,
    syncDiary = true,
    eligibleBefore?: number | null,
) {
    for (const stored of state.mealPlan.portions) {
        for (const proposal of stored.workspace.proposals) {
            if (proposal.recipient.userId !== userId) continue;
            if (proposal.state === 'pending' && Date.parse(proposal.dueAt) <= now) {
                proposal.state = 'auto_confirmed';
                proposal.decisionAt = proposal.dueAt;
                proposal.version++;
            }
            const eligible =
                syncDiary &&
                (eligibleBefore === undefined ||
                    (eligibleBefore !== null && Date.parse(proposal.availableAt) <= eligibleBefore));
            if (eligible && proposal.state === 'auto_confirmed')
                ensurePortionEntry(state, userId, proposal, 'timeout', now);
            if (eligible && proposal.state === 'confirmed') ensurePortionEntry(state, userId, proposal, 'manual', now);
            if (eligible && proposal.state === 'cancelled') {
                const row = state.diary.entries.find((candidate) => candidate.entry.proposalId === proposal.id);
                if (row && row.entry.state !== 'archived') {
                    row.entry.state = 'archived';
                    row.entry.version++;
                }
            }
        }
    }
}

const proposalView = (
    proposal: MockState['mealPlan']['portions'][number]['workspace']['proposals'][number],
    active: boolean,
) => ({
    id: proposal.id,
    source: proposal.source,
    quantity: proposal.quantity,
    unit: proposal.unit,
    state: proposal.state,
    confirmationMethod:
        proposal.state === 'auto_confirmed'
            ? ('timeout' as const)
            : proposal.state === 'confirmed'
              ? ('manual' as const)
              : proposal.state === 'refused'
                ? ('refused' as const)
                : proposal.state === 'cancelled'
                  ? ('cancelled' as const)
                  : null,
    availableAt: proposal.availableAt,
    dueAt: proposal.dueAt,
    decisionAt: proposal.decisionAt,
    version: proposal.version,
    actions: {
        canConfirm: active && proposal.state === 'pending',
        canRefuse: active && proposal.state === 'pending',
        canCancel: proposal.state === 'auto_confirmed',
    },
});

export function mockDiaryAccess(state: MockState, userId: string, now: number) {
    const personal = mockPersonalSubscription(state, userId, now);
    const family = state.family.families.find(
        (candidate) =>
            !candidate.archived &&
            candidate.members.some((member) => member.userId === userId && member.leftAt === null),
    );
    const familyPro = family?.plan === 'pro';
    if (personal.plan === 'pro' || familyPro)
        return {
            mode: 'active' as const,
            reason: null,
            source: familyPro ? ('family' as const) : personal.source,
            periodEndsAt: familyPro ? family.periodEndsAt : personal.periodEndsAt,
        };
    const historical =
        state.subscription.trialHistory.includes(userId) ||
        state.diary.entries.some((row) => row.userId === userId) ||
        state.nutrition.profiles.some((row) => row.userId === userId);
    if (!historical) return null;
    return {
        mode: 'read_only' as const,
        reason: 'pro_expired' as const,
        source: 'history' as const,
        periodEndsAt: state.subscription.records.find((record) => record.userId === userId)?.endsAt ?? null,
    };
}

export function diaryHandle(context: Context): Response | null {
    const { state, userId, path, method, query, params, input, ifMatch, now, success, fail } = context;
    if (
        path !== '/api/v1/diary' &&
        path !== '/api/v1/diary/sources' &&
        !/^\/api\/v1\/diary\/[^/]+(?:\/archive|\/media)?$/.test(path) &&
        !/^\/api\/v1\/diary\/portions\/[^/]+\/decision$/.test(path)
    )
        return null;
    if (!userId) return fail(401);
    const access = mockDiaryAccess(state, userId, now);
    if (!access) return fail(403, 'PRO_REQUIRED');
    const eligibleBefore =
        access.mode === 'read_only' ? (access.periodEndsAt ? Date.parse(access.periodEndsAt) : null) : undefined;
    syncDiaryPortions(state, userId, now, true, eligibleBefore);
    const portionDecision = /^\/api\/v1\/diary\/portions\/([^/]+)\/decision$/.exec(path);
    const cancellation = portionDecision && (input as { decision?: unknown } | null)?.decision === 'cancelled';
    if (method !== 'GET' && access.mode !== 'active' && !cancellation) return fail(403, 'PRO_READ_ONLY');

    if (path === '/api/v1/diary' && method === 'GET') {
        const date = query.get('date');
        if (!date || !z.iso.date().safeParse(date).success) return fail(400);
        const items = state.diary.entries
            .filter((row) => row.userId === userId && localDate(row.entry.eatenAt) === date)
            .map((row) => row.entry)
            .sort((left, right) => left.eatenAt.localeCompare(right.eatenAt));
        const active = items.filter((entry) => entry.state !== 'archived');
        const proposals = state.mealPlan.portions
            .flatMap((row) => row.workspace.proposals)
            .filter(
                (proposal) =>
                    proposal.recipient.userId === userId &&
                    (access.mode === 'active' ||
                        state.diary.entries.some((row) => row.entry.proposalId === proposal.id) ||
                        (eligibleBefore !== null &&
                            eligibleBefore !== undefined &&
                            Date.parse(proposal.availableAt) <= eligibleBefore)),
            )
            .map((proposal) => proposalView(proposal, access.mode === 'active'));
        return success({
            access,
            date,
            items,
            proposals,
            media: {
                mode: 'unavailable',
                reason: 'Object storage, KMS и malware scanner ещё не подключены',
                acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
                maxBytes: 10 * 1024 * 1024,
            },
            summary: { entryCount: active.length, nutrition: unknownNutrition(), completeness: 'unknown' },
        });
    }

    if (portionDecision && method === 'POST') {
        const value = contracts['POST /api/v1/diary/portions/{id}/decision'].request.safeParse(input);
        if (!value.success) return fail(400);
        const replayKey = `${userId}:${portionDecision[1]}:${value.data.idempotencyKey}`;
        const replayed = state.diary.replay[replayKey];
        if (replayed) return replayed.hash === hash(value.data) ? success(replayed.data) : fail(409);
        const proposal = state.mealPlan.portions
            .flatMap((row) => row.workspace.proposals)
            .find((item) => item.id === portionDecision[1] && item.recipient.userId === userId);
        if (!proposal) return fail(404);
        if (!ifMatch) return fail(428);
        if (ifMatch !== `"${proposal.version}"` || proposal.version !== value.data.expectedVersion) return fail(412);
        const allowed =
            (proposal.state === 'pending' && ['confirmed', 'refused'].includes(value.data.decision)) ||
            (proposal.state === 'auto_confirmed' && value.data.decision === 'cancelled');
        if (!allowed) return fail(409);
        proposal.state = value.data.decision;
        proposal.decisionAt = new Date(now).toISOString();
        proposal.version++;
        syncDiaryPortions(state, userId, now);
        const data = { proposal: proposalView(proposal, access.mode === 'active') };
        state.diary.replay[replayKey] = { hash: hash(value.data), data };
        return success(data);
    }

    if (path === '/api/v1/diary/sources' && method === 'GET') {
        const type = query.get('type');
        const q = (query.get('q') ?? '').toLocaleLowerCase('ru');
        const limit = Math.min(50, Math.max(1, Number(query.get('limit') ?? 20)));
        if (type === 'inventory_batch') {
            seedInventoryFixtures(state.inventory, userId, now);
            return success({
                items: state.inventory.batches
                    .filter(
                        (row) =>
                            row.userId === userId &&
                            !row.batch.archivedAt &&
                            row.batch.name.toLocaleLowerCase('ru').includes(q),
                    )
                    .slice(0, limit)
                    .map(({ batch }) => ({
                        type,
                        id: batch.id,
                        name: batch.name,
                        unit: batch.unit,
                        availableQuantity: batch.quantity,
                        version: batch.version,
                        scope: 'private',
                    })),
            });
        }
        if (type === 'ingredient') {
            const ingredients = [
                ['10000000-0000-4000-8000-000000000001', 'Молоко', 'ml'],
                ['10000000-0000-4000-8000-000000000002', 'Яблоки', 'g'],
                ['10000000-0000-4000-8000-000000000003', 'Рис', 'g'],
            ];
            return success({
                items: ingredients
                    .filter(([, name]) => name!.toLocaleLowerCase('ru').includes(q))
                    .slice(0, limit)
                    .map(([id, name, unit]) => ({
                        type,
                        id,
                        name,
                        unit,
                        availableQuantity: null,
                        version: null,
                        scope: 'catalog',
                    })),
            });
        }
        if (type === 'recipe') {
            return success({
                items: publicRecipeFixtures()
                    .filter((recipe) => recipe.title.toLocaleLowerCase('ru').includes(q))
                    .slice(0, limit)
                    .map((recipe) => ({
                        type,
                        id: recipe.id,
                        name: recipe.title,
                        unit: 'serv',
                        availableQuantity: null,
                        version: null,
                        scope: 'public',
                    })),
            });
        }
        return fail(400);
    }

    const replay = (target: string, key: string, body: unknown, create: () => unknown) => {
        const replayKey = `${userId}:${target}:${key}`;
        const existing = state.diary.replay[replayKey];
        if (existing) return existing.hash === hash(body) ? success(existing.data) : fail(409);
        const data = create();
        state.diary.replay[replayKey] = { hash: hash(body), data };
        return success(data);
    };

    if (path === '/api/v1/diary' && method === 'POST') {
        const value = contracts['POST /api/v1/diary'].request.safeParse(input);
        if (!value.success) return fail(400);
        return replay(userId, value.data.idempotencyKey, value.data, () => {
            const components = value.data.components.map((component) => {
                let source: {
                    type: 'manual' | 'ingredient' | 'inventory_batch' | 'recipe';
                    id: string | null;
                    name: string;
                    scope: 'manual' | 'catalog' | 'private' | 'public';
                };
                if (component.source.type === 'manual')
                    source = { type: 'manual', id: null, name: component.source.name, scope: 'manual' };
                else if (component.source.type === 'inventory_batch') {
                    const sourceInput = component.source;
                    seedInventoryFixtures(state.inventory, userId, now);
                    const row = state.inventory.batches.find(
                        (candidate) =>
                            candidate.userId === userId &&
                            candidate.batch.id === sourceInput.batchId &&
                            !candidate.batch.archivedAt,
                    );
                    if (!row) throw new Error('404');
                    if (row.batch.version !== sourceInput.batchVersion) throw new Error('412');
                    if (
                        row.batch.unit !== component.unit ||
                        row.batch.quantity === null ||
                        decimal(row.batch.quantity) < decimal(component.quantity)
                    )
                        throw new Error('422');
                    row.batch.quantity = decimalText(decimal(row.batch.quantity) - decimal(component.quantity));
                    row.batch.version++;
                    source = { type: 'inventory_batch', id: row.batch.id, name: row.batch.name, scope: 'private' };
                } else if (component.source.type === 'ingredient') {
                    source = {
                        type: 'ingredient',
                        id: component.source.ingredientId,
                        name: 'Ингредиент из каталога',
                        scope: 'catalog',
                    };
                } else {
                    const sourceInput = component.source;
                    const recipe = publicRecipeFixtures().find((candidate) => candidate.id === sourceInput.recipeId);
                    if (!recipe) throw new Error('404');
                    source = { type: 'recipe', id: recipe.id, name: recipe.title, scope: 'public' };
                }
                return {
                    id: component.id,
                    source,
                    quantity: component.quantity,
                    unit: component.unit,
                    nutrition: unknownNutrition(),
                    completeness: 'unknown' as const,
                    confidence: 'unconfirmed' as const,
                };
            });
            const entry = entrySchema.parse({
                id: crypto.randomUUID(),
                eatenAt: value.data.eatenAt,
                meal: value.data.meal,
                state: 'confirmed',
                confirmationMethod: 'manual',
                proposalId: null,
                note: value.data.note,
                nutrition: unknownNutrition(),
                completeness: 'unknown',
                components,
                version: 1,
                createdAt: new Date(now).toISOString(),
            });
            state.diary.entries.push({ userId, entry });
            return { entry };
        });
    }

    const row = state.diary.entries.find(
        (candidate) => candidate.userId === userId && candidate.entry.id === params.id,
    );
    if (!row) return fail(404);
    if (path.endsWith('/media') && method === 'POST') {
        const value = contracts['POST /api/v1/diary/{id}/media'].request.safeParse(input);
        if (!value.success) return fail(400);
        return fail(503, 'DIARY_MEDIA_STORAGE_UNAVAILABLE');
    }
    if (!ifMatch) return fail(428);
    if (ifMatch !== `"${row.entry.version}"`) return fail(412);
    if (path.endsWith('/archive') && method === 'POST') {
        const value = contracts['POST /api/v1/diary/{id}/archive'].request.safeParse(input);
        if (!value.success) return fail(400);
        return replay(row.entry.id, value.data.idempotencyKey, value.data, () => {
            row.entry.state = value.data.archived ? 'archived' : 'confirmed';
            row.entry.version++;
            return { entry: row.entry };
        });
    }
    if (method === 'PUT') {
        const value = contracts['PUT /api/v1/diary/{id}'].request.safeParse(input);
        if (!value.success) return fail(400);
        return replay(row.entry.id, value.data.idempotencyKey, value.data, () => {
            row.entry.eatenAt = value.data.eatenAt;
            row.entry.meal = value.data.meal;
            row.entry.note = value.data.note;
            row.entry.version++;
            return { entry: row.entry };
        });
    }
    return fail(404);
}
