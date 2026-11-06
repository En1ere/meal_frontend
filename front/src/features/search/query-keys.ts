export type SearchType = 'product' | 'recipe' | 'brand' | 'store';

export const searchKeys = {
    results: (userId: string | undefined, type: SearchType, query: string, limit: number) =>
        ['unified-search', userId, type, query, limit] as const,
};
