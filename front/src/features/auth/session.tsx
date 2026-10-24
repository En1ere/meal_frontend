'use client';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, usePathname } from 'next/navigation';
import { useRuntime } from '../../app/providers.js';
import { ApiError } from '../../shared/api/client.js';
import { authRoutes, safeReturnTo, type AuthContext } from '../../shared/auth/routes.js';
import { PageLoader as ArcPageLoader } from '@meal-planner/design-system';
import { forgetOfflineOwner, rememberOfflineOwner } from '../offline/offline-store.js';
import { clearBrowserRecipeCache } from '../recipes/offline-cache.js';
import { readOfflineOwner, subscribeOfflineState } from '../offline/offline-store.js';

export function useSession(context: AuthContext) {
    const { api } = useRuntime();
    const kind = context === 'user' ? 'user' : 'staff';
    return useQuery({
        queryKey: ['session', kind],
        enabled: !!api,
        staleTime: 5_000,
        refetchInterval: 30000,
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
                if (kind === 'user' && user) rememberOfflineOwner(user.id);
                return user;
            } catch (error) {
                if (error instanceof ApiError && error.status === 401) {
                    if (kind === 'user') {
                        forgetOfflineOwner();
                        clearBrowserRecipeCache();
                    }
                    return null;
                }
                throw error;
            }
        },
    });
}
export function Guard({
    context,
    children,
    allowOffline = false,
}: {
    context: AuthContext;
    children: ReactNode;
    allowOffline?: boolean;
}) {
    const runtime = useRuntime();
    const session = useSession(context);
    const router = useRouter();
    const pathname = usePathname();
    const accepted = session.data?.context === context;
    const family = useQuery({
        queryKey: ['family', session.data?.id],
        enabled: context === 'user' && !!runtime.api && accepted,
        queryFn: async ({ signal }) => (await runtime.api!.request('GET /api/v1/family', undefined, signal)).data,
    });
    const online = useSyncExternalStore(
        subscribeOfflineState,
        () => navigator.onLine,
        () => true,
    );
    const offlineAccepted = context === 'user' && allowOffline && !online && !!readOfflineOwner();
    useEffect(() => {
        if (session.isSuccess && !accepted && !offlineAccepted)
            router.replace(
                `${authRoutes[context].login}?returnTo=${encodeURIComponent(safeReturnTo(pathname + window.location.search, context))}`,
            );
    }, [session.isSuccess, accepted, offlineAccepted, context, router, pathname]);
    useEffect(() => {
        if (context !== 'user' || !session.data?.id || !family.isSuccess) return;
        const routeScope =
            pathname === '/family' || pathname.startsWith('/family/')
                ? 'family'
                : ['/inventory', '/recipes', '/preserves', '/shopping', '/purchases', '/receipts', '/plan'].some(
                        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
                    )
                  ? 'personal'
                  : null;
        if (routeScope)
            runtime.ui
                .getState()
                .setScopeFor(
                    session.data.id,
                    routeScope === 'family' && family.data.state === 'none' ? 'personal' : routeScope,
                );
        else runtime.ui.getState().initializeScope(session.data.id, family.data.state !== 'none');
    }, [context, family.data, family.isSuccess, pathname, runtime.ui, session.data?.id]);
    if ((runtime.error || session.isError) && !offlineAccepted)
        return (
            <section className="status-panel" role="alert">
                <h1>Не удалось проверить вход</h1>
                <p>Подключение недоступно. Это не означает, что вы вышли из аккаунта.</p>
                <button onClick={() => (runtime.error ? window.location.reload() : void session.refetch())}>
                    Повторить
                </button>
            </section>
        );
    if (!offlineAccepted && (!runtime.api || !session.isSuccess || !accepted))
        return (
            <main id="main">
                <ArcPageLoader label="Проверяем сессию…" />
            </main>
        );
    return children;
}
