export const authLifecycleKeys = {
    publicLegalManifest: ['public-legal-manifest'] as const,
    resetLink: (token: string) => ['reset-link', token] as const,
};
