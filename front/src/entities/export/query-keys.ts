export const exportKeys = {
    root: ['exports'] as const,
    forAccount: (userId: string | undefined) => ['exports', userId] as const,
    lifecycle: (userId: string | undefined) => ['exports', userId, 'lifecycle'] as const,
};
