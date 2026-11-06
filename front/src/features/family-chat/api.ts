import type { z } from 'zod';
import type { ApiClient } from '../../shared/api/client.js';
import type { contracts, Success } from '../../shared/api/contracts.generated.js';

export type FamilyChatTransport = Pick<ApiClient, 'request'>;
export type FamilyChatReadCommand = z.input<(typeof contracts)['POST /api/v1/family/chat/read']['request']>;
export type FamilyChatSendCommand = z.input<(typeof contracts)['POST /api/v1/family/chat/messages']['request']>;
export type FamilyChatEditCommand = z.input<(typeof contracts)['PUT /api/v1/family/chat/messages/{id}']['request']>;
export type FamilyChatDraftCommand = z.input<(typeof contracts)['PUT /api/v1/family/chat/draft']['request']>;
export type FamilyChatReactionCommand = z.input<
    (typeof contracts)['POST /api/v1/family/chat/messages/{id}/reaction']['request']
>;
export type FamilyChatPinCommand = z.input<(typeof contracts)['POST /api/v1/family/chat/messages/{id}/pin']['request']>;
export type FamilyChatHideCommand = z.input<
    (typeof contracts)['POST /api/v1/family/chat/messages/{id}/hide']['request']
>;
export type FamilyChatRemoveCommand = z.input<
    (typeof contracts)['POST /api/v1/family/chat/messages/{id}/remove']['request']
>;

export async function loadFamilyChat(
    transport: FamilyChatTransport,
    query: string,
    before: string | null,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/family/chat'>['data']> {
    return (
        await transport.request('GET /api/v1/family/chat', undefined, signal, undefined, {
            query: { q: query, ...(before ? { before } : {}) },
        })
    ).data;
}

export function markFamilyChatRead(
    transport: FamilyChatTransport,
    command: FamilyChatReadCommand,
): Promise<Success<'POST /api/v1/family/chat/read'>> {
    return transport.request('POST /api/v1/family/chat/read', command);
}

export function sendFamilyChatMessage(
    transport: FamilyChatTransport,
    command: FamilyChatSendCommand,
): Promise<Success<'POST /api/v1/family/chat/messages'>> {
    return transport.request('POST /api/v1/family/chat/messages', command);
}

export function editFamilyChatMessage(
    transport: FamilyChatTransport,
    id: string,
    command: FamilyChatEditCommand,
): Promise<Success<'PUT /api/v1/family/chat/messages/{id}'>> {
    return transport.request('PUT /api/v1/family/chat/messages/{id}', command, undefined, { id });
}

export function saveFamilyChatDraft(
    transport: FamilyChatTransport,
    command: FamilyChatDraftCommand,
): Promise<Success<'PUT /api/v1/family/chat/draft'>> {
    return transport.request('PUT /api/v1/family/chat/draft', command);
}

export function reactToFamilyChatMessage(
    transport: FamilyChatTransport,
    id: string,
    command: FamilyChatReactionCommand,
): Promise<Success<'POST /api/v1/family/chat/messages/{id}/reaction'>> {
    return transport.request('POST /api/v1/family/chat/messages/{id}/reaction', command, undefined, { id });
}

export function pinFamilyChatMessage(
    transport: FamilyChatTransport,
    id: string,
    command: FamilyChatPinCommand,
): Promise<Success<'POST /api/v1/family/chat/messages/{id}/pin'>> {
    return transport.request('POST /api/v1/family/chat/messages/{id}/pin', command, undefined, { id });
}

export function hideFamilyChatMessage(
    transport: FamilyChatTransport,
    id: string,
    command: FamilyChatHideCommand,
): Promise<Success<'POST /api/v1/family/chat/messages/{id}/hide'>> {
    return transport.request('POST /api/v1/family/chat/messages/{id}/hide', command, undefined, { id });
}

export function removeFamilyChatMessage(
    transport: FamilyChatTransport,
    id: string,
    command: FamilyChatRemoveCommand,
): Promise<Success<'POST /api/v1/family/chat/messages/{id}/remove'>> {
    return transport.request('POST /api/v1/family/chat/messages/{id}/remove', command, undefined, { id });
}
