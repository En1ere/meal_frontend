import { openOfflineDatabase } from './offline-store.js';

interface Snapshot<T = unknown> {
    key: string;
    owner: string;
    data: T;
    savedAt: string;
}

const storageKey = (owner: string, key: string) => `${owner}:${key}`;

function transactionDone(transaction: IDBTransaction) {
    return new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error ?? new Error('Локальная транзакция отменена.'));
        transaction.onerror = () => reject(transaction.error ?? new Error('Ошибка локальных снимков.'));
    });
}

export async function saveOfflineSnapshot<T>(owner: string, key: string, data: T) {
    const database = await openOfflineDatabase();
    if (!database) return;
    try {
        const transaction = database.transaction('snapshots', 'readwrite');
        transaction.objectStore('snapshots').put({
            key: storageKey(owner, key),
            owner,
            data: structuredClone(data),
            savedAt: new Date().toISOString(),
        } satisfies Snapshot<T>);
        await transactionDone(transaction);
    } finally {
        database.close();
    }
}

export async function readOfflineSnapshotData<T>(owner: string, key: string, maxAgeDays = 30): Promise<T | null> {
    const database = await openOfflineDatabase();
    if (!database) return null;
    try {
        const transaction = database.transaction('snapshots', 'readonly');
        const request = transaction.objectStore('snapshots').get(storageKey(owner, key));
        const snapshot = await new Promise<Snapshot<T> | undefined>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result as Snapshot<T> | undefined);
            request.onerror = () => reject(request.error ?? new Error('Не удалось прочитать локальный снимок.'));
        });
        await transactionDone(transaction);
        if (!snapshot || Date.parse(snapshot.savedAt) <= Date.now() - maxAgeDays * 86_400_000) return null;
        return structuredClone(snapshot.data);
    } finally {
        database.close();
    }
}
