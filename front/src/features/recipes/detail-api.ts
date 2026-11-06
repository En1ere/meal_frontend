import type { z } from 'zod';
import type { ApiClient } from '../../shared/api/client.js';
import type { contracts, Success } from '../../shared/api/contracts.generated.js';

type RecipeDetailTransport = Pick<ApiClient, 'request'>;
export type RecipeBookmarkCommand = z.input<(typeof contracts)['POST /api/v1/recipes/{id}/bookmark']['request']>;

export async function loadRecipeDetail(
    transport: RecipeDetailTransport,
    id: string,
    signal: AbortSignal,
): Promise<Success<'GET /api/v1/recipes/{id}'>['data']['recipe']> {
    return (await transport.request('GET /api/v1/recipes/{id}', undefined, signal, { id })).data.recipe;
}

export async function loadRecipePersonal(
    transport: RecipeDetailTransport,
    id: string,
    servings: number,
    signal: AbortSignal,
): Promise<Success<'GET /api/v1/recipes/{id}/personal'>['data']> {
    return (
        await transport.request(
            'GET /api/v1/recipes/{id}/personal',
            undefined,
            signal,
            { id },
            {
                query: { servings: String(servings) },
            },
        )
    ).data;
}

export async function loadRecipeStatistics(
    transport: RecipeDetailTransport,
    id: string,
    servings: number,
    signal: AbortSignal,
): Promise<Success<'GET /api/v1/recipes/{id}/cooking-statistics'>['data']> {
    return (
        await transport.request(
            'GET /api/v1/recipes/{id}/cooking-statistics',
            undefined,
            signal,
            { id },
            {
                query: { servings: String(servings) },
            },
        )
    ).data;
}

export async function saveRecipeBookmark(
    transport: RecipeDetailTransport,
    id: string,
    command: RecipeBookmarkCommand,
    signal: AbortSignal,
): Promise<void> {
    await transport.request('POST /api/v1/recipes/{id}/bookmark', command, signal, { id });
}
