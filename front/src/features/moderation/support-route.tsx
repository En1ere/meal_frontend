'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRuntime } from '../../shared/runtime/index.js';
import { ApiError } from '../../shared/api/client.js';
import { PageLoader as ArcPageLoader } from '@meal-planner/design-system';
import styles from './moderation.module.css';
import { ModeratorShell, PageState } from './shared.js';

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
                                        Назначение: <b>{query.data.assignment === 'mine' ? 'Мне' : 'Не назначено'}</b>
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
                                            <strong>{entry.author === 'support' ? 'Поддержка' : 'Пользователь'}</strong>
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
    );
}
