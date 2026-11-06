export const subscriptionKeys = {
    settings: (userId: string | undefined) => ['subscription-settings', userId] as const,
};
