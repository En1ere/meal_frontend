import { z } from 'zod';
import { contracts } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';
import { publicRecipeFixtures, recipeProductFixtures, recipeSummary, type RecipeFixture } from './recipe-fixtures.js';
import { recipeAvailability } from './recipe-domain.js';
import { seedInventoryFixtures } from './inventory.js';
import { hasConsent } from './legal.js';
export const recipesStateSchema = z.object({
    bookmarks: z.record(z.string(), z.array(z.string())),
    replay: z.record(z.string(), z.object({ input: z.string(), recipeId: z.string(), bookmarked: z.boolean() })),
});
export type RecipesState = z.infer<typeof recipesStateSchema>;
export const createRecipesState = (): RecipesState => ({ bookmarks: {}, replay: {} });
export function ensureRecipeProducts(state: MockState) {
    for (const [index, name, unit] of recipeProductFixtures) {
        const id = `10000000-0000-4000-8000-${index.padStart(12, '0')}`;
        if (state.products.items.some((entry) => entry.product.id === id)) continue;
        state.products.items.push({
            authorId: null,
            product: {
                id,
                name,
                categoryCode: 'recipe-fixture',
                defaultUnit: unit,
                status: 'approved',
                owned: false,
                version: 1,
                aliases: [],
                nutrition: null,
                allergens: [],
                variants: [],
                provenance: 'Демонстрационный каталог ингредиентов рецептов',
                proposalId: null,
            },
        });
    }
}
const querySchema = z
    .object({
        q: z.string().trim().max(200).default(''),
        category: z.string().trim().max(100).optional(),
        tab: z.enum(['for-you', 'inventory', 'new']).default('for-you'),
        scope: z.enum(['private', 'family']).default('private'),
        page: z.coerce.number().int().min(1).max(10000).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
    })
    .strict();
function availability(state: MockState, userId: string, recipe: RecipeFixture, servings: number) {
    const stocks = state.inventory.batches
        .filter((row) => row.userId === userId && !row.batch.archivedAt)
        .map(({ batch }) => ({
            ingredientId: batch.ingredientId,
            variantId: null,
            productId: null,
            sourceRecipeId: null,
            quantity: batch.quantity,
            unit: batch.unit,
        }));
    const prepared = state.cookingWorkflow.prepared
        .filter((row) => row.userId === userId)
        .map(({ batch }) => ({
            ingredientId: batch.ingredientId,
            variantId: null,
            productId: null,
            sourceRecipeId: batch.sourceRecipeId,
            quantity: batch.quantity,
            unit: batch.unit,
        }));
    return recipeAvailability(recipe.ingredients, [...stocks, ...prepared], recipe.baseServings, servings);
}
export function recipesHandle(c: {
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
    if (path !== '/api/v1/recipes' && !path.startsWith('/api/v1/recipes/')) return null;
    ensureRecipeProducts(state);
    if (userId) seedInventoryFixtures(state.inventory, userId, now);
    const recipes = publicRecipeFixtures()
        .filter((recipe) => {
            const author = state.users.find((candidate) => candidate.login === recipe.authorLogin);
            return (
                !state.recipeWorkspace.hidden.includes(recipe.id) &&
                !state.recipeWorkspace.recipes.some((row) => row.recipe.id === recipe.id && row.recipe.archived) &&
                (!author || hasConsent(state.legal, author.id, 'dissemination'))
            );
        })
        .map((recipe) => {
            const comments = state.recipeWorkspace.comments.filter((row) => {
                const author = state.users.find((candidate) => candidate.id === row.userId);
                return (
                    row.recipeId === recipe.id &&
                    !row.removed &&
                    hasConsent(state.legal, author?.id ?? null, 'dissemination')
                );
            });
            const ratings = state.recipeWorkspace.ratings.filter((row) => row.recipeId === recipe.id);
            return {
                ...recipe,
                comments: comments.slice(0, 100).map((row) => ({
                    id: row.id,
                    authorLogin: row.authorLogin,
                    body: row.body,
                    createdAt: row.createdAt,
                    edited: !!row.editedAt,
                    replyToId: row.replyToId,
                })),
                commentsTotal: comments.length,
                ...(ratings.length
                    ? {
                          rating: ratings.reduce((sum, row) => sum + row.value, 0) / ratings.length,
                          ratingCount: ratings.length,
                      }
                    : {}),
            };
        });
    if (path === '/api/v1/recipes' && method === 'GET') {
        const parsed = querySchema.safeParse(Object.fromEntries(query));
        if (!parsed.success) return fail(400);
        const value = parsed.data;
        if (value.tab === 'inventory' && !userId) return fail(401);
        let matches = recipes.filter(
            (r) =>
                (!value.q ||
                    `${r.title} ${r.description ?? ''}`
                        .toLocaleLowerCase('ru')
                        .includes(value.q.toLocaleLowerCase('ru'))) &&
                (!value.category || r.category === value.category),
        );
        if (value.tab === 'new')
            matches = matches.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id));
        const summaries = matches.map((recipe) => {
            const summary = recipeSummary(recipe);
            if (userId) {
                const data = availability(state, userId, recipe, recipe.baseServings);
                summary.availability = {
                    requiredCount: data.requiredCount,
                    presentCount: data.presentCount,
                    presencePercent: data.presencePercent,
                    canPrepare: data.canPrepare,
                    needsQuantityCheck: data.needsQuantityCheck,
                };
            }
            return summary;
        });
        if (value.tab === 'inventory')
            summaries.sort(
                (a, b) =>
                    (b.availability?.presencePercent ?? 0) - (a.availability?.presencePercent ?? 0) ||
                    b.publishedAt.localeCompare(a.publishedAt) ||
                    a.id.localeCompare(b.id),
            );
        return success({
            items: summaries.slice((value.page - 1) * value.limit, value.page * value.limit),
            total: summaries.length,
            page: value.page,
            limit: value.limit,
            recommendationMode: 'inventory-presence-v1',
        });
    }
    if ((path.endsWith('/personal') || path.endsWith('/bookmark')) && !userId) return fail(401);
    const recipe = recipes.find((r) => r.id === params.id);
    if (!recipe) return fail(404);
    if (method === 'GET' && !path.endsWith('/personal')) return success({ recipe });
    if (!userId) return fail(401);
    const bookmarks = state.recipes.bookmarks[userId] ?? [];
    if (method === 'GET' && path.endsWith('/personal')) {
        const parsed = z
            .object({ servings: z.coerce.number().int().min(1).max(1000).default(1) })
            .strict()
            .safeParse(Object.fromEntries(query));
        if (!parsed.success) return fail(400);
        return success({
            recipeId: recipe.id,
            servings: parsed.data.servings,
            bookmarked: bookmarks.includes(recipe.id),
            availability: availability(state, userId, recipe, parsed.data.servings),
        });
    }
    if (method === 'POST' && path.endsWith('/bookmark')) {
        if (state.inventory.blocked.includes(userId)) return fail(403);
        const parsed = contracts['POST /api/v1/recipes/{id}/bookmark'].request.safeParse(input);
        if (!parsed.success) return fail(400);
        const value = parsed.data,
            key = `${userId}:${recipe.id}:${value.idempotencyKey}`,
            signature = JSON.stringify(value);
        const previous = state.recipes.replay[key];
        if (previous)
            return previous.input === signature
                ? success({ recipeId: previous.recipeId, bookmarked: previous.bookmarked })
                : fail(409);
        state.recipes.bookmarks[userId] = value.bookmarked
            ? [...new Set([...bookmarks, recipe.id])]
            : bookmarks.filter((id) => id !== recipe.id);
        const result = { recipeId: recipe.id, bookmarked: value.bookmarked };
        state.recipes.replay[key] = { input: signature, ...result };
        return success(result);
    }
    return fail(404);
}
