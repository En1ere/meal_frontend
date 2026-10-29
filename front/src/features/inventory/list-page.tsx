'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRuntime } from '../../shared/runtime/index.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { useSession } from '../../entities/session/client.js';
import {
    InventoryShell,
    Loading,
    Failure,
    localDate,
    dateText,
    expiryText,
    units,
    inventoryBase,
    inventoryScopeQuery,
    type InventoryScope,
} from './shared.js';
import styles from './inventory.module.css';

type Batch = Success<'GET /api/v1/inventory/{id}'>['data']['batch'];
export function BatchRows({
    items,
    locations,
    scope = 'private',
}: {
    items: Batch[];
    locations: { id: string; name: string }[];
    scope?: InventoryScope;
}) {
    const place = (id: string | null) => locations.find((x) => x.id === id)?.name ?? 'Место не указано';
    const amount = (batch: Batch) =>
        batch.quantity === null ? 'Количество неизвестно' : `${batch.quantity} ${units[batch.unit]}`;
    const state = (batch: Batch) =>
        batch.packageState === 'opened' ? 'Открыто' : batch.packageState === 'sealed' ? 'Закрыто' : 'Не указано';
    return (
        <>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Продукт</th>
                        <th>Количество</th>
                        <th>Срок годности</th>
                        <th>Место</th>
                        <th>Упаковка</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((batch) => (
                        <tr key={batch.id}>
                            <td>
                                <Link href={`${inventoryBase(scope)}/batches/${batch.id}`}>{batch.name}</Link>
                            </td>
                            <td>
                                {amount(batch)}{' '}
                                <span className={styles.badge}>
                                    {batch.precision === 'exact' ? 'Точно' : 'Примерно'}
                                </span>
                            </td>
                            <td>
                                {expiryText(batch.expiryOn)}
                                <br />
                                <span className={styles.muted}>{dateText(batch.expiryOn)}</span>
                            </td>
                            <td>{place(batch.locationId)}</td>
                            <td>{state(batch)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className={styles.mobile}>
                {[...new Set(items.map((x) => x.locationId))].map((id) => (
                    <section key={id ?? 'unknown'} className={styles.history}>
                        <h2>{place(id)}</h2>
                        {items
                            .filter((x) => x.locationId === id)
                            .map((batch) => (
                                <article key={batch.id}>
                                    <Link href={`${inventoryBase(scope)}/batches/${batch.id}`}>
                                        <strong>{batch.name}</strong>
                                    </Link>
                                    <div>
                                        {amount(batch)} · {batch.precision === 'exact' ? 'Точно' : 'Примерно'}
                                    </div>
                                    <div>
                                        {expiryText(batch.expiryOn)} · {state(batch)}
                                    </div>
                                </article>
                            ))}
                    </section>
                ))}
            </div>
        </>
    );
}
function Content({ scope }: { scope: InventoryScope }) {
    const { api } = useRuntime();
    const user = useSession('user');
    const search = useSearchParams();
    const router = useRouter();
    const filters = {
        q: search.get('q') ?? '',
        status: search.get('status') ?? 'active',
        attention: search.get('attention') ?? 'all',
        days: search.get('days') ?? '3',
        localDate: localDate(),
        limit: '50',
        offset: search.get('offset') ?? '0',
        ...(search.get('locationId') ? { locationId: search.get('locationId')! } : {}),
    };
    const query = useQuery({
        queryKey: ['inventory', scope, user.data?.id, filters],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (
                await api!.request('GET /api/v1/inventory', undefined, signal, undefined, {
                    query: { ...filters, ...inventoryScopeQuery(scope) },
                })
            ).data,
    });
    const locations = useQuery({
        queryKey: ['inventory-locations', scope, user.data?.id],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (
                await api!.request('GET /api/v1/inventory-locations', undefined, signal, undefined, {
                    query: inventoryScopeQuery(scope),
                })
            ).data.items,
    });
    const attention = useQuery({
        queryKey: ['inventory-attention', scope, user.data?.id, filters.days, filters.localDate],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (
                await api!.request('GET /api/v1/inventory', undefined, signal, undefined, {
                    query: {
                        attention: 'expiring',
                        days: filters.days,
                        localDate: filters.localDate,
                        status: 'active',
                        limit: '1',
                        ...inventoryScopeQuery(scope),
                    },
                })
            ).data.total,
    });
    function filter(name: string, value: string) {
        const next = new URLSearchParams(search);
        if (value) next.set(name, value);
        else next.delete(name);
        if (name !== 'offset') next.delete('offset');
        const url = `${inventoryBase(scope)}${next.size ? `?${next.toString()}` : ''}`;
        if (name === 'q') router.replace(url, { scroll: false });
        else router.push(url, { scroll: false });
    }
    return (
        <>
            <div className={styles.heading}>
                <div>
                    <h1>{scope === 'family' ? 'Семейные запасы' : 'Мои запасы'}</h1>
                    <p className={styles.muted}>
                        {scope === 'family'
                            ? 'Общие продукты · доступны участникам семьи'
                            : 'Личные продукты · видно только вам'}
                    </p>
                </div>
                <div className={styles.actions}>
                    <Link className="button primary" href={`${inventoryBase(scope)}/new`}>
                        Добавить продукт
                    </Link>
                    <Link className="button outline" href={`${inventoryBase(scope)}/scan`}>
                        Сканировать
                    </Link>
                </div>
            </div>
            <div className={styles.filters}>
                <label>
                    Поиск в запасах
                    <input type="search" value={filters.q} onChange={(e) => filter('q', e.target.value)} />
                </label>
                <label>
                    Место
                    <select value={filters.locationId ?? ''} onChange={(e) => filter('locationId', e.target.value)}>
                        <option value="">Все места</option>
                        {locations.data?.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    Статус
                    <select value={filters.status} onChange={(e) => filter('status', e.target.value)}>
                        <option value="active">Активные</option>
                        <option value="archived">Архив</option>
                        <option value="all">Все</option>
                    </select>
                </label>
                <label>
                    Срок
                    <select value={filters.attention} onChange={(e) => filter('attention', e.target.value)}>
                        <option value="all">Все сроки</option>
                        <option value="expiring">Требует внимания</option>
                        <option value="unknown">Срок неизвестен</option>
                    </select>
                </label>
                <label>
                    Ближайшие дни
                    <select value={filters.days} onChange={(e) => filter('days', e.target.value)}>
                        {[3, 7, 14].map((n) => (
                            <option key={n} value={n}>
                                {n} дней
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            {attention.data !== undefined && attention.data > 0 && (
                <button className={styles.notice} onClick={() => filter('attention', 'expiring')}>
                    Требует внимания · {attention.data} — истёкшие сроки и ближайшие {filters.days} дней
                </button>
            )}
            {query.isPending ? (
                <Loading />
            ) : query.isError ? (
                <Failure error={query.error} retry={() => void query.refetch()} />
            ) : query.data.items.length === 0 ? (
                <section className={styles.card}>
                    <h2>Здесь пока нет продуктов</h2>
                    <p>Измените фильтры или добавьте первую партию.</p>
                    <Link href={`${inventoryBase(scope)}/new`}>Добавить продукт</Link>
                </section>
            ) : (
                <>
                    <BatchRows items={query.data.items} locations={locations.data ?? []} scope={scope} />
                    <div className={styles.actions}>
                        <button
                            className="button outline"
                            disabled={Number(filters.offset) === 0}
                            onClick={() => filter('offset', String(Math.max(0, Number(filters.offset) - 50)))}
                        >
                            Назад
                        </button>
                        <span>Всего {query.data.total}</span>
                        <button
                            className="button outline"
                            disabled={Number(filters.offset) + 50 >= query.data.total}
                            onClick={() => filter('offset', String(Number(filters.offset) + 50))}
                        >
                            Далее
                        </button>
                    </div>
                </>
            )}
            {locations.isError && (
                <p role="alert">
                    Названия мест временно недоступны.{' '}
                    <button onClick={() => void locations.refetch()}>Повторить</button>
                </p>
            )}
        </>
    );
}
export function InventoryPage({ scope = 'private' }: { scope?: InventoryScope }) {
    return (
        <InventoryShell scope={scope}>
            <Content scope={scope} />
        </InventoryShell>
    );
}
