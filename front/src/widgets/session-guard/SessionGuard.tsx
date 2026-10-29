'use client';

import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { PageLoader as ArcPageLoader } from '@meal-planner/design-system';
import { useSession } from '../../entities/session/client.js';
import { useFamilyContext } from '../../entities/family/client.js';
import { useWorkspaceScope } from '../../entities/workspace-scope/client.js';
import { readOfflineOwner, subscribeOfflineState } from '../../entities/offline/store.js';
import { authRoutes, safeReturnTo, type AuthContext } from '../../shared/auth/routes.js';
import { useRuntime } from '../../shared/runtime/index.js';

export function SessionGuard({
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
    const setScopeFor = useWorkspaceScope((state) => state.setScopeFor);
    const initializeScope = useWorkspaceScope((state) => state.initializeScope);
    const accepted = session.data?.context === context;
    const family = useFamilyContext(session.data?.id, context === 'user' && accepted);
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
            setScopeFor(
                session.data.id,
                routeScope === 'family' && family.data.state === 'none' ? 'personal' : routeScope,
            );
        else initializeScope(session.data.id, family.data.state !== 'none');
    }, [context, family.data, family.isSuccess, initializeScope, pathname, session.data?.id, setScopeFor]);

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
