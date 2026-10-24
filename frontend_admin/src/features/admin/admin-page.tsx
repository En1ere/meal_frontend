import { useState, type FormEvent } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useRuntime } from '../../app/providers.js';
import { Guard, useSession } from '../auth/session.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import { Fields, recordTitle, type RecordItem } from './record-fields.js';
import { RelatedCollection } from './related-collection.js';
import { AdminShell } from './admin-shell.js';
import { detailPath, findSection, sectionPath, type Section } from './navigation.js';
import styles from './admin.module.css';
import { SupportConversation } from './support-conversation.js';
import { ApiError } from '../../shared/api/client.js';
import { displayStatus } from './display-values.js';
import { SupportCreate } from './support-workspace.js';
import { GovernanceActions } from '../governance/governance-actions.js';
import { OperationsWorkspace } from '../operations/operations-workspace.js';
import { ContentPanel } from '../content/content-panel.js';
import { BillingWorkspace } from '../billing/billing-workspace.js';
import { ReviewPanel } from '../review/review-panel.js';
import { AccountDeletionReview } from '../review/account-deletion-review.js';
import { FreeAiWorkspace } from '../free-ai/free-ai-workspace.js';

const lookupSections: readonly Section[] = ['users', 'access', 'subscriptions'];
function OverviewLinks({ item }: { item: RecordItem }) {
    const destinations: Record<string, Section> = {
        support_waiting: 'support',
        assigned_support: 'support',
        moderation_pending: 'queues',
        assigned_moderation: 'queues',
        jobs_failed: 'operations',
        jobs_running: 'operations',
        orders_pending: 'payments',
        attempts_failed: 'payments',
    };
    const targets = [
        ...new Set(item.fields.flatMap((field) => (destinations[field.key] ? [destinations[field.key]!] : []))),
    ];
    return (
        <div className="actions">
            {targets.map((target) => (
                <Link key={target} className="button outline" to={sectionPath(target)}>
                    {findSection(target)!.title}
                </Link>
            ))}
        </div>
    );
}
function Actions({ item }: { item: RecordItem }) {
    if (!item.actions.length) return null;
    return (
        <section className={styles.actions}>
            <h2>Действия</h2>
            {item.actions.map((action) => (
                <div key={action.key}>
                    <button className="button outline" disabled aria-describedby={`reason-${action.key}`}>
                        {action.label}
                    </button>
                    <p id={`reason-${action.key}`} className={styles.muted}>
                        {action.reason ??
                            'Команда пока недоступна. Требуется отдельный согласованный процесс выполнения.'}
                    </p>
                </div>
            ))}
        </section>
    );
}
function ErrorPanel({ error, retry }: { error: Error; retry: () => void }) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
        <div className={styles.notice} role="alert">
            {missing ? (
                <>
                    <h2>Запись не найдена</h2>
                    <p>Возможно, она удалена или больше недоступна. Вернитесь к списку и обновите поиск.</p>
                </>
            ) : (
                <p>Не удалось получить данные. {error.message}</p>
            )}
            <button className="button outline" onClick={retry}>
                Повторить
            </button>
        </div>
    );
}
export function AdminPage({ fixedSection }: { fixedSection?: Section }) {
    const { section: sectionParam, id } = useParams();
    const section = findSection(fixedSection ?? sectionParam);
    if (!section)
        return (
            <Guard context="admin">
                <AdminShell active="overview">
                    <h1>Раздел не найден</h1>
                    <Link to="/admin">К обзору</Link>
                </AdminShell>
            </Guard>
        );
    return (
        <Guard context="admin">
            <AdminShell active={section.id}>
                {id ? (
                    <Detail key={`${section.id}/${id}`} section={section.id} id={id} />
                ) : (
                    <List key={section.id} section={section.id} />
                )}
            </AdminShell>
        </Guard>
    );
}
function List({ section }: { section: Section }) {
    const { api, queryClient } = useRuntime();
    const session = useSession('admin');
    const info = findSection(section)!;
    const lookup = lookupSections.includes(section);
    const filterKey = ['admin-filters', session.data?.id, section];
    const restored = queryClient.getQueryData<{ query?: string; status?: string }>(filterKey);
    const restoredQuery =
        restored && typeof restored === 'object' && 'query' in restored && typeof restored.query === 'string'
            ? restored.query
            : '';
    const restoredStatus =
        restored && typeof restored === 'object' && 'status' in restored && typeof restored.status === 'string'
            ? restored.status
            : '';
    const [draft, setDraft] = useState(restoredQuery);
    const [statusDraft, setStatusDraft] = useState(restoredStatus);
    const [search, setSearch] = useState<{ query?: string; status?: string } | null>(
        restoredQuery || restoredStatus ? { query: restoredQuery, status: restoredStatus } : lookup ? null : {},
    );
    const result = useInfiniteQuery({
        queryKey: ['admin', session.data?.id, section, search],
        enabled: !!api && search !== null,
        initialPageParam: undefined as string | undefined,
        queryFn: async ({ signal, pageParam }) => {
            if (!api) throw new Error('Подключение не готово');
            return (
                await api.request(
                    'POST /api/v1/admin/{section}/search',
                    {
                        ...search,
                        ...(section === 'queues' ? { queue: 'recipes' } : {}),
                        limit: 20,
                        ...(pageParam ? { cursor: pageParam } : {}),
                    },
                    signal,
                    { section },
                )
            ).data;
        },
        getNextPageParam: (last) => last.nextCursor ?? undefined,
    });
    function submit(event: FormEvent) {
        event.preventDefault();
        const applied = {
            ...(draft.trim() ? { query: draft.trim() } : {}),
            ...(statusDraft.trim() ? { status: statusDraft.trim() } : {}),
        };
        queryClient.setQueryData(filterKey, applied);
        setSearch(applied);
    }
    const pages = result.data?.pages ?? [];
    const items = [...new Map(pages.flatMap((page) => page.items).map((item) => [item.id, item])).values()];
    const first = pages[0];
    return (
        <>
            <header className={styles.heading}>
                <h1>{info.title}</h1>
                <p>{info.description}</p>
                {section === 'queues' && <p>Очередь: рецепты</p>}
            </header>
            {section === 'support' && <SupportCreate />}
            {section !== 'overview' && (
                <form className={styles.filters} onSubmit={submit}>
                    <div>
                        <label htmlFor="admin-search">
                            {section === 'subscriptions'
                                ? 'ID подписки или владельца'
                                : lookup
                                  ? 'Идентификатор пользователя или логин'
                                  : 'Поиск'}
                        </label>
                        <input
                            id="admin-search"
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            maxLength={100}
                            required={lookup}
                            autoComplete="off"
                            placeholder={
                                section === 'subscriptions'
                                    ? 'Точный UUID'
                                    : lookup
                                      ? 'Точный UUID или логин'
                                      : 'Название или идентификатор'
                            }
                        />
                    </div>
                    {!lookup && !['sanctions', 'audit', 'rollback', 'metrics'].includes(section) && (
                        <div>
                            <label htmlFor="admin-status">Статус</label>
                            <input
                                id="admin-status"
                                value={statusDraft}
                                onChange={(event) => setStatusDraft(event.target.value)}
                                maxLength={64}
                                placeholder="Все статусы"
                            />
                        </div>
                    )}
                    <button className="button primary" type="submit" disabled={result.isFetching}>
                        {lookup ? 'Найти' : 'Применить'}
                    </button>
                    <button
                        className="button outline"
                        type="button"
                        onClick={() => {
                            setDraft('');
                            setStatusDraft('');
                            queryClient.removeQueries({ queryKey: filterKey, exact: true });
                            setSearch(lookup ? null : {});
                        }}
                    >
                        Сбросить
                    </button>
                </form>
            )}
            {search === null ? (
                <p className={styles.notice}>
                    {section === 'subscriptions'
                        ? 'Введите UUID подписки или её владельца, чтобы начать поиск.'
                        : 'Введите точный идентификатор или логин пользователя, чтобы начать поиск.'}
                </p>
            ) : (
                <>
                    <div className={styles.toolbar}>
                        <span role="status">{result.isFetching ? 'Обновляем данные…' : 'Данные текущего запроса'}</span>
                        <button
                            className="button outline"
                            disabled={result.isFetching}
                            onClick={() => void result.refetch()}
                        >
                            Обновить данные
                        </button>
                    </div>
                    {result.isPending && (
                        <ArcSkeleton height="5rem" variant="lines" lines={3} label="Загружаем раздел…" />
                    )}
                    {result.isError && <ErrorPanel error={result.error} retry={() => void result.refetch()} />}
                    {result.isError && items.length > 0 && (
                        <p role="status">Показаны ранее полученные данные. Их актуальность не подтверждена.</p>
                    )}
                    {first?.reason && <p className={styles.notice}>{first.reason}</p>}
                    {result.isSuccess && first?.availability === 'available' && !items.length && (
                        <p className={styles.notice}>По заданным условиям записей не найдено.</p>
                    )}
                    <div className={section === 'overview' ? styles.overview : styles.records}>
                        {items.map((item) => (
                            <article className={styles.card} key={item.id}>
                                <div className={styles['card-heading']}>
                                    <h2>{recordTitle(item, section)}</h2>
                                    {(section !== 'overview' || item.status !== null) && (
                                        <span className={styles.badge}>{displayStatus(item.status)}</span>
                                    )}
                                </div>
                                <Fields item={item} />
                                {section === 'overview' ? (
                                    <OverviewLinks item={item} />
                                ) : (
                                    <Link className="button outline" to={detailPath(section, item.id)}>
                                        Открыть<span className={styles['sr-only']}>: {item.title}</span>
                                    </Link>
                                )}
                            </article>
                        ))}
                    </div>
                    {result.hasNextPage && (
                        <button
                            className="button outline"
                            disabled={result.isFetching}
                            onClick={() => void result.fetchNextPage()}
                        >
                            Загрузить ещё
                        </button>
                    )}
                </>
            )}
        </>
    );
}
function Detail({ section, id }: { section: Section; id: string }) {
    const { api, queryClient } = useRuntime();
    const session = useSession('admin');
    const info = findSection(section)!;
    const result = useQuery({
        queryKey: ['admin-detail', session.data?.id, section, id],
        enabled: !!api,
        queryFn: async ({ signal }) => {
            if (!api) throw new Error('Подключение не готово');
            return (await api.request('GET /api/v1/admin/{section}/{id}', undefined, signal, { section, id })).data;
        },
    });
    const requestKind = result.data?.item.fields.find((field) => field.key === 'kind')?.value;
    return (
        <>
            <Link to={sectionPath(section)}>К разделу «{info.title}»</Link>
            {result.isPending && <ArcSkeleton height="5rem" variant="lines" lines={4} label="Загружаем карточку…" />}
            {result.isError && <ErrorPanel error={result.error} retry={() => void result.refetch()} />}
            {result.data && (
                <>
                    <header className={styles.heading}>
                        <h1>{recordTitle(result.data.item, section)}</h1>
                        <p>{displayStatus(result.data.item.status)}</p>
                        <p className={styles['record-id']}>Идентификатор: {result.data.item.id}</p>
                    </header>
                    <div className={styles.toolbar}>
                        <span className={styles.muted}>
                            {result.data.item.updatedAt
                                ? `Обновлено: ${new Date(result.data.item.updatedAt).toLocaleString()}`
                                : 'Время обновления не указано'}
                        </span>
                        <button
                            className="button outline"
                            disabled={result.isFetching}
                            onClick={() => {
                                void result.refetch();
                                void queryClient.invalidateQueries({
                                    queryKey: ['admin-related', session.data?.sessionId, section, id],
                                });
                            }}
                        >
                            Обновить данные
                        </button>
                    </div>
                    {result.isError && <p role="status">Данные могут быть устаревшими.</p>}
                    <article className={styles.card}>
                        <Fields item={result.data.item} />
                    </article>
                    {result.data.item.related.length > 0 && (
                        <section className={styles.card}>
                            <h2>Связанные записи</h2>
                            <ul className={styles.related}>
                                {result.data.item.related.map((link, index) => (
                                    <li key={`${link.section}/${link.id}/${index}`}>
                                        <Link to={detailPath(link.section, link.id)}>{link.label}</Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                    {section === 'support' && (
                        <SupportConversation
                            id={id}
                            version={result.data.item.version}
                            status={result.data.item.status}
                        />
                    )}
                    <div className={styles['detail-collections']}>
                        {result.data.collections.map((collection) => (
                            <RelatedCollection
                                key={collection.key}
                                section={section}
                                id={id}
                                collection={collection.key}
                                label={collection.label}
                            />
                        ))}
                    </div>
                    {(['users', 'access', 'sanctions'] as string[]).includes(section) && (
                        <GovernanceActions section={section as 'users' | 'access' | 'sanctions'} id={id} />
                    )}
                    {(section === 'operations' || section === 'errors') && (
                        <OperationsWorkspace section={section} id={id} itemVersion={result.data.item.version} />
                    )}
                    {(section === 'queues' || section === 'catalog') && <ContentPanel section={section} id={id} />}
                    {section === 'users' && <FreeAiWorkspace id={id} />}
                    {(section === 'users' || section === 'subscriptions' || section === 'payments') && (
                        <BillingWorkspace section={section} id={id} />
                    )}
                    {(section === 'rollback' ||
                        (section === 'legal-requests' &&
                            !['account_deletion', 'deletion'].includes(requestKind ?? ''))) && (
                        <ReviewPanel section={section} id={id} />
                    )}
                    {section === 'legal-requests' && ['account_deletion', 'deletion'].includes(requestKind ?? '') && (
                        <AccountDeletionReview id={id} version={Number(result.data.item.version)} />
                    )}
                    {!(
                        [
                            'users',
                            'access',
                            'sanctions',
                            'operations',
                            'errors',
                            'support',
                            'queues',
                            'catalog',
                            'subscriptions',
                            'payments',
                            'legal-requests',
                            'rollback',
                        ] as string[]
                    ).includes(section) && <Actions item={result.data.item} />}
                </>
            )}
        </>
    );
}
