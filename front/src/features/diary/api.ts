import type { z } from 'zod';
import type { ApiClient } from '../../shared/api/client.js';
import type { contracts, Success } from '../../shared/api/contracts.generated.js';

export type CreateDiaryEntryCommand = Omit<
    z.input<(typeof contracts)['POST /api/v1/diary']['request']>,
    'idempotencyKey'
>;
export type ArchiveDiaryEntryCommand = Omit<
    z.input<(typeof contracts)['POST /api/v1/diary/{id}/archive']['request']>,
    'idempotencyKey'
>;
export type UpdateDiaryEntryCommand = Omit<
    z.input<(typeof contracts)['PUT /api/v1/diary/{id}']['request']>,
    'idempotencyKey'
>;
export type DecideDiaryPortionCommand = Omit<
    z.input<(typeof contracts)['POST /api/v1/diary/portions/{id}/decision']['request']>,
    'idempotencyKey'
>;
export type DiaryTransport = Pick<ApiClient, 'request'>;

export async function loadDiaryDay(transport: DiaryTransport, date: string, signal?: AbortSignal) {
    return (
        await transport.request('GET /api/v1/diary', undefined, signal, undefined, {
            query: { date },
        })
    ).data;
}

export async function loadDiarySources(transport: DiaryTransport, type: string, query: string, signal?: AbortSignal) {
    return (
        await transport.request('GET /api/v1/diary/sources', undefined, signal, undefined, {
            query: { type, q: query, limit: '20' },
        })
    ).data.items;
}

export function createDiaryEntry(
    transport: DiaryTransport,
    command: CreateDiaryEntryCommand,
): Promise<Success<'POST /api/v1/diary'>> {
    return transport.request('POST /api/v1/diary', { ...command, idempotencyKey: crypto.randomUUID() });
}

export function archiveDiaryEntry(
    transport: DiaryTransport,
    id: string,
    command: ArchiveDiaryEntryCommand,
): Promise<Success<'POST /api/v1/diary/{id}/archive'>> {
    return transport.request(
        'POST /api/v1/diary/{id}/archive',
        { ...command, idempotencyKey: crypto.randomUUID() },
        undefined,
        { id },
        { ifMatch: command.expectedVersion },
    );
}

export function updateDiaryEntry(
    transport: DiaryTransport,
    id: string,
    command: UpdateDiaryEntryCommand,
): Promise<Success<'PUT /api/v1/diary/{id}'>> {
    return transport.request(
        'PUT /api/v1/diary/{id}',
        { ...command, idempotencyKey: crypto.randomUUID() },
        undefined,
        { id },
        { ifMatch: command.expectedVersion },
    );
}

export function decideDiaryPortion(
    transport: DiaryTransport,
    id: string,
    command: DecideDiaryPortionCommand,
): Promise<Success<'POST /api/v1/diary/portions/{id}/decision'>> {
    return transport.request(
        'POST /api/v1/diary/portions/{id}/decision',
        { ...command, idempotencyKey: crypto.randomUUID() },
        undefined,
        { id },
        { ifMatch: command.expectedVersion },
    );
}
