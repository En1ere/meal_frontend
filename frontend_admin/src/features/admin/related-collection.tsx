import { useId, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useRuntime } from '../../app/providers.js';
import { useSession } from '../auth/session.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import { Fields, recordTitle } from './record-fields.js';
import { detailPath, type Section } from './navigation.js';
import styles from './admin.module.css';
import { displayStatus } from './display-values.js';

export function RelatedCollection({
    section,
    id,
    collection,
    label,
}: {
    section: Section;
    id: string;
    collection: string;
    label: string;
}) {
    const { api } = useRuntime();
    const session = useSession('admin');
    const [opened, setOpened] = useState(false);
    const regionId = useId();
    const headingId = useId();
    const result = useInfiniteQuery({
        queryKey: ['admin-related', session.data?.sessionId, section, id, collection],
        enabled: !!api && opened,
        initialPageParam: undefined as string | undefined,
        queryFn: async ({ signal, pageParam }) => {
            if (!api) throw new Error('Подключение не готово');
            return (
                await api.request(
                    'POST /api/v1/admin/{section}/{id}/related/{collection}/search',
                    { limit: 10, ...(pageParam ? { cursor: pageParam } : {}) },
                    signal,
                    { section, id, collection },
                )
            ).data;
        },
        getNextPageParam: (page) => page.nextCursor ?? undefined,
    });
    const records = [
        ...new Map((result.data?.pages ?? []).flatMap((page) => page.items).map((item) => [item.id, item])).values(),
    ];
    return (
        <section className={styles.collection}>
            <h2 id={headingId}>
                <button
                    className={styles['collection-toggle']}
                    aria-expanded={opened}
                    aria-controls={regionId}
                    onClick={() => setOpened((value) => !value)}
                >
                    {label}
                    <span>{opened ? 'Свернуть' : 'Показать'}</span>
                </button>
            </h2>
            {opened && (
                <div id={regionId} role="region" aria-labelledby={headingId} className={styles['collection-body']}>
                    <button
                        className="button outline"
                        disabled={result.isFetching}
                        onClick={() => void result.refetch()}
                    >
                        Обновить раздел
                    </button>
                    {result.isPending && <ArcSkeleton variant="lines" lines={3} label={`Загружаем: ${label}`} />}
                    {result.isError && (
                        <p role="alert">
                            Не удалось загрузить раздел. {result.error.message}{' '}
                            {records.length > 0 ? 'Ранее полученные данные могут быть устаревшими.' : ''}
                        </p>
                    )}
                    {result.isSuccess && !records.length && <p role="status">Связанных записей нет.</p>}
                    {records.map((item) => (
                        <article className={styles['collection-record']} key={item.id}>
                            <h3>{recordTitle(item)}</h3>
                            <p className={styles['record-id']}>Идентификатор: {item.id}</p>
                            {item.status && <p className={styles.muted}>{displayStatus(item.status)}</p>}
                            <Fields item={item} />
                            {item.related.length > 0 && (
                                <ul className={styles.related}>
                                    {item.related.map((link, index) => (
                                        <li key={`${link.section}/${link.id}/${index}`}>
                                            <Link to={detailPath(link.section, link.id)}>{link.label}</Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </article>
                    ))}
                    {result.hasNextPage && (
                        <button
                            className="button outline"
                            disabled={result.isFetching}
                            onClick={() => void result.fetchNextPage()}
                        >
                            Загрузить ещё записи
                        </button>
                    )}
                </div>
            )}
        </section>
    );
}
