export const familyChatKeys = {
    root: ['family-chat'] as const,
    list: (userId: string | undefined, q: string) => ['family-chat', userId, q] as const,
};
