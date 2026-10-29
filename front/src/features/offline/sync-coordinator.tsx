'use client';

import { useEffect } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../../shared/api/client.js';
import { readOfflineOwner } from '../../entities/offline/store.js';
import { syncOfflineQueue } from '../../entities/offline/queue.js';

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
            await Promise.all(
                [
                    'shopping',
                    'receipts',
                    'purchases',
                    'inventory',
                    'recipe-workspace',
                    'cooking',
                    'offline-draft-state',
                ].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
            );
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
