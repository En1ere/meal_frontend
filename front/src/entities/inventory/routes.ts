import type { InventoryScope } from './model.js';

export const inventoryBase = (scope: InventoryScope) => (scope === 'family' ? '/family/inventory' : '/inventory');
