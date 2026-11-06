import type { z } from 'zod';
import type { ApiClient } from '../../shared/api/client.js';
import type { contracts, Success } from '../../shared/api/contracts.generated.js';

export type FamilyNoteTab = 'active' | 'archived';
export type FamilyNote = Success<'GET /api/v1/family/notes/{id}'>['data'];
export type FamilyNoteList = Success<'GET /api/v1/family/notes'>['data']['items'];
export type FamilyNoteHistory = Success<'GET /api/v1/family/notes/{id}/history'>['data']['items'];
export type ToggleFamilyNoteItemCommand = z.input<
    (typeof contracts)['POST /api/v1/family/notes/{id}/items/{itemId}/toggle']['request']
>;
export type ArchiveFamilyNoteCommand = z.input<(typeof contracts)['POST /api/v1/family/notes/{id}/archive']['request']>;
export type CreateFamilyNoteCommand = z.input<(typeof contracts)['POST /api/v1/family/notes']['request']>;
export type UpdateFamilyNoteCommand = z.input<(typeof contracts)['PUT /api/v1/family/notes/{id}']['request']>;
export type FamilyNotesTransport = Pick<ApiClient, 'request'>;

export async function loadFamilyNotes(
    transport: FamilyNotesTransport,
    tab: FamilyNoteTab,
    query: string,
    signal?: AbortSignal,
): Promise<FamilyNoteList> {
    return (
        await transport.request('GET /api/v1/family/notes', undefined, signal, undefined, { query: { tab, q: query } })
    ).data.items;
}

export async function loadFamilyNote(
    transport: FamilyNotesTransport,
    id: string,
    signal?: AbortSignal,
): Promise<FamilyNote> {
    return (await transport.request('GET /api/v1/family/notes/{id}', undefined, signal, { id })).data;
}

export async function loadFamilyNoteHistory(
    transport: FamilyNotesTransport,
    id: string,
    signal?: AbortSignal,
): Promise<FamilyNoteHistory> {
    return (await transport.request('GET /api/v1/family/notes/{id}/history', undefined, signal, { id })).data.items;
}

export function toggleFamilyNoteItem(
    transport: FamilyNotesTransport,
    id: string,
    itemId: string,
    command: ToggleFamilyNoteItemCommand,
): Promise<Success<'POST /api/v1/family/notes/{id}/items/{itemId}/toggle'>> {
    return transport.request('POST /api/v1/family/notes/{id}/items/{itemId}/toggle', command, undefined, {
        id,
        itemId,
    });
}

export function archiveFamilyNote(
    transport: FamilyNotesTransport,
    id: string,
    command: ArchiveFamilyNoteCommand,
): Promise<Success<'POST /api/v1/family/notes/{id}/archive'>> {
    return transport.request('POST /api/v1/family/notes/{id}/archive', command, undefined, { id });
}

export function createFamilyNote(
    transport: FamilyNotesTransport,
    command: CreateFamilyNoteCommand,
): Promise<Success<'POST /api/v1/family/notes'>> {
    return transport.request('POST /api/v1/family/notes', command);
}

export function updateFamilyNote(
    transport: FamilyNotesTransport,
    id: string,
    command: UpdateFamilyNoteCommand,
): Promise<Success<'PUT /api/v1/family/notes/{id}'>> {
    return transport.request('PUT /api/v1/family/notes/{id}', command, undefined, { id });
}
