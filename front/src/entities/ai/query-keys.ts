export const aiKeys = {
    capabilities: (userId: string | undefined) => ['ai-capabilities', userId] as const,
    familySharing: (userId: string | undefined) => ['ai-family-sharing', userId] as const,
    conversation: (userId: string | undefined, id: string) => ['ai-conversation', userId, id] as const,
    operation: (userId: string | undefined, id: string) => ['ai-operation', userId, id] as const,
    historyRoot: (userId: string | undefined) => ['ai-history', userId] as const,
    history: (userId: string | undefined, archived: 'active' | 'archived' | 'all') =>
        ['ai-history', userId, archived] as const,
};
