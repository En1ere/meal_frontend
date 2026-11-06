import type { z } from 'zod';
import type { ApiClient } from '../../../shared/api/client.js';
import type { contracts, Success } from '../../../shared/api/contracts.generated.js';

export type AuthLifecycleTransport = Pick<ApiClient, 'request'>;
type Command<R extends keyof typeof contracts> = z.input<(typeof contracts)[R]['request']>;

export async function registerAccount(
    transport: AuthLifecycleTransport,
    input: Command<'POST /api/v1/auth/register/v2'>,
    signal: AbortSignal,
): Promise<void> {
    await transport.request('POST /api/v1/auth/register/v2', input, signal);
}

export async function resendVerificationEmail(
    transport: AuthLifecycleTransport,
    input: Command<'POST /api/v1/auth/email/resend'>,
    signal: AbortSignal,
): Promise<void> {
    await transport.request('POST /api/v1/auth/email/resend', input, signal);
}

export async function requestPasswordRecovery(
    transport: AuthLifecycleTransport,
    input: Command<'POST /api/v1/auth/password/recovery'>,
    signal: AbortSignal,
): Promise<void> {
    await transport.request('POST /api/v1/auth/password/recovery', input, signal);
}

export async function verifyEmail(
    transport: AuthLifecycleTransport,
    input: Command<'POST /api/v1/auth/email/verify'>,
    signal: AbortSignal,
): Promise<void> {
    await transport.request('POST /api/v1/auth/email/verify', input, signal);
}

export async function confirmEmailChange(
    transport: AuthLifecycleTransport,
    input: Command<'POST /api/v1/auth/email/change/confirm'>,
    signal: AbortSignal,
): Promise<Success<'POST /api/v1/auth/email/change/confirm'>['data']> {
    return (await transport.request('POST /api/v1/auth/email/change/confirm', input, signal)).data;
}

export async function cancelEmailChange(
    transport: AuthLifecycleTransport,
    input: Command<'POST /api/v1/auth/email/change/cancel'>,
    signal: AbortSignal,
): Promise<void> {
    await transport.request('POST /api/v1/auth/email/change/cancel', input, signal);
}

export async function checkPasswordResetLink(
    transport: AuthLifecycleTransport,
    input: Command<'POST /api/v1/auth/password/reset/check'>,
    signal: AbortSignal,
): Promise<Success<'POST /api/v1/auth/password/reset/check'>['data']> {
    return (await transport.request('POST /api/v1/auth/password/reset/check', input, signal)).data;
}

export async function resetPassword(
    transport: AuthLifecycleTransport,
    input: Command<'POST /api/v1/auth/password/reset'>,
    signal: AbortSignal,
): Promise<void> {
    await transport.request('POST /api/v1/auth/password/reset', input, signal);
}
