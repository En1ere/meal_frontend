export const aiBalanceKeys = {
    forAccount: (userId: string | undefined) => ['ai-balance', userId] as const,
};
