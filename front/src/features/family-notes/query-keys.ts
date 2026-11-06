export const familyNotesKeys = {
    root: ['family-notes'] as const,
    forAccount: (userId: string | undefined) => ['family-notes', userId] as const,
    list: (userId: string | undefined, tab: 'active' | 'archived', query: string) =>
        ['family-notes', userId, tab, query] as const,
    note: (id: string, userId: string | undefined) => ['family-note', id, userId] as const,
    history: (id: string, userId: string | undefined) => ['family-note-history', id, userId] as const,
};
