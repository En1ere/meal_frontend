import type { ApiClient } from '../../shared/api/client.js';
import type { Success } from '../../shared/api/contracts.generated.js';

export type SignInTransport = Pick<ApiClient, 'request'>;
export type UserSignInMethod = 'password' | 'totp' | 'pin';
export type StaffSignInContext = 'moderator';
export type StaffMfaMethod = 'totp' | 'recovery';

export async function signInUser(
    transport: SignInTransport,
    method: UserSignInMethod,
    credentials: { email: string; secret: string },
    signal: AbortSignal,
): Promise<Success<'POST /api/v1/auth/login'>['data']['user']> {
    if (method === 'password')
        return (
            await transport.request(
                'POST /api/v1/auth/login',
                {
                    email: credentials.email,
                    password: credentials.secret,
                },
                signal,
            )
        ).data.user;
    if (method === 'totp')
        return (
            await transport.request(
                'POST /api/v1/auth/totp/login',
                {
                    email: credentials.email,
                    code: credentials.secret,
                },
                signal,
            )
        ).data.user;
    return (await transport.request('POST /api/v1/auth/pin/login', { pin: credentials.secret }, signal)).data.user;
}

export async function startStaffSignIn(
    transport: SignInTransport,
    context: StaffSignInContext,
    credentials: { email: string; password: string },
    signal: AbortSignal,
): Promise<Success<'POST /api/v1/staff/auth/login'>['data']> {
    return (
        await transport.request(
            'POST /api/v1/staff/auth/login',
            { email: credentials.email, password: credentials.password, context },
            signal,
        )
    ).data;
}

export async function verifyStaffMfa(
    transport: SignInTransport,
    input: { challenge: string; code: string; method: StaffMfaMethod },
    signal: AbortSignal,
): Promise<Success<'POST /api/v1/staff/auth/mfa/verify'>['data']> {
    return (await transport.request('POST /api/v1/staff/auth/mfa/verify', input, signal)).data;
}
