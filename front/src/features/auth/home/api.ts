import type { ApiClient } from '../../../shared/api/client.js';
import type { Success } from '../../../shared/api/contracts.generated.js';

export type AuthHomeTransport = Pick<ApiClient, 'request'>;
export type AuthHomeScope = 'personal' | 'family';
export type HomeRecipeRecommendation = Extract<
    Success<'GET /api/v1/recommendations'>['data']['items'][number],
    { type: 'recipe' }
>;

export async function loadAuthHome(
    transport: AuthHomeTransport,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/home'>['data']> {
    return (await transport.request('GET /api/v1/home', undefined, signal)).data;
}

export async function loadAuthHomeRecipeRecommendations(
    transport: AuthHomeTransport,
    scope: AuthHomeScope,
    signal?: AbortSignal,
): Promise<HomeRecipeRecommendation[]> {
    const result = await transport.request('GET /api/v1/recommendations', undefined, signal, undefined, {
        query: {
            type: 'recipe',
            scope: scope === 'family' ? 'family' : 'private',
            surface: 'home',
            limit: '3',
        },
    });
    return result.data.items.filter((item): item is HomeRecipeRecommendation => item.type === 'recipe');
}
