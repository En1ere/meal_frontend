export const diaryKeys = {
    root: ['diary'] as const,
    day: (userId: string | undefined, date: string) => ['diary', userId, date] as const,
    sources: (sourceType: string, search: string) => ['diary-sources', sourceType, search] as const,
};
