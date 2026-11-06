export const supportKeys = {
    root: ['support'] as const,
    forAccount: (userId: string | undefined) => ['support', userId] as const,
    list: (userId: string | undefined, category: string, status: string) =>
        ['support', userId, category, status] as const,
    meta: ['support-meta'] as const,
    detail: (userId: string | undefined, id: string) => ['support-detail', userId, id] as const,
};
