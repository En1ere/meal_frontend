import type { ApiClient } from '../../shared/api/client.js';
import type { Success } from '../../shared/api/contracts.generated.js';

export type RecipeReadTransport = Pick<ApiClient, 'request'>;

export async function loadRecipeCatalog(
    transport: RecipeReadTransport,
    state: {
        q: string;
        category: string;
        tab: 'for-you' | 'inventory' | 'new';
        page: number;
    },
    signal: AbortSignal,
): Promise<Success<'GET /api/v1/recipes'>['data']> {
    return (
        await transport.request('GET /api/v1/recipes', undefined, signal, undefined, {
            query: {
                q: state.q,
                ...(state.category ? { category: state.category } : {}),
                tab: state.tab,
                page: String(state.page),
                limit: '12',
            },
        })
    ).data;
}

export async function loadRecipeCommunity(
    transport: RecipeReadTransport,
    id: string,
    signal: AbortSignal,
): Promise<Success<'GET /api/v1/recipe-workspace/{id}/community'>['data']> {
    return (await transport.request('GET /api/v1/recipe-workspace/{id}/community', undefined, signal, { id })).data;
}

export async function loadPublicCommunity(
    transport: RecipeReadTransport,
    filters: {
        q: string;
        category: string;
        sort: 'newest' | 'oldest';
        author: string | undefined;
        cursor: string | null;
    },
    signal: AbortSignal,
): Promise<Success<'GET /api/v1/community'>['data']> {
    return (
        await transport.request('GET /api/v1/community', undefined, signal, undefined, {
            query: {
                q: filters.q,
                ...(filters.category ? { category: filters.category } : {}),
                sort: filters.sort,
                limit: '12',
                ...(filters.author ? { author: filters.author } : {}),
                ...(filters.cursor ? { cursor: filters.cursor } : {}),
            },
        })
    ).data;
}

export async function loadPublicRecipeComments(
    transport: RecipeReadTransport,
    recipeId: string,
    cursor: string | null,
    signal: AbortSignal,
): Promise<Success<'GET /api/v1/community/recipes/{id}/comments'>['data']> {
    return (
        await transport.request(
            'GET /api/v1/community/recipes/{id}/comments',
            undefined,
            signal,
            { id: recipeId },
            {
                query: { limit: '20', ...(cursor ? { cursor } : {}) },
            },
        )
    ).data;
}

export async function loadPreparedStockOptions(
    transport: RecipeReadTransport,
    signal: AbortSignal,
): Promise<Success<'GET /api/v1/cooking-attempts/stock-options'>['data']> {
    return (await transport.request('GET /api/v1/cooking-attempts/stock-options', undefined, signal)).data;
}

export async function loadFamilyRecipe(
    transport: RecipeReadTransport,
    id: string,
    signal: AbortSignal,
): Promise<Success<'GET /api/v1/recipe-workspace/{id}'>['data']['recipe']> {
    return (
        await transport.request(
            'GET /api/v1/recipe-workspace/{id}',
            undefined,
            signal,
            { id },
            {
                query: { scope: 'family' },
            },
        )
    ).data.recipe;
}

export async function loadFamilyRecipeProducts(
    transport: RecipeReadTransport,
    signal: AbortSignal,
): Promise<Success<'GET /api/v1/products'>['data']['items']> {
    return (await transport.request('GET /api/v1/products', undefined, signal, undefined, { query: { limit: '100' } }))
        .data.items;
}
