'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../shared/runtime/index.js';
import { ApiError } from '../../shared/api/client.js';
import { commandError } from '../../shared/api/command-error.js';
import { useSession } from '../../entities/session/client.js';
import { units } from '../../entities/measurement/model.js';
import { inventoryScopeQuery, type InventoryScope } from '../../entities/inventory/model.js';
import { inventoryKeys } from '../../entities/inventory/query-keys.js';
import { inventoryBase } from '../../entities/inventory/routes.js';
import { rowError, type ReviewRow } from './contracts.js';
import styles from './ingest.module.css';

function Row({
    row,
    update,
    disabled,
    scope,
}: {
    row: ReviewRow;
    update: (value: ReviewRow) => void;
    disabled: boolean;
    scope: InventoryScope;
}) {
    const { api } = useRuntime();
    const session = useSession('user');
    const [query, setQuery] = useState(row.name);
    const [search, setSearch] = useState(row.name);
    const products = useQuery({
        queryKey: ['products', 'ingest', session.data?.id, search],
        enabled: !!api && !!session.data && !!search.trim() && !row.skip,
        queryFn: async ({ signal }) =>
            (
                await api!.request('GET /api/v1/products', undefined, signal, undefined, {
                    query: {
                        ...(row.barcode && search === row.barcode ? { barcode: row.barcode } : { q: search }),
                        limit: '20',
                        offset: '0',
                    },
                })
            ).data,
    });
    const locations = useQuery({
        queryKey: inventoryKeys.locations(scope, session.data?.id),
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) =>
            (
                await api!.request('GET /api/v1/inventory-locations', undefined, signal, undefined, {
                    query: inventoryScopeQuery(scope),
                })
            ).data.items,
    });
    const change = (values: Partial<ReviewRow>) => update({ ...row, ...values, reviewed: values.reviewed ?? false });
    return (
        <section className={styles.card}>
            <h3>{row.source}</h3>
            <label className={styles.check}>
                <input
                    type="checkbox"
                    checked={row.skip}
                    disabled={disabled}
                    onChange={(event) => change({ skip: event.target.checked })}
                />
                Пропустить строку
            </label>
            {!row.skip && (
                <>
                    <div className={styles.grid}>
                        <label>
                            Название
                            <input
                                value={row.name}
                                disabled={disabled}
                                maxLength={200}
                                onChange={(event) => change({ name: event.target.value })}
                            />
                        </label>
                        <label>
                            Поиск товара
                            <input
                                value={query}
                                disabled={disabled}
                                onChange={(event) => setQuery(event.target.value)}
                            />
                        </label>
                    </div>
                    <div className={styles.actions}>
                        <button
                            className="button outline"
                            disabled={disabled || !query.trim()}
                            onClick={() => setSearch(query)}
                        >
                            Найти в каталоге
                        </button>
                        <Link href="/products/new" target="_blank">
                            Нет товара? Создать в новой вкладке
                        </Link>
                        <button
                            className="button outline"
                            disabled={disabled || products.isFetching}
                            onClick={() => void products.refetch()}
                        >
                            Обновить каталог
                        </button>
                    </div>
                    {products.isError && <p role="alert">Каталог недоступен. Повторите поиск.</p>}
                    <label>
                        Товар каталога
                        <select
                            value={row.ingredientId}
                            disabled={disabled || products.isFetching}
                            onChange={(event) => {
                                const product = products.data?.items.find((item) => item.id === event.target.value);
                                change({
                                    ingredientId: event.target.value,
                                    ...(product ? { name: product.name } : {}),
                                    ...(product && !row.unit ? { unit: product.defaultUnit } : {}),
                                });
                            }}
                        >
                            <option value="">{products.isFetching ? 'Поиск…' : 'Выберите совпадение'}</option>
                            {products.data?.items
                                .filter((item) => scope === 'private' || item.status === 'approved')
                                .map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name}
                                        {item.status === 'pending' ? ' · на модерации, доступен вам' : ''}
                                    </option>
                                ))}
                        </select>
                    </label>
                    <div className={styles.grid}>
                        <label>
                            Количество (пусто — неизвестно)
                            <input
                                value={row.quantity}
                                inputMode="decimal"
                                disabled={disabled}
                                onChange={(event) => change({ quantity: event.target.value.replace(',', '.') })}
                            />
                        </label>
                        <label>
                            Единица
                            <select
                                value={row.unit}
                                disabled={disabled}
                                onChange={(event) => change({ unit: event.target.value })}
                            >
                                <option value="">Выберите</option>
                                {Object.entries(units).map(([value, label]) => (
                                    <option value={value} key={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            Срок годности
                            <input
                                type="date"
                                value={row.expiryOn}
                                disabled={disabled}
                                onChange={(event) => change({ expiryOn: event.target.value })}
                            />
                        </label>
                        <label>
                            Место хранения
                            <select
                                value={row.locationId}
                                disabled={disabled || locations.isFetching}
                                onChange={(event) => change({ locationId: event.target.value, locationName: '' })}
                            >
                                <option value="">Выберите место</option>
                                {locations.data?.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    {locations.isError && (
                        <p role="alert">
                            Не удалось загрузить места.{' '}
                            <button onClick={() => void locations.refetch()}>Повторить</button>
                        </p>
                    )}
                    {row.locationName && (
                        <p className={styles.notice}>
                            В файле: «{row.locationName}».{' '}
                            <button disabled={disabled} onClick={() => change({ locationName: '', locationId: '' })}>
                                Очистить подсказку из файла
                            </button>
                            . Затем выберите место хранения.
                        </p>
                    )}
                    <label className={styles.check}>
                        <input
                            type="checkbox"
                            checked={row.reviewed}
                            disabled={disabled}
                            onChange={(event) => change({ reviewed: event.target.checked })}
                        />
                        Проверил название, совпадение, количество и дату
                    </label>
                    {rowError(row) && <p className={styles.error}>{rowError(row)}</p>}
                </>
            )}
        </section>
    );
}

export function IngestReview({
    initialRows,
    onBack,
    scope = 'private',
}: {
    initialRows: ReviewRow[];
    onBack: () => void;
    scope?: InventoryScope;
}) {
    const { api, queryClient } = useRuntime();
    const [rows, setRows] = useState(initialRows);
    const [page, setPage] = useState(0);
    const [confirmed, setConfirmed] = useState(false);
    const pendingCommand = useRef<{ rows: unknown[]; idempotencyKey: string } | null>(null);
    const selected = rows.filter((row) => !row.skip);
    const invalid = selected.filter((row) => rowError(row));
    const seen = new Set<string>();
    const duplicates = selected.filter((row) => {
        const key = JSON.stringify([row.name.toLowerCase(), row.quantity, row.unit, row.expiryOn]);
        if (seen.has(key)) return true;
        seen.add(key);
        return false;
    }).length;
    const mutation = useMutation({
        mutationFn: async () => {
            if (!api || !confirmed || !selected.length || invalid.length) throw new Error('Проверьте выбранные строки');
            pendingCommand.current ??= {
                rows: selected.map((row) => ({
                    name: row.name.trim(),
                    ingredientId: row.ingredientId,
                    quantity: row.quantity || null,
                    unit: row.unit,
                    locationId: row.locationId,
                    openedAt: null,
                    purchasedOn: null,
                    expiryOn: row.expiryOn || null,
                    packageState: 'unknown',
                    precision: 'exact',
                    quantitySource: 'inventory',
                    confidence: null,
                    pricePaidRub: null,
                    storeName: null,
                    barcode: row.barcode ?? null,
                    scope,
                    idempotencyKey: crypto.randomUUID(),
                })),
                idempotencyKey: crypto.randomUUID(),
            };
            return (await api.request('POST /api/v1/inventory/import/commit', pendingCommand.current)).data;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: inventoryKeys.root });
        },
    });
    const definiteFailure =
        mutation.error instanceof ApiError && [400, 401, 403, 404, 409, 412, 422].includes(mutation.error.status);
    const locked = mutation.isPending || (mutation.isError && !definiteFailure);
    if (mutation.isSuccess)
        return (
            <section className={styles.card} role="status">
                <h2>Запасы добавлены</h2>
                <p>
                    Создано партий: {mutation.data.items.length}. Пропущено строк: {rows.length - selected.length}.
                </p>
                <Link href={inventoryBase(scope)}>Перейти к запасам</Link>
            </section>
        );
    return (
        <div className={styles.page}>
            <h2>Проверка перед добавлением</h2>
            <p>
                {scope === 'family' ? 'Семейные' : 'Личные'} запасы · выбрано {selected.length} из {rows.length} ·
                требуют проверки {invalid.length}
            </p>
            {duplicates > 0 && (
                <p className={styles.notice}>
                    Похожих повторных строк: {duplicates}. Проверьте дубликаты: каждая выбранная строка создаст
                    отдельную партию.
                </p>
            )}
            <div className={styles.actions}>
                <button className="button outline" disabled={locked} onClick={onBack}>
                    К исходным данным
                </button>
                <button
                    className="button outline"
                    disabled={locked}
                    onClick={() => {
                        setRows(rows.map((row) => (rowError(row) ? { ...row, skip: true } : row)));
                        setConfirmed(false);
                        pendingCommand.current = null;
                        mutation.reset();
                    }}
                >
                    Пропустить все непроверенные строки
                </button>
            </div>
            {rows.slice(page * 20, page * 20 + 20).map((row) => (
                <Row
                    key={row.key}
                    row={row}
                    scope={scope}
                    disabled={locked}
                    update={(value) => {
                        setRows(rows.map((item) => (item.key === value.key ? value : item)));
                        setConfirmed(false);
                        pendingCommand.current = null;
                        mutation.reset();
                    }}
                />
            ))}
            {rows.length > 20 && (
                <nav className={styles.actions} aria-label="Строки импорта">
                    <button disabled={!page} onClick={() => setPage(page - 1)}>
                        Предыдущие
                    </button>
                    <span>
                        {page + 1} / {Math.ceil(rows.length / 20)}
                    </span>
                    <button disabled={(page + 1) * 20 >= rows.length} onClick={() => setPage(page + 1)}>
                        Следующие
                    </button>
                </nav>
            )}
            <section className={styles.card}>
                <label className={styles.check}>
                    <input
                        type="checkbox"
                        checked={confirmed}
                        disabled={locked}
                        onChange={(event) => setConfirmed(event.target.checked)}
                    />
                    Добавить выбранные строки только в {scope === 'family' ? 'семейные' : 'мои личные'} запасы
                </label>
                <p>Все выбранные строки сохраняются одной операцией. Ошибка проверки не добавит часть списка.</p>
                {mutation.isError && (
                    <p role="alert" className={styles.error}>
                        {commandError(mutation.error)}{' '}
                        {definiteFailure
                            ? 'Исправьте данные и подтвердите их заново.'
                            : 'Повтор использует тот же запрос. Чтобы исключить дубль, исходные строки временно заблокированы.'}
                    </p>
                )}
                <button
                    className="button primary"
                    disabled={!api || !confirmed || !selected.length || !!invalid.length || mutation.isPending}
                    onClick={() => mutation.mutate()}
                >
                    {mutation.isPending
                        ? 'Добавляем…'
                        : mutation.isError
                          ? 'Повторить тот же запрос'
                          : `Добавить ${selected.length} партий`}
                </button>
                {mutation.isError && <Link href={inventoryBase(scope)}>Проверить результат в запасах</Link>}
            </section>
        </div>
    );
}
