import type { z } from 'zod';
import type { ApiClient } from '../../shared/api/client.js';
import type { contracts, Success } from '../../shared/api/contracts.generated.js';

export type PreserveTransport = Pick<ApiClient, 'request'>;
export type PreserveScope = 'private' | 'family';
export type PreserveListFilters = Record<string, string>;
export type PreserveConsumePreviewCommand = z.input<
    (typeof contracts)['POST /api/v1/preserves/{id}/consume-preview']['request']
>;

export async function loadPreserveList(
    transport: PreserveTransport,
    filters: PreserveListFilters,
    localDate: string,
    scope: PreserveScope,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/preserves'>['data']> {
    return (
        await transport.request('GET /api/v1/preserves', undefined, signal, undefined, {
            query: { ...filters, localDate, limit: '20', scope },
        })
    ).data;
}

export async function loadPreserveLocations(
    transport: PreserveTransport,
    scope: PreserveScope,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/inventory-locations'>['data']> {
    return (
        await transport.request('GET /api/v1/inventory-locations', undefined, signal, undefined, {
            query: { scope },
        })
    ).data;
}

export async function loadPreserveDetail(
    transport: PreserveTransport,
    id: string,
    scope: PreserveScope,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/preserves/{id}'>['data']> {
    return (await transport.request('GET /api/v1/preserves/{id}', undefined, signal, { id }, { query: { scope } }))
        .data;
}

export async function loadPreserveHistory(
    transport: PreserveTransport,
    id: string,
    scope: PreserveScope,
    page: number,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/preserves/{id}/history'>['data']> {
    return (
        await transport.request(
            'GET /api/v1/preserves/{id}/history',
            undefined,
            signal,
            { id },
            {
                query: { page: String(page), limit: '20', scope },
            },
        )
    ).data;
}

export async function previewPreserveConsumption(
    transport: PreserveTransport,
    id: string,
    command: PreserveConsumePreviewCommand,
    signal?: AbortSignal,
): Promise<Success<'POST /api/v1/preserves/{id}/consume-preview'>['data']> {
    return (await transport.request('POST /api/v1/preserves/{id}/consume-preview', command, signal, { id })).data;
}

export async function loadPreserveQrLabel(
    transport: PreserveTransport,
    id: string,
    scope: PreserveScope,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/preserves/{id}/qr-label'>['data']> {
    return (
        await transport.request('GET /api/v1/preserves/{id}/qr-label', undefined, signal, { id }, { query: { scope } })
    ).data;
}

export function loadPreserveSourceRecipe(
    transport: PreserveTransport,
    id: string,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/recipe-workspace/{id}'>> {
    return transport.request('GET /api/v1/recipe-workspace/{id}', undefined, signal, { id });
}
