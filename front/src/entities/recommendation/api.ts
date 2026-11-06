import type { z } from 'zod';
import type { ApiClient } from '../../shared/api/client.js';
import type { contracts, Success } from '../../shared/api/contracts.generated.js';

export type FollowingPage = Success<'GET /api/v1/profile/following'>['data'];
export type AuthorFollowState = Success<'GET /api/v1/authors/{username}/follow'>['data'];
export type RecommendationEventCommand = Omit<
    z.input<(typeof contracts)['POST /api/v1/recommendations/events']['request']>,
    'idempotencyKey'
>;
export type RecommendationReadTransport = Pick<ApiClient, 'request'>;
type Recommendation = Success<'GET /api/v1/recommendations'>['data']['items'][number];
export type RecipeRecommendation = Extract<Recommendation, { type: 'recipe' }>;
export type AuthorRecommendation = Extract<Recommendation, { type: 'author' }>;

export async function loadRecipeRecommendations(
    transport: RecommendationReadTransport,
    signal: AbortSignal,
): Promise<RecipeRecommendation[]> {
    return (
        await transport.request('GET /api/v1/recommendations', undefined, signal, undefined, {
            query: { type: 'recipe', scope: 'private', surface: 'recipes', limit: '12' },
        })
    ).data.items.filter((item): item is RecipeRecommendation => item.type === 'recipe');
}

export async function loadAuthorRecommendations(
    transport: RecommendationReadTransport,
    signal: AbortSignal,
): Promise<AuthorRecommendation[]> {
    return (
        await transport.request('GET /api/v1/recommendations', undefined, signal, undefined, {
            query: { type: 'author', scope: 'private', surface: 'authors', limit: '3' },
        })
    ).data.items.filter((item): item is AuthorRecommendation => item.type === 'author');
}

export async function loadFollowingPage(
    transport: RecommendationReadTransport,
    cursor: string | null,
    signal?: AbortSignal,
): Promise<FollowingPage> {
    return (
        await transport.request('GET /api/v1/profile/following', undefined, signal, undefined, {
            query: { limit: '20', ...(cursor ? { cursor } : {}) },
        })
    ).data;
}

export async function loadAuthorFollowState(
    transport: RecommendationReadTransport,
    username: string,
    signal?: AbortSignal,
): Promise<AuthorFollowState> {
    return (await transport.request('GET /api/v1/authors/{username}/follow', undefined, signal, { username })).data;
}

export async function recordRecommendationEvent(
    transport: RecommendationReadTransport,
    input: RecommendationEventCommand,
): Promise<void> {
    await transport.request('POST /api/v1/recommendations/events', {
        ...input,
        idempotencyKey: crypto.randomUUID(),
    });
}

export async function setAuthorFollowing(
    transport: RecommendationReadTransport,
    username: string,
    following: boolean,
): Promise<AuthorFollowState> {
    return (
        await transport.request(
            'PUT /api/v1/authors/{username}/follow',
            {
                following,
                idempotencyKey: crypto.randomUUID(),
            },
            undefined,
            { username },
        )
    ).data;
}
