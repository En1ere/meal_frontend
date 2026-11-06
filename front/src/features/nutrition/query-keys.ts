export const nutritionKeys = {
    settingsRoot: ['nutrition-settings'] as const,
    settings: (userId: string | undefined) => ['nutrition-settings', userId] as const,
    analyticsRoot: ['nutrition-analytics'] as const,
    analytics: (userId: string | undefined, from: string, to: string) =>
        ['nutrition-analytics', userId, from, to] as const,
};
