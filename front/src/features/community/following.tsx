'use client';

import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRuntime } from '../../shared/runtime/index.js';
import { useSession } from '../../entities/session/client.js';
import styles from './following.module.css';
import type { ReactNode } from 'react';

export function FollowingList({ renderFollowAction }: { renderFollowAction: (username: string) => ReactNode }) {
    const { api } = useRuntime();
    const session = useSession('user');
    const query = useInfiniteQuery({
        queryKey: ['profile-following', session.data?.id],
        enabled: !!api && !!session.data,
        initialPageParam: null as string | null,
        queryFn: async ({ signal, pageParam }) =>
            (
                await api!.request('GET /api/v1/profile/following', undefined, signal, undefined, {
                    query: { limit: '20', ...(pageParam ? { cursor: pageParam } : {}) },
                })
            ).data,
        getNextPageParam: (page) => page.nextCursor ?? undefined,
    });
    if (query.isPending) return <p role="status">Загружаем подписки…</p>;
    if (query.isError && !query.data)
        return (
            <div className={styles.state} role="alert">
                <p>Не удалось загрузить подписки.</p>
                <button className="button outline" onClick={() => void query.refetch()}>
                    Повторить
                </button>
            </div>
        );
    const loaded = query.data?.pages.flatMap((page) => page.items) ?? [];
    const items = loaded.filter(
        (item, index) => loaded.findIndex((candidate) => candidate.username === item.username) === index,
    );
    return (
        <div className={styles.wrapper}>
            {!items.length && (
                <div className={styles.state} role="status">
                    <p>Вы пока ни на кого не подписаны.</p>
                    <Link href="/community">Найти авторов в сообществе</Link>
                </div>
            )}
            <ul className={styles.list}>
                {items.map((author) => (
                    <li key={author.username}>
                        <img
                            src={author.avatarUrl ?? '/assets/food-122-illustration.webp'}
                            alt=""
                            referrerPolicy="no-referrer"
                        />
                        <div>
                            <Link href={`/authors/${encodeURIComponent(author.username)}`}>@{author.username}</Link>
                            <small>
                                {author.recipeCount === 0
                                    ? 'Нет опубликованных рецептов'
                                    : `${author.recipeCount} опубликованных рецептов`}
                            </small>
                        </div>
                        {renderFollowAction(author.username)}
                    </li>
                ))}
            </ul>
            {query.isFetchNextPageError && <p role="alert">Следующая часть не загрузилась. Повторите попытку.</p>}
            {query.hasNextPage && (
                <button
                    className="button outline"
                    disabled={query.isFetchingNextPage}
                    onClick={() => void query.fetchNextPage()}
                >
                    {query.isFetchingNextPage ? 'Загружаем…' : 'Показать ещё'}
                </button>
            )}
        </div>
    );
}
