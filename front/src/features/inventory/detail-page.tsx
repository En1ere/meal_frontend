'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../app/providers.js';
import { ApiError } from '../../shared/api/client.js';
import { useSession } from '../auth/session.js';
import { useRequestSignal } from '../auth/use-request-signal.js';
import { InlineLoader as ArcInlineLoader } from '@meal-planner/design-system';
import { BatchFields, type Fields, type Batch } from './batch-form.js';
import {
    InventoryShell,
    Loading,
    Failure,
    commandError,
    dateText,
    expiryText,
    units,
    inventoryBase,
    inventoryScopeQuery,
    type InventoryScope,
} from './shared.js';
import { HistoryList } from './history-page.js';
import styles from './inventory.module.css';

function Editor({
    batch,
    locations,
    onDone,
    initialAction,
    scope,
}: {
    batch: Batch;
    locations: { id: string; name: string }[];
    onDone: () => void;
    initialAction: string;
    scope: InventoryScope;
}) {
    const { api, queryClient } = useRuntime();
    const signal = useRequestSignal();
    const [action, setAction] = useState(initialAction);
    const [fields, setFields] = useState<Fields>({
        name: batch.name,
        quantity: batch.quantity,
        unit: batch.unit,
        locationId: batch.locationId,
        purchasedOn: batch.purchasedOn,
        expiryOn: batch.expiryOn,
        openedAt: batch.openedAt,
        packageState: batch.packageState,
        precision: batch.precision,
        pricePaidRub: batch.pricePaidRub,
        storeName: batch.storeName,
        barcode: batch.barcode,
    });
    const [quantity, setQuantity] = useState('');
    const [location, setLocation] = useState('');
    const [pending, setPending] = useState(false);
    const [uncertain, setUncertain] = useState(false);
    const [error, setError] = useState('');
    const [conflict, setConflict] = useState(false);
    const attempt = useRef<{ key: string; fingerprint: string } | null>(null);
    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!api || pending || conflict) return;
        const command =
            action === 'edit'
                ? { action, fields }
                : action === 'consume'
                  ? { action, quantity }
                  : action === 'transfer'
                    ? { action, locationId: location }
                    : { action };
        const body = { ...command, version: batch.version, scope };
        const fingerprint = JSON.stringify(body);
        if (!attempt.current || attempt.current.fingerprint !== fingerprint)
            attempt.current = { key: crypto.randomUUID(), fingerprint };
        const abort = signal();
        setPending(true);
        setError('');
        try {
            await api.request(
                'POST /api/v1/inventory/{id}/command',
                { ...body, idempotencyKey: attempt.current.key },
                abort,
                { id: batch.id },
                { ifMatch: batch.version },
            );
            if (abort.aborted) return;
            await queryClient.invalidateQueries({ queryKey: ['inventory'] });
            await queryClient.invalidateQueries({ queryKey: ['inventory-history'] });
            await queryClient.invalidateQueries({ queryKey: ['inventory-attention'] });
            onDone();
        } catch (err) {
            if (!abort.aborted) {
                setError(commandError(err));
                setUncertain(!(err instanceof ApiError) || err.status >= 500);
                setConflict(err instanceof ApiError && err.status === 412);
                if (err instanceof ApiError && err.status < 500) attempt.current = null;
            }
        } finally {
            if (!abort.aborted) setPending(false);
        }
    }
    return (
        <form className={styles.card} onSubmit={(event) => void submit(event)}>
            <h2>Изменить партию</h2>
            <fieldset className={styles.lockable} disabled={pending || uncertain}>
                <div className={styles.actions}>
                    {(batch.archivedAt ? ['restore'] : ['edit', 'consume', 'transfer', 'archive']).map((value) => (
                        <button
                            type="button"
                            key={value}
                            className="button outline"
                            aria-pressed={action === value}
                            onClick={() => setAction(value)}
                        >
                            {
                                (
                                    {
                                        edit: 'Исправить',
                                        consume: 'Расход',
                                        transfer: 'Переместить',
                                        archive: 'В архив',
                                        restore: 'Восстановить',
                                    } as Record<string, string>
                                )[value]
                            }
                        </button>
                    ))}
                </div>
                {action === 'edit' && <BatchFields initial={fields} locations={locations} onChange={setFields} />}{' '}
                {action === 'consume' && (
                    <label>
                        Количество расхода, {units[batch.unit]}
                        <input
                            required
                            inputMode="decimal"
                            pattern="[0-9]+([.][0-9]{1,8})?"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value.replace(',', '.'))}
                        />
                        <span>Расход уменьшает запас и не добавляет еду в дневник.</span>
                    </label>
                )}
                {action === 'transfer' && (
                    <label>
                        Новое место
                        <select required value={location} onChange={(e) => setLocation(e.target.value)}>
                            <option value="">Выберите место</option>
                            {locations
                                .filter((x) => x.id !== batch.locationId)
                                .map((x) => (
                                    <option key={x.id} value={x.id}>
                                        {x.name}
                                    </option>
                                ))}
                        </select>
                    </label>
                )}
                {action === 'archive' && (
                    <p>Партия будет скрыта из активных запасов. История сохранится; партию можно восстановить.</p>
                )}
                {action === 'restore' && (
                    <p>Вернуть партию в активные {scope === 'family' ? 'семейные' : 'личные'} запасы?</p>
                )}
            </fieldset>
            {error && (
                <p role="alert" className={styles.notice}>
                    {error}
                </p>
            )}
            {conflict && (
                <button
                    type="button"
                    onClick={() => {
                        void (async () => {
                            await queryClient.invalidateQueries({ queryKey: ['inventory'] });
                            setConflict(false);
                            setError(
                                'Актуальные сведения показаны выше. Сравните их со своим вводом перед сохранением.',
                            );
                        })();
                    }}
                >
                    Загрузить актуальные сведения, сохранив ввод
                </button>
            )}
            <div className={styles.actions}>
                <button className="button primary" disabled={pending || conflict}>
                    {pending ? <ArcInlineLoader label="Сохраняем" /> : 'Подтвердить'}
                </button>
                <button type="button" className="button outline" disabled={pending || uncertain} onClick={onDone}>
                    Закрыть
                </button>
            </div>
        </form>
    );
}
function Content({ id, scope }: { id: string; scope: InventoryScope }) {
    const { api } = useRuntime();
    const user = useSession('user');
    const [editing, setEditing] = useState<string | null>(null);
    const batch = useQuery({
        queryKey: ['inventory', scope, 'batch', user.data?.id, id],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (
                await api!.request(
                    'GET /api/v1/inventory/{id}',
                    undefined,
                    signal,
                    { id },
                    {
                        query: inventoryScopeQuery(scope),
                    },
                )
            ).data.batch,
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
    if (batch.isPending) return <Loading />;
    if (batch.isError) return <Failure error={batch.error} retry={() => void batch.refetch()} />;
    const item = batch.data;
    return (
        <>
            <Link href={inventoryBase(scope)}>← К запасам</Link>
            <div className={styles.heading}>
                <div>
                    <h1>{item.name}</h1>
                    <span className={styles.badge}>
                        {scope === 'family' ? 'Семья' : 'Личное'} · {item.archivedAt ? 'В архиве' : 'Активна'}
                    </span>
                </div>
                <div className={styles.actions}>
                    {item.archivedAt ? (
                        <button className="button primary" disabled={!!editing} onClick={() => setEditing('restore')}>
                            Восстановить
                        </button>
                    ) : (
                        <>
                            <button className="button primary" disabled={!!editing} onClick={() => setEditing('edit')}>
                                Исправить
                            </button>
                            <button
                                className="button outline"
                                disabled={!!editing}
                                onClick={() => setEditing('transfer')}
                            >
                                Переместить
                            </button>
                            <details>
                                <summary>Другие действия</summary>
                                <div className={styles.actions}>
                                    <button disabled={!!editing} onClick={() => setEditing('consume')}>
                                        Расход
                                    </button>
                                    <button disabled={!!editing} onClick={() => setEditing('archive')}>
                                        В архив
                                    </button>
                                </div>
                            </details>
                        </>
                    )}
                </div>
            </div>
            <div className={styles.columns}>
                <section className={styles.card}>
                    <h2>{item.quantity === null ? 'Количество неизвестно' : `${item.quantity} ${units[item.unit]}`}</h2>
                    <p>
                        {item.precision === 'exact' ? 'Точно' : 'Примерно'} · {expiryText(item.expiryOn)}
                    </p>
                    <dl className={styles.details}>
                        <dt>Срок годности</dt>
                        <dd>{dateText(item.expiryOn)}</dd>
                        <dt>Место</dt>
                        <dd>{locations.data?.find((x) => x.id === item.locationId)?.name ?? 'Не указано'}</dd>
                        <dt>Упаковка</dt>
                        <dd>
                            {item.packageState === 'opened'
                                ? 'Открыто'
                                : item.packageState === 'sealed'
                                  ? 'Закрыто'
                                  : 'Не указано'}
                        </dd>
                        <dt>Дата открытия</dt>
                        <dd>{item.openedAt ? new Date(item.openedAt).toLocaleString('ru-RU') : 'Не указана'}</dd>
                        <dt>Дата покупки</dt>
                        <dd>{dateText(item.purchasedOn)}</dd>
                        <dt>Первое поступление</dt>
                        <dd>{new Date(item.createdAt).toLocaleString('ru-RU')}</dd>
                        <dt>Магазин</dt>
                        <dd>{item.storeName ?? 'Не указан'}</dd>
                        <dt>Цена</dt>
                        <dd>{item.pricePaidRub === null ? 'Не указана' : `${item.pricePaidRub} ₽`}</dd>
                        <dt>Штрихкод</dt>
                        <dd>{item.barcode ?? 'Не указан'}</dd>
                    </dl>
                    <Link href={`/products/${item.ingredientId}`}>Карточка продукта</Link>
                </section>
                <section className={styles.card}>
                    <h2>История движения</h2>
                    <HistoryList batchId={id} scope={scope} />
                </section>
            </div>
            {editing && (
                <Editor
                    key={editing}
                    initialAction={editing}
                    batch={item}
                    locations={locations.data ?? []}
                    scope={scope}
                    onDone={() => setEditing(null)}
                />
            )}
        </>
    );
}
export function InventoryDetailPage({ id, scope = 'private' }: { id: string; scope?: InventoryScope }) {
    return (
        <InventoryShell scope={scope}>
            <Content key={id} id={id} scope={scope} />
        </InventoryShell>
    );
}
