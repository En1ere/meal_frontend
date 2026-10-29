'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { defaultClientTheme, type ThemeName } from '@meal-planner/design-system';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { ApiClient } from '../api/client.js';
import type { Success } from '../api/contracts.generated.js';

export type MfaFlow = Success<'POST /api/v1/staff/auth/login'>['data'] & {
    context: 'moderator';
    returnTo: string;
};

export type UiState = {
    theme: ThemeName;
    collapsed: boolean;
    setTheme: (value: ThemeName) => void;
    toggleSidebar: () => void;
};

export const createUiStore = () =>
    createStore<UiState>((set) => ({
        theme: defaultClientTheme,
        collapsed: false,
        setTheme: (theme) => set({ theme }),
        toggleSidebar: () => set((state) => ({ collapsed: !state.collapsed })),
    }));

export interface Runtime {
    api: ApiClient | null;
    error: string | null;
    queryClient: QueryClient;
    reset: () => void;
    broadcast: () => void;
    ui: ReturnType<typeof createUiStore>;
    mfa: MfaFlow | null;
    setMfa: (value: MfaFlow | null) => void;
    sessionLifecycle: {
        onUserAuthenticated: (userId: string) => void;
        onUserUnauthorized: () => void;
    };
}

const RuntimeContext = createContext<Runtime | null>(null);

export function RuntimeProvider({ value, children }: { value: Runtime; children: ReactNode }) {
    return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}

export function useRuntime() {
    const value = useContext(RuntimeContext);
    if (!value) throw new Error('Missing runtime provider');
    return value;
}

export function useUi<T>(selector: (state: UiState) => T) {
    return useStore(useRuntime().ui, selector);
}
