import type { z } from 'zod';
import type { ApiClient } from '../../shared/api/client.js';
import type { contracts, Success } from '../../shared/api/contracts.generated.js';

export type AccountSecurityState = Success<'GET /api/v1/auth/security'>['data'];
export type CriticalReauthCommand = z.input<(typeof contracts)['POST /api/v1/account/critical-reauth']['request']>;
export type CriticalReauthData = Success<'POST /api/v1/account/critical-reauth'>['data'];
export type AccountSecurityTransport = Pick<ApiClient, 'request'>;
type Command<R extends keyof typeof contracts> = z.input<(typeof contracts)[R]['request']>;

export async function loadAccountSecurity(
    transport: AccountSecurityTransport,
    signal?: AbortSignal,
): Promise<AccountSecurityState> {
    return (await transport.request('GET /api/v1/auth/security', undefined, signal)).data;
}

export async function createCriticalReauth(
    transport: AccountSecurityTransport,
    input: CriticalReauthCommand,
): Promise<CriticalReauthData> {
    return (await transport.request('POST /api/v1/account/critical-reauth', input)).data;
}

export async function changeAccountPassword(
    transport: AccountSecurityTransport,
    input: Command<'POST /api/v1/auth/password/change'>,
    signal: AbortSignal,
): Promise<void> {
    await transport.request('POST /api/v1/auth/password/change', input, signal);
}

export async function requestAccountEmailChange(
    transport: AccountSecurityTransport,
    input: Command<'POST /api/v1/auth/email/change'>,
    signal: AbortSignal,
): Promise<void> {
    await transport.request('POST /api/v1/auth/email/change', input, signal);
}

export async function setupAccountPin(
    transport: AccountSecurityTransport,
    input: Command<'POST /api/v1/auth/pin/setup'>,
    signal: AbortSignal,
): Promise<void> {
    await transport.request('POST /api/v1/auth/pin/setup', input, signal);
}

export async function revokeAccountPin(transport: AccountSecurityTransport, signal: AbortSignal): Promise<void> {
    await transport.request('POST /api/v1/auth/pin/revoke', {}, signal);
}

export async function startAuthenticatorSetup(
    transport: AccountSecurityTransport,
    input: Command<'POST /api/v1/auth/authenticator/setup'>,
    signal: AbortSignal,
): Promise<Success<'POST /api/v1/auth/authenticator/setup'>['data']> {
    return (await transport.request('POST /api/v1/auth/authenticator/setup', input, signal)).data;
}

export async function confirmAuthenticatorSetup(
    transport: AccountSecurityTransport,
    input: Command<'POST /api/v1/auth/authenticator/confirm'>,
    signal: AbortSignal,
): Promise<Success<'POST /api/v1/auth/authenticator/confirm'>['data']> {
    return (await transport.request('POST /api/v1/auth/authenticator/confirm', input, signal)).data;
}

export async function regenerateAuthenticatorRecoveryCodes(
    transport: AccountSecurityTransport,
    input: Command<'POST /api/v1/auth/authenticator/recovery-codes'>,
    signal: AbortSignal,
): Promise<Success<'POST /api/v1/auth/authenticator/recovery-codes'>['data']> {
    return (await transport.request('POST /api/v1/auth/authenticator/recovery-codes', input, signal)).data;
}
