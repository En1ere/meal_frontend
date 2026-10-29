'use client';

import { useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../shared/runtime/index.js';
import { familyKeys } from './model.js';

export function useFamilyContext(userId: string | undefined, enabled = true) {
    const { api } = useRuntime();
    return useQuery({
        queryKey: familyKeys.context(userId),
        enabled: enabled && !!api && !!userId,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/family', undefined, signal)).data,
    });
}

export { familyKeys } from './model.js';
export type { Family, FamilyContext } from './model.js';
