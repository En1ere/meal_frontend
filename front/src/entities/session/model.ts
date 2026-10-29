import type { QueryClient } from '@tanstack/react-query';
import type { Success } from '../../shared/api/contracts.generated.js';
import type { AuthContext } from '../../shared/auth/routes.js';

export type UserSession = Success<'GET /api/v1/auth/me'>['data']['user'] | null;
type UserSessionUpdater = UserSession | undefined | ((current: UserSession | undefined) => UserSession | undefined);

export interface SessionWriteRuntime {
    queryClient: QueryClient;
    sessionLifecycle: {
        onUserAuthenticated: (userId: string) => void;
        onUserUnauthorized: () => void;
    };
}

export const sessionQueryKey = (context: AuthContext) => ['session', context === 'user' ? 'user' : 'staff'] as const;

export function setUserSession(runtime: SessionWriteRuntime, updater: UserSessionUpdater) {
    const session = runtime.queryClient.setQueryData<UserSession>(sessionQueryKey('user'), updater);
    if (session) runtime.sessionLifecycle.onUserAuthenticated(session.id);
    else if (session === null) runtime.sessionLifecycle.onUserUnauthorized();
    return session;
}
