export const accountLifecycleKeys = {
    root: ['account-lifecycle'] as const,
    lifecycle: (userId: string | undefined) => ['account-lifecycle', userId] as const,
    deletionPreview: (userId: string | undefined) => ['account-deletion-preview', userId] as const,
};
