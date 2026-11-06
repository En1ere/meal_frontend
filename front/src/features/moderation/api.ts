import type { z } from 'zod';
import type { ApiClient } from '../../shared/api/client.js';
import type { contracts, Success } from '../../shared/api/contracts.generated.js';

export type ModerationQueueFilters = { status: string; assignment: string; priority: string };
export type ModerationQueueAction = 'claim' | 'skip';
export type ModerationQueueCommand = z.input<(typeof contracts)['POST /api/v1/moderator/items/{id}/claim']['request']>;
export type ModerationDecisionCommand = z.input<
    (typeof contracts)['POST /api/v1/moderator/items/{id}/decision']['request']
>;
export type ModerationSupportReplyCommand = z.input<
    (typeof contracts)['POST /api/v1/moderator/support/{id}/reply']['request']
>;
export type ModerationSupportReopenCommand = z.input<
    (typeof contracts)['POST /api/v1/moderator/support/{id}/reopen']['request']
>;
export type ModerationTransport = Pick<ApiClient, 'request'>;

export async function loadModerationOverview(
    transport: ModerationTransport,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/moderator/overview'>['data']> {
    return (await transport.request('GET /api/v1/moderator/overview', undefined, signal)).data;
}

export async function loadModerationQueue(
    transport: ModerationTransport,
    queue: string,
    filters: ModerationQueueFilters,
    cursor: string | null,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/moderator/queues/{queue}'>['data']> {
    return (
        await transport.request(
            'GET /api/v1/moderator/queues/{queue}',
            undefined,
            signal,
            { queue },
            {
                query: { ...filters, ...(cursor ? { cursor } : {}) },
            },
        )
    ).data;
}

export async function applyModerationQueueAction(
    transport: ModerationTransport,
    action: ModerationQueueAction,
    id: string,
    command: ModerationQueueCommand,
): Promise<
    | Success<'POST /api/v1/moderator/items/{id}/claim'>['data']
    | Success<'POST /api/v1/moderator/items/{id}/skip'>['data']
> {
    if (action === 'claim')
        return (await transport.request('POST /api/v1/moderator/items/{id}/claim', command, undefined, { id })).data;
    return (await transport.request('POST /api/v1/moderator/items/{id}/skip', command, undefined, { id })).data;
}

export async function loadModerationItem(
    transport: ModerationTransport,
    id: string,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/moderator/items/{id}'>['data']> {
    return (await transport.request('GET /api/v1/moderator/items/{id}', undefined, signal, { id })).data;
}

export async function decideModerationItem(
    transport: ModerationTransport,
    id: string,
    command: ModerationDecisionCommand,
): Promise<Success<'POST /api/v1/moderator/items/{id}/decision'>['data']> {
    return (await transport.request('POST /api/v1/moderator/items/{id}/decision', command, undefined, { id })).data;
}

export async function loadModerationSupport(
    transport: ModerationTransport,
    id: string,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/moderator/support/{id}'>['data']> {
    return (await transport.request('GET /api/v1/moderator/support/{id}', undefined, signal, { id })).data;
}

export async function replyToModerationSupport(
    transport: ModerationTransport,
    id: string,
    command: ModerationSupportReplyCommand,
): Promise<Success<'POST /api/v1/moderator/support/{id}/reply'>['data']> {
    return (await transport.request('POST /api/v1/moderator/support/{id}/reply', command, undefined, { id })).data;
}

export async function reopenModerationSupport(
    transport: ModerationTransport,
    id: string,
    command: ModerationSupportReopenCommand,
): Promise<Success<'POST /api/v1/moderator/support/{id}/reopen'>['data']> {
    return (await transport.request('POST /api/v1/moderator/support/{id}/reopen', command, undefined, { id })).data;
}
