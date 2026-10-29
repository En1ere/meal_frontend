import type { Success } from '../../shared/api/contracts.generated.js';

export type FamilyContext = Success<'GET /api/v1/family'>['data'];
export type Family = NonNullable<FamilyContext['family']>;

export const familyKeys = {
    all: ['family'] as const,
    context: (userId: string | undefined) => ['family', userId] as const,
};
