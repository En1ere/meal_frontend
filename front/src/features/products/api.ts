import type { z } from 'zod';
import { inventoryScopeQuery } from '../../entities/inventory/model.js';
import type { ApiClient } from '../../shared/api/client.js';
import type { contracts, Success } from '../../shared/api/contracts.generated.js';

export type ProductProposalCommand = z.input<(typeof contracts)['POST /api/v1/products/proposals']['request']>;
export type ProductProposalInput = Omit<ProductProposalCommand, 'idempotencyKey'>;
export type ProductsTransport = Pick<ApiClient, 'request'>;

export async function loadProductReference(transport: ProductsTransport, signal?: AbortSignal) {
    return (await transport.request('GET /api/v1/products/reference', undefined, signal)).data;
}

export async function submitProductProposal(
    transport: ProductsTransport,
    command: ProductProposalCommand,
    signal?: AbortSignal,
) {
    return (await transport.request('POST /api/v1/products/proposals', command, signal)).data.product;
}

export async function loadProduct(transport: ProductsTransport, id: string, signal?: AbortSignal) {
    return (await transport.request('GET /api/v1/products/{id}', undefined, signal, { id })).data.product;
}

export async function loadProductInventory(
    transport: ProductsTransport,
    id: string,
    currentLocalDate: string,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/inventory'>['data']> {
    return (
        await transport.request('GET /api/v1/inventory', undefined, signal, undefined, {
            query: { ingredientId: id, localDate: currentLocalDate, limit: '100' },
        })
    ).data;
}

export async function loadPrivateProductLocations(transport: ProductsTransport, signal?: AbortSignal) {
    return (
        await transport.request('GET /api/v1/inventory-locations', undefined, signal, undefined, {
            query: inventoryScopeQuery('private'),
        })
    ).data.items;
}
