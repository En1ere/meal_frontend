'use client';

import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useRuntime } from '../../app/providers.js';
import { ApiError } from '../../shared/api/client.js';
import { UserAppShell } from '../../ui/AppShell/UserAppShell.js';
import { PageLoader as ArcPageLoader } from '@meal-planner/design-system';
import { Guard } from '../auth/session.js';
import styles from './moderation.module.css';

const queueNames: Record<string, string> = {
    recipes: 'Рецепты',
    recipe_variants: 'Варианты рецептов',
    products: 'Продукты',
    reports: 'Жалобы',
    support: 'Поддержка',
    authorship: 'Авторство',
};

function ModeratorShell({ children }: { children: ReactNode }) {
    return <UserAppShell contentClassName={styles.main}>{children}</UserAppShell>;
}

function PageState({ error, retry }: { error: unknown; retry: () => void }) {
    const message =
        error instanceof ApiError && error.status === 403
            ? 'Эта очередь недоступна по вашим правам.'
            : 'Не удалось загрузить данные.';
    return (
        <section className={styles.state} role="alert">
            <h1>{message}</h1>
            <button className="button outline" onClick={retry}>
                Повторить
            </button>
        </section>
    );
}

export function ModerationOverview() {
    const { api } = useRuntime();
    const query = useQuery({
        queryKey: ['moderator', 'overview'],
        enabled: !!api,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/moderator/overview', undefined, signal)).data,
    });
    return (
        <Guard context="moderator">
            <ModeratorShell>
                {query.isPending ? (
                    <ArcPageLoader label="Загружаем очереди…" />
                ) : query.isError ? (
                    <PageState error={query.error} retry={() => void query.refetch()} />
                ) : (
                    <>
                        <p className={styles.eyebrow}>Служебный доступ</p>
                        <h1 className={styles.title}>Модерация</h1>
                        <p className={styles.subtitle}>Обзор доступных очередей и назначенных задач</p>
                        <nav className={styles.tabs} aria-label="Разделы модерации">
                            <span aria-current="page">Обзор</span>
                            <a href="#queues">Очереди</a>
                            <a href="#assigned">Мои задачи</a>
                        </nav>
                        <section className={styles.panel} id="queues">
                            <h2>Доступные очереди</h2>
                            <div className={styles['queue-grid']}>
                                {query.data.queues.map((queue) => (
                                    <article key={queue.key} className={styles['queue-card']}>
                                        <div>
                                            <h3>{queue.title}</h3>
                                            <p>
                                                {queue.count === null
                                                    ? 'Количество недоступно'
                                                    : `${queue.count} материалов`}
                                            </p>
                                        </div>
                                        {queue.available ? (
                                            <Link href={`/moderation/queues/${queue.key}`}>
                                                Открыть <span aria-hidden="true">›</span>
                                            </Link>
                                        ) : (
                                            <span>Нет доступа</span>
                                        )}
                                    </article>
                                ))}
                            </div>
                        </section>
                        <section className={styles.panel} id="assigned">
                            <h2>Назначено мне</h2>
                            {query.data.assigned.length ? (
                                <div className={styles.table}>
                                    {query.data.assigned.map((item) => (
                                        <div className={styles['table-row']} key={item.id}>
                                            <strong>{item.title}</strong>
                                            <span>{queueNames[item.queue]}</span>
                                            <span>{item.status}</span>
                                            <span>
                                                {item.dueAt
                                                    ? new Date(item.dueAt).toLocaleString('ru-RU')
                                                    : 'Без срока'}
                                            </span>
                                            <Link href={`/moderation/items/${item.id}`}>Открыть</Link>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className={styles.empty}>Назначенных задач пока нет.</p>
                            )}
                        </section>
                        <section className={styles.panel}>
                            <h2>Сроки рассмотрения</h2>
                            <div className={`${styles.sla} ${styles[query.data.sla.state]}`}>
                                <strong>{query.data.sla.label}</strong>
                                <span>Сроки — ориентир, а не гарантия.</span>
                            </div>
                        </section>
                    </>
                )}
            </ModeratorShell>
        </Guard>
    );
}

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
        <Guard context="moderator">
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
                                    <select
                                        value={filters[key]}
                                        onChange={(event) => setFilter(key, event.target.value)}
                                    >
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
        </Guard>
    );
}

export function ModerationItem({ id }: { id: string }) {
    const { api, queryClient } = useRuntime();
    const [action, setAction] = useState('');
    const [category, setCategory] = useState('');
    const [reason, setReason] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [message, setMessage] = useState('');
    const query = useQuery({
        queryKey: ['moderator', 'item', id],
        enabled: !!api,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/moderator/items/{id}', undefined, signal, { id })).data,
    });
    const decision = useMutation({
        mutationFn: async () =>
            (
                await api!.request(
                    'POST /api/v1/moderator/items/{id}/decision',
                    { action, category, reason, version: query.data!.version, idempotencyKey: crypto.randomUUID() },
                    undefined,
                    { id },
                )
            ).data,
        onSuccess: async () => {
            setMessage('Решение сохранено.');
            setConfirming(false);
            setAction('');
            setCategory('');
            setReason('');
            await queryClient.invalidateQueries({ queryKey: ['moderator'] });
        },
        onError: async (error) => {
            setMessage(error instanceof ApiError ? error.message : 'Не удалось сохранить решение.');
            if (error instanceof ApiError && error.status === 401)
                await queryClient.invalidateQueries({ queryKey: ['session', 'staff'] });
            else if (error instanceof ApiError && [409, 412].includes(error.status)) await query.refetch();
        },
    });
    if (!query.data && query.isPending)
        return (
            <Guard context="moderator">
                <ModeratorShell>
                    <ArcPageLoader label="Загружаем материал…" />
                </ModeratorShell>
            </Guard>
        );
    if (query.isError || !query.data)
        return (
            <Guard context="moderator">
                <ModeratorShell>
                    <PageState error={query.error} retry={() => void query.refetch()} />
                </ModeratorShell>
            </Guard>
        );
    const item = query.data;
    const valid = !!action && !!category && reason.trim().length >= 3;
    return (
        <Guard context="moderator">
            <ModeratorShell>
                <Link className={styles.back} href={`/moderation/queues/${item.queue}`}>
                    ‹ К очереди {(queueNames[item.queue] ?? 'Модерация').toLowerCase()}
                </Link>
                <p className={styles.eyebrow}>Служебный доступ</p>
                <h1 className={styles.title}>Проверка редакции</h1>
                <div className={styles['review-grid']}>
                    <div>
                        <section className={styles.panel}>
                            <h2>{item.title}</h2>
                            <p>
                                Состояние материала: <span className={styles.badge}>{item.status}</span>
                            </p>
                        </section>
                        <section className={styles.panel}>
                            <h2>Материал для проверки</h2>
                            <div className={styles.compare}>
                                <article>
                                    <h3>Публичный вид</h3>
                                    <strong>{item.publicView.title}</strong>
                                    <p>{item.publicView.content}</p>
                                </article>
                                {item.original && (
                                    <article>
                                        <h3>Оригинал</h3>
                                        <strong>{item.original.title}</strong>
                                        <p>{item.original.content}</p>
                                        <small>Оригинал виден только при наличии доступа.</small>
                                    </article>
                                )}
                            </div>
                        </section>
                        <section className={styles.panel}>
                            <h2>Контекст</h2>
                            {item.context.map((value) => (
                                <p key={value}>{value}</p>
                            ))}
                            {item.signals.map((value) => (
                                <p className={styles.warning} key={value}>
                                    {value}
                                </p>
                            ))}
                        </section>
                        {item.related.length > 0 && (
                            <section className={styles.panel}>
                                <h2>Похожие материалы</h2>
                                {item.related.map((related) => (
                                    <Link
                                        className={styles.related}
                                        href={`/moderation/items/${related.id}`}
                                        key={related.id}
                                    >
                                        {related.title}
                                        <span>Открыть</span>
                                    </Link>
                                ))}
                            </section>
                        )}
                    </div>
                    <aside className={styles.decision}>
                        <h2>Решение</h2>
                        <label>
                            Действие *
                            <select
                                value={action}
                                onChange={(event) => {
                                    setAction(event.target.value);
                                    setConfirming(false);
                                }}
                            >
                                <option value="">Выберите действие</option>
                                {item.actions.map((value) => (
                                    <option value={value} key={value}>
                                        {
                                            (
                                                {
                                                    approve: 'Одобрить',
                                                    reject: 'Отклонить',
                                                    publish: 'Опубликовать',
                                                    hide: 'Скрыть',
                                                    unpublish: 'Снять с публикации',
                                                } as Record<string, string>
                                            )[value]
                                        }
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            Категория причины *
                            <select
                                value={category}
                                onChange={(event) => {
                                    setCategory(event.target.value);
                                    setConfirming(false);
                                }}
                            >
                                <option value="">Выберите категорию</option>
                                <option value="quality">Качество</option>
                                <option value="safety">Безопасность</option>
                                <option value="authorship">Авторство</option>
                                <option value="other">Другое</option>
                            </select>
                        </label>
                        <label>
                            Обоснование *
                            <textarea
                                value={reason}
                                onChange={(event) => {
                                    setReason(event.target.value);
                                    setConfirming(false);
                                }}
                                placeholder="Объясните решение"
                            />
                        </label>
                        {!confirming ? (
                            <button className="button primary" disabled={!valid} onClick={() => setConfirming(true)}>
                                Проверить решение
                            </button>
                        ) : (
                            <div className={styles.confirm}>
                                <strong>Подтвердите решение</strong>
                                <p>{reason}</p>
                                <div className="actions">
                                    <button className="button outline" onClick={() => setConfirming(false)}>
                                        Назад
                                    </button>
                                    <button
                                        className="button primary"
                                        disabled={decision.isPending}
                                        onClick={() => decision.mutate()}
                                    >
                                        Подтвердить
                                    </button>
                                </div>
                            </div>
                        )}{' '}
                        {!valid && (
                            <p className={styles.hint}>Выберите действие и укажите причину не короче трёх символов.</p>
                        )}
                        {message && (
                            <p role="status" className={styles.notice}>
                                {message}
                            </p>
                        )}
                    </aside>
                </div>
            </ModeratorShell>
        </Guard>
    );
}

export function ModerationSupport({ id }: { id: string }) {
    const { api, queryClient } = useRuntime();
    const [draft, setDraft] = useState('');
    const [message, setMessage] = useState('');
    const query = useQuery({
        queryKey: ['moderator', 'support', id],
        enabled: !!api,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/moderator/support/{id}', undefined, signal, { id })).data,
    });
    const reply = useMutation({
        mutationFn: async () =>
            (
                await api!.request(
                    'POST /api/v1/moderator/support/{id}/reply',
                    { message: draft, version: query.data!.version, idempotencyKey: crypto.randomUUID() },
                    undefined,
                    { id },
                )
            ).data,
        onSuccess: async () => {
            setDraft('');
            setMessage('Ответ отправлен автору обращения.');
            await queryClient.invalidateQueries({ queryKey: ['moderator', 'support', id] });
        },
        onError: (error) => setMessage(error instanceof ApiError ? error.message : 'Не удалось отправить ответ.'),
    });
    const reopen = useMutation({
        mutationFn: async () =>
            (
                await api!.request(
                    'POST /api/v1/moderator/support/{id}/reopen',
                    { version: query.data!.version, idempotencyKey: crypto.randomUUID() },
                    undefined,
                    { id },
                )
            ).data,
        onSuccess: async () => {
            setMessage('Обращение открыто повторно.');
            await queryClient.invalidateQueries({ queryKey: ['moderator', 'support', id] });
        },
        onError: (error) => setMessage(error instanceof ApiError ? error.message : 'Не удалось открыть обращение.'),
    });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (draft.trim()) reply.mutate();
    };
    return (
        <Guard context="moderator">
            <ModeratorShell>
                {query.isPending ? (
                    <ArcPageLoader label="Загружаем обращение…" />
                ) : query.isError ? (
                    <PageState error={query.error} retry={() => void query.refetch()} />
                ) : (
                    <>
                        <Link className={styles.back} href="/moderation/queues/support">
                            ‹ К очереди поддержки
                        </Link>
                        <p className={styles.eyebrow}>Служебный доступ</p>
                        <h1 className={styles.title}>Обращение</h1>
                        <div className={styles['support-grid']}>
                            <div>
                                <section className={styles.panel}>
                                    <h2>{query.data.subject}</h2>
                                    <div className={styles.meta}>
                                        <span>
                                            Статус: <b>{query.data.status}</b>
                                        </span>
                                        <span>
                                            Категория: <b>{query.data.category}</b>
                                        </span>
                                        <span>
                                            Назначение:{' '}
                                            <b>{query.data.assignment === 'mine' ? 'Мне' : 'Не назначено'}</b>
                                        </span>
                                    </div>
                                </section>
                                <section className={styles.panel}>
                                    <h2>Переписка</h2>
                                    <div className={styles.messages}>
                                        {query.data.messages.map((entry) => (
                                            <article
                                                key={entry.id}
                                                className={entry.author === 'support' ? styles['staff-message'] : ''}
                                            >
                                                <strong>
                                                    {entry.author === 'support' ? 'Поддержка' : 'Пользователь'}
                                                </strong>
                                                <time>{new Date(entry.createdAt).toLocaleString('ru-RU')}</time>
                                                <p>{entry.body}</p>
                                            </article>
                                        ))}
                                    </div>
                                </section>
                                {query.data.canReply && (
                                    <form className={styles.panel} onSubmit={submit}>
                                        <h2>Ваш ответ</h2>
                                        <label>
                                            Сообщение *
                                            <textarea
                                                value={draft}
                                                onChange={(event) => setDraft(event.target.value)}
                                                placeholder="Напишите ответ"
                                            />
                                        </label>
                                        <p className={styles.hint}>Ответ будет виден автору обращения.</p>
                                        <button className="button primary" disabled={!draft.trim() || reply.isPending}>
                                            Отправить ответ
                                        </button>
                                    </form>
                                )}
                                {query.data.canReopen && (
                                    <button
                                        className="button outline"
                                        disabled={reopen.isPending}
                                        onClick={() => reopen.mutate()}
                                    >
                                        Открыть повторно
                                    </button>
                                )}
                                {message && (
                                    <p className={styles.notice} role="status">
                                        {message}
                                    </p>
                                )}
                            </div>
                            <aside>
                                <section className={styles.panel}>
                                    <h2>Контекст обращения</h2>
                                    {query.data.context.map((value) => (
                                        <p key={value}>{value}</p>
                                    ))}
                                </section>
                                {query.data.related && (
                                    <section className={styles.panel}>
                                        <h2>Связанный материал</h2>
                                        <Link className="button primary" href={query.data.related.href}>
                                            {query.data.related.title}
                                        </Link>
                                    </section>
                                )}
                            </aside>
                        </div>
                    </>
                )}
            </ModeratorShell>
        </Guard>
    );
}
