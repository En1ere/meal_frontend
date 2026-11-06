export const aiAppealKeys = {
    root: ['ai-appeals'] as const,
    list: (userId: string | undefined) => ['ai-appeals', userId] as const,
    detail: (userId: string | undefined, id: string) => ['ai-appeal', userId, id] as const,
};
