import { useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { useRuntime } from '../../app/providers.js';
import { ApiError } from '../../shared/api/client.js';
import { authRoutes, safeReturnTo, type AuthContext } from '../../shared/auth/routes.js';
import { PageLoader as ArcPageLoader } from '@meal-planner/design-system';

export function useSession(context: AuthContext) {
    const { api } = useRuntime();
    const kind = context;
    return useQuery({
        queryKey: ['session', kind],
        enabled: !!api,
        refetchInterval: 30000,
        queryFn: async ({ signal }) => {
            if (!api) throw new Error('API not ready');
            try {
                return (await api.request('GET /api/v1/admin/auth/me', undefined, signal)).data.user;
            } catch (error) {
                if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null;
                throw error;
            }
        },
    });
}
export function Guard({ context, children }: { context: AuthContext; children: ReactNode }) {
    const runtime = useRuntime();
    const session = useSession(context);
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const accepted = session.data?.context === context;
    useEffect(() => {
        if (session.isSuccess && !accepted)
            void navigate(
                `${authRoutes[context].login}?returnTo=${encodeURIComponent(safeReturnTo(pathname, context))}`,
                {
                    replace: true,
                },
            );
    }, [session.isSuccess, accepted, context, navigate, pathname]);
    if (runtime.error || session.isError)
        return (
            <section className="status-panel" role="alert">
                <h1>Не удалось проверить вход</h1>
                <p>Подключение недоступно. Это не означает, что вы вышли из аккаунта.</p>
                <button onClick={() => (runtime.error ? window.location.reload() : void session.refetch())}>
                    Повторить
                </button>
            </section>
        );
    if (!runtime.api || !session.isSuccess || !accepted)
        return (
            <main id="main">
                <ArcPageLoader label="Проверяем сессию…" />
            </main>
        );
    return children;
}
