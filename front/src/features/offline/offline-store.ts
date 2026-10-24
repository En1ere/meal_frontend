import { readRecipeCache, recipeCacheKey } from '../recipes/offline-cache.js';

export const offlineDatabaseName = 'meal-planner-offline-v1';
export const offlineCachePrefix = 'meal-planner-offline-';
const lastSyncKey = 'meal-planner-offline-last-sync-v1';
const offlineOwnerKey = 'meal-planner-offline-owner-v1';
const stateEvent = 'meal-planner-offline-state';

export interface OfflineSnapshot {
    online: boolean;
    serviceWorkerReady: boolean;
    cachedRecipes: number;
    pending: number;
    failed: number;
    conflicts: number;
    rejected: number;
    authRequired: number;
    lastSyncAt: string | null;
    usageBytes: number | null;
    quotaBytes: number | null;
}

function emit() {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(stateEvent));
}

export function subscribeOfflineState(callback: () => void) {
    window.addEventListener('online', callback);
    window.addEventListener('offline', callback);
    window.addEventListener('storage', callback);
    window.addEventListener(stateEvent, callback);
    navigator.serviceWorker?.addEventListener('controllerchange', callback);
    return () => {
        window.removeEventListener('online', callback);
        window.removeEventListener('offline', callback);
        window.removeEventListener('storage', callback);
        window.removeEventListener(stateEvent, callback);
        navigator.serviceWorker?.removeEventListener('controllerchange', callback);
    };
}

export function markOfflineSync(at = new Date().toISOString()) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(lastSyncKey, at);
        emit();
    } catch {
        /* Storage may be disabled; successful network work remains successful. */
    }
}

export function rememberOfflineOwner(owner: string) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(offlineOwnerKey, owner);
        emit();
    } catch {
        /* Offline access remains unavailable when browser storage is disabled. */
    }
}

export function readOfflineOwner() {
    if (typeof window === 'undefined') return null;
    try {
        return localStorage.getItem(offlineOwnerKey);
    } catch {
        return null;
    }
}

export function forgetOfflineOwner() {
    if (typeof window === 'undefined') return;
    try {
        localStorage.removeItem(offlineOwnerKey);
        emit();
    } catch {
        /* The caller still clears its in-memory session state. */
    }
}

export function openOfflineDatabase(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    return new Promise((resolve, reject) => {
        let blocked = false;
        const request = indexedDB.open(offlineDatabaseName, 2);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains('queue'))
                request.result.createObjectStore('queue', { keyPath: 'queueId' });
            if (!request.result.objectStoreNames.contains('snapshots'))
                request.result.createObjectStore('snapshots', { keyPath: 'key' });
        };
        request.onsuccess = () => {
            if (blocked) request.result.close();
            else resolve(request.result);
        };
        request.onerror = () => reject(request.error ?? new Error('Не удалось открыть локальную очередь.'));
        request.onblocked = () => {
            blocked = true;
            reject(new Error('Локальная очередь занята другой вкладкой.'));
        };
    });
}

async function queueCounts(owner: string) {
    const database = await openOfflineDatabase();
    if (!database) return { pending: 0, failed: 0, conflicts: 0, rejected: 0, authRequired: 0 };
    try {
        return await new Promise<{
            pending: number;
            failed: number;
            conflicts: number;
            rejected: number;
            authRequired: number;
        }>((resolve) => {
            const counts = { pending: 0, failed: 0, conflicts: 0, rejected: 0, authRequired: 0 };
            const transaction = database.transaction('queue', 'readonly');
            const request = transaction.objectStore('queue').openCursor();
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) return;
                const value = cursor.value as { owner?: string; status?: string };
                if (value.owner === owner) {
                    if (value.status === 'failed') counts.failed++;
                    else if (value.status === 'conflict') counts.conflicts++;
                    else if (value.status === 'rejected') counts.rejected++;
                    else if (value.status === 'auth_required') counts.authRequired++;
                    else if (value.status !== 'synced' && value.status !== 'superseded') counts.pending++;
                }
                cursor.continue();
            };
            transaction.oncomplete = () => resolve(counts);
            transaction.onabort = () => resolve(counts);
            transaction.onerror = () => resolve(counts);
        });
    } finally {
        database.close();
    }
}

export async function readOfflineSnapshot(owner: string): Promise<OfflineSnapshot> {
    let usageBytes: number | null = null;
    let quotaBytes: number | null = null;
    try {
        const estimate = await navigator.storage?.estimate();
        usageBytes = estimate?.usage ?? null;
        quotaBytes = estimate?.quota ?? null;
    } catch {
        /* Browser may not expose quota data. */
    }
    const queue = await queueCounts(owner);
    let cachedRecipes = 0;
    let lastSyncAt: string | null = null;
    try {
        cachedRecipes = readRecipeCache(localStorage, owner).length;
        const stored = localStorage.getItem(lastSyncKey);
        lastSyncAt = stored && Number.isFinite(Date.parse(stored)) ? stored : null;
    } catch {
        /* Storage may be unavailable. */
    }
    return {
        online: navigator.onLine,
        serviceWorkerReady: !!navigator.serviceWorker?.controller?.scriptURL.endsWith('/offline-worker.js'),
        cachedRecipes,
        ...queue,
        lastSyncAt,
        usageBytes,
        quotaBytes,
    };
}

async function clearOwnerStore(owner: string, storeName: 'queue' | 'snapshots') {
    const database = await openOfflineDatabase();
    if (!database) return;
    try {
        await new Promise<void>((resolve, reject) => {
            const transaction = database.transaction(storeName, 'readwrite');
            const request = transaction.objectStore(storeName).openCursor();
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) return;
                const value = cursor.value as { owner?: string };
                if (value.owner === owner) cursor.delete();
                cursor.continue();
            };
            transaction.oncomplete = () => resolve();
            transaction.onabort = () =>
                reject(transaction.error ?? new Error('Не удалось очистить локальную очередь.'));
            transaction.onerror = () =>
                reject(transaction.error ?? new Error('Не удалось очистить локальную очередь.'));
        });
    } finally {
        database.close();
    }
}

export async function clearOfflineData(owner: string) {
    const counts = await queueCounts(owner);
    if (counts.pending || counts.failed || counts.conflicts || counts.rejected || counts.authRequired)
        throw new Error('Сначала синхронизируйте или разрешите операции в локальной очереди.');
    await clearOwnerStore(owner, 'queue');
    await clearOwnerStore(owner, 'snapshots');
    const failures: unknown[] = [];
    try {
        localStorage.removeItem(recipeCacheKey);
        localStorage.removeItem(lastSyncKey);
    } catch (error) {
        failures.push(error);
    }
    if (typeof caches !== 'undefined') {
        const names = await caches.keys();
        const results = await Promise.allSettled(
            names.filter((name) => name.startsWith(offlineCachePrefix)).map((name) => caches.delete(name)),
        );
        failures.push(...results.filter((result) => result.status === 'rejected'));
    }
    if (!failures.length) {
        try {
            localStorage.removeItem(offlineOwnerKey);
        } catch (error) {
            failures.push(error);
        }
    }
    emit();
    if (failures.length) throw new Error('Часть локальных данных удалить не удалось. Повторите очистку.');
}

export async function registerOfflineWorker() {
    if (process.env.NEXT_PUBLIC_API_MODE === 'mock' || !('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.register('/offline-worker.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: 'PRECACHE' });
    emit();
}
