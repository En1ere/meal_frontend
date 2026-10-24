import { z } from 'zod';
import { contracts } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';
import { hasConsent } from './legal.js';
import { publicRecipeFixtures, recipeSummary, type RecipeFixture } from './recipe-fixtures.js';
import { recipeAvailability } from './recipe-domain.js';
import { seedInventoryFixtures } from './inventory.js';
import { mockFamilyContext } from './family.js';

export const recommendationEventKinds = ['impression', 'open', 'not_interested', 'not_suitable'] as const;

const eventSchema = z.object({
    id: z.uuid(),
    userId: z.uuid(),
    recommendationId: z.uuid(),
    entityType: z.enum(['recipe', 'author']),
    entityId: z.string().min(1),
    event: z.enum(recommendationEventKinds),
    algorithm: z.literal('personalized-v1'),
    surface: z.enum(['home', 'recipes', 'authors']),
    position: z.number().int().min(0).max(999),
    reasonCodes: z.array(z.string()).max(3),
    occurredAt: z.iso.datetime(),
});

const followSchema = z.object({
    followerId: z.uuid(),
    authorId: z.uuid(),
    createdAt: z.iso.datetime(),
});

export const recommendationsStateSchema = z.object({
    events: z.array(eventSchema),
    follows: z.array(followSchema),
    issued: z.array(
        z.object({
            recommendationId: z.uuid(),
            userId: z.uuid(),
            entityType: z.enum(['recipe', 'author']),
            entityId: z.string().min(1),
            surface: z.enum(['home', 'recipes', 'authors']),
            position: z.number().int().min(0).max(999),
            reasonCodes: z.array(z.string()).max(3),
            expiresAt: z.number().default(0),
        }),
    ),
    replay: z.record(z.string(), z.object({ signature: z.string(), result: z.unknown() })),
});

export type RecommendationsState = z.infer<typeof recommendationsStateSchema>;
export const createRecommendationsState = (): RecommendationsState => ({
    events: [],
    follows: [],
    issued: [],
    replay: {},
});

export type RecommendationReasonCode =
    | 'inventory_match'
    | 'expiring_ingredients'
    | 'diet_match'
    | 'quick_goal'
    | 'variety'
    | 'similar_tastes'
    | 'high_rating'
    | 'new_recipe';

export interface RankedRecipe {
    recipe: RecipeFixture;
    score: number;
    reasonCode: RecommendationReasonCode;
    reason: string;
    availability: ReturnType<typeof recipeAvailability>;
    safetyWarnings: Array<{
        code: 'allergens_incomplete' | 'allergen_contains' | 'allergen_may_contain' | 'allergen_unknown';
        text: string;
    }>;
}

export interface RankedAuthor {
    authorId: string;
    username: string;
    displayName: string;
    recipeCount: number;
    score: number;
    reasonCode: 'liked_recipes' | 'similar_readers' | 'popular_author';
    reason: string;
}

const reasonLabels: Record<RecommendationReasonCode, string> = {
    inventory_match: 'Все основные продукты уже есть',
    expiring_ingredients: 'Поможет использовать продукты с близким сроком',
    diet_match: 'Соответствует вашим предпочтениям',
    quick_goal: 'Подходит для быстрого приготовления',
    variety: 'Добавит разнообразия в меню',
    similar_tastes: 'Нравится людям с похожими предпочтениями',
    high_rating: 'Хорошо оценён другими пользователями',
    new_recipe: 'Новый для вас рецепт',
};

export const recommendationPolicy = {
    minStrongUserEvents: 5,
    minCollaborativeContributors: 20,
} as const;

const daysBetween = (later: string, earlier: number) =>
    Math.ceil((Date.parse(`${later}T00:00:00Z`) - earlier) / 86_400_000);
const equipmentCode = (method: string) => ({ stovetop: 'hob', oven: 'oven' })[method] ?? method;
function dietCodes(recipe: RecipeFixture) {
    return new Set(recipe.tags);
}

function ingredientStocks(state: MockState, ownerId: string) {
    return state.inventory.batches
        .filter((row) => row.userId === ownerId && !row.batch.archivedAt)
        .map(({ batch }) => ({
            ingredientId: batch.ingredientId,
            variantId: null,
            productId: null,
            sourceRecipeId: null,
            quantity: batch.quantity,
            unit: batch.unit,
        }));
}

function isAllowed(state: MockState, userId: string, recipe: RecipeFixture) {
    const preferences = state.personalization.rows[userId]?.preferences;
    if (!preferences) return true;
    if (preferences.equipment[equipmentCode(recipe.method)] === 'no') return false;
    if (preferences.diets.length && !preferences.diets.some((diet) => dietCodes(recipe).has(diet))) return false;
    if (
        hasConsent(state.legal, userId, 'special_category') &&
        preferences.allergenMode === 'hide' &&
        preferences.allergens.length
    ) {
        if (
            recipe.allergens.some(
                (allergen) => allergen.status === 'contains' && preferences.allergens.includes(allergen.code),
            )
        )
            return false;
    }
    return true;
}

function collaborativeSignals(state: MockState, userId: string) {
    const own = new Set([
        ...(state.recipes.bookmarks[userId] ?? []),
        ...state.cookingWorkflow.attempts
            .filter((row) => row.userId === userId && row.attempt.status === 'completed')
            .map((row) => row.recipe.id),
        ...state.recipeWorkspace.ratings.filter((row) => row.userId === userId).map((row) => row.recipeId),
        ...state.mealPlan.plans
            .filter((row) => row.userId === userId)
            .flatMap((row) => row.entries.flatMap((entry) => (entry.recipe ? [entry.recipe.id] : []))),
    ]);
    if (own.size < recommendationPolicy.minStrongUserEvents) return new Map<string, number>();
    const candidates = new Map<string, { score: number; contributors: Set<string> }>();
    for (const user of state.users) {
        if (user.id === userId || !user.active) continue;
        const other = new Set(state.recipes.bookmarks[user.id] ?? []);
        const overlap = [...own].filter((recipeId) => other.has(recipeId)).length;
        if (!overlap) continue;
        for (const recipeId of other) {
            const current = candidates.get(recipeId) ?? { score: 0, contributors: new Set<string>() };
            current.score += overlap;
            current.contributors.add(user.id);
            candidates.set(recipeId, current);
        }
    }
    // Sparse cohorts are too noisy; production and mocks intentionally share this cold-start threshold.
    return new Map(
        [...candidates]
            .filter(([, value]) => value.contributors.size >= recommendationPolicy.minCollaborativeContributors)
            .map(([recipeId, value]) => [recipeId, Math.min(10, (10 * value.score) / value.contributors.size)]),
    );
}

/** Pure, deterministic personalized-v1 ranker. HTTP/storage remain outside this module. */
export function rankRecipeRecommendations(
    state: MockState,
    userId: string,
    recipes: RecipeFixture[],
    now: number,
    inventoryOwnerId = userId,
): RankedRecipe[] {
    const preferences = state.personalization.rows[userId]?.preferences;
    const stocks = ingredientStocks(state, inventoryOwnerId);
    const collaborative = collaborativeSignals(state, userId);
    const hidden = new Set(
        state.recommendations.events
            .filter(
                (event) =>
                    event.userId === userId &&
                    event.entityType === 'recipe' &&
                    (event.event === 'not_interested' || event.event === 'not_suitable'),
            )
            .map((event) => event.entityId),
    );

    return recipes
        .filter((recipe) => !hidden.has(recipe.id) && isAllowed(state, userId, recipe))
        .map((recipe): RankedRecipe => {
            const availability = recipeAvailability(
                recipe.ingredients,
                stocks,
                recipe.baseServings,
                recipe.baseServings,
            );
            const ingredientIds = new Set(
                recipe.ingredients.filter((item) => !item.optional).map((item) => item.ingredientId),
            );
            const expiringIds = new Set(
                state.inventory.batches
                    .filter(
                        ({ userId: owner, batch }) =>
                            owner === inventoryOwnerId &&
                            !batch.archivedAt &&
                            !!batch.expiryOn &&
                            ingredientIds.has(batch.ingredientId) &&
                            daysBetween(batch.expiryOn, now) >= 0 &&
                            daysBetween(batch.expiryOn, now) <= 14,
                    )
                    .map(({ batch }) => batch.ingredientId),
            );
            const expiringMatches = recipe.ingredients.filter(
                (item) => !item.optional && item.ingredientId !== null && expiringIds.has(item.ingredientId),
            ).length;
            const inventoryScore =
                35 * (availability.requiredCount === 0 ? 1 : availability.presentCount / availability.requiredCount);
            const expiryScore = 15 * Math.min(1, expiringMatches / Math.max(1, availability.requiredCount));
            const quickScore = preferences?.goals.includes('quick') && (recipe.durationMinutes ?? 10_000) <= 30 ? 8 : 0;
            const wasteScore = preferences?.goals.includes('less_waste') && expiringMatches > 0 ? 7 : 0;
            const diets = preferences?.diets ?? [];
            const preferenceScore = diets.length
                ? (20 * diets.filter((diet) => dietCodes(recipe).has(diet)).length) / diets.length
                : 0;
            const similar = collaborative.get(recipe.id) ?? 0;
            const qualityScore =
                recipe.rating === null ? 0 : 10 * ((recipe.rating - 1) / 4) * Math.min(1, recipe.ratingCount / 10);
            const completed = state.cookingWorkflow.attempts.filter(
                (row) => row.userId === userId && row.recipe.id === recipe.id && row.attempt.status === 'completed',
            );
            const lastCompleted = completed
                .map((row) => row.attempt.completedAt)
                .filter((value): value is string => !!value)
                .sort()
                .at(-1);
            const daysSinceCooked = lastCompleted ? Math.floor((now - Date.parse(lastCompleted)) / 86_400_000) : null;
            const noveltyScore = completed.length === 0 ? 5 : Math.min(5, (daysSinceCooked ?? 0) / 30);
            const repeatPenalty = daysSinceCooked !== null && daysSinceCooked < 7 ? 10 : 0;
            const candidates: Array<[RecommendationReasonCode, number]> = [
                ['expiring_ingredients', expiryScore],
                ['inventory_match', inventoryScore],
                ['diet_match', preferenceScore],
                ['quick_goal', quickScore],
                [completed.length === 0 ? 'new_recipe' : 'variety', noveltyScore],
                ['similar_tastes', similar],
                ['high_rating', qualityScore],
                ['new_recipe', 1],
            ];
            const [reasonCode] = candidates.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]!;
            const healthAllowed = hasConsent(state.legal, userId, 'special_category');
            const selectedAllergens = new Set(healthAllowed ? (preferences?.allergens ?? []) : []);
            const safetyWarnings: RankedRecipe['safetyWarnings'] = [];
            if (!recipe.allergensComplete)
                safetyWarnings.push({
                    code: 'allergens_incomplete',
                    text: 'Данные об аллергенах не указаны',
                });
            if (
                healthAllowed &&
                preferences?.allergenMode === 'warn' &&
                recipe.allergens.some(
                    (allergen) => selectedAllergens.has(allergen.code) && allergen.status === 'contains',
                )
            )
                safetyWarnings.push({
                    code: 'allergen_contains',
                    text: 'Рецепт содержит выбранный аллерген',
                });
            if (
                recipe.allergens.some(
                    (allergen) => selectedAllergens.has(allergen.code) && allergen.status === 'may_contain',
                )
            )
                safetyWarnings.push({
                    code: 'allergen_may_contain',
                    text: 'Рецепт может содержать выбранный аллерген',
                });
            if (
                recipe.allergens.some(
                    (allergen) => selectedAllergens.has(allergen.code) && allergen.status === 'unknown',
                )
            )
                safetyWarnings.push({
                    code: 'allergen_unknown',
                    text: 'Наличие выбранного аллергена не подтверждено',
                });
            return {
                recipe,
                availability,
                safetyWarnings: safetyWarnings.slice(0, 3),
                score:
                    inventoryScore +
                    expiryScore +
                    quickScore +
                    wasteScore +
                    noveltyScore +
                    preferenceScore +
                    similar +
                    qualityScore -
                    repeatPenalty,
                reasonCode,
                reason:
                    reasonCode === 'inventory_match' && availability.presentCount < availability.requiredCount
                        ? 'Часть продуктов уже есть в запасах'
                        : reasonLabels[reasonCode],
            };
        })
        .sort((a, b) => b.score - a.score || a.recipe.id.localeCompare(b.recipe.id));
}

export function rankAuthorRecommendations(state: MockState, userId: string, recipes: RecipeFixture[]): RankedAuthor[] {
    const current = state.users.find((user) => user.id === userId);
    const followed = new Set(
        state.recommendations.follows.filter((follow) => follow.followerId === userId).map((follow) => follow.authorId),
    );
    const hidden = new Set(
        state.recommendations.events
            .filter(
                (event) =>
                    event.userId === userId &&
                    event.entityType === 'author' &&
                    (event.event === 'not_interested' || event.event === 'not_suitable'),
            )
            .map((event) => event.entityId),
    );
    const peers = new Map<string, number>();
    if (followed.size >= recommendationPolicy.minStrongUserEvents) {
        for (const follow of state.recommendations.follows) {
            if (follow.followerId !== userId && followed.has(follow.authorId))
                peers.set(follow.followerId, (peers.get(follow.followerId) ?? 0) + 1);
        }
    }
    return state.users
        .filter(
            (author) =>
                author.id !== userId &&
                author.login !== current?.login &&
                author.active &&
                author.verified &&
                !followed.has(author.id) &&
                !hidden.has(author.login) &&
                recipes.some((recipe) => recipe.authorLogin === author.login),
        )
        .map((author): RankedAuthor => {
            const authored = recipes.filter((recipe) => recipe.authorLogin === author.login);
            const authoredIds = new Set(authored.map((recipe) => recipe.id));
            const likedScore =
                (state.recipes.bookmarks[userId] ?? []).filter((id) => authoredIds.has(id)).length +
                3 *
                    state.cookingWorkflow.attempts.filter(
                        (row) =>
                            row.userId === userId &&
                            row.attempt.status === 'completed' &&
                            authoredIds.has(row.recipe.id),
                    ).length;
            const rated = authored.filter((recipe) => recipe.rating !== null);
            const ratingScore = rated.length
                ? rated.reduce((sum, recipe) => sum + recipe.rating!, 0) / rated.length
                : 0;
            const supporters = new Set(
                state.recommendations.follows
                    .filter((row) => row.authorId === author.id && peers.has(row.followerId))
                    .map((row) => row.followerId),
            );
            const collaborativeScore =
                supporters.size >= recommendationPolicy.minCollaborativeContributors
                    ? [...supporters].reduce((sum, id) => sum + (peers.get(id) ?? 0), 0)
                    : 0;
            const reasonCode =
                likedScore > 0 ? 'liked_recipes' : collaborativeScore > 0 ? 'similar_readers' : 'popular_author';
            return {
                authorId: author.id,
                username: author.login,
                displayName: author.name,
                recipeCount: authored.length,
                score: Math.min(100, likedScore * 12 + collaborativeScore + ratingScore * 8),
                reasonCode,
                reason:
                    reasonCode === 'liked_recipes'
                        ? 'Вы уже интересовались рецептами этого автора'
                        : reasonCode === 'similar_readers'
                          ? 'Его выбирают люди с похожими интересами'
                          : 'Автор публикует популярные рецепты',
            };
        })
        .sort((a, b) => b.score - a.score || a.username.localeCompare(b.username));
}

/** Greedy diversity pass prevents a short shelf from being filled by near-duplicates. */
export function diversifyRecipes(ranked: RankedRecipe[], limit: number) {
    const selected: RankedRecipe[] = [];
    const categoryCount = new Map<string, number>();
    for (const candidate of ranked) {
        if (selected.length >= limit) break;
        const category = candidate.recipe.category ?? 'uncategorized';
        if ((categoryCount.get(category) ?? 0) >= 2 && ranked.length > limit) continue;
        selected.push(candidate);
        categoryCount.set(category, (categoryCount.get(category) ?? 0) + 1);
    }
    return selected;
}

type RecommendationContext = {
    state: MockState;
    userId: string | null;
    path: string;
    params: Record<string, string>;
    method: string;
    query: URLSearchParams;
    input: unknown;
    now: number;
    success: (data: unknown) => Response;
    fail: (status: number) => Response;
};

const replay = (state: RecommendationsState, key: string, input: unknown, run: () => unknown) => {
    const signature = JSON.stringify(input);
    const prior = state.replay[key];
    if (prior) return prior.signature === signature ? prior.result : Symbol.for('conflict');
    const result = run();
    if (typeof result === 'symbol') return result;
    state.replay[key] = { signature, result };
    return result;
};

export function recommendationsHandle(context: RecommendationContext): Response | null {
    const { state, userId, path, params, method, query, input, now, success, fail } = context;
    if (
        path !== '/api/v1/recommendations' &&
        path !== '/api/v1/recommendations/events' &&
        !/^\/api\/v1\/authors\/[^/]+\/follow$/.test(path)
    )
        return null;
    if (!userId) return fail(401);

    if (path === '/api/v1/recommendations' && method === 'GET') {
        const parsed = z
            .object({
                type: z.enum(['recipe', 'author']).default('recipe'),
                scope: z.enum(['private', 'family']).default('private'),
                surface: z.enum(['home', 'recipes', 'authors']).default('recipes'),
                limit: z.coerce.number().int().min(1).max(50).default(20),
            })
            .strict()
            .safeParse(Object.fromEntries(query));
        if (!parsed.success) return fail(400);
        if (
            (parsed.data.type === 'recipe' && parsed.data.surface === 'authors') ||
            (parsed.data.type === 'author' && parsed.data.surface !== 'authors')
        )
            return fail(400);
        let inventoryOwnerId = userId;
        if (parsed.data.scope === 'family') {
            const family = mockFamilyContext(state, userId);
            if (family.state === 'none' || !family.family) return fail(404);
            if (family.state !== 'active') return fail(403);
            inventoryOwnerId = family.family.id;
            seedInventoryFixtures(state.inventory, inventoryOwnerId, userId, 'family', now);
        } else seedInventoryFixtures(state.inventory, userId, now);
        const recipes = publicRecipeFixtures().filter((recipe) => {
            const author = state.users.find((candidate) => candidate.login === recipe.authorLogin);
            return (
                !state.recipeWorkspace.hidden.includes(recipe.id) &&
                (!author || hasConsent(state.legal, author.id, 'dissemination'))
            );
        });
        state.recommendations.issued = state.recommendations.issued.filter((item) => item.expiresAt > now);
        const issue = (
            entityType: 'recipe' | 'author',
            entityId: string,
            currentRecommendationId: string,
            position: number,
            reasonCodes: string[],
        ) => {
            const previous = state.recommendations.issued.find(
                (item) => item.recommendationId === currentRecommendationId && item.userId === userId,
            );
            const value = {
                recommendationId: currentRecommendationId,
                userId,
                entityType,
                entityId,
                surface: parsed.data.surface,
                position,
                reasonCodes,
                expiresAt: now + 86_400_000,
            };
            if (previous) Object.assign(previous, value);
            else state.recommendations.issued.push(value);
        };
        const items =
            parsed.data.type === 'recipe'
                ? diversifyRecipes(
                      rankRecipeRecommendations(state, userId, recipes, now, inventoryOwnerId),
                      parsed.data.limit,
                  ).map((ranked, position) => {
                      const summary = recipeSummary(ranked.recipe);
                      summary.availability = {
                          requiredCount: ranked.availability.requiredCount,
                          presentCount: ranked.availability.presentCount,
                          presencePercent: ranked.availability.presencePercent,
                          canPrepare: ranked.availability.canPrepare,
                          needsQuantityCheck: ranked.availability.needsQuantityCheck,
                      };
                      const currentRecommendationId = crypto.randomUUID();
                      issue('recipe', ranked.recipe.id, currentRecommendationId, position, [ranked.reasonCode]);
                      return {
                          type: 'recipe' as const,
                          recommendationId: currentRecommendationId,
                          algorithmVersion: 'personalized-v1' as const,
                          score: Math.max(0, Math.min(100, ranked.score)),
                          reasonCodes: [ranked.reasonCode],
                          reasons: [{ code: ranked.reasonCode, text: ranked.reason }],
                          safetyWarnings: ranked.safetyWarnings,
                          recipe: summary,
                      };
                  })
                : rankAuthorRecommendations(state, userId, recipes)
                      .slice(0, parsed.data.limit)
                      .map((ranked, position) => {
                          const authored = recipes.filter((recipe) => recipe.authorLogin === ranked.username);
                          const ratings = authored.filter((recipe) => recipe.rating !== null);
                          const currentRecommendationId = crypto.randomUUID();
                          const reasonCode =
                              ranked.reasonCode === 'liked_recipes'
                                  ? ('author_affinity' as const)
                                  : ranked.reasonCode === 'similar_readers'
                                    ? ('author_similar_audience' as const)
                                    : ('author_quality' as const);
                          issue('author', ranked.username, currentRecommendationId, position, [reasonCode]);
                          return {
                              type: 'author' as const,
                              recommendationId: currentRecommendationId,
                              algorithmVersion: 'personalized-v1' as const,
                              score: Math.max(0, Math.min(100, ranked.score)),
                              reasonCodes: [reasonCode],
                              reasons: [{ code: reasonCode, text: ranked.reason }],
                              safetyWarnings: [],
                              author: {
                                  username: ranked.username,
                                  recipeCount: ranked.recipeCount,
                                  averageRating: ratings.length
                                      ? ratings.reduce((sum, recipe) => sum + recipe.rating!, 0) / ratings.length
                                      : null,
                                  followerCount: state.recommendations.follows.filter(
                                      (follow) => follow.authorId === ranked.authorId,
                                  ).length,
                                  followed: false as const,
                              },
                          };
                      });
        return success({ algorithm: 'personalized-v1', items });
    }

    if (path === '/api/v1/recommendations/events' && method === 'POST') {
        const parsed = contracts['POST /api/v1/recommendations/events'].request.safeParse(input);
        if (!parsed.success) return fail(400);
        const value = parsed.data;
        const result = replay(
            state.recommendations,
            `${userId}:recommendation-event:${value.idempotencyKey}`,
            value,
            () => {
                const issued = state.recommendations.issued.find(
                    (item) => item.userId === userId && item.recommendationId === value.recommendationId,
                );
                if (
                    !issued ||
                    issued.expiresAt <= now ||
                    issued.entityType !== value.entityType ||
                    issued.entityId !== value.entityId ||
                    issued.surface !== value.surface ||
                    issued.position !== value.position ||
                    JSON.stringify(issued.reasonCodes) !== JSON.stringify(value.reasonCodes)
                )
                    return Symbol.for('missing');
                const targetExists =
                    value.entityType === 'recipe'
                        ? publicRecipeFixtures().some((recipe) => recipe.id === value.entityId)
                        : state.users.some((user) => user.login === value.entityId && user.active && user.verified);
                if (!targetExists) return Symbol.for('missing');
                state.recommendations.events.push({
                    id: crypto.randomUUID(),
                    userId,
                    recommendationId: value.recommendationId,
                    entityType: value.entityType,
                    entityId: value.entityId,
                    event: value.event,
                    algorithm: value.algorithm,
                    surface: value.surface,
                    position: value.position,
                    reasonCodes: value.reasonCodes,
                    occurredAt: new Date(now).toISOString(),
                });
                return { accepted: true as const };
            },
        );
        if (result === Symbol.for('conflict')) return fail(409);
        if (result === Symbol.for('missing')) return fail(404);
        return success(result);
    }

    if (method === 'PUT' && path.endsWith('/follow')) {
        const parsed = contracts['PUT /api/v1/authors/{username}/follow'].request.safeParse(input);
        if (!parsed.success) return fail(400);
        const author = state.users.find((user) => user.login === params.username && user.active && user.verified);
        if (!author || !hasConsent(state.legal, author.id, 'dissemination')) return fail(404);
        if (author.id === userId) return fail(422);
        const value = parsed.data;
        const result = replay(
            state.recommendations,
            `${userId}:author-follow:${author.id}:${value.idempotencyKey}`,
            value,
            () => {
                state.recommendations.follows = state.recommendations.follows.filter(
                    (follow) => follow.followerId !== userId || follow.authorId !== author.id,
                );
                if (value.following)
                    state.recommendations.follows.push({
                        followerId: userId,
                        authorId: author.id,
                        createdAt: new Date(now).toISOString(),
                    });
                return { username: author.login, following: value.following };
            },
        );
        if (result === Symbol.for('conflict')) return fail(409);
        return success(result);
    }
    return fail(404);
}
