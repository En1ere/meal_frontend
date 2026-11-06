'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../shared/runtime/index.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { useSession } from '../../entities/session/client.js';
import { loadNewsDetail, loadNewsPage, markNewsRead } from './api.js';
import { newsKeys } from './query-keys.js';
import styles from './news.module.css';

export function NewsPage() {
    const { api } = useRuntime();
    const session = useSession('user');
    const query = useInfiniteQuery({
        queryKey: newsKeys.list(session.data?.id),
        enabled: !!api && !session.isPending,
        initialPageParam: null as string | null,
        queryFn: ({ signal, pageParam }) => loadNewsPage(api!, pageParam, signal),
        getNextPageParam: (page) => page.nextCursor ?? undefined,
    });
    const items = query.data?.pages.flatMap((page) => page.items) ?? [];
    return (
        <>
            <header>
                <h1>Новости сервиса</h1>
                <p>Опубликованные новости и важные объявления.</p>
            </header>
            {query.isPending ? (
                <p role="status">Загружаем новости…</p>
            ) : query.isError && !query.data ? (
                <>
                    <p role="alert">Не удалось загрузить новости.</p>
                    <button className="button outline" onClick={() => void query.refetch()}>
                        Повторить
                    </button>
                </>
            ) : (
                <>
                    {!items.length && <p>Опубликованных новостей пока нет.</p>}
                    <div className={styles.list}>
                        {items.map((item) => (
                            <article key={item.id} className={styles.card}>
                                {item.coverImage && (
                                    <img
                                        src={item.coverImage.url}
                                        alt={item.coverImage.alt}
                                        referrerPolicy="no-referrer"
                                    />
                                )}
                                <p>
                                    {item.type === 'important' ? 'Важное объявление' : 'Новость'} ·{' '}
                                    <time dateTime={item.publishedAt}>
                                        {new Date(item.publishedAt).toLocaleDateString('ru-RU', { timeZone: 'UTC' })}
                                    </time>
                                </p>
                                <h2>
                                    <Link href={`/news/${item.id}`}>{item.title}</Link>
                                </h2>
                            </article>
                        ))}
                    </div>
                    {query.isFetchNextPageError && (
                        <p role="alert">Следующая часть не загрузилась. Повторите попытку.</p>
                    )}
                    {query.hasNextPage && (
                        <button
                            className="button outline"
                            disabled={query.isFetchingNextPage}
                            onClick={() => void query.fetchNextPage()}
                        >
                            Показать ещё
                        </button>
                    )}
                </>
            )}
        </>
    );
}
type News = Success<'GET /api/v1/news/{id}'>['data'];
function Blocks({ page }: { page: News['pages'][number] }) {
    return (
        <div className={styles.blocks}>
            {page.blocks.map((block, index) =>
                block.kind === 'text' ? (
                    <p key={index}>{block.text}</p>
                ) : block.kind === 'image' ? (
                    <img key={index} src={block.url} alt={block.alt} referrerPolicy="no-referrer" />
                ) : (
                    <a key={index} href={block.url} target="_blank" rel="noopener noreferrer">
                        {block.text}
                    </a>
                ),
            )}
        </div>
    );
}
function Reader({ item }: { item: News }) {
    const { api, queryClient } = useRuntime();
    const session = useSession('user');
    const [page, setPage] = useState(0);
    const dialog = useRef<HTMLDialogElement>(null);
    const mark = useMutation({
        mutationFn: () => markNewsRead(api!, item.id),
        onSuccess: () => void queryClient.invalidateQueries({ queryKey: newsKeys.detail(session.data?.id, item.id) }),
    });
    useEffect(() => {
        if (item.type === 'important') dialog.current?.showModal();
    }, [item.id, item.type]);
    const content = (
        <>
            <h1 id="news-title">{item.title}</h1>
            <time dateTime={item.publishedAt}>
                {new Date(item.publishedAt).toLocaleDateString('ru-RU', { timeZone: 'UTC' })}
            </time>
            <Blocks page={item.pages[page]!} />
            <div className={styles.actions}>
                <button className="button outline" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>
                    Назад
                </button>
                <span aria-live="polite">
                    Страница {page + 1} из {item.pages.length}
                </span>
                <button
                    className="button outline"
                    disabled={page === item.pages.length - 1}
                    onClick={() => setPage((value) => value + 1)}
                >
                    Далее
                </button>
            </div>
            {session.data &&
                (item.readAt ? (
                    <p>Отмечено прочитанным</p>
                ) : (
                    <button
                        className="button outline"
                        disabled={mark.isPending || page !== item.pages.length - 1}
                        onClick={() => mark.mutate()}
                    >
                        Отметить прочитанным
                    </button>
                ))}
            {mark.isError && <p role="alert">Не удалось подтвердить отметку. Повторите попытку.</p>}
        </>
    );
    return item.type === 'important' ? (
        <>
            <h1>{item.title}</h1>
            <button className="button primary" onClick={() => dialog.current?.showModal()}>
                Открыть объявление
            </button>
            <dialog className={styles.dialog} ref={dialog} aria-labelledby="news-title">
                {content}
                <button className="button outline" onClick={() => dialog.current?.close()}>
                    Закрыть
                </button>
            </dialog>
        </>
    ) : (
        <article className={styles.reader}>{content}</article>
    );
}
export function NewsDetailPage({ id }: { id: string }) {
    const { api } = useRuntime();
    const session = useSession('user');
    const query = useQuery({
        queryKey: newsKeys.detail(session.data?.id, id),
        enabled: !!api && !session.isPending,
        queryFn: ({ signal }) => loadNewsDetail(api!, id, signal),
    });
    return (
        <>
            <Link href="/news">← Все новости</Link>
            {query.isPending ? (
                <p role="status">Загружаем новость…</p>
            ) : query.isError ? (
                <section role="alert">
                    <h1>Новость недоступна</h1>
                    <p>Публикация могла быть снята или доступ изменился.</p>
                    <button className="button outline" onClick={() => void query.refetch()}>
                        Проверить снова
                    </button>
                </section>
            ) : (
                <Reader key={id} item={query.data} />
            )}
        </>
    );
}
