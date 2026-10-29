'use client';

import Link from 'next/link';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useRuntime } from '../../shared/runtime/index.js';
import { useSession } from '../../entities/session/client.js';
import styles from './ai.module.css';
import { statusLabels, Frame } from './shared.js';

export function AiHistoryPage() {
    return (
        <Frame>
            <HistoryContent />
        </Frame>
    );
}

function HistoryContent() {
    const { api, queryClient } = useRuntime(),
        session = useSession('user'),
        [archived, setArchived] = useState<'active' | 'archived' | 'all'>('active');
    const query = useInfiniteQuery({
        queryKey: ['ai-history', session.data?.id, archived],
        enabled: !!api && !!session.data,
        initialPageParam: null as string | null,
        queryFn: async ({ signal, pageParam }) =>
            (
                await api!.request('GET /api/v1/ai/history', undefined, signal, undefined, {
                    query: {
                        archived,
                        limit: '20',
                        ...(pageParam ? { cursor: pageParam } : {}),
                    },
                })
            ).data,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    });
    const transition = useMutation({
        mutationFn: async (item: { id: string; archived: boolean; version: number }) =>
            (
                await api!.request(
                    'PUT /api/v1/ai/history/{id}/archive',
                    {
                        archived: !item.archived,
                        expectedVersion: item.version,
                        idempotencyKey: crypto.randomUUID(),
                    },
                    undefined,
                    { id: item.id },
                )
            ).data,
        onSuccess: (value) => {
            void queryClient.invalidateQueries({ queryKey: ['ai-history', session.data?.id] });
            void queryClient.invalidateQueries({ queryKey: ['ai-conversation', session.data?.id, value.item.id] });
        },
    });
    const items = query.data?.pages.flatMap((page) => page.items) ?? [];
    const total = query.data?.pages[0]?.total ?? 0;
    return (
        <>
            <header className={styles.heading}>
                <div>
                    <h1>История AI</h1>
                    <p>Повторное чтение сохранённого результата не списывает действия.</p>
                </div>
                <Link href="/ai">Новая задача</Link>
            </header>
            <section className={styles.card} aria-label="Фильтр истории">
                <label>
                    Показывать
                    <select value={archived} onChange={(event) => setArchived(event.target.value as typeof archived)}>
                        <option value="active">Активные</option>
                        <option value="archived">Архив</option>
                        <option value="all">Все</option>
                    </select>
                </label>
                {!query.isPending && !query.isError && <p>Найдено: {total}</p>}
            </section>
            {query.isPending ? (
                <p role="status">Загружаем историю…</p>
            ) : query.isError ? (
                <section className={styles.card}>
                    <p role="alert">История недоступна.</p>
                    <button type="button" onClick={() => void query.refetch()}>
                        Проверить статус
                    </button>
                </section>
            ) : items.length === 0 ? (
                <section className={styles.card}>
                    <h2>{archived === 'archived' ? 'Архив пуст' : 'История пуста'}</h2>
                </section>
            ) : (
                <>
                    {transition.isError && (
                        <section className={styles.notice} role="alert">
                            <p>Не удалось подтвердить изменение архива. Проверьте актуальное состояние истории.</p>
                            <button type="button" onClick={() => void query.refetch()}>
                                Проверить статус
                            </button>
                        </section>
                    )}
                    <div className={styles.list}>
                        {items.map((item) => (
                            <article className={styles.card} key={item.id}>
                                <header>
                                    <div>
                                        <small>
                                            {new Date(item.createdAt).toLocaleString('ru')} · {item.cost} действие
                                        </small>
                                        <h2>{item.title}</h2>
                                    </div>
                                    <strong>{statusLabels[item.status]}</strong>
                                </header>
                                {item.result && <p>{item.result}</p>}
                                {item.status === 'refunded' && <p>Списание возвращено в исходный bucket.</p>}
                                <div className={styles.actions}>
                                    <Link href={`/ai/${item.id}`}>Открыть беседу</Link>
                                    <button
                                        type="button"
                                        disabled={transition.isPending}
                                        onClick={() => transition.mutate(item)}
                                    >
                                        {item.archived ? 'Восстановить' : 'Архивировать'}
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                    {query.hasNextPage && (
                        <button
                            type="button"
                            disabled={query.isFetchingNextPage}
                            onClick={() => void query.fetchNextPage()}
                        >
                            {query.isFetchingNextPage ? 'Загружаем…' : 'Показать ещё'}
                        </button>
                    )}
                </>
            )}
        </>
    );
}
