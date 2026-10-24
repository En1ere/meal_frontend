import { setupWorker } from 'msw/browser';
import { MockApi } from './api.js';
import { createHandlers } from './handlers.js';
import { IndexedDbRepository } from './repository.js';

let start: Promise<void> | undefined;
export function startBrowserMocks(): Promise<void> {
    if (process.env.NODE_ENV !== 'development' && process.env.NEXT_PUBLIC_E2E_PRODUCTION_MOCKS !== '1')
        throw new Error('Browser mocks are development-only outside the isolated E2E production build');
    if (typeof window === 'undefined') throw new Error('Start browser mocks only on the client');
    return (start ??= (async () => {
        const origin = window.location.origin;
        const worker = setupWorker(...createHandlers(new MockApi(new IndexedDbRepository(), { origin }), origin));
        await worker.start({ onUnhandledRequest: 'bypass', serviceWorker: { url: '/mockServiceWorker.js' } });
    })().catch((error: unknown) => {
        start = undefined;
        throw error;
    }));
}
