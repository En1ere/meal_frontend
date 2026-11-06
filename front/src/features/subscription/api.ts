import type { z } from 'zod';
import type { ApiClient } from '../../shared/api/client.js';
import type { contracts, Success } from '../../shared/api/contracts.generated.js';

export type SubscriptionTransport = Pick<ApiClient, 'request'>;
export type SubscriptionTrialCommand = z.input<
    (typeof contracts)['POST /api/v1/settings/subscription/trial/activate']['request']
>;
export type SubscriptionPlanPreviewCommand = z.input<
    (typeof contracts)['POST /api/v1/settings/subscription/plan/preview']['request']
>;
export type SubscriptionDowngradePreviewCommand = z.input<
    (typeof contracts)['POST /api/v1/settings/subscription/downgrade/preview']['request']
>;
export type SubscriptionRenewalPreviewCommand = z.input<
    (typeof contracts)['POST /api/v1/settings/subscription/renewal/preview']['request']
>;
export type SubscriptionCombinationPreviewCommand = z.input<
    (typeof contracts)['POST /api/v1/settings/subscription/combination/preview']['request']
>;
export type SubscriptionCommitCommand = z.input<
    (typeof contracts)['POST /api/v1/settings/subscription/plan/commit']['request']
>;
export type SubscriptionCommitAction = 'plan' | 'renewal' | 'downgrade';
export type SubscriptionCombinationConsentCommand = z.input<
    (typeof contracts)['POST /api/v1/settings/subscription/combination/consent']['request']
>;

export async function loadSubscription(
    transport: SubscriptionTransport,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/settings/subscription'>['data']> {
    return (await transport.request('GET /api/v1/settings/subscription', undefined, signal)).data;
}

export async function activateSubscriptionTrial(
    transport: SubscriptionTransport,
    command: SubscriptionTrialCommand,
): Promise<Success<'POST /api/v1/settings/subscription/trial/activate'>['data']> {
    return (await transport.request('POST /api/v1/settings/subscription/trial/activate', command)).data;
}

export async function previewSubscriptionPlan(
    transport: SubscriptionTransport,
    command: SubscriptionPlanPreviewCommand,
): Promise<Success<'POST /api/v1/settings/subscription/plan/preview'>['data']> {
    return (await transport.request('POST /api/v1/settings/subscription/plan/preview', command)).data;
}

export async function previewSubscriptionDowngrade(
    transport: SubscriptionTransport,
    command: SubscriptionDowngradePreviewCommand,
): Promise<Success<'POST /api/v1/settings/subscription/downgrade/preview'>['data']> {
    return (await transport.request('POST /api/v1/settings/subscription/downgrade/preview', command)).data;
}

export async function previewSubscriptionRenewal(
    transport: SubscriptionTransport,
    command: SubscriptionRenewalPreviewCommand,
): Promise<Success<'POST /api/v1/settings/subscription/renewal/preview'>['data']> {
    return (await transport.request('POST /api/v1/settings/subscription/renewal/preview', command)).data;
}

export async function previewSubscriptionCombination(
    transport: SubscriptionTransport,
    command: SubscriptionCombinationPreviewCommand,
): Promise<Success<'POST /api/v1/settings/subscription/combination/preview'>['data']> {
    return (await transport.request('POST /api/v1/settings/subscription/combination/preview', command)).data;
}

export async function commitSubscriptionChange(
    transport: SubscriptionTransport,
    action: SubscriptionCommitAction,
    command: SubscriptionCommitCommand,
): Promise<Success<'POST /api/v1/settings/subscription/plan/commit'>['data']> {
    if (action === 'plan')
        return (await transport.request('POST /api/v1/settings/subscription/plan/commit', command)).data;
    if (action === 'renewal')
        return (await transport.request('POST /api/v1/settings/subscription/renewal/commit', command)).data;
    return (await transport.request('POST /api/v1/settings/subscription/downgrade/commit', command)).data;
}

export async function consentToSubscriptionCombination(
    transport: SubscriptionTransport,
    command: SubscriptionCombinationConsentCommand,
): Promise<Success<'POST /api/v1/settings/subscription/combination/consent'>['data']> {
    return (await transport.request('POST /api/v1/settings/subscription/combination/consent', command)).data;
}
