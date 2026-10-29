'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRuntime } from '../../shared/runtime/index.js';
import { PageLoader as ArcPageLoader } from '@meal-planner/design-system';
import styles from './moderation.module.css';
import { queueNames, ModeratorShell, PageState } from './shared.js';

export function ModerationOverview() {
    const { api } = useRuntime();
    const query = useQuery({
        queryKey: ['moderator', 'overview'],
        enabled: !!api,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/moderator/overview', undefined, signal)).data,
    });
    return (
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
                                            {item.dueAt ? new Date(item.dueAt).toLocaleString('ru-RU') : 'Без срока'}
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
    );
}
