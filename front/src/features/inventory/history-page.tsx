'use client';
import Link from 'next/link';
import { useRef, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useRuntime } from '../../shared/runtime/index.js';
import { useSession } from '../../entities/session/client.js';
import {
    InventoryShell,
    Loading,
    Failure,
    units,
    localDate,
    inventoryBase,
    inventoryScopeQuery,
    type InventoryScope,
} from './shared.js';
import styles from './inventory.module.css';
import { historyView, historyViewUrl } from './url-state.js';
const actions: Record<string, string> = {
    purchase: 'Поступление',
    consume: 'Расход',
    cook: 'Приготовление',
    transfer: 'Перемещение',
    adjust: 'Корректировка',
    archive: 'Архивирование',
    restore: 'Восстановление',
    compensate: 'Компенсация',
};
export function HistoryList({ batchId, scope = 'private' }: { batchId?: string; scope?: InventoryScope }) {
    const { api } = useRuntime();
    const user = useSession('user');
    const search = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const prefix = batchId ? 'history_' : '';
    const { q, action, from, to, offset, selected } = historyView(new URLSearchParams(search), prefix);
    const change = (name: string, value: string | null) => {
        const url = historyViewUrl(pathname, new URLSearchParams(search), name, value, prefix);
        if (name === 'q') router.replace(url, { scroll: false });
        else router.push(url, { scroll: false });
    };
    const setSelected = (value: string | null) => change('event', value);
    const heading = useRef<HTMLHeadingElement>(null);
    const listHeading = useRef<HTMLHeadingElement>(null);
    const previousSelection = useRef<string | null>(null);
    useEffect(() => {
        if (selected) heading.current?.focus();
        else if (previousSelection.current) listHeading.current?.focus();
        previousSelection.current = selected;
    }, [selected]);
    const query = useQuery({
        placeholderData: keepPreviousData,
        queryKey: ['inventory-history', scope, user.data?.id, batchId, q, action, from, to, offset],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (
                await api!.request('GET /api/v1/inventory-history', undefined, signal, undefined, {
                    query: {
                        ...(batchId ? { batchId } : {}),
                        ...(q ? { q } : {}),
                        ...(action ? { action } : {}),
                        ...(from ? { from: new Date(`${from}T00:00:00`).toISOString() } : {}),
                        ...(to
                            ? {
                                  to: new Date(
                                      new Date(`${to}T00:00:00`).setDate(new Date(`${to}T00:00:00`).getDate() + 1) - 1,
                                  ).toISOString(),
                              }
                            : {}),
                        limit: '100',
                        offset: String(offset),
                        ...inventoryScopeQuery(scope),
                    },
                })
            ).data,
    });
    const items = query.data?.items ?? [];
    const explicitlyChosen = items.find((item) => item.id === selected);
    const chosen = explicitlyChosen ?? items[0];
    const days = [...new Set(items.map((item) => localDate(new Date(item.recordedAt))))];
    const details = chosen ? (
        <section
            className={`${styles.card} ${styles['history-detail']} ${explicitlyChosen ? styles['history-selected'] : ''}`}
        >
            <button
                className={styles['mobile-back']}
                onClick={() => {
                    setSelected(null);
                }}
            >
                ← Назад к событиям
            </button>
            <h3 ref={heading} tabIndex={-1}>
                {chosen.after.name}
            </h3>
            <p>{actions[chosen.action] ?? chosen.action}</p>
            <dl className={styles.details}>
                <dt>Изменение</dt>
                <dd>
                    {chosen.quantityDelta === null
                        ? 'Количество неизвестно'
                        : `${chosen.quantityDelta} ${units[chosen.after.unit]}`}
                </dd>
                <dt>Было</dt>
                <dd>{chosen.before?.quantity ?? 'Неизвестно'}</dd>
                <dt>Стало</dt>
                <dd>{chosen.after.quantity ?? 'Неизвестно'}</dd>
                <dt>Записано</dt>
                <dd>{new Date(chosen.recordedAt).toLocaleString('ru-RU')}</dd>
                <dt>Фактическое время</dt>
                <dd>{new Date(chosen.effectiveAt).toLocaleString('ru-RU')}</dd>
                <dt>Автор</dt>
                <dd>{chosen.actorId === user.data?.id ? 'Вы' : (chosen.actorId ?? 'Система')}</dd>
                <dt>Версия партии</dt>
                <dd>{chosen.after.version}</dd>
            </dl>
            <Link
                href={
                    chosen.after.ingredientId
                        ? `${inventoryBase(scope)}/batches/${chosen.after.id}`
                        : `/inventory/prepared?batch=${chosen.after.id}`
                }
            >
                Открыть партию
            </Link>
        </section>
    ) : null;
    return (
        <>
            <div className={styles.filters}>
                <label>
                    Поиск продукта
                    <input
                        type="search"
                        value={q}
                        onChange={(e) => {
                            change('q', e.target.value);
                        }}
                    />
                </label>
                <label>
                    Операция
                    <select
                        value={action}
                        onChange={(e) => {
                            change('action', e.target.value);
                        }}
                    >
                        <option value="">Все операции</option>
                        {Object.entries(actions).map(([value, label]) => (
                            <option value={value} key={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    С даты
                    <input
                        type="date"
                        value={from}
                        onChange={(e) => {
                            change('from', e.target.value);
                        }}
                    />
                </label>
                <label>
                    По дату
                    <input
                        type="date"
                        value={to}
                        onChange={(e) => {
                            change('to', e.target.value);
                        }}
                    />
                </label>
            </div>
            {query.isPending ? (
                <Loading />
            ) : query.isError ? (
                <Failure error={query.error} retry={() => void query.refetch()} />
            ) : (
                <>
                    <p role="status">{query.isFetching ? 'Обновляем историю…' : ''}</p>
                    <div className={`${styles['history-layout']} ${batchId ? styles['history-compact'] : ''}`}>
                        <section className={`${styles.history} ${explicitlyChosen ? styles['mobile-hidden'] : ''}`}>
                            <h3 ref={listHeading} tabIndex={-1}>
                                События
                            </h3>
                            {items.length === 0 ? (
                                <p>Событий по этим условиям нет.</p>
                            ) : (
                                days.map((day) => (
                                    <section className={styles.history} key={day}>
                                        <h3>{new Date(`${day}T12:00:00`).toLocaleDateString('ru-RU')}</h3>
                                        {items
                                            .filter((item) => localDate(new Date(item.recordedAt)) === day)
                                            .map((item) => (
                                                <button
                                                    className={styles['history-event']}
                                                    key={item.id}
                                                    aria-pressed={chosen?.id === item.id}
                                                    onClick={() => setSelected(item.id)}
                                                >
                                                    {new Date(item.recordedAt).toLocaleString('ru-RU')} ·{' '}
                                                    {item.after.name} · {actions[item.action] ?? item.action} ·{' '}
                                                    {item.quantityDelta === null
                                                        ? 'Количество неизвестно'
                                                        : `${item.quantityDelta} ${units[item.after.unit]}`}
                                                </button>
                                            ))}
                                    </section>
                                ))
                            )}
                        </section>
                        {details}
                    </div>
                    <div className={styles.actions}>
                        <button
                            className="button outline"
                            disabled={offset === 0}
                            onClick={() => {
                                change('offset', String(Math.max(0, offset - 100)));
                            }}
                        >
                            Предыдущие события
                        </button>
                        <span>Всего {query.data.total}</span>
                        <button
                            className="button outline"
                            disabled={offset + 100 >= query.data.total}
                            onClick={() => {
                                change('offset', String(offset + 100));
                            }}
                        >
                            Следующие события
                        </button>
                    </div>
                </>
            )}
        </>
    );
}
export function InventoryHistoryPage({ scope = 'private' }: { scope?: InventoryScope }) {
    return (
        <InventoryShell scope={scope}>
            <h1>История запасов</h1>
            <p className={styles.muted}>
                Все изменения {scope === 'family' ? 'семейных' : 'личных'} запасов. Расход не означает съеденное.
            </p>
            <HistoryList scope={scope} />
        </InventoryShell>
    );
}
