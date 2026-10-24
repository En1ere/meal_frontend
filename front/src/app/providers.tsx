'use client';

import { Fragment, createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { defaultClientTheme, resolveTheme, type ThemeName } from '@meal-planner/design-system';
import { ApiClient } from '../shared/api/client.js';
import { clearBrowserRecipeCache } from '../features/recipes/offline-cache.js';
import type { Success } from '../shared/api/contracts.generated.js';
import { forgetOfflineOwner, registerOfflineWorker } from '../features/offline/offline-store.js';
import { OfflineSyncCoordinator } from '../features/offline/sync-coordinator.js';

export type MfaFlow = Success<'POST /api/v1/staff/auth/login'>['data'] & {
    context: 'moderator';
    returnTo: string;
};

type UiState = {
    theme: ThemeName;
    collapsed: boolean;
    scope: 'family' | 'personal';
    scopeInitializedFor: string | null;
    setTheme: (value: ThemeName) => void;
    toggleSidebar: () => void;
    setScope: (value: 'family' | 'personal') => void;
    setScopeFor: (userId: string, value: 'family' | 'personal') => void;
    initializeScope: (userId: string, hasFamily: boolean) => void;
    resetScope: () => void;
};
const createUiStore = () =>
    createStore<UiState>((set) => ({
        theme: defaultClientTheme,
        collapsed: false,
        scope: 'personal',
        scopeInitializedFor: null,
        setTheme: (theme) => set({ theme }),
        toggleSidebar: () => set((s) => ({ collapsed: !s.collapsed })),
        setScope: (scope) => set({ scope }),
        setScopeFor: (scopeInitializedFor, scope) => set({ scope, scopeInitializedFor }),
        initializeScope: (userId, hasFamily) =>
            set((state) =>
                state.scopeInitializedFor === userId
                    ? state
                    : { scope: hasFamily ? 'family' : 'personal', scopeInitializedFor: userId },
            ),
        resetScope: () => set({ scope: 'personal', scopeInitializedFor: null }),
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
    const [authGeneration, setAuthGeneration] = useState(0);
    useEffect(() => {
        let active = true;
        async function start() {
            try {
                if (process.env.NEXT_PUBLIC_API_MODE === 'mock') {
                    const { startBrowserMocks } = await import('../mocks/browser.js');
                    await startBrowserMocks();
                } else {
                    if ('serviceWorker' in navigator) {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        for (const registration of registrations)
                            if (registration.active?.scriptURL.endsWith('/mockServiceWorker.js'))
                                await registration.unregister();
                        if (navigator.serviceWorker.controller?.scriptURL.endsWith('/mockServiceWorker.js')) {
                            window.location.reload();
                            return;
                        }
                    }
                    await registerOfflineWorker().catch(() => {
                        /* The online application remains usable when offline shell registration fails. */
                    });
                }
                if (active) setApi(new ApiClient(window.location.origin));
            } catch {
                if (active) setError('Не удалось подготовить подключение. Обновите страницу.');
            }
        }
        void start();
        return () => {
            active = false;
        };
    }, []);
    useEffect(() => {
        try {
            ui.getState().setTheme(resolveTheme(localStorage.getItem('meal-theme'), defaultClientTheme));
        } catch {
            /* storage can be disabled */
        }
        const apply = () => {
            const theme = ui.getState().theme;
            document.documentElement.dataset.theme = theme;
            try {
                localStorage.setItem('meal-theme', theme);
            } catch {
                /* optional preference */
            }
        };
        apply();
        return ui.subscribe(apply);
    }, [ui]);
    useEffect(() => {
        if (!api || !('BroadcastChannel' in window)) return;
        const next = new BroadcastChannel('meal-auth-change');
        next.onmessage = () => {
            clearBrowserRecipeCache();
            forgetOfflineOwner();
            api.invalidate();
            queryClient.clear();
            ui.getState().resetScope();
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
        clearBrowserRecipeCache();
        forgetOfflineOwner();
        api?.invalidate();
        queryClient.clear();
        ui.getState().resetScope();
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
                <OfflineSyncCoordinator api={api} queryClient={queryClient} />
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
