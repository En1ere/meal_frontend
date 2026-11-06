export const proOverviewKeys = {
    root: ['pro-overview'] as const,
    overview: (userId: string | undefined) => ['pro-overview', userId] as const,
};
