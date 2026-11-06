export const personalizationKeys = {
    root: ['personalization'] as const,
    settings: (userId: string | undefined) => ['personalization', userId] as const,
};
