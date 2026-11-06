import type { z } from 'zod';
import type { ApiClient } from '../../shared/api/client.js';
import type { contracts, Success } from '../../shared/api/contracts.generated.js';

export type AccountLifecycleState = Success<'GET /api/v1/account/lifecycle'>['data'];
export type AccountDeletionPreview = Success<'GET /api/v1/account/deletion/preview'>['data'];
export type AccountLifecycleExports = Success<'GET /api/v1/exports'>['data'];
export type ArchiveAccountCommand = z.input<(typeof contracts)['POST /api/v1/account/archive']['request']>;
export type RequestAccountDeletionCommand = z.input<(typeof contracts)['POST /api/v1/account/deletion']['request']>;
export type AccountDeletionAction = 'cancel' | 'finalize';
export type AccountDeletionActionCommand = z.input<
    (typeof contracts)['POST /api/v1/account/deletion/cancel']['request']
>;
export type AccountDeletionActionResult =
    Success<'POST /api/v1/account/deletion/cancel'>['data'] | Success<'POST /api/v1/account/deletion/finalize'>['data'];
export type AccountLifecycleTransport = Pick<ApiClient, 'request'>;

export async function loadAccountLifecycle(
    transport: AccountLifecycleTransport,
    signal?: AbortSignal,
): Promise<AccountLifecycleState> {
    return (await transport.request('GET /api/v1/account/lifecycle', undefined, signal)).data;
}

export async function loadAccountDeletionPreview(
    transport: AccountLifecycleTransport,
    signal?: AbortSignal,
): Promise<AccountDeletionPreview> {
    return (await transport.request('GET /api/v1/account/deletion/preview', undefined, signal)).data;
}

export async function loadAccountLifecycleExports(
    transport: AccountLifecycleTransport,
    signal?: AbortSignal,
): Promise<AccountLifecycleExports> {
    return (
        await transport.request('GET /api/v1/exports', undefined, signal, undefined, {
            query: { limit: '20' },
        })
    ).data;
}

export async function archiveAccount(
    transport: AccountLifecycleTransport,
    command: ArchiveAccountCommand,
): Promise<Success<'POST /api/v1/account/archive'>['data']> {
    return (await transport.request('POST /api/v1/account/archive', command)).data;
}

export async function requestAccountDeletion(
    transport: AccountLifecycleTransport,
    command: RequestAccountDeletionCommand,
): Promise<Success<'POST /api/v1/account/deletion'>['data']> {
    return (await transport.request('POST /api/v1/account/deletion', command)).data;
}

export async function applyAccountDeletionAction(
    transport: AccountLifecycleTransport,
    action: AccountDeletionAction,
    command: AccountDeletionActionCommand,
): Promise<AccountDeletionActionResult> {
    if (action === 'cancel') return (await transport.request('POST /api/v1/account/deletion/cancel', command)).data;
    return (await transport.request('POST /api/v1/account/deletion/finalize', command)).data;
}
