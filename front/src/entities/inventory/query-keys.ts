import type { InventoryScope } from './model.js';

export const inventoryKeys = {
    root: ['inventory'] as const,
    forProduct: (userId: string | undefined, productId: string) => ['inventory', 'product', userId, productId] as const,
    locationsRoot: ['inventory-locations'] as const,
    locations: (scope: InventoryScope, userId: string | undefined) => ['inventory-locations', scope, userId] as const,
};
