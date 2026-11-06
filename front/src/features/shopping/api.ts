import type { z } from 'zod';
import type { ApiClient } from '../../shared/api/client.js';
import type { contracts, Success } from '../../shared/api/contracts.generated.js';
import { inventoryScopeQuery, type InventoryScope } from '../../entities/inventory/model.js';

export type ShoppingTransport = Pick<ApiClient, 'request'>;
type ShoppingScope = InventoryScope;
export type ShoppingListQuery = {
    q: string;
    status: string;
    scope: ShoppingScope;
    cursor?: string;
};
export type PurchaseResolutionPreviewCommand = z.input<
    (typeof contracts)['POST /api/v1/purchases/{id}/resolve-preview']['request']
>;
export type ShoppingPurchasePreviewCommand = z.input<
    (typeof contracts)['POST /api/v1/shopping-lists/{id}/purchase-preview']['request']
>;
export type ReceiptIntakePreviewCommand = z.input<
    (typeof contracts)['POST /api/v1/receipts/{id}/intake-preview']['request']
>;

export async function loadShoppingLists(
    transport: ShoppingTransport,
    query: ShoppingListQuery,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/shopping-lists'>['data']> {
    return (await transport.request('GET /api/v1/shopping-lists', undefined, signal, undefined, { query })).data;
}

export async function loadShoppingList(
    transport: ShoppingTransport,
    id: string,
    scope: ShoppingScope,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/shopping-lists/{id}'>['data']> {
    return (await transport.request('GET /api/v1/shopping-lists/{id}', undefined, signal, { id }, { query: { scope } }))
        .data;
}

export async function loadShoppingHistory(
    transport: ShoppingTransport,
    id: string,
    scope: ShoppingScope,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/shopping-lists/{id}/history'>['data']> {
    return (
        await transport.request(
            'GET /api/v1/shopping-lists/{id}/history',
            undefined,
            signal,
            { id },
            { query: { scope } },
        )
    ).data;
}

export async function loadShoppingRecipePreview(
    transport: ShoppingTransport,
    recipeId: string,
    servings: string,
    scope: ShoppingScope,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/shopping-lists/recipe-preview'>['data']> {
    return (
        await transport.request('GET /api/v1/shopping-lists/recipe-preview', undefined, signal, undefined, {
            query: { recipeId, servings, scope },
        })
    ).data;
}

export async function loadShoppingProducts(
    transport: ShoppingTransport,
    q: string,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/products'>['data']> {
    return (
        await transport.request('GET /api/v1/products', undefined, signal, undefined, { query: { q, limit: '20' } })
    ).data;
}

export async function loadShoppingProduct(
    transport: ShoppingTransport,
    id: string,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/products/{id}'>['data']> {
    return (await transport.request('GET /api/v1/products/{id}', undefined, signal, { id })).data;
}

export async function loadShoppingLocations(
    transport: ShoppingTransport,
    scope: ShoppingScope,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/inventory-locations'>['data']['items']> {
    return (
        await transport.request('GET /api/v1/inventory-locations', undefined, signal, undefined, {
            query: inventoryScopeQuery(scope),
        })
    ).data.items;
}

export async function loadShoppingPurchase(
    transport: ShoppingTransport,
    id: string,
    scope: ShoppingScope,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/purchases/{id}'>['data']> {
    return (await transport.request('GET /api/v1/purchases/{id}', undefined, signal, { id }, { query: { scope } }))
        .data;
}

export async function previewPurchaseResolution(
    transport: ShoppingTransport,
    id: string,
    command: PurchaseResolutionPreviewCommand,
): Promise<Success<'POST /api/v1/purchases/{id}/resolve-preview'>['data']> {
    return (await transport.request('POST /api/v1/purchases/{id}/resolve-preview', command, undefined, { id })).data;
}

export async function previewShoppingPurchase(
    transport: ShoppingTransport,
    kind: 'shopping',
    id: string,
    command: ShoppingPurchasePreviewCommand,
    signal: AbortSignal,
): Promise<Success<'POST /api/v1/shopping-lists/{id}/purchase-preview'>['data']>;
export async function previewShoppingPurchase(
    transport: ShoppingTransport,
    kind: 'receipt',
    id: string,
    command: ReceiptIntakePreviewCommand,
    signal: AbortSignal,
): Promise<Success<'POST /api/v1/receipts/{id}/intake-preview'>['data']>;
export async function previewShoppingPurchase(
    transport: ShoppingTransport,
    kind: 'shopping' | 'receipt',
    id: string,
    command: ShoppingPurchasePreviewCommand | ReceiptIntakePreviewCommand,
    signal: AbortSignal,
): Promise<
    | Success<'POST /api/v1/shopping-lists/{id}/purchase-preview'>['data']
    | Success<'POST /api/v1/receipts/{id}/intake-preview'>['data']
> {
    return kind === 'shopping'
        ? (await transport.request('POST /api/v1/shopping-lists/{id}/purchase-preview', command, signal, { id })).data
        : (await transport.request('POST /api/v1/receipts/{id}/intake-preview', command, signal, { id })).data;
}

export async function loadShoppingReceipt(
    transport: ShoppingTransport,
    id: string,
    scope: ShoppingScope,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/receipts/{id}'>['data']> {
    return (await transport.request('GET /api/v1/receipts/{id}', undefined, signal, { id }, { query: { scope } })).data;
}

export async function loadShoppingReceiptDuplicates(
    transport: ShoppingTransport,
    id: string,
    scope: ShoppingScope,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/receipts/{id}/duplicates'>['data']> {
    return (
        await transport.request('GET /api/v1/receipts/{id}/duplicates', undefined, signal, { id }, { query: { scope } })
    ).data;
}

export async function loadShoppingEntitlements(
    transport: ShoppingTransport,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/entitlements'>['data']> {
    return (await transport.request('GET /api/v1/entitlements', undefined, signal)).data;
}

export async function loadShoppingReceiptCapabilities(
    transport: ShoppingTransport,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/receipts/capabilities'>['data']> {
    return (await transport.request('GET /api/v1/receipts/capabilities', undefined, signal)).data;
}
