export const familyProjectionKeys = {
    invitations: (userId: string | undefined) => ['family-invitations', userId] as const,
    invitationPreview: (userId: string | undefined, token: string) =>
        ['family-invitation-preview', userId, token] as const,
    leavePreviewRoot: (userId: string | undefined) => ['family-leave-preview', userId] as const,
    leavePreview: (userId: string | undefined, familyVersion: number) =>
        ['family-leave-preview', userId, familyVersion] as const,
    ownershipRoot: ['family-ownership'] as const,
    ownership: (userId: string | undefined) => ['family-ownership', userId] as const,
    ownershipRequest: (userId: string | undefined, token: string) =>
        ['family-ownership-request', userId, token] as const,
    ownershipNotice: ['family-ownership-notice'] as const,
};
