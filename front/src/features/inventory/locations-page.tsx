'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../shared/runtime/index.js';
import { ApiError } from '../../shared/api/client.js';
import { useSession } from '../../entities/session/client.js';
import { useRequestSignal } from '../../shared/api/use-request-signal.js';
import {
    InventoryShell,
    Loading,
    Failure,
    commandError,
    places,
    localDate,
    inventoryBase,
    inventoryScopeQuery,
    type InventoryScope,
} from './shared.js';
import { BatchRows } from './list-page.js';
import styles from './inventory.module.css';
function Content({ scope }: { scope: InventoryScope }) {
    const { api, queryClient } = useRuntime();
    const user = useSession('user');
    const signal = useRequestSignal();
    const search = useSearchParams();
    const router = useRouter();
    const selected = search.get('location') ?? '';
    const setSelected = (id: string) => {
        const query = new URLSearchParams(search);
        if (id) query.set('location', id);
        else query.delete('location');
        router.push(`${inventoryBase(scope)}/locations${query.size ? `?${query.toString()}` : ''}`, { scroll: false });
    };
    const [name, setName] = useState('');
    const [type, setType] = useState('fridge');
    const [rename, setRename] = useState(false);
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);
    const [uncertain, setUncertain] = useState(false);
    const [conflict, setConflict] = useState(false);
    const attempt = useRef<{ key: string; fingerprint: string } | null>(null);
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
    const batches = useQuery({
        queryKey: ['inventory', scope, 'location', user.data?.id, selected],
        enabled: !!api && !!user.data && !!selected,
        queryFn: async ({ signal }) =>
            (
                await api!.request('GET /api/v1/inventory', undefined, signal, undefined, {
                    query: {
                        locationId: selected,
                        localDate: localDate(),
                        limit: '100',
                        ...inventoryScopeQuery(scope),
                    },
                })
            ).data,
    });
    const current = locations.data?.find((x) => x.id === selected);
    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!api || pending || conflict) return;
        const body =
            rename && current
                ? { action: 'rename', id: current.id, version: current.version, name, scope }
                : { action: 'create', type, name, scope };
        const fingerprint = JSON.stringify(body);
        if (!attempt.current || attempt.current.fingerprint !== fingerprint)
            attempt.current = { key: crypto.randomUUID(), fingerprint };
        const abort = signal();
        setPending(true);
        setError('');
        try {
            const result = await api.request(
                'POST /api/v1/inventory-locations',
                { ...body, idempotencyKey: attempt.current.key },
                abort,
                undefined,
                rename && current ? { ifMatch: current.version } : undefined,
            );
            if (abort.aborted) return;
            attempt.current = null;
            setUncertain(false);
            setConflict(false);
            setSelected(result.data.location.id);
            setName('');
            setRename(false);
            await queryClient.invalidateQueries({ queryKey: ['inventory-locations'] });
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
        <>
            <h1>Места хранения</h1>
            <p className={styles.muted}>
                {scope === 'family' ? 'Общие места семьи.' : 'Личные места.'} Переименование не перемещает продукты.
            </p>
            {locations.isPending ? (
                <Loading />
            ) : locations.isError ? (
                <Failure error={locations.error} retry={() => void locations.refetch()} />
            ) : (
                <>
                    <div className={`${styles.actions} ${current ? styles['mobile-hidden'] : ''}`} aria-label="Места">
                        {locations.data.map((item) => (
                            <button
                                key={item.id}
                                className="button outline"
                                aria-pressed={selected === item.id}
                                disabled={pending || uncertain}
                                onClick={() => {
                                    setSelected(item.id);
                                    setRename(false);
                                    setName('');
                                }}
                            >
                                {item.name}
                            </button>
                        ))}
                    </div>
                    {current && (
                        <section className={styles.card}>
                            <div className={styles.heading}>
                                <h2>{current.name}</h2>
                                <button
                                    disabled={pending || uncertain}
                                    onClick={() => {
                                        setRename(true);
                                        setName(current.name);
                                    }}
                                >
                                    Переименовать
                                </button>
                                <button disabled={pending || uncertain} onClick={() => setSelected('')}>
                                    ← К списку мест
                                </button>
                            </div>
                            {batches.isPending ? (
                                <Loading />
                            ) : batches.isError ? (
                                <Failure error={batches.error} retry={() => void batches.refetch()} />
                            ) : batches.data.items.length === 0 ? (
                                <p>В этом месте пока нет продуктов.</p>
                            ) : (
                                <>
                                    <BatchRows items={batches.data.items} locations={locations.data} scope={scope} />
                                    {batches.data.total > batches.data.items.length && (
                                        <Link href={`${inventoryBase(scope)}?locationId=${current.id}`}>
                                            Показать все {batches.data.total} партий
                                        </Link>
                                    )}
                                </>
                            )}
                        </section>
                    )}
                </>
            )}
            <form
                onSubmit={(event) => void submit(event)}
                className={`${styles.card} ${current && !rename ? styles['mobile-hidden'] : ''}`}
            >
                <h2>{rename ? 'Переименовать место' : 'Добавить место'}</h2>
                <label>
                    Название
                    <input
                        disabled={pending || uncertain}
                        required
                        maxLength={100}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </label>
                {!rename && (
                    <label>
                        Базовый тип
                        <select disabled={pending || uncertain} value={type} onChange={(e) => setType(e.target.value)}>
                            {Object.entries(places).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                {error && <p role="alert">{error}</p>}
                {conflict && (
                    <button
                        type="button"
                        onClick={() => {
                            void (async () => {
                                await locations.refetch();
                                setConflict(false);
                                setError(
                                    'Сведения обновлены. Проверьте текущее название и свой ввод перед сохранением.',
                                );
                            })();
                        }}
                    >
                        Обновить сведения, сохранив ввод
                    </button>
                )}
                <button className="button primary" disabled={pending || conflict}>
                    {pending ? 'Сохраняем…' : uncertain ? 'Повторить незавершённую команду' : 'Сохранить'}
                </button>
                {rename && (
                    <button
                        type="button"
                        disabled={pending || uncertain}
                        onClick={() => {
                            setRename(false);
                            setName('');
                        }}
                    >
                        Отмена
                    </button>
                )}
            </form>
        </>
    );
}
export function InventoryLocationsPage({ scope = 'private' }: { scope?: InventoryScope }) {
    return (
        <InventoryShell scope={scope}>
            <LocationRoute scope={scope} />
        </InventoryShell>
    );
}
function LocationRoute({ scope }: { scope: InventoryScope }) {
    const search = useSearchParams();
    return <Content key={search.get('location') ?? ''} scope={scope} />;
}
