export const preserveKeys = {
    root: ['preserves'] as const,
    list: <Filters>(userId: string | undefined, scope: 'private' | 'family', filters: Filters) =>
        ['preserves', userId, scope, 'list', filters] as const,
    detail: (userId: string | undefined, scope: 'private' | 'family', id: string) =>
        ['preserves', userId, scope, id] as const,
    history: (userId: string | undefined, scope: 'private' | 'family', id: string, page: number) =>
        ['preserves', userId, scope, id, 'history', page] as const,
    qrLabel: (id: string) => ['preserves', id, 'qr-label'] as const,
};
