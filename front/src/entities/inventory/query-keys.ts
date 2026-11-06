import type { InventoryScope } from './model.js';

export const inventoryKeys = {
    root: ['inventory'] as const,
    list: (
        scope: InventoryScope,
        userId: string | undefined,
        filters: Readonly<{
            q: string;
            status: string;
            attention: string;
            days: string;
            localDate: string;
            limit: string;
            offset: string;
            locationId?: string;
        }>,
    ) => ['inventory', scope, userId, filters] as const,
    batch: (scope: InventoryScope, userId: string | undefined, id: string) =>
        ['inventory', scope, 'batch', userId, id] as const,
    atLocation: (scope: InventoryScope, userId: string | undefined, locationId: string) =>
        ['inventory', scope, 'location', userId, locationId] as const,
    cookingReview: (userId: string | undefined, attemptId: string) =>
        ['inventory', userId, 'cooking-review', attemptId] as const,
    forProduct: (userId: string | undefined, productId: string) => ['inventory', 'product', userId, productId] as const,
    attentionRoot: ['inventory-attention'] as const,
    attention: (scope: InventoryScope, userId: string | undefined, days: string, localDate: string) =>
        ['inventory-attention', scope, userId, days, localDate] as const,
    historyRoot: ['inventory-history'] as const,
    history: (
        scope: InventoryScope,
        userId: string | undefined,
        batchId: string | undefined,
        q: string,
        action: string,
        from: string,
        to: string,
        offset: number,
    ) => ['inventory-history', scope, userId, batchId, q, action, from, to, offset] as const,
    productSearchRoot: ['inventory-products'] as const,
    productSearch: (userId: string | undefined, q: string) => ['inventory-products', userId, q] as const,
    locationsRoot: ['inventory-locations'] as const,
    locations: (scope: InventoryScope, userId: string | undefined) => ['inventory-locations', scope, userId] as const,
    // These projections cache the full `{ items }` response object and intentionally
    // remain distinct from `locations(scope, userId)`, whose consumers cache only `items`.
    preserveLocations: (userId: string | undefined, scope: InventoryScope) =>
        ['inventory-locations', userId, scope] as const,
    cookingLocations: (userId: string | undefined) => ['inventory-locations', userId] as const,
};
