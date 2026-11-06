'use client';

import { useEffect } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../../shared/api/client.js';
import { readOfflineOwner } from '../../entities/offline/store.js';
import { syncOfflineQueue } from '../../entities/offline/queue.js';
import { offlineQueryRoots } from '../../entities/offline/query-keys.js';
import { inventoryKeys } from '../../entities/inventory/query-keys.js';
import { recipeQueryRoots } from '../../entities/recipe/query-keys.js';
import { shoppingQueryRoots } from '../../entities/shopping/query-keys.js';

export function OfflineSyncCoordinator({ api, queryClient }: { api: ApiClient | null; queryClient: QueryClient }) {
    useEffect(() => {
        if (!api) return;
        let active = true;
        const synchronize = async () => {
            const owner = readOfflineOwner();
            if (!active || !owner || !navigator.onLine) return;
            try {
                await syncOfflineQueue(api, owner);
            } catch {
                return;
            }
            if (!active) return;
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: shoppingQueryRoots.root }),
                queryClient.invalidateQueries({ queryKey: shoppingQueryRoots.receiptsRoot }),
                queryClient.invalidateQueries({ queryKey: shoppingQueryRoots.purchasesRoot }),
                queryClient.invalidateQueries({ queryKey: inventoryKeys.root }),
                queryClient.invalidateQueries({ queryKey: recipeQueryRoots.workspaceRoot }),
                queryClient.invalidateQueries({ queryKey: recipeQueryRoots.cookingRoot }),
                queryClient.invalidateQueries({ queryKey: offlineQueryRoots.draftStateRoot }),
            ]);
        };
        const onVisible = () => {
            if (document.visibilityState === 'visible') void synchronize();
        };
        const onOnline = () => void synchronize();
        window.addEventListener('online', onOnline);
        document.addEventListener('visibilitychange', onVisible);
        const interval = window.setInterval(() => void synchronize(), 30_000);
        void synchronize();
        return () => {
            active = false;
            window.removeEventListener('online', onOnline);
            document.removeEventListener('visibilitychange', onVisible);
            window.clearInterval(interval);
        };
    }, [api, queryClient]);
    return null;
}
