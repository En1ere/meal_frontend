export const newsKeys = {
    list: (userId: string | undefined) => ['news', userId ?? 'guest'] as const,
    detail: (userId: string | undefined, id: string) => ['news-detail', userId ?? 'guest', id] as const,
};
