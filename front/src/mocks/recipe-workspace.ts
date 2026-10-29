import { workspaceNutrition, workspaceIngredientSource } from './recipe-workspace-nutrition.js';
import { z } from 'zod';
import { contracts, type Success } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';
import { publicRecipeFixtures, type RecipeFixture } from './recipe-fixtures.js';
import { ensureRecipeProducts } from './recipes.js';
import { mockFamilyContext } from './family.js';
import usersFixture from '../../contracts/dev-users.json' with { type: 'json' };
const recipeSchema = contracts['GET /api/v1/recipe-workspace/{id}'].success.shape.data.shape.recipe;
const storedRecipeSchema = recipeSchema.extend({
    availabilityScope: z.enum(['private', 'family']).default('private'),
    authorLogin: z.string().nullable().default(null),
    canEdit: z.boolean().default(true),
});
export type WorkspaceRecipe = Success<'GET /api/v1/recipe-workspace/{id}'>['data']['recipe'];
type Document = WorkspaceRecipe['document'];
const commentSchema = z.object({
    id: z.uuid(),
    recipeId: z.uuid(),
    userId: z.uuid(),
    authorLogin: z.string().nullable(),
    body: z.string(),
    editedAt: z.string().nullable(),
    createdAt: z.string(),
    version: z.number(),
    replyToId: z.uuid().nullable(),
    removed: z.boolean(),
    history: z.array(z.string()),
});
export const recipeWorkspaceStateSchema = z.object({
    recipes: z.array(
        z.object({
            userId: z.uuid(),
            familyId: z.uuid().nullable().default(null),
            recipe: storedRecipeSchema,
            history: z.array(storedRecipeSchema),
            submittedRevisionIds: z.array(z.uuid()),
        }),
    ),
    comments: z.array(commentSchema),
    ratings: z.array(z.object({ id: z.uuid(), userId: z.uuid(), recipeId: z.uuid(), value: z.number() })),
    reports: z.array(
        z.object({
            id: z.uuid(),
            userId: z.uuid(),
            recipeId: z.uuid(),
            commentId: z.uuid().nullable(),
            reason: z.string(),
            status: z.string(),
            submittedAt: z.string(),
        }),
    ),
    hidden: z.array(z.uuid()),
    replay: z.record(z.string(), z.object({ input: z.string(), result: z.unknown() })),
    allowances: z.array(
        z.object({ userId: z.uuid(), kind: z.enum(['submission', 'comment', 'report']), at: z.number() }),
    ),
    policy: z.object({
        version: z.number().int(),
        submissionDailyLimit: z.number().int(),
        commentHourlyLimit: z.number().int(),
        reportDailyLimit: z.number().int(),
    }),
});
export type RecipeWorkspaceState = z.infer<typeof recipeWorkspaceStateSchema>;
export const createRecipeWorkspaceState = (): RecipeWorkspaceState => ({
    recipes: [],
    comments: publicRecipeFixtures().flatMap((recipe) =>
        recipe.comments.map((comment) => ({
            id: comment.id,
            recipeId: recipe.id,
            userId: usersFixture.users.find((u) => u.login === comment.authorLogin)?.id ?? usersFixture.users[0]!.id,
            authorLogin: comment.authorLogin,
            body: comment.body,
            editedAt: null,
            createdAt: comment.createdAt,
            version: 1,
            replyToId: comment.replyToId,
            removed: false,
            history: [],
        })),
    ),
    ratings: [],
    reports: [],
    hidden: [],
    replay: {},
    allowances: [],
    policy: { version: 1, submissionDailyLimit: 10, commentHourlyLimit: 30, reportDailyLimit: 10 },
});
class WorkspaceFailure extends Error {
    constructor(readonly status: number) {
        super(String(status));
    }
}
const deny = (status: number): never => {
    throw new WorkspaceFailure(status);
};
function normalize(value: unknown): Document {
    const v = z
        .object({
            title: z.string().optional(),
            description: z.string().nullable().optional(),
            category: z.string().nullable().optional(),
            tags: z.array(z.string()).optional(),
            baseServings: z.number().optional(),
            method: z.string().optional(),
            ingredients: z
                .array(
                    z.object({
                        ingredientId: z.string().nullable().optional(),
                        variantId: z.string().nullable().optional(),
                        productId: z.string().nullable().optional(),
                        sourceRecipeId: z.string().nullable().optional(),
                        quantity: z.string().nullable().optional(),
                        unit: z.string().nullable().optional(),
                        optional: z.boolean().optional(),
                    }),
                )
                .optional(),
            steps: z
                .array(
                    z.object({
                        text: z.string(),
                        durationSeconds: z.number().nullable().optional(),
                        temperature: z.string().nullable().optional(),
                    }),
                )
                .optional(),
        })
        .parse(value);
    const ingredients = (v.ingredients ?? []).map((line) => ({
        ingredientId: line.ingredientId ?? null,
        variantId: line.variantId ?? null,
        productId: line.productId ?? null,
        sourceRecipeId: line.sourceRecipeId ?? null,
        quantity: line.quantity ?? null,
        unit: line.unit ?? null,
        optional: line.optional ?? false,
    }));
    if (
        ingredients.some(
            (i) => [i.ingredientId, i.variantId, i.productId, i.sourceRecipeId].filter(Boolean).length !== 1,
        )
    )
        deny(400);
    if (v.tags?.some((tag) => !tag.trim())) deny(400);
    return {
        title: v.title?.trim() ?? '',
        description: v.description ?? null,
        category: v.category?.trim() ?? null,
        tags: v.tags?.map((tag) => tag.trim()) ?? [],
        baseServings: v.baseServings ?? 1,
        method: v.method ?? '',
        ingredients,
        steps: (v.steps ?? []).map((s) => ({
            text: s.text,
            durationSeconds: s.durationSeconds ?? null,
            temperature: s.temperature ?? null,
        })),
    };
}
export function workspaceVisibleRecipe(state: MockState, userId: string, id: string): WorkspaceRecipe | null {
    const family = mockFamilyContext(state, userId);
    const scoped = state.recipeWorkspace.recipes.find(
        (r) =>
            r.recipe.id === id &&
            !r.recipe.archived &&
            r.recipe.status !== 'hidden' &&
            ((r.recipe.availabilityScope === 'private' && r.userId === userId) ||
                (r.recipe.availabilityScope === 'family' &&
                    family.state === 'active' &&
                    r.familyId === family.family?.id)),
    );
    if (scoped)
        return {
            ...structuredClone(scoped.recipe),
            authorLogin: state.users.find((u) => u.id === scoped.userId)?.login ?? null,
            canEdit: scoped.userId === userId,
        };
    if (state.recipeWorkspace.hidden.includes(id)) return null;
    const publicRecipe = publicRecipeFixtures().find((r) => r.id === id);
    if (!publicRecipe) return null;
    return {
        id: publicRecipe.id,
        revisionId: publicRecipe.revisionId,
        version: 1,
        revision: 1,
        status: 'published',
        review: { revisionId: publicRecipe.revisionId, status: 'published', publicReason: null },
        publication: { revisionId: publicRecipe.revisionId, publishedAt: publicRecipe.publishedAt },
        archived: false,
        baseRecipeId: null,
        availabilityScope: 'private',
        authorLogin: publicRecipe.authorLogin,
        canEdit: false,
        nutrition: {
            status: publicRecipe.nutrition ? 'calculated' : 'unavailable',
            base: publicRecipe.nutrition,
            uncoveredIngredientIds: [],
        },
        document: {
            title: publicRecipe.title,
            description: publicRecipe.description,
            category: publicRecipe.category,
            tags: publicRecipe.tags,
            baseServings: publicRecipe.baseServings,
            method: publicRecipe.method,
            ingredients: publicRecipe.ingredients.map((i) => ({
                ...workspaceIngredientSource(i),
                quantity: i.quantity,
                unit: i.unit,
                optional: i.optional,
            })),
            steps: publicRecipe.steps.map((s) => ({
                text: s.text,
                durationSeconds: s.durationSeconds,
                temperature: s.temperature,
            })),
        },
    };
}
export function workspaceConsumeAllowance(
    state: RecipeWorkspaceState,
    userId: string,
    kind: 'submission' | 'comment' | 'report',
    now: number,
) {
    const duration = kind === 'comment' ? 3600000 : 86400000,
        limit =
            kind === 'submission'
                ? state.policy.submissionDailyLimit
                : kind === 'comment'
                  ? state.policy.commentHourlyLimit
                  : state.policy.reportDailyLimit;
    if (state.allowances.filter((e) => e.userId === userId && e.kind === kind && e.at > now - duration).length >= limit)
        deny(429);
    state.allowances.push({ userId, kind, at: now });
}
export function recipeWorkspaceHandle(c: {
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
}): Response | null {
    const { state, userId, path, params, method, query, input, now, success, fail } = c;
    if (path === '/api/v1/recipe-policy') return userId ? success(state.recipeWorkspace.policy) : fail(401);
    if (!path.startsWith('/api/v1/recipe-workspace')) return null;
    if (!userId) return fail(401);
    ensureRecipeProducts(state);
    const data = structuredClone(state.recipeWorkspace),
        iso = new Date(now).toISOString(),
        id = params.id ?? '',
        commentId = params.commentId ?? '';
    const family = () => {
        const context = mockFamilyContext(state, userId);
        if (context.state === 'none' || !context.family) return deny(404);
        if (context.state !== 'active') return deny(403);
        return context.family;
    };
    const own = () => {
        const row = data.recipes.find(
            (r) =>
                r.userId === userId &&
                r.recipe.id === id &&
                (r.recipe.availabilityScope === 'private' || r.familyId === family().id),
        );
        if (!row) return deny(404);
        return row;
    };
    const visible = () => workspaceVisibleRecipe({ ...state, recipeWorkspace: data }, userId, id) ?? deny(404);
    const evidence = (attemptId: string) => {
        if (
            !state.cookingWorkflow.attempts.some(
                (r) =>
                    r.userId === userId &&
                    r.attempt.id === attemptId &&
                    r.attempt.recipeId === id &&
                    r.attempt.status === 'completed' &&
                    r.attempt.completedAt,
            )
        )
            deny(403);
    };
    const checkSources = (document: Document, scope: 'private' | 'family') => {
        for (const line of document.ingredients) {
            if (line.unit && !['g', 'kg', 'ml', 'l', 'pcs', 'portion'].includes(line.unit)) deny(422);
            if (line.sourceRecipeId) {
                if (line.sourceRecipeId === id || !workspaceVisibleRecipe(state, userId, line.sourceRecipeId))
                    deny(422);
                continue;
            }
            const product = state.products.items.find(
                (r) =>
                    (r.authorId === null || (scope === 'private' && r.authorId === userId)) &&
                    (r.product.id === line.ingredientId ||
                        r.product.variants.some(
                            (v) => v.id === line.variantId || v.products.some((s) => s.id === line.productId),
                        )),
            );
            if (!product) deny(422);
        }
    };
    const nutrition = (
        document: Document,
        previous: WorkspaceRecipe['nutrition'] | undefined,
    ): WorkspaceRecipe['nutrition'] =>
        workspaceNutrition(
            document,
            document.ingredients.map((line) => {
                const source = state.products.items.find((p) => p.product.id === line.ingredientId)?.product.nutrition;
                if (!source || line.variantId || line.productId || line.sourceRecipeId) return null;
                return {
                    kcal: source.kcal,
                    protein: source.protein,
                    fat: source.fat,
                    carbs: source.carbs,
                    quantity: source.basisQuantity,
                    unit: source.basisUnit,
                };
            }),
            previous,
        );
    try {
        if (method === 'GET') {
            const reportDetail = /^\/api\/v1\/recipe-workspace\/reports\/([^/]+)$/.exec(path);
            if (reportDetail) {
                const row = data.reports.find((item) => item.id === reportDetail[1] && item.userId === userId);
                if (!row) return fail(404);
                return success({
                    id: row.id,
                    recipeId: data.hidden.includes(row.recipeId) ? null : row.recipeId,
                    reason: row.reason,
                    status: row.status,
                    submittedAt: row.submittedAt,
                });
            }
            if (path.endsWith('/reports')) {
                const q = z
                    .object({
                        page: z.coerce.number().int().min(1).max(10000).default(1),
                        limit: z.coerce.number().int().min(1).max(100).default(20),
                    })
                    .strict()
                    .parse(Object.fromEntries(query));
                const matches = data.reports
                    .filter((r) => r.userId === userId)
                    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
                return success({
                    items: matches
                        .slice((q.page - 1) * q.limit, q.page * q.limit)
                        .map(({ id, recipeId, reason, status, submittedAt }) => ({
                            id,
                            recipeId,
                            reason,
                            status,
                            submittedAt,
                        })),
                    total: matches.length,
                    ...q,
                });
            }
            if (path === '/api/v1/recipe-workspace') {
                const q = z
                    .object({
                        q: z.string().trim().max(200).default(''),
                        scope: z.enum(['private', 'family']).default('private'),
                        status: z.enum(['active', 'archived']).default('active'),
                        page: z.coerce.number().int().min(1).max(10000).default(1),
                        limit: z.coerce.number().int().min(1).max(100).default(20),
                    })
                    .strict()
                    .parse(Object.fromEntries(query));
                const familyId = q.scope === 'family' ? family().id : null;
                const matches = data.recipes.filter(
                    (r) =>
                        ((q.scope === 'private' && r.userId === userId && r.recipe.availabilityScope === 'private') ||
                            (q.scope === 'family' &&
                                r.familyId === familyId &&
                                r.recipe.availabilityScope === 'family')) &&
                        r.recipe.archived === (q.status === 'archived') &&
                        r.recipe.document.title.toLowerCase().includes(q.q.toLowerCase()),
                );
                return success({
                    items: matches.slice((q.page - 1) * q.limit, q.page * q.limit).map((r) => ({
                        ...r.recipe,
                        authorLogin: state.users.find((u) => u.id === r.userId)?.login ?? null,
                        canEdit: r.userId === userId,
                    })),
                    total: matches.length,
                    page: q.page,
                    limit: q.limit,
                });
            }
            if (path.endsWith('/community')) {
                visible();
                const attempt = state.cookingWorkflow.attempts.find(
                    (r) =>
                        r.userId === userId &&
                        r.attempt.recipeId === id &&
                        r.attempt.status === 'completed' &&
                        r.attempt.completedAt,
                );
                return success({
                    attemptId: attempt?.attempt.id ?? null,
                    rating: data.ratings.find((r) => r.userId === userId && r.recipeId === id)?.value ?? null,
                    comments: data.comments
                        .filter((r) => r.recipeId === id && !r.removed)
                        .slice(0, 100)
                        .map(({ id, authorLogin, body, editedAt, createdAt, version, userId: author, replyToId }) => ({
                            id,
                            authorLogin,
                            body,
                            editedAt,
                            createdAt,
                            version,
                            isOwn: author === userId,
                            replyToId,
                        })),
                    reports: data.reports
                        .filter((r) => r.userId === userId && r.recipeId === id)
                        .slice(0, 100)
                        .map(({ id, reason, status, submittedAt }) => ({ id, reason, status, submittedAt })),
                });
            }
            const scope = query.get('scope') === 'family' ? 'family' : 'private';
            const recipe = workspaceVisibleRecipe({ ...state, recipeWorkspace: data }, userId, id);
            if (!recipe || recipe.availabilityScope !== scope) return deny(404);
            return success({ recipe });
        }
        if (state.inventory.blocked.includes(userId)) return fail(403);
        const action = path.split('/').at(-1) ?? '',
            route = path.replace(id || '__none__', '{id}').replace(commentId || '__none__', '{commentId}');
        const operation = `${method} ${route}` as keyof typeof contracts,
            contract = contracts[operation];
        if (!contract?.request) return fail(404);
        const parsed = contract.request.safeParse(input);
        if (!parsed.success) return fail(400);
        const v = z.object({ idempotencyKey: z.uuid() }).passthrough().parse(parsed.data),
            binding = `${userId}:${operation}:${id}:${commentId}:${path === '/api/v1/recipe-workspace' ? String(v.scope) : ''}:${v.idempotencyKey}`,
            fingerprint = JSON.stringify(parsed.data),
            replay = data.replay[binding];
        if (replay) {
            if (replay.input !== fingerprint) return fail(409);
            return success(replay.result);
        }
        let result: unknown;
        if (path === '/api/v1/recipe-workspace') {
            const document = normalize(v.document);
            const scope = v.scope === 'family' ? 'family' : 'private';
            const familyId = scope === 'family' ? family().id : null;
            checkSources(document, scope);
            const next = crypto.randomUUID();
            const recipe: WorkspaceRecipe = {
                id: next,
                revisionId: crypto.randomUUID(),
                revision: 1,
                version: 1,
                status: 'draft',
                review: { revisionId: '', status: 'draft', publicReason: null },
                publication: null,
                archived: false,
                baseRecipeId: null,
                availabilityScope: scope,
                authorLogin: state.users.find((u) => u.id === userId)?.login ?? null,
                canEdit: true,
                document,
                nutrition: nutrition(document, undefined),
            };
            recipe.review.revisionId = recipe.revisionId;
            data.recipes.unshift({ userId, familyId, recipe, history: [], submittedRevisionIds: [] });
            result = { recipe };
        } else if (action === 'variant') {
            const base = visible(),
                recipe: WorkspaceRecipe = {
                    ...structuredClone(base),
                    id: crypto.randomUUID(),
                    revisionId: crypto.randomUUID(),
                    revision: 1,
                    version: 1,
                    status: 'draft',
                    review: { revisionId: '', status: 'draft', publicReason: null },
                    publication: null,
                    baseRecipeId: id,
                    availabilityScope: 'private',
                    authorLogin: state.users.find((u) => u.id === userId)?.login ?? null,
                    canEdit: true,
                    nutrition: nutrition(base.document, base.nutrition),
                };
            recipe.review.revisionId = recipe.revisionId;
            data.recipes.unshift({ userId, familyId: null, recipe, history: [], submittedRevisionIds: [] });
            result = { recipe };
        } else if (['rating', 'comments', 'reports'].includes(action) && !commentId) {
            visible();
            if (action === 'rating') {
                const p = contracts['POST /api/v1/recipe-workspace/{id}/rating'].request.parse(v);
                evidence(p.attemptId);
                if (data.ratings.some((r) => r.userId === userId && r.recipeId === id)) deny(409);
                const next = crypto.randomUUID();
                data.ratings.push({ id: next, userId, recipeId: id, value: p.value });
                result = { id: next };
            } else if (action === 'comments') {
                const p = contracts['POST /api/v1/recipe-workspace/{id}/comments'].request.parse(v);
                if (!p.body.trim()) deny(400);
                evidence(p.attemptId);
                if (p.replyToId && !data.comments.some((r) => r.id === p.replyToId && r.recipeId === id && !r.removed))
                    deny(404);
                workspaceConsumeAllowance(data, userId, 'comment', now);
                const next = crypto.randomUUID();
                data.comments.push({
                    id: next,
                    userId,
                    recipeId: id,
                    body: p.body.trim(),
                    authorLogin: state.users.find((u) => u.id === userId)?.login ?? null,
                    editedAt: null,
                    createdAt: iso,
                    version: 1,
                    replyToId: p.replyToId ?? null,
                    removed: false,
                    history: [],
                });
                result = { id: next };
            } else {
                const p = contracts['POST /api/v1/recipe-workspace/{id}/reports'].request.parse(v);
                if (p.commentId && !data.comments.some((r) => r.id === p.commentId && r.recipeId === id && !r.removed))
                    deny(404);
                workspaceConsumeAllowance(data, userId, 'report', now);
                const next = crypto.randomUUID();
                data.reports.push({
                    id: next,
                    userId,
                    recipeId: id,
                    commentId: p.commentId ?? null,
                    reason: p.reason,
                    status: 'pending',
                    submittedAt: iso,
                });
                if (['dangerous', 'personal-data'].includes(p.reason)) {
                    if (p.commentId) {
                        const row = data.comments.find((r) => r.id === p.commentId)!;
                        row.removed = true;
                        row.version++;
                    } else {
                        data.hidden.push(id);
                        const row = data.recipes.find((r) => r.recipe.id === id);
                        if (row) {
                            const reviewedRevisionId = row.recipe.publication?.revisionId ?? row.recipe.revisionId;
                            row.recipe.status = 'hidden';
                            row.recipe.review = {
                                revisionId: reviewedRevisionId,
                                status: 'hidden',
                                publicReason: null,
                            };
                            row.recipe.publication = null;
                            row.recipe.version++;
                        }
                    }
                }
                result = { id: next };
            }
        } else if (commentId) {
            visible();
            const row = data.comments.find((r) => r.id === commentId && r.recipeId === id && r.userId === userId);
            if (!row) return deny(404);
            if (row.removed || row.version !== v.expectedVersion) deny(409);
            row.history.push(row.body);
            if (method === 'PATCH') {
                if (!String(v.body).trim()) deny(400);
                row.body = String(v.body).trim();
                row.editedAt = iso;
            } else row.removed = true;
            row.version++;
            result = { id: commentId };
        } else {
            const row = own();
            if (row.recipe.version !== v.expectedVersion) deny(409);
            if (method === 'PUT' || action === 'rollback') {
                if (row.recipe.archived || row.recipe.status === 'hidden') deny(409);
                const document =
                    method === 'PUT'
                        ? normalize(v.document)
                        : structuredClone(row.history.at(-1)?.document ?? deny(409));
                checkSources(document, row.recipe.availabilityScope);
                row.history.push(structuredClone(row.recipe));
                row.recipe = {
                    ...row.recipe,
                    document,
                    revision: row.recipe.revision + 1,
                    revisionId: crypto.randomUUID(),
                    version: row.recipe.version + 1,
                    nutrition: nutrition(document, row.recipe.nutrition),
                };
            } else if (action === 'submit') {
                if (
                    row.recipe.archived ||
                    row.recipe.status === 'hidden' ||
                    row.submittedRevisionIds.includes(row.recipe.revisionId)
                )
                    deny(409);
                const d = row.recipe.document;
                if (!d.title.trim() || !d.ingredients.length || !d.steps.length || d.steps.some((s) => !s.text.trim()))
                    deny(422);
                workspaceConsumeAllowance(data, userId, 'submission', now);
                row.submittedRevisionIds.push(row.recipe.revisionId);
                row.recipe.status = 'pending';
                row.recipe.review = {
                    revisionId: row.recipe.revisionId,
                    status: 'pending',
                    publicReason: null,
                };
                row.recipe.version++;
            } else if (action === 'archive' || action === 'restore') {
                row.recipe.archived = action === 'archive';
                if (action === 'archive' && row.recipe.publication) {
                    const reviewedRevisionId = row.recipe.publication.revisionId;
                    row.recipe.publication = null;
                    row.recipe.status = 'unpublished';
                    row.recipe.review = {
                        revisionId: reviewedRevisionId,
                        status: 'unpublished',
                        publicReason: null,
                    };
                }
                row.recipe.version++;
            } else return fail(404);
            result = { recipe: row.recipe };
        }
        data.replay[binding] = { input: fingerprint, result: structuredClone(result) };
        state.recipeWorkspace = data;
        return success(result);
    } catch (error) {
        if (error instanceof WorkspaceFailure) return fail(error.status);
        if (error instanceof z.ZodError) return fail(400);
        throw error;
    }
}

export function workspaceRecipeFixture(state: MockState, userId: string, id: string): RecipeFixture | null {
    const workspace = workspaceVisibleRecipe(state, userId, id);
    if (!workspace) return null;
    if (workspace.availabilityScope === 'family') return null;
    const existing = publicRecipeFixtures().find((r) => r.id === id);
    if (existing) return existing;
    const d = workspace.document,
        authored = state.recipeWorkspace.recipes.find((row) => row.recipe.id === id);
    const childId = (i: number) => workspace.revisionId.slice(0, 24) + String(i).padStart(12, '0');
    return {
        id,
        revisionId: workspace.revisionId,
        title: d.title,
        description: d.description,
        category: d.category,
        tags: d.tags,
        baseServings: d.baseServings,
        method: d.method,
        imageUrl: null,
        authorLogin: authored ? (state.users.find((u) => u.id === authored.userId)?.login ?? null) : null,
        publishedAt: '2026-09-29T00:00:00.000Z',
        durationMinutes: null,
        rating: null,
        ratingCount: 0,
        availability: null,
        nutrition: workspace.nutrition.status === 'calculated' ? workspace.nutrition.base : null,
        allergens: [],
        allergensComplete: false,
        allergenCompleteness: {
            complete: false,
            unknownIngredients: d.ingredients.map((line, index) => ({
                recipeIngredientId: childId(index + 1),
                name:
                    state.products.items.find((product) => product.product.id === line.ingredientId)?.product.name ??
                    'Ингредиент',
                ingredientId: line.ingredientId,
                variantId: line.variantId,
                productId: line.productId,
            })),
        },
        variants: [],
        comments: [],
        commentsTotal: 0,
        ingredients: d.ingredients.map((line, index) => ({
            ...line,
            id: childId(index + 1),
            position: index + 1,
            name: state.products.items.find((p) => p.product.id === line.ingredientId)?.product.name ?? 'Ингредиент',
        })),
        steps: d.steps.map((step, index) => ({ ...step, id: childId(index + 1000), position: index + 1 })),
    };
}
