import type { z } from 'zod';
import type { ApiClient } from '../../shared/api/client.js';
import type { contracts, Success } from '../../shared/api/contracts.generated.js';

type PersonalizationData = Success<'GET /api/v1/personalization'>['data'];
export type PersonalizationPreferences = PersonalizationData['preferences'];
export type OnboardingCommand = Omit<
    z.input<(typeof contracts)['PUT /api/v1/personalization/onboarding']['request']>,
    'idempotencyKey'
>;
export type PreferencesCommand = Omit<
    z.input<(typeof contracts)['PUT /api/v1/personalization/preferences']['request']>,
    'idempotencyKey'
>;

export type PersonalizationTransport = Pick<ApiClient, 'request'>;

export async function loadPersonalization(
    transport: PersonalizationTransport,
    signal?: AbortSignal,
): Promise<PersonalizationData> {
    return (await transport.request('GET /api/v1/personalization', undefined, signal)).data;
}

export async function saveOnboarding(
    transport: PersonalizationTransport,
    input: OnboardingCommand,
): Promise<PersonalizationData['onboarding']> {
    return (
        await transport.request('PUT /api/v1/personalization/onboarding', {
            ...input,
            idempotencyKey: crypto.randomUUID(),
        })
    ).data;
}

export async function savePreferences(
    transport: PersonalizationTransport,
    input: PreferencesCommand,
): Promise<PersonalizationPreferences> {
    return (
        await transport.request('PUT /api/v1/personalization/preferences', {
            ...input,
            idempotencyKey: crypto.randomUUID(),
        })
    ).data;
}
