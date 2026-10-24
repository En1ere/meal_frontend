import { setupWorker } from 'msw/browser';
import { MockApi } from './api.js';
import { createHandlers } from './handlers.js';
import { IndexedDbRepository } from './repository.js';

let start: Promise<void> | undefined;
export function startBrowserMocks(): Promise<void> {
    if (!import.meta.env.DEV) throw new Error('Browser mocks are development-only');
    if (typeof window === 'undefined') throw new Error('Start browser mocks only on the client');
    return (start ??= (async () => {
        const origin = window.location.origin;
        const worker = setupWorker(
            ...createHandlers(new MockApi(new IndexedDbRepository(), { origin, adminOnly: true }), origin),
        );
        await worker.start({ onUnhandledRequest: 'bypass', serviceWorker: { url: '/mockServiceWorker.js' } });
    })().catch((error: unknown) => {
        start = undefined;
        throw error;
    }));
}
