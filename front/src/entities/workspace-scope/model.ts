import { createStore } from 'zustand/vanilla';

export type WorkspaceScope = 'personal' | 'family';

export type WorkspaceScopeState = {
    scope: WorkspaceScope;
    initializedFor: string | null;
    setScope: (scope: WorkspaceScope) => void;
    setScopeFor: (userId: string, scope: WorkspaceScope) => void;
    initializeScope: (userId: string, hasFamily: boolean) => void;
    reset: () => void;
};

export const createWorkspaceScopeStore = () =>
    createStore<WorkspaceScopeState>((set) => ({
        scope: 'personal',
        initializedFor: null,
        setScope: (scope) => set({ scope }),
        setScopeFor: (initializedFor, scope) => set({ scope, initializedFor }),
        initializeScope: (userId, hasFamily) =>
            set((state) =>
                state.initializedFor === userId
                    ? state
                    : { scope: hasFamily ? 'family' : 'personal', initializedFor: userId },
            ),
        reset: () => set({ scope: 'personal', initializedFor: null }),
    }));

export type WorkspaceScopeStore = ReturnType<typeof createWorkspaceScopeStore>;
