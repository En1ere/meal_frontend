import { Fragment, createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { useLocation } from 'react-router-dom';
import { defaultAdminTheme, resolveTheme, type ThemeName } from '@meal-planner/design-system';
import type { ApiClient } from '../shared/api/client.js';
import type { Success } from '../shared/api/contracts.generated.js';
import { setAdminUnlock } from '../shared/auth/unlock.js';
import { clearAdminPrivateStorage, removeLegacyAdminPrivateStorage } from '../shared/storage/private-cache.js';

export type MfaFlow = Success<'POST /api/v1/staff/auth/login'>['data'] & {
    context: 'admin';
    returnTo: string;
};

type UiState = {
    theme: ThemeName;
    setTheme: (value: ThemeName) => void;
};
const createUiStore = () =>
    createStore<UiState>((set) => ({
        theme: defaultAdminTheme,
        setTheme: (theme) => set({ theme }),
    }));
interface Runtime {
    api: ApiClient | null;
    error: string | null;
    queryClient: QueryClient;
    reset: () => void;
    broadcast: () => void;
    ui: ReturnType<typeof createUiStore>;
    mfa: MfaFlow | null;
    setMfa: (value: MfaFlow | null) => void;
}
const Context = createContext<Runtime | null>(null);
export function Providers({ children }: { children: ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: { retry: false, staleTime: 0, refetchOnWindowFocus: true },
                    mutations: { retry: false },
                },
            }),
    );
    const [ui] = useState(createUiStore);
    const [api, setApi] = useState<ApiClient | null>(null);
    const [error, setError] = useState<string | null>(null);
    const channel = useRef<BroadcastChannel | null>(null);
    const [mfa, setMfa] = useState<MfaFlow | null>(null);
    const location = useLocation();
    const pathname = location.pathname.replace(/\/+$/, '') || '/';
    const previousPath = useRef(pathname);
    useEffect(() => {
        if (previousPath.current === '/auth/mfa' && pathname !== '/auth/mfa') setMfa(null);
        previousPath.current = pathname;
    }, [pathname]);
    const [authGeneration, setAuthGeneration] = useState(0);
    useEffect(() => {
        let active = true;
        async function start() {
            try {
                if (import.meta.env.VITE_API_MODE === 'mock') {
                    const { startBrowserMocks } = await import('../mocks/browser.js');
                    await startBrowserMocks();
                } else if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (const registration of registrations)
                        if (registration.active?.scriptURL.endsWith('/mockServiceWorker.js'))
                            await registration.unregister();
                    if (navigator.serviceWorker.controller?.scriptURL.endsWith('/mockServiceWorker.js')) {
                        window.location.reload();
                        return;
                    }
                }
                const { ApiClient } = await import('../shared/api/client.js');
                if (active)
                    setApi(
                        new ApiClient(window.location.origin, fetch, () => {
                            // Confirmed loss of an authenticated context clears all private data immediately.
                            queryClient.clear();
                            clearAdminPrivateStorage();
                            queryClient.setQueryData(['session', 'admin'], null);
                            setMfa(null);
                            setAuthGeneration((value) => value + 1);
                        }),
                    );
            } catch {
                if (active) setError('Не удалось подготовить подключение. Обновите страницу.');
            }
        }
        void start();
        return () => {
            active = false;
        };
    }, [queryClient]);
    useEffect(() => {
        try {
            removeLegacyAdminPrivateStorage();
            // Migrate the inherited family-only value without touching account or MFA data.
            ui.getState().setTheme(resolveTheme(localStorage.getItem('meal-admin-theme'), defaultAdminTheme));
        } catch {
            /* storage can be disabled */
        }
        const apply = () => {
            const theme = ui.getState().theme;
            document.documentElement.dataset.theme = theme;
            try {
                localStorage.setItem('meal-admin-theme', theme);
            } catch {
                /* optional preference */
            }
        };
        apply();
        return ui.subscribe(apply);
    }, [ui]);
    useEffect(() => {
        if (!api || !('BroadcastChannel' in window)) return;
        const next = new BroadcastChannel('meal-admin-auth-change');
        next.onmessage = () => {
            setAdminUnlock();
            api.invalidate();
            queryClient.clear();
            clearAdminPrivateStorage();
            setMfa(null);
            setAuthGeneration((value) => value + 1);
        };
        channel.current = next;
        return () => {
            channel.current = null;
            next.close();
        };
    }, [api, queryClient, ui]);
    const reset = () => {
        setAdminUnlock();
        api?.invalidate();
        queryClient.clear();
        clearAdminPrivateStorage();
        setMfa(null);
        setAuthGeneration((value) => value + 1);
    };
    return (
        <Context.Provider
            value={{
                api,
                error,
                queryClient,
                reset,
                broadcast: () => channel.current?.postMessage('changed'),
                ui,
                mfa,
                setMfa,
            }}
        >
            <QueryClientProvider client={queryClient}>
                {/* Drop mounted query observers and transient MFA/form state on account changes. */}
                <Fragment key={authGeneration}>{children}</Fragment>
            </QueryClientProvider>
        </Context.Provider>
    );
}
export function useRuntime() {
    const value = useContext(Context);
    if (!value) throw new Error('Missing runtime provider');
    return value;
}
export function useUi<T>(selector: (state: UiState) => T) {
    return useStore(useRuntime().ui, selector);
}
