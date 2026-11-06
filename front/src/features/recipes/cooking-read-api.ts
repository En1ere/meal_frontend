import { ApiError, type ApiClient } from '../../shared/api/client.js';
import type { Success } from '../../shared/api/contracts.generated.js';

type CookingReadTransport = Pick<ApiClient, 'request'>;
type CookingView = 'current' | 'all' | 'archive';
export type CookingRecipe = Pick<
    Success<'GET /api/v1/recipes/{id}'>['data']['recipe'],
    'id' | 'revisionId' | 'title' | 'baseServings'
>;

export async function loadCookingStockOptions(transport: CookingReadTransport, signal: AbortSignal) {
    return (await transport.request('GET /api/v1/cooking-attempts/stock-options', undefined, signal)).data;
}

export async function loadCookingLocations(transport: CookingReadTransport, signal: AbortSignal) {
    return (await transport.request('GET /api/v1/inventory-locations', undefined, signal)).data;
}

export async function loadCookingAttempts(
    transport: CookingReadTransport,
    view: CookingView,
    signal: AbortSignal,
): Promise<Success<'GET /api/v1/cooking-attempts'>['data']> {
    return (await transport.request('GET /api/v1/cooking-attempts', undefined, signal, undefined, { query: { view } }))
        .data;
}

export async function loadCookingAttempt(
    transport: CookingReadTransport,
    id: string,
    signal: AbortSignal,
): Promise<Success<'GET /api/v1/cooking-attempts/{id}'>['data']> {
    return (await transport.request('GET /api/v1/cooking-attempts/{id}', undefined, signal, { id })).data;
}

export async function loadCookingRecipe(
    transport: CookingReadTransport,
    id: string,
    signal: AbortSignal,
): Promise<CookingRecipe> {
    try {
        return (await transport.request('GET /api/v1/recipes/{id}', undefined, signal, { id })).data.recipe;
    } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 404) throw error;
        const own = (await transport.request('GET /api/v1/recipe-workspace/{id}', undefined, signal, { id })).data
            .recipe;
        return {
            id: own.id,
            revisionId: own.revisionId,
            title: own.document.title,
            baseServings: own.document.baseServings,
        };
    }
}
