import type { z } from 'zod';
import type { ApiClient } from '../../shared/api/client.js';
import type { contracts, Success } from '../../shared/api/contracts.generated.js';

export type ExportHistoryPage = Success<'GET /api/v1/exports'>['data'];
export type ExportDownload = Success<'GET /api/v1/exports/{id}/download-content'>['data'];
export type ExportPreviewCommand = z.input<(typeof contracts)['POST /api/v1/exports/preview']['request']>;
export type CreateExportCommand = z.input<(typeof contracts)['POST /api/v1/exports']['request']>;
export type ExportsTransport = Pick<ApiClient, 'request'>;

export async function loadExportHistory(
    transport: ExportsTransport,
    cursor: string | null,
    signal?: AbortSignal,
): Promise<ExportHistoryPage> {
    return (
        await transport.request('GET /api/v1/exports', undefined, signal, undefined, {
            query: { limit: '20', ...(cursor ? { cursor } : {}) },
        })
    ).data;
}

export async function downloadExport(transport: ExportsTransport, id: string): Promise<ExportDownload> {
    return (await transport.request('GET /api/v1/exports/{id}/download-content', undefined, undefined, { id })).data;
}

export async function previewExport(
    transport: ExportsTransport,
    command: ExportPreviewCommand,
): Promise<Success<'POST /api/v1/exports/preview'>['data']> {
    return (await transport.request('POST /api/v1/exports/preview', command)).data;
}

export async function createExport(
    transport: ExportsTransport,
    command: CreateExportCommand,
): Promise<Success<'POST /api/v1/exports'>['data']['job']> {
    return (await transport.request('POST /api/v1/exports', command)).data.job;
}
