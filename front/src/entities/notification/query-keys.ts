export const notificationKeys = {
    root: ['notifications'] as const,
    forAccount: (userId: string | undefined) => ['notifications', userId] as const,
    list: (userId: string | undefined, category: string, unread: boolean) =>
        ['notifications', userId, category, unread] as const,
    preferences: (userId: string | undefined) => ['notification-preferences', userId] as const,
    pushConfig: (userId: string | undefined) => ['notification-push-config', userId] as const,
};
