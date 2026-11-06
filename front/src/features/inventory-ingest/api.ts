import type { z } from 'zod';
import type { ApiClient } from '../../shared/api/client.js';
import type { contracts, Success } from '../../shared/api/contracts.generated.js';
import { inventoryScopeQuery, type InventoryScope } from '../../entities/inventory/model.js';

export type IngestProductPage = Success<'GET /api/v1/products'>['data'];
export type IngestLocation = Success<'GET /api/v1/inventory-locations'>['data']['items'][number];
export type InventoryImportCommand = z.input<(typeof contracts)['POST /api/v1/inventory/import/commit']['request']>;
export type InventoryImportResult = Success<'POST /api/v1/inventory/import/commit'>['data'];
export type InventoryIngestTransport = Pick<ApiClient, 'request'>;

export async function loadIngestProducts(
    transport: InventoryIngestTransport,
    search: string,
    barcode: string | undefined,
    signal?: AbortSignal,
): Promise<IngestProductPage> {
    return (
        await transport.request('GET /api/v1/products', undefined, signal, undefined, {
            query: {
                ...(barcode && search === barcode ? { barcode } : { q: search }),
                limit: '20',
                offset: '0',
            },
        })
    ).data;
}

export async function loadIngestLocations(
    transport: InventoryIngestTransport,
    scope: InventoryScope,
    signal?: AbortSignal,
): Promise<IngestLocation[]> {
    return (
        await transport.request('GET /api/v1/inventory-locations', undefined, signal, undefined, {
            query: inventoryScopeQuery(scope),
        })
    ).data.items;
}

export async function commitInventoryImport(
    transport: InventoryIngestTransport,
    command: InventoryImportCommand,
): Promise<InventoryImportResult> {
    return (await transport.request('POST /api/v1/inventory/import/commit', command)).data;
}
