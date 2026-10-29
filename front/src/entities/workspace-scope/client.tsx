'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { WorkspaceScopeState, WorkspaceScopeStore } from './model.js';

const WorkspaceScopeContext = createContext<WorkspaceScopeStore | null>(null);

export function WorkspaceScopeProvider({ value, children }: { value: WorkspaceScopeStore; children: ReactNode }) {
    return <WorkspaceScopeContext.Provider value={value}>{children}</WorkspaceScopeContext.Provider>;
}

export function useWorkspaceScope<T>(selector: (state: WorkspaceScopeState) => T) {
    const store = useContext(WorkspaceScopeContext);
    if (!store) throw new Error('Missing workspace scope provider');
    return useStore(store, selector);
}
