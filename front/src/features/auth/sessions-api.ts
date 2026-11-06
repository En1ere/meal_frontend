import type { ApiClient } from '../../shared/api/client.js';
import type { Success } from '../../shared/api/contracts.generated.js';

export type SessionTransport = Pick<ApiClient, 'request'>;
export type SessionKind = 'user' | 'staff';

export async function loadSessionList(
    transport: SessionTransport,
    kind: SessionKind,
    signal?: AbortSignal,
): Promise<
    | Success<'GET /api/v1/auth/sessions'>['data']['sessions']
    | Success<'GET /api/v1/staff/auth/sessions'>['data']['sessions']
> {
    return kind === 'user'
        ? (await transport.request('GET /api/v1/auth/sessions', undefined, signal)).data.sessions
        : (await transport.request('GET /api/v1/staff/auth/sessions', undefined, signal)).data.sessions;
}

export function logoutSession(
    transport: SessionTransport,
    kind: SessionKind,
    signal: AbortSignal,
): Promise<Success<'POST /api/v1/auth/logout'> | Success<'POST /api/v1/staff/auth/logout'>> {
    return kind === 'user'
        ? transport.request('POST /api/v1/auth/logout', undefined, signal)
        : transport.request('POST /api/v1/staff/auth/logout', undefined, signal);
}

export async function revokeOtherSessions(
    transport: SessionTransport,
    kind: SessionKind,
    signal: AbortSignal,
): Promise<number> {
    return kind === 'user'
        ? (await transport.request('POST /api/v1/auth/sessions/revoke-others', undefined, signal)).data.revokedCount
        : (await transport.request('POST /api/v1/staff/auth/sessions/revoke-others', undefined, signal)).data
              .revokedCount;
}
