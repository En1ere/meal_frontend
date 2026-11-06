type ShoppingKeyScope = 'private' | 'family';
type ShoppingListFilters = {
    q: string;
    status: string;
    cursor?: string;
    scope: ShoppingKeyScope;
};

export const shoppingKeys = {
    lists: (owner: string | null | undefined, filters: ShoppingListFilters) =>
        ['shopping', owner, 'lists', filters] as const,
    detail: (owner: string | null | undefined, scope: ShoppingKeyScope, id: string | undefined) =>
        ['shopping', owner, scope, id] as const,
    history: (owner: string | null | undefined, scope: ShoppingKeyScope, id: string | undefined) =>
        ['shopping', owner, scope, id, 'history'] as const,
    recipePreview: (userId: string | undefined, recipeId: string | null, servings: string) =>
        ['shopping', userId, 'recipe-preview', recipeId, servings] as const,
    catalogSearch: (userId: string | undefined, scope: ShoppingKeyScope, q: string) =>
        ['shopping-catalog', userId, scope, 'search', q] as const,
    catalogDetail: (userId: string | undefined, scope: ShoppingKeyScope, ingredientId: string | null) =>
        ['shopping-catalog', userId, scope, 'detail', ingredientId] as const,
    purchase: (userId: string | undefined, scope: ShoppingKeyScope, id: string) =>
        ['purchases', userId, scope, id] as const,
    receiptCapabilities: ['receipt-capabilities'] as const,
    receipt: (userId: string | undefined, scope: ShoppingKeyScope, id: string) =>
        ['receipts', userId, scope, id] as const,
    receiptDuplicates: (userId: string | undefined, scope: ShoppingKeyScope, id: string) =>
        ['receipts', userId, scope, id, 'duplicates'] as const,
};
