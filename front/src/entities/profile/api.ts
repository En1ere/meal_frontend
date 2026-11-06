import type { z } from 'zod';
import type { ApiClient } from '../../shared/api/client.js';
import type { contracts, Success } from '../../shared/api/contracts.generated.js';

export type OwnProfile = Success<'GET /api/v1/profile'>['data']['profile'];
export type PublicProfile = Success<'GET /api/v1/authors/{username}'>['data']['profile'];
export type PublicAchievements = Success<'GET /api/v1/authors/{username}/achievements'>['data'];
export type PublicReputation = Success<'GET /api/v1/authors/{username}/reputation'>['data'];
export type UpdateOwnProfileCommand = Omit<
    z.input<(typeof contracts)['PUT /api/v1/profile']['request']>,
    'idempotencyKey'
>;
export type ProfileReadTransport = Pick<ApiClient, 'request'>;

export async function loadOwnProfile(transport: ProfileReadTransport, signal?: AbortSignal): Promise<OwnProfile> {
    return (await transport.request('GET /api/v1/profile', undefined, signal)).data.profile;
}

export async function loadPublicProfile(
    transport: ProfileReadTransport,
    username: string,
    signal?: AbortSignal,
): Promise<PublicProfile> {
    return (await transport.request('GET /api/v1/authors/{username}', undefined, signal, { username })).data.profile;
}

export async function loadPublicAchievements(
    transport: ProfileReadTransport,
    username: string,
    signal?: AbortSignal,
): Promise<PublicAchievements> {
    return (await transport.request('GET /api/v1/authors/{username}/achievements', undefined, signal, { username }))
        .data;
}

export async function loadPublicReputation(
    transport: ProfileReadTransport,
    username: string,
    signal?: AbortSignal,
): Promise<PublicReputation> {
    return (await transport.request('GET /api/v1/authors/{username}/reputation', undefined, signal, { username })).data;
}

export async function updateOwnProfile(
    transport: ProfileReadTransport,
    input: UpdateOwnProfileCommand,
): Promise<OwnProfile> {
    return (
        await transport.request('PUT /api/v1/profile', {
            ...input,
            idempotencyKey: crypto.randomUUID(),
        })
    ).data.profile;
}
