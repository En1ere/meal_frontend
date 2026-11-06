import type { ApiClient } from '../../shared/api/client.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { inventoryScopeQuery, type InventoryScope } from '../../entities/inventory/model.js';

export type InventoryTransport = Pick<ApiClient, 'request'>;
export type InventoryCreateCommand = Record<string, unknown> & {
    ingredientId: string;
    scope: InventoryScope;
    idempotencyKey: string;
};
export type InventoryBatchCommand = Record<string, unknown> & {
    action: string;
    version: number;
    scope: InventoryScope;
    idempotencyKey: string;
};
export type InventoryLocationCommand = Record<string, unknown> & {
    action: string;
    idempotencyKey: string;
};

export type InventoryListFilters = {
    q: string;
    status: string;
    attention: string;
    days: string;
    localDate: string;
    limit: string;
    offset: string;
    locationId?: string;
};

export type InventoryHistoryFilters = {
    batchId?: string | undefined;
    q: string;
    action: string;
    from: string;
    to: string;
    offset: number;
};

export async function loadInventoryProducts(
    transport: InventoryTransport,
    q: string,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/products'>['data']> {
    return (
        await transport.request('GET /api/v1/products', undefined, signal, undefined, { query: { q, limit: '20' } })
    ).data;
}

export async function loadInventoryLocations(
    transport: InventoryTransport,
    scope: InventoryScope,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/inventory-locations'>['data']['items']> {
    return (
        await transport.request('GET /api/v1/inventory-locations', undefined, signal, undefined, {
            query: inventoryScopeQuery(scope),
        })
    ).data.items;
}

export function createInventoryBatch(
    transport: InventoryTransport,
    command: InventoryCreateCommand,
    signal?: AbortSignal,
): Promise<Success<'POST /api/v1/inventory'>> {
    return transport.request('POST /api/v1/inventory', command, signal);
}

export async function loadInventoryBatch(
    transport: InventoryTransport,
    scope: InventoryScope,
    id: string,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/inventory/{id}'>['data']['batch']> {
    return (
        await transport.request(
            'GET /api/v1/inventory/{id}',
            undefined,
            signal,
            { id },
            {
                query: inventoryScopeQuery(scope),
            },
        )
    ).data.batch;
}

export function runInventoryBatchCommand(
    transport: InventoryTransport,
    id: string,
    command: InventoryBatchCommand,
    signal: AbortSignal,
    ifMatch: number,
): Promise<Success<'POST /api/v1/inventory/{id}/command'>> {
    return transport.request('POST /api/v1/inventory/{id}/command', command, signal, { id }, { ifMatch });
}

export async function loadInventoryHistory(
    transport: InventoryTransport,
    scope: InventoryScope,
    filters: InventoryHistoryFilters,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/inventory-history'>['data']> {
    const { batchId, q, action, from, to, offset } = filters;
    return (
        await transport.request('GET /api/v1/inventory-history', undefined, signal, undefined, {
            query: {
                ...(batchId ? { batchId } : {}),
                ...(q ? { q } : {}),
                ...(action ? { action } : {}),
                ...(from ? { from: new Date(`${from}T00:00:00`).toISOString() } : {}),
                ...(to
                    ? {
                          to: new Date(
                              new Date(`${to}T00:00:00`).setDate(new Date(`${to}T00:00:00`).getDate() + 1) - 1,
                          ).toISOString(),
                      }
                    : {}),
                limit: '100',
                offset: String(offset),
                ...inventoryScopeQuery(scope),
            },
        })
    ).data;
}

export async function loadInventoryList(
    transport: InventoryTransport,
    scope: InventoryScope,
    filters: InventoryListFilters,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/inventory'>['data']> {
    return (
        await transport.request('GET /api/v1/inventory', undefined, signal, undefined, {
            query: { ...filters, ...inventoryScopeQuery(scope) },
        })
    ).data;
}

export async function loadInventoryAttention(
    transport: InventoryTransport,
    scope: InventoryScope,
    days: string,
    localDate: string,
    signal?: AbortSignal,
): Promise<number> {
    return (
        await transport.request('GET /api/v1/inventory', undefined, signal, undefined, {
            query: {
                attention: 'expiring',
                days,
                localDate,
                status: 'active',
                limit: '1',
                ...inventoryScopeQuery(scope),
            },
        })
    ).data.total;
}

export async function loadInventoryAtLocation(
    transport: InventoryTransport,
    scope: InventoryScope,
    locationId: string,
    localDate: string,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/inventory'>['data']> {
    return (
        await transport.request('GET /api/v1/inventory', undefined, signal, undefined, {
            query: { locationId, localDate, limit: '100', ...inventoryScopeQuery(scope) },
        })
    ).data;
}

export function saveInventoryLocation(
    transport: InventoryTransport,
    command: InventoryLocationCommand,
    signal: AbortSignal,
    ifMatch?: number,
): Promise<Success<'POST /api/v1/inventory-locations'>> {
    return transport.request(
        'POST /api/v1/inventory-locations',
        command,
        signal,
        undefined,
        ifMatch === undefined ? undefined : { ifMatch },
    );
}
