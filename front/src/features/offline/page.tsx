'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useSession } from '../auth/session.js';
import { Brand } from '../../shared/ui/brand.js';
import { ThemeControl } from '../../ui/ThemeControl/ThemeControl.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import {
    clearOfflineData,
    readOfflineOwner,
    readOfflineSnapshot,
    subscribeOfflineState,
    type OfflineSnapshot,
} from './offline-store.js';
import styles from './offline.module.css';
import { useRuntime } from '../../app/providers.js';
import {
    discardOfflineItem,
    listOfflineQueue,
    retryOfflineItem,
    syncOfflineQueue,
    type OfflineQueueItem,
} from './queue.js';

const bytes = (value: number | null) => {
    if (value === null) return 'Недоступно в этом браузере';
    if (value < 1024) return `${value} Б`;
    if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} КБ`;
    return `${(value / 1024 ** 2).toFixed(1)} МБ`;
};

function Content() {
    const { api, queryClient } = useRuntime();
    const session = useSession('user');
    const router = useRouter();
    const online = useSyncExternalStore(
        subscribeOfflineState,
        () => navigator.onLine,
        () => true,
    );
    const owner = session.data?.id ?? (!online ? readOfflineOwner() : null);
    const dialog = useRef<HTMLDialogElement>(null);
    const [snapshot, setSnapshot] = useState<OfflineSnapshot | null>(null);
    const [queue, setQueue] = useState<OfflineQueueItem[]>([]);
    const [error, setError] = useState('');
    const [clearing, setClearing] = useState(false);
    useEffect(() => {
        if (online && session.isSuccess && !session.data) router.replace('/auth?returnTo=%2Fsettings%2Foffline');
    }, [online, router, session.data, session.isSuccess]);
    useEffect(() => {
        if (!owner) return;
        let active = true;
        const refresh = () => {
            void Promise.all([readOfflineSnapshot(owner), listOfflineQueue(owner)])
                .then(([value, items]) => {
                    if (active) {
                        setSnapshot(value);
                        setQueue(items);
                        setError('');
                    }
                })
                .catch(() => {
                    if (active)
                        setError('Не удалось прочитать локальную очередь. Закройте другие вкладки и повторите.');
                });
        };
        refresh();
        const unsubscribe = subscribeOfflineState(refresh);
        return () => {
            active = false;
            unsubscribe();
        };
    }, [owner]);
    async function clear() {
        if (!owner || clearing) return;
        setClearing(true);
        setError('');
        try {
            await clearOfflineData(owner);
            dialog.current?.close();
            setSnapshot(await readOfflineSnapshot(owner));
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Не удалось очистить локальные данные.');
        } finally {
            setClearing(false);
        }
    }
    async function synchronize() {
        if (!api || !owner || !navigator.onLine) return;
        setError('');
        try {
            await syncOfflineQueue(api, owner);
            await queryClient.invalidateQueries();
            setSnapshot(await readOfflineSnapshot(owner));
            setQueue(await listOfflineQueue(owner));
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Не удалось синхронизировать локальные действия.');
        }
    }
    async function retry(item: OfflineQueueItem) {
        if (!owner) return;
        await retryOfflineItem(owner, item.queueId);
        if (navigator.onLine) await synchronize();
        else {
            setSnapshot(await readOfflineSnapshot(owner));
            setQueue(await listOfflineQueue(owner));
        }
    }
    async function discard(item: OfflineQueueItem) {
        if (!owner || !window.confirm('Удалить это локальное действие без отправки на сервер?')) return;
        try {
            await discardOfflineItem(owner, item.queueId);
            setSnapshot(await readOfflineSnapshot(owner));
            setQueue(await listOfflineQueue(owner));
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Не удалось удалить локальное действие.');
        }
    }
    if (!owner) {
        return (
            <main id="main" className={styles.page}>
                <section className={styles.panel} role={session.isError ? 'alert' : 'status'}>
                    <h1>{!online ? 'Локальные данные недоступны' : 'Проверяем вход…'}</h1>
                    <p>
                        {!online
                            ? 'На устройстве нет подтверждённого аккаунта. Подключитесь к сети и войдите снова.'
                            : session.isError
                              ? 'Не удалось проверить аккаунт. Повторите запрос.'
                              : 'Настройки откроются после проверки активной сессии.'}
                    </p>
                    {session.isError && <button onClick={() => void session.refetch()}>Повторить</button>}
                </section>
            </main>
        );
    }
    return (
        <main id="main" className={styles.page}>
            <header className={styles.header}>
                <Brand />
                <ThemeControl />
                <Link href="/settings/account">Аккаунт и безопасность</Link>
            </header>
            <nav className={styles.breadcrumbs} aria-label="Навигация по настройкам">
                <Link href="/profile">Профиль</Link>
                <span>→</span>
                <span>Offline и устройство</span>
            </nav>
            <div className={styles.heading}>
                <div>
                    <p className={styles.eyebrow}>Настройки</p>
                    <h1>Offline и устройство</h1>
                    <p>Контролируйте сохранённые данные и состояние синхронизации на этом устройстве.</p>
                </div>
                <span className={`${styles.state} ${snapshot?.online ? styles.online : styles.offline}`}>
                    {snapshot?.online ? 'В сети' : 'Офлайн'}
                </span>
            </div>
            {!online && <p role="status">Показаны данные последнего подтверждённого аккаунта на этом устройстве.</p>}
            {!snapshot ? (
                <ArcSkeleton variant="lines" lines={6} label="Проверяем локальные данные" />
            ) : (
                <div className={styles.grid}>
                    <section className={styles.panel}>
                        <h2>Локальные данные</h2>
                        <dl className={styles.facts}>
                            <div>
                                <dt>Занято приложением</dt>
                                <dd>{bytes(snapshot.usageBytes)}</dd>
                            </div>
                            <div>
                                <dt>Доступно браузеру</dt>
                                <dd>{bytes(snapshot.quotaBytes)}</dd>
                            </div>
                            <div>
                                <dt>Сохранённые рецепты</dt>
                                <dd>{snapshot.cachedRecipes} из 2</dd>
                            </div>
                            <div>
                                <dt>Офлайн-оболочка</dt>
                                <dd>{snapshot.serviceWorkerReady ? 'Готова' : 'Не активна'}</dd>
                            </div>
                        </dl>
                        <Link className={styles.action} href="/recipes/offline">
                            Открыть сохранённые рецепты
                        </Link>
                        {!snapshot.serviceWorkerReady && process.env.NEXT_PUBLIC_API_MODE === 'mock' && (
                            <p className={styles.note}>
                                В mock-development сеть перехватывает MSW. Офлайн-оболочка включается в real-режиме,
                                чтобы два Service Worker не конфликтовали.
                            </p>
                        )}
                    </section>
                    <section className={styles.panel}>
                        <h2>Синхронизация</h2>
                        <dl className={styles.facts}>
                            <div>
                                <dt>Последний успешный обмен</dt>
                                <dd>
                                    {snapshot.lastSyncAt
                                        ? new Date(snapshot.lastSyncAt).toLocaleString('ru-RU')
                                        : 'Пока не зафиксирован'}
                                </dd>
                            </div>
                            <div>
                                <dt>Ожидают отправки</dt>
                                <dd>{snapshot.pending}</dd>
                            </div>
                            <div>
                                <dt>Требуют внимания</dt>
                                <dd>
                                    {snapshot.failed + snapshot.conflicts + snapshot.rejected + snapshot.authRequired}
                                </dd>
                            </div>
                        </dl>
                        <button disabled={!online || !queue.length} onClick={() => void synchronize()}>
                            Синхронизировать сейчас
                        </button>
                        <p className={styles.note}>
                            Поддерживаемые действия отправляются автоматически при возвращении сети. Платежи, AI,
                            публикация и модерация всегда требуют подключения.
                        </p>
                    </section>
                    <section className={styles.panel}>
                        <h2>Очередь действий</h2>
                        {!queue.length && <p>Локальных действий, ожидающих обработки, нет.</p>}
                        <ul className={styles.queue}>
                            {queue.map((item) => (
                                <li key={item.queueId}>
                                    <strong>
                                        {{ purchase: 'Покупки', recipe: 'Личный рецепт', cooking: 'Готовка' }[
                                            item.entityType
                                        ] ?? item.entityType}
                                    </strong>
                                    <span>
                                        {{
                                            pending: 'Ожидает отправки',
                                            failed: 'Временная ошибка',
                                            conflict: 'Конфликт версий',
                                            rejected: 'Отклонено сервером',
                                            auth_required: 'Нужно снова войти',
                                            synced: 'Отправлено',
                                            superseded: 'Отменено',
                                        }[item.status] ?? item.status}
                                    </span>
                                    <small>{new Date(item.createdAt).toLocaleString('ru-RU')}</small>
                                    {item.lastError && <p>{item.lastError}</p>}
                                    {['conflict', 'rejected'].includes(item.status) && (
                                        <details>
                                            <summary>Показать сохранённый ввод</summary>
                                            <pre>{JSON.stringify(item.body, null, 2)}</pre>
                                        </details>
                                    )}
                                    {item.status === 'conflict' && (
                                        <p>
                                            Серверная версия сохранена. Проверьте её в исходном разделе и перенесите
                                            нужные поля вручную либо удалите локальное действие.
                                        </p>
                                    )}
                                    <div className={styles.actions}>
                                        {['failed', 'auth_required'].includes(item.status) && (
                                            <button onClick={() => void retry(item)}>Повторить</button>
                                        )}
                                        <button onClick={() => void discard(item)}>Удалить локальное действие</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                    <section className={`${styles.panel} ${styles.danger}`}>
                        <h2>Очистить данные устройства</h2>
                        <p>
                            Удалятся сохранённые рецепты, офлайн-оболочка и локальные метаданные этого аккаунта.
                            Серверные рецепты, запасы и покупки не изменятся.
                        </p>
                        <button
                            disabled={snapshot.pending + snapshot.failed + snapshot.conflicts > 0}
                            onClick={() => dialog.current?.showModal()}
                        >
                            Очистить локальные данные
                        </button>
                        {snapshot.pending + snapshot.failed + snapshot.conflicts > 0 && (
                            <p role="status">Очистка заблокирована, пока в очереди остаются операции.</p>
                        )}
                    </section>
                </div>
            )}
            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}
            <dialog ref={dialog} className={styles.dialog} aria-labelledby="clear-offline-title">
                <h2 id="clear-offline-title">Удалить локальные данные?</h2>
                <p>
                    Ранее загруженная информация исчезнет с этого устройства и без интернета будет недоступна. Данные на
                    сервере останутся без изменений.
                </p>
                <div className={styles.actions}>
                    <button disabled={clearing} onClick={() => dialog.current?.close()}>
                        Отмена
                    </button>
                    <button disabled={clearing} onClick={() => void clear()}>
                        {clearing ? 'Очищаем…' : 'Удалить с устройства'}
                    </button>
                </div>
            </dialog>
        </main>
    );
}

export function OfflineSettingsPage() {
    return <Content />;
}
