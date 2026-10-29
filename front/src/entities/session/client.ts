'use client';

import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../../shared/api/client.js';
import type { AuthContext } from '../../shared/auth/routes.js';
import { useRuntime } from '../../shared/runtime/index.js';
import { sessionQueryKey } from './model.js';

export { sessionQueryKey, setUserSession, type UserSession } from './model.js';

export function useSession(context: AuthContext) {
    const { api, sessionLifecycle } = useRuntime();
    const kind = context === 'user' ? 'user' : 'staff';
    return useQuery({
        queryKey: sessionQueryKey(context),
        enabled: !!api,
        staleTime: 5_000,
        refetchInterval: 30_000,
        queryFn: async ({ signal }) => {
            if (!api) throw new Error('API not ready');
            try {
                const user = (
                    await api.request(
                        kind === 'user' ? 'GET /api/v1/auth/me' : 'GET /api/v1/staff/auth/me',
                        undefined,
                        signal,
                    )
                ).data.user;
                if (kind === 'user' && user) sessionLifecycle.onUserAuthenticated(user.id);
                return user;
            } catch (error) {
                if (error instanceof ApiError && error.status === 401) {
                    if (kind === 'user') sessionLifecycle.onUserUnauthorized();
                    return null;
                }
                throw error;
            }
        },
    });
}
