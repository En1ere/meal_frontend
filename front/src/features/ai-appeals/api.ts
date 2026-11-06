import type { z } from 'zod';
import type { ApiClient } from '../../shared/api/client.js';
import type { contracts, Success } from '../../shared/api/contracts.generated.js';

export type AiAppealsList = Success<'GET /api/v1/ai/appeals'>['data'];
export type AiAppealDetail = Success<'GET /api/v1/ai/appeals/{id}'>['data'];
export type CreateAiAppealCommand = Omit<
    z.input<(typeof contracts)['POST /api/v1/ai/appeals']['request']>,
    'idempotencyKey'
>;
export type ReplyAiAppealCommand = Omit<
    z.input<(typeof contracts)['POST /api/v1/support/{id}/reply']['request']>,
    'idempotencyKey'
>;
export type AiAppealsTransport = Pick<ApiClient, 'request'>;

export async function loadAiAppeals(transport: AiAppealsTransport, signal?: AbortSignal): Promise<AiAppealsList> {
    return (await transport.request('GET /api/v1/ai/appeals', undefined, signal)).data;
}

export async function createAiAppeal(
    transport: AiAppealsTransport,
    command: CreateAiAppealCommand,
): Promise<Success<'POST /api/v1/ai/appeals'>['data']> {
    return (
        await transport.request('POST /api/v1/ai/appeals', {
            ...command,
            idempotencyKey: crypto.randomUUID(),
        })
    ).data;
}

export async function loadAiAppeal(
    transport: AiAppealsTransport,
    id: string,
    signal?: AbortSignal,
): Promise<AiAppealDetail> {
    return (await transport.request('GET /api/v1/ai/appeals/{id}', undefined, signal, { id })).data;
}

export async function replyAiAppeal(
    transport: AiAppealsTransport,
    ticketId: string,
    command: ReplyAiAppealCommand,
): Promise<Success<'POST /api/v1/support/{id}/reply'>['data']> {
    return (
        await transport.request(
            'POST /api/v1/support/{id}/reply',
            {
                ...command,
                idempotencyKey: crypto.randomUUID(),
            },
            undefined,
            { id: ticketId },
        )
    ).data;
}
