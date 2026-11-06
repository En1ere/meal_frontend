export const entitlementKeys = {
    forAccount: (userId: string | undefined) => ['entitlements', userId] as const,
};
