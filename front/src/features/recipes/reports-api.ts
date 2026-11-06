import type { ApiClient } from '../../shared/api/client.js';
import type { Success } from '../../shared/api/contracts.generated.js';

export type RecipeReportsTransport = Pick<ApiClient, 'request'>;

export async function loadRecipeReports(
    transport: RecipeReportsTransport,
    page: number,
    signal: AbortSignal,
): Promise<Success<'GET /api/v1/recipe-workspace/reports'>['data']> {
    return (
        await transport.request('GET /api/v1/recipe-workspace/reports', undefined, signal, undefined, {
            query: { page: String(page), limit: '20' },
        })
    ).data;
}

export async function loadRecipeReport(
    transport: RecipeReportsTransport,
    id: string,
    signal: AbortSignal,
): Promise<Success<'GET /api/v1/recipe-workspace/reports/{id}'>['data']> {
    return (await transport.request('GET /api/v1/recipe-workspace/reports/{id}', undefined, signal, { id })).data;
}
