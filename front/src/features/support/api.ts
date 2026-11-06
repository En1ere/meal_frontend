import type { z } from 'zod';
import type { ApiClient } from '../../shared/api/client.js';
import type { contracts, Success } from '../../shared/api/contracts.generated.js';

export type SupportTransport = Pick<ApiClient, 'request'>;
export type SupportListFilters = { category: string; status: string };
export type SupportCreateCommand = z.input<(typeof contracts)['POST /api/v1/support']['request']>;
export type SupportReplyCommand = z.input<(typeof contracts)['POST /api/v1/support/{id}/reply']['request']>;
export type SupportStateCommand = z.input<(typeof contracts)['POST /api/v1/support/{id}/close']['request']>;
export type SupportStateAction = 'close' | 'reopen';
export type SupportEditCommand = z.input<
    (typeof contracts)['PATCH /api/v1/support/{id}/messages/{messageId}']['request']
>;

export async function loadSupportList(
    transport: SupportTransport,
    filters: SupportListFilters,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/support'>['data']> {
    return (
        await transport.request('GET /api/v1/support', undefined, signal, undefined, {
            query: filters,
        })
    ).data;
}

export async function loadSupportMeta(
    transport: SupportTransport,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/support/meta'>['data']> {
    return (await transport.request('GET /api/v1/support/meta', undefined, signal)).data;
}

export async function createSupportTicket(
    transport: SupportTransport,
    command: SupportCreateCommand,
): Promise<Success<'POST /api/v1/support'>['data']> {
    return (await transport.request('POST /api/v1/support', command)).data;
}

export async function loadSupportTicket(
    transport: SupportTransport,
    id: string,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/support/{id}'>['data']> {
    return (await transport.request('GET /api/v1/support/{id}', undefined, signal, { id })).data;
}

export async function replyToSupportTicket(
    transport: SupportTransport,
    id: string,
    command: SupportReplyCommand,
): Promise<Success<'POST /api/v1/support/{id}/reply'>['data']> {
    return (await transport.request('POST /api/v1/support/{id}/reply', command, undefined, { id })).data;
}

export async function changeSupportTicketState(
    transport: SupportTransport,
    action: SupportStateAction,
    id: string,
    command: SupportStateCommand,
): Promise<Success<'POST /api/v1/support/{id}/close'>['data'] | Success<'POST /api/v1/support/{id}/reopen'>['data']> {
    if (action === 'close')
        return (await transport.request('POST /api/v1/support/{id}/close', command, undefined, { id })).data;
    return (await transport.request('POST /api/v1/support/{id}/reopen', command, undefined, { id })).data;
}

export async function editSupportMessage(
    transport: SupportTransport,
    id: string,
    messageId: string,
    command: SupportEditCommand,
): Promise<Success<'PATCH /api/v1/support/{id}/messages/{messageId}'>['data']> {
    return (
        await transport.request('PATCH /api/v1/support/{id}/messages/{messageId}', command, undefined, {
            id,
            messageId,
        })
    ).data;
}
