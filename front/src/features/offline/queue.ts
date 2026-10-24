import { ApiError, type ApiClient } from '../../shared/api/client.js';
import { contracts, type Route } from '../../shared/api/contracts.generated.js';
import { openOfflineDatabase } from './offline-store.js';

export const offlineRoutes = [
    'POST /api/v1/shopping-lists/{id}/items',
    'POST /api/v1/shopping-lists/{id}/items/{itemId}',
    'POST /api/v1/recipe-workspace',
    'PUT /api/v1/recipe-workspace/{id}',
    'POST /api/v1/recipe-workspace/{id}/archive',
    'POST /api/v1/recipe-workspace/{id}/restore',
    'POST /api/v1/cooking-attempts/{id}/progress',
] as const satisfies readonly Route[];

export type OfflineRoute = (typeof offlineRoutes)[number];
export type OfflineQueueStatus =
    'pending' | 'synced' | 'failed' | 'conflict' | 'rejected' | 'auth_required' | 'superseded';
export type OfflineEntityType = 'purchase' | 'recipe' | 'cooking';

export interface OfflineQueueItem {
    queueId: string;
    owner: string;
    operationType: 'create' | 'update' | 'archive' | 'restore';
    entityType: OfflineEntityType;
    entityId: string;
    localEntityId?: string | null;
    serverEntityId?: string | null;
    route: OfflineRoute;
    params?: Record<string, string>;
    body: Record<string, unknown>;
    baseVersion: number | null;
    idempotencyKey: string;
    dependsOn: string[];
    createdAt: string;
    status: OfflineQueueStatus;
    retryCount: number;
    attemptedAt?: string | null;
    serverRevision: string | null;
    lastError: string | null;
    nextAttemptAt?: string | null;
}

const activeStatuses = new Set<OfflineQueueStatus>(['pending', 'failed', 'conflict', 'rejected', 'auth_required']);
const priorities: Record<OfflineEntityType, number> = { purchase: 0, cooking: 1, recipe: 2 };
let inProcessSync: Promise<void> | null = null;

function transactionDone(transaction: IDBTransaction) {
    return new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error ?? new Error('Локальная транзакция отменена.'));
        transaction.onerror = () => reject(transaction.error ?? new Error('Ошибка локальной очереди.'));
    });
}

async function readAll(): Promise<OfflineQueueItem[]> {
    const database = await openOfflineDatabase();
    if (!database) return [];
    try {
        const transaction = database.transaction('queue', 'readonly');
        const request = transaction.objectStore('queue').getAll();
        const result = await new Promise<OfflineQueueItem[]>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result as OfflineQueueItem[]);
            request.onerror = () => reject(request.error ?? new Error('Не удалось прочитать локальную очередь.'));
        });
        await transactionDone(transaction);
        return result;
    } finally {
        database.close();
    }
}

async function put(item: OfflineQueueItem) {
    const database = await openOfflineDatabase();
    if (!database) throw new Error('IndexedDB недоступна: действие нельзя надёжно сохранить на устройстве.');
    try {
        const transaction = database.transaction('queue', 'readwrite');
        transaction.objectStore('queue').put(item);
        await transactionDone(transaction);
    } finally {
        database.close();
    }
    window.dispatchEvent(new Event('meal-planner-offline-state'));
}

async function markOwnerAuthRequired(owner: string, message: string) {
    const database = await openOfflineDatabase();
    if (!database) return;
    try {
        const transaction = database.transaction('queue', 'readwrite');
        const store = transaction.objectStore('queue');
        const request = store.openCursor();
        request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) return;
            const item = cursor.value as OfflineQueueItem;
            if (item.owner === owner && ['pending', 'failed', 'auth_required'].includes(item.status))
                cursor.update({ ...item, status: 'auth_required', lastError: message, nextAttemptAt: null });
            cursor.continue();
        };
        await transactionDone(transaction);
    } finally {
        database.close();
    }
    window.dispatchEvent(new Event('meal-planner-offline-state'));
}

export async function listOfflineQueue(owner: string, includeCompleted = false) {
    return (await readAll())
        .filter((item) => item.owner === owner && (includeCompleted || activeStatuses.has(item.status)))
        .sort(
            (left, right) =>
                priorities[left.entityType] - priorities[right.entityType] ||
                Date.parse(left.createdAt) - Date.parse(right.createdAt),
        );
}

export async function readOfflineDraftState(owner: string, localEntityId: string) {
    const history = (await listOfflineQueue(owner, true)).filter((item) => item.localEntityId === localEntityId);
    const mapping = history
        .filter((item) => item.status === 'synced' && item.serverEntityId && item.serverRevision)
        .at(-1);
    const unresolvedCreate = history
        .filter(
            (item) =>
                item.route === 'POST /api/v1/recipe-workspace' &&
                item.operationType === 'create' &&
                item.status !== 'synced' &&
                item.status !== 'superseded',
        )
        .at(-1);
    return {
        serverId: mapping?.serverEntityId ?? null,
        unresolvedStatus: unresolvedCreate?.status ?? null,
        unresolvedError: unresolvedCreate?.lastError ?? null,
    };
}

async function enqueueUnlocked(input: {
    owner: string;
    route: OfflineRoute;
    body: Record<string, unknown>;
    params?: Record<string, string>;
    operationType: OfflineQueueItem['operationType'];
    entityType: OfflineEntityType;
    entityId: string;
    baseVersion?: number | null;
}) {
    if (navigator.onLine) throw new Error('Offline-очередь используется только без подключения.');
    const history = await listOfflineQueue(input.owner, true);
    const draftMapping =
        input.entityType === 'recipe' && input.route === 'POST /api/v1/recipe-workspace'
            ? history
                  .filter(
                      (item) =>
                          item.status === 'synced' &&
                          item.localEntityId === input.entityId &&
                          item.serverEntityId &&
                          item.serverRevision,
                  )
                  .at(-1)
            : undefined;
    const mappedVersion = draftMapping ? Number(draftMapping.serverRevision) : null;
    const route: OfflineRoute = draftMapping ? 'PUT /api/v1/recipe-workspace/{id}' : input.route;
    const entityId = draftMapping?.serverEntityId ?? input.entityId;
    const localEntityId = input.entityId.startsWith('draft:') ? input.entityId : null;
    const previous = history
        .filter(
            (item) =>
                activeStatuses.has(item.status) &&
                item.entityType === input.entityType &&
                (item.entityId === entityId || (!!localEntityId && item.localEntityId === localEntityId)),
        )
        .at(-1);
    const replacesDraftSnapshot =
        input.entityType === 'recipe' &&
        !!localEntityId &&
        previous?.status === 'pending' &&
        !previous.attemptedAt &&
        previous.route === route;
    const idempotencyKey = replacesDraftSnapshot
        ? previous.idempotencyKey
        : typeof input.body.idempotencyKey === 'string'
          ? input.body.idempotencyKey
          : crypto.randomUUID();
    const body = {
        ...structuredClone(input.body),
        ...(draftMapping ? { expectedVersion: mappedVersion } : {}),
        idempotencyKey,
    };
    const parsed = contracts[route].request?.safeParse(body);
    if (parsed && !parsed.success)
        throw new Error('Действие не сохранено: ' + parsed.error.issues.map((issue) => issue.message).join('; '));
    const item: OfflineQueueItem = {
        queueId: replacesDraftSnapshot ? previous.queueId : crypto.randomUUID(),
        owner: input.owner,
        operationType: draftMapping ? 'update' : input.operationType,
        entityType: input.entityType,
        entityId,
        localEntityId,
        serverEntityId: draftMapping?.serverEntityId ?? null,
        route,
        ...(draftMapping?.serverEntityId
            ? { params: { id: draftMapping.serverEntityId } }
            : input.params
              ? { params: structuredClone(input.params) }
              : {}),
        body,
        baseVersion: mappedVersion ?? input.baseVersion ?? null,
        idempotencyKey,
        dependsOn: replacesDraftSnapshot ? previous.dependsOn : previous ? [previous.queueId] : [],
        createdAt: replacesDraftSnapshot ? previous.createdAt : new Date().toISOString(),
        status: 'pending',
        retryCount: 0,
        attemptedAt: replacesDraftSnapshot ? (previous.attemptedAt ?? null) : null,
        serverRevision: null,
        lastError: null,
        nextAttemptAt: null,
    };
    await put(item);
    window.dispatchEvent(new Event('meal-planner-offline-queued'));
    return item;
}

export function enqueueOfflineOperation(input: Parameters<typeof enqueueUnlocked>[0]) {
    if ('locks' in navigator) return navigator.locks.request('meal-planner-offline-sync', () => enqueueUnlocked(input));
    return enqueueUnlocked(input);
}

function responseVersion(value: unknown) {
    if (!value || typeof value !== 'object') return null;
    const direct = (value as Record<string, unknown>).version;
    if (typeof direct === 'number') return direct;
    const recipe = (value as Record<string, unknown>).recipe;
    if (recipe && typeof recipe === 'object') {
        const nested = (recipe as Record<string, unknown>).version;
        if (typeof nested === 'number') return nested;
    }
    return null;
}

function responseEntityId(value: unknown) {
    if (!value || typeof value !== 'object') return null;
    const recipe = (value as Record<string, unknown>).recipe;
    if (!recipe || typeof recipe !== 'object') return null;
    const id = (recipe as Record<string, unknown>).id;
    return typeof id === 'string' ? id : null;
}

async function markSyncedAndAdvance(
    owner: string,
    item: OfflineQueueItem,
    version: number | null,
    serverEntityId: string | null,
) {
    const database = await openOfflineDatabase();
    if (!database) throw new Error('IndexedDB недоступна: результат синхронизации нельзя надёжно сохранить.');
    const synced: OfflineQueueItem = {
        ...item,
        status: 'synced',
        serverEntityId: serverEntityId ?? item.serverEntityId ?? item.params?.id ?? null,
        serverRevision: version === null ? null : String(version),
        lastError: null,
        nextAttemptAt: null,
    };
    try {
        const transaction = database.transaction('queue', 'readwrite');
        const store = transaction.objectStore('queue');
        store.put(synced);
        if (version !== null) {
            const request = store.openCursor();
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) return;
                const dependant = cursor.value as OfflineQueueItem;
                if (dependant.owner === owner && dependant.dependsOn.includes(item.queueId)) {
                    const body = { ...dependant.body };
                    if ('version' in body) body.version = version;
                    if ('expectedVersion' in body) body.expectedVersion = version;
                    const followsUncertainRecipeCreation =
                        item.route === 'POST /api/v1/recipe-workspace' &&
                        dependant.route === 'POST /api/v1/recipe-workspace' &&
                        serverEntityId;
                    cursor.update(
                        followsUncertainRecipeCreation
                            ? {
                                  ...dependant,
                                  operationType: 'update',
                                  entityId: serverEntityId,
                                  localEntityId: dependant.localEntityId ?? item.localEntityId ?? item.entityId,
                                  serverEntityId,
                                  route: 'PUT /api/v1/recipe-workspace/{id}',
                                  params: { id: serverEntityId },
                                  body: { ...body, expectedVersion: version },
                                  baseVersion: version,
                              }
                            : { ...dependant, body, baseVersion: version },
                    );
                }
                cursor.continue();
            };
        }
        await transactionDone(transaction);
    } finally {
        database.close();
    }
    window.dispatchEvent(new Event('meal-planner-offline-state'));
    return synced;
}

async function performSync(api: ApiClient, owner: string) {
    if (!navigator.onLine) return;
    const items = await listOfflineQueue(owner);
    const byId = new Map((await listOfflineQueue(owner, true)).map((item) => [item.queueId, item]));
    for (const queued of items) {
        if (!navigator.onLine) break;
        const item = (await listOfflineQueue(owner)).find((candidate) => candidate.queueId === queued.queueId);
        if (!item) continue;
        if (!['pending', 'failed', 'auth_required'].includes(item.status)) continue;
        if (item.nextAttemptAt && Date.parse(item.nextAttemptAt) > Date.now()) continue;
        const blocked = item.dependsOn.some((id) => byId.get(id)?.status !== 'synced');
        if (blocked) continue;
        const sending = { ...item, attemptedAt: item.attemptedAt ?? new Date().toISOString() };
        try {
            await put(sending);
            const response = await api.request(sending.route, sending.body, undefined, sending.params);
            const version = responseVersion(response.data);
            const synced = await markSyncedAndAdvance(owner, sending, version, responseEntityId(response.data));
            byId.set(sending.queueId, synced);
        } catch (error) {
            const next: OfflineQueueItem = {
                ...sending,
                retryCount: sending.retryCount + 1,
                lastError: error instanceof Error ? error.message : 'Неизвестная ошибка синхронизации',
                status:
                    error instanceof ApiError && error.status === 401
                        ? 'auth_required'
                        : error instanceof ApiError && [409, 412].includes(error.status)
                          ? 'conflict'
                          : error instanceof ApiError && error.status < 500
                            ? 'rejected'
                            : navigator.onLine
                              ? 'failed'
                              : 'pending',
                nextAttemptAt:
                    error instanceof ApiError && error.status < 500 && error.status !== 401
                        ? null
                        : new Date(
                              Date.now() + Math.min(15 * 60_000, 30_000 * 2 ** Math.min(sending.retryCount, 5)),
                          ).toISOString(),
            };
            await put(next);
            byId.set(sending.queueId, next);
            if (next.status === 'auth_required' || next.status === 'pending' || next.status === 'failed') break;
        }
    }
}

async function verifyOwnerAndSync(api: ApiClient, owner: string) {
    try {
        const currentOwner = (await api.request('GET /api/v1/auth/me')).data.user.id;
        if (currentOwner !== owner) {
            await markOwnerAuthRequired(
                owner,
                'Очередь принадлежит другому аккаунту. Войдите в исходный аккаунт для синхронизации.',
            );
            return;
        }
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
            await markOwnerAuthRequired(owner, 'Сессия завершена. Войдите снова для синхронизации.');
            return;
        }
        throw error;
    }
    await performSync(api, owner);
}

export function syncOfflineQueue(api: ApiClient, owner: string) {
    if (inProcessSync) return inProcessSync;
    const run = async () => {
        if ('locks' in navigator)
            await navigator.locks.request('meal-planner-offline-sync', () => verifyOwnerAndSync(api, owner));
        else await verifyOwnerAndSync(api, owner);
    };
    inProcessSync = run().finally(() => {
        inProcessSync = null;
    });
    return inProcessSync;
}

export async function retryOfflineItem(owner: string, queueId: string) {
    const item = (await listOfflineQueue(owner)).find((candidate) => candidate.queueId === queueId);
    if (!item || !['failed', 'auth_required'].includes(item.status)) return;
    await put({ ...item, status: 'pending', lastError: null, nextAttemptAt: null });
}

export async function discardOfflineItem(owner: string, queueId: string) {
    const item = (await listOfflineQueue(owner)).find((candidate) => candidate.queueId === queueId);
    if (!item || item.status === 'synced') return;
    const dependants = (await listOfflineQueue(owner)).filter((candidate) => candidate.dependsOn.includes(queueId));
    if (dependants.length) throw new Error('Сначала обработайте зависимые действия, чтобы не нарушить их порядок.');
    await put({ ...item, status: 'superseded', lastError: null });
}
