'use client';

import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useRuntime } from '../../shared/runtime/index.js';
import { ApiError } from '../../shared/api/client.js';
import { PageLoader as ArcPageLoader } from '@meal-planner/design-system';
import styles from './moderation.module.css';
import { queueNames, ModeratorShell, PageState } from './shared.js';

export function ModerationQueue({ queue }: { queue: string }) {
    const { api, queryClient } = useRuntime();
    const router = useRouter();
    const search = useSearchParams();
    const isKnownQueue = Object.hasOwn(queueNames, queue);
    const filters = {
        status: search.get('status') ?? 'all',
        assignment: search.get('assignment') ?? 'all',
        priority: search.get('priority') ?? 'all',
    };
    const query = useInfiniteQuery({
        queryKey: ['moderator', 'queue', queue, filters],
        enabled: !!api && isKnownQueue,
        initialPageParam: null as string | null,
        queryFn: async ({ signal, pageParam }) =>
            (
                await api!.request(
                    'GET /api/v1/moderator/queues/{queue}',
                    undefined,
                    signal,
                    { queue },
                    { query: { ...filters, ...(pageParam ? { cursor: pageParam } : {}) } },
                )
            ).data,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    });
    const [message, setMessage] = useState('');
    const command = useMutation({
        mutationFn: async ({ id, version, action }: { id: string; version: number; action: 'claim' | 'skip' }) =>
            (
                await api!.request(
                    action === 'claim'
                        ? 'POST /api/v1/moderator/items/{id}/claim'
                        : 'POST /api/v1/moderator/items/{id}/skip',
                    { version, idempotencyKey: crypto.randomUUID() },
                    undefined,
                    { id },
                )
            ).data,
        onSuccess: async (_, variables) => {
            setMessage(
                variables.action === 'claim'
                    ? 'Задача назначена вам.'
                    : 'Уведомление пропущено; материал остался в очереди.',
            );
            await queryClient.invalidateQueries({ queryKey: ['moderator'] });
        },
        onError: async (error) => {
            setMessage(error instanceof ApiError ? error.message : 'Не удалось выполнить действие.');
            if (error instanceof ApiError && error.status === 401)
                await queryClient.invalidateQueries({ queryKey: ['session', 'staff'] });
            else if (error instanceof ApiError && [409, 412].includes(error.status))
                await queryClient.invalidateQueries({ queryKey: ['moderator', 'queue', queue] });
        },
    });
    const setFilter = (key: string, value: string) => {
        setMessage('');
        const next = new URLSearchParams(search.toString());
        if (value === 'all') next.delete(key);
        else next.set(key, value);
        router.replace(`/moderation/queues/${queue}${next.size ? `?${next}` : ''}`);
    };
    const pages = query.data?.pages ?? [];
    const items = [...new Map(pages.flatMap((page) => page.items).map((item) => [item.id, item])).values()];
    const title = pages[0]?.title ?? queueNames[queue] ?? 'Очередь';
    return (
        <ModeratorShell>
            {!isKnownQueue ? (
                <section className={styles.state} role="alert">
                    <p className={styles.eyebrow}>Ошибка 404</p>
                    <h1>Очередь модерации не найдена</h1>
                    <p>Проверьте адрес или вернитесь к списку доступных очередей.</p>
                    <Link className="button outline" href="/moderation">
                        К сводке модератора
                    </Link>
                </section>
            ) : query.isPending && !query.data ? (
                <ArcPageLoader label="Загружаем очередь…" />
            ) : query.isError && !query.data ? (
                <PageState error={query.error} retry={() => void query.refetch()} />
            ) : (
                <>
                    <Link className={styles.back} href="/moderation">
                        ‹ К сводке модератора
                    </Link>
                    <p className={styles.eyebrow}>Служебный доступ</p>
                    <h1 className={styles.title}>Очередь: {title.toLowerCase()}</h1>
                    <div className={styles.filters}>
                        {(
                            [
                                ['status', 'Статус'],
                                ['assignment', 'Назначение'],
                                ['priority', 'Приоритет'],
                            ] as const
                        ).map(([key, label]) => (
                            <label key={key}>
                                {label}
                                <select value={filters[key]} onChange={(event) => setFilter(key, event.target.value)}>
                                    <option value="all">Все</option>
                                    {key === 'status' ? (
                                        <>
                                            <option value="pending">В очереди</option>
                                            <option value="in_review">На рассмотрении</option>
                                            <option value="approved">Одобрено</option>
                                        </>
                                    ) : key === 'assignment' ? (
                                        <>
                                            <option value="unassigned">Не назначено</option>
                                            <option value="mine">Мне</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value="normal">Обычный</option>
                                            <option value="high">Высокий</option>
                                            <option value="critical">Критический</option>
                                        </>
                                    )}
                                </select>
                            </label>
                        ))}
                    </div>
                    {message && (
                        <p className={styles.notice} role="status">
                            {message}
                        </p>
                    )}
                    <section className={styles['queue-list']}>
                        {items.length ? (
                            items.map((item) => (
                                <article className={styles['task-card']} key={item.id}>
                                    <div>
                                        <h2>{item.title}</h2>
                                        <dl>
                                            <div>
                                                <dt>Статус</dt>
                                                <dd>{item.status}</dd>
                                            </div>
                                            <div>
                                                <dt>Назначение</dt>
                                                <dd>
                                                    {item.assignment === 'mine'
                                                        ? 'Мне'
                                                        : item.assignment === 'other'
                                                          ? 'Другому модератору'
                                                          : 'Не назначено'}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt>Приоритет</dt>
                                                <dd>{item.priority}</dd>
                                            </div>
                                            <div>
                                                <dt>Срок</dt>
                                                <dd>
                                                    {item.dueAt
                                                        ? new Date(item.dueAt).toLocaleString('ru-RU')
                                                        : 'Без срока'}
                                                </dd>
                                            </div>
                                        </dl>
                                    </div>
                                    <div className={styles['task-actions']}>
                                        {item.canClaim && (
                                            <button
                                                className="button primary"
                                                disabled={command.isPending}
                                                onClick={() =>
                                                    command.mutate({
                                                        id: item.id,
                                                        version: item.version,
                                                        action: 'claim',
                                                    })
                                                }
                                            >
                                                Взять в работу
                                            </button>
                                        )}
                                        {item.canOpen && (
                                            <Link
                                                className="button primary"
                                                href={
                                                    item.queue === 'support'
                                                        ? `/moderation/support/${item.id}`
                                                        : `/moderation/items/${item.id}`
                                                }
                                            >
                                                Открыть
                                            </Link>
                                        )}
                                        {item.canSkip && (
                                            <button
                                                className="text-button"
                                                disabled={command.isPending}
                                                onClick={() =>
                                                    command.mutate({
                                                        id: item.id,
                                                        version: item.version,
                                                        action: 'skip',
                                                    })
                                                }
                                            >
                                                Пропустить уведомление
                                            </button>
                                        )}
                                    </div>
                                </article>
                            ))
                        ) : (
                            <p className={styles.empty}>В этой выборке нет материалов.</p>
                        )}
                    </section>
                    {query.isFetchNextPageError && (
                        <div className={styles.state} role="alert">
                            <p>Не удалось загрузить следующую страницу. Уже загруженные материалы сохранены.</p>
                            <button className="button outline" onClick={() => void query.fetchNextPage()}>
                                Повторить загрузку
                            </button>
                        </div>
                    )}
                    {query.hasNextPage && !query.isFetchNextPageError && (
                        <button
                            className="button outline"
                            disabled={query.isFetchingNextPage}
                            onClick={() => void query.fetchNextPage()}
                        >
                            {query.isFetchingNextPage ? 'Загружаем…' : 'Показать ещё'}
                        </button>
                    )}
                    <p className={styles.hint}>Сроки — ориентир, а не гарантия.</p>
                </>
            )}
        </ModeratorShell>
    );
}
