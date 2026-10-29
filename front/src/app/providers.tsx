'use client';

import { Fragment, useEffect, useState, useRef, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { defaultClientTheme, resolveTheme } from '@meal-planner/design-system';
import { ApiClient } from '../shared/api/client.js';
import { clearBrowserRecipeCache } from '../entities/recipe-cache/model.js';
import { RecipeWorkspaceCompatibility } from '../entities/recipe/index.js';
import {
    forgetOfflineOwner,
    markOfflineSync,
    registerOfflineWorker,
    rememberOfflineOwner,
} from '../entities/offline/store.js';
import { OfflineSyncCoordinator } from '../features/offline/client.js';
import { createUiStore, RuntimeProvider, type MfaFlow } from '../shared/runtime/index.js';
import { WorkspaceScopeProvider } from '../entities/workspace-scope/client.js';
import { createWorkspaceScopeStore } from '../entities/workspace-scope/model.js';

const sessionLifecycle = {
    onUserAuthenticated: rememberOfflineOwner,
    onUserUnauthorized: () => {
        forgetOfflineOwner();
        clearBrowserRecipeCache();
    },
};

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
    const [workspaceScope] = useState(createWorkspaceScopeStore);
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
                    void registerOfflineWorker().catch(() => {
                        /* The online application remains usable when offline shell registration fails. */
                    });
                }
                if (active)
                    setApi(
                        new ApiClient(
                            window.location.origin,
                            fetch,
                            markOfflineSync,
                            new RecipeWorkspaceCompatibility(),
                        ),
                    );
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
            workspaceScope.getState().reset();
            setMfa(null);
            setAuthGeneration((value) => value + 1);
        };
        channel.current = next;
        return () => {
            channel.current = null;
            next.close();
        };
    }, [api, queryClient, ui, workspaceScope]);
    const reset = () => {
        clearBrowserRecipeCache();
        forgetOfflineOwner();
        api?.invalidate();
        queryClient.clear();
        workspaceScope.getState().reset();
        setMfa(null);
        setAuthGeneration((value) => value + 1);
    };
    return (
        <WorkspaceScopeProvider value={workspaceScope}>
            <RuntimeProvider
                value={{
                    api,
                    error,
                    queryClient,
                    reset,
                    broadcast: () => channel.current?.postMessage('changed'),
                    ui,
                    mfa,
                    setMfa,
                    sessionLifecycle,
                }}
            >
                <QueryClientProvider client={queryClient}>
                    <OfflineSyncCoordinator api={api} queryClient={queryClient} />
                    {/* Drop mounted query observers and transient MFA/form state on account changes. */}
                    <Fragment key={authGeneration}>{children}</Fragment>
                </QueryClientProvider>
            </RuntimeProvider>
        </WorkspaceScopeProvider>
    );
}
