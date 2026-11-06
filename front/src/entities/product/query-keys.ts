export const productKeys = {
    ingestSearch: (userId: string | undefined, query: string) => ['products', 'ingest', userId, query] as const,
    editorSearch: (userId: string | undefined, query: string) => ['products', 'editor', userId, query] as const,
    familyRecipeCatalog: (userId: string | undefined) => ['products', 'family-recipe', userId] as const,
    detail: (userId: string | undefined, id: string) => ['product', userId, id] as const,
    reference: (userId: string | undefined) => ['product-reference', userId] as const,
};
