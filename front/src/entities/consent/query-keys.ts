export const consentKeys = {
    settings: (userId: string | undefined) => ['legal-settings', userId] as const,
};
