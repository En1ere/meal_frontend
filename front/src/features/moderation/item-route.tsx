'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useRuntime } from '../../shared/runtime/index.js';
import { ApiError } from '../../shared/api/client.js';
import { PageLoader as ArcPageLoader } from '@meal-planner/design-system';
import styles from './moderation.module.css';
import { queueNames, ModeratorShell, PageState } from './shared.js';

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
            <ModeratorShell>
                <ArcPageLoader label="Загружаем материал…" />
            </ModeratorShell>
        );
    if (query.isError || !query.data)
        return (
            <ModeratorShell>
                <PageState error={query.error} retry={() => void query.refetch()} />
            </ModeratorShell>
        );
    const item = query.data;
    const valid = !!action && !!category && reason.trim().length >= 3;
    return (
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
    );
}
