'use client';
import Link from 'next/link';
import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRuntime } from '../../app/providers.js';
import { ApiError } from '../../shared/api/client.js';
import { useSession } from '../auth/session.js';
import { useRequestSignal } from '../auth/use-request-signal.js';
import { InlineLoader as ArcInlineLoader } from '@meal-planner/design-system';
import { BatchFields, emptyFields, type Fields } from './batch-form.js';
import {
    InventoryShell,
    Loading,
    Failure,
    commandError,
    inventoryBase,
    inventoryScopeQuery,
    type InventoryScope,
} from './shared.js';
import styles from './inventory.module.css';

function Content({ scope }: { scope: InventoryScope }) {
    const { api, queryClient } = useRuntime();
    const user = useSession('user');
    const router = useRouter();
    const search = useSearchParams();
    const signal = useRequestSignal();
    const q = search.get('q') ?? search.get('name') ?? '';
    const setQ = (value: string) => {
        const query = new URLSearchParams(search);
        query.delete('name');
        if (value) query.set('q', value);
        else query.delete('q');
        router.replace(`${inventoryBase(scope)}/new${query.size ? `?${query.toString()}` : ''}`, { scroll: false });
    };
    const [selected, setSelected] = useState('');
    const [fields, setFields] = useState<Fields>(emptyFields);
    const [pending, setPending] = useState(false);
    const [uncertain, setUncertain] = useState(false);
    const [error, setError] = useState('');
    const pendingRef = useRef(false);
    const attempt = useRef<{ key: string; fingerprint: string } | null>(null);
    const products = useQuery({
        queryKey: ['inventory-products', user.data?.id, q],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/products', undefined, signal, undefined, { query: { q, limit: '20' } }))
                .data,
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
    async function save(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!api || pendingRef.current) return;
        pendingRef.current = true;
        const body = { ...fields, ingredientId: selected, scope };
        const fingerprint = JSON.stringify(body);
        if (!attempt.current || attempt.current.fingerprint !== fingerprint)
            attempt.current = { key: crypto.randomUUID(), fingerprint };
        setPending(true);
        setError('');
        const requestSignal = signal();
        try {
            const response = await api.request(
                'POST /api/v1/inventory',
                { ...body, idempotencyKey: attempt.current.key },
                requestSignal,
            );
            if (requestSignal.aborted) return;
            await queryClient.invalidateQueries({ queryKey: ['inventory'] });
            await queryClient.invalidateQueries({ queryKey: ['inventory-attention'] });
            router.push(`${inventoryBase(scope)}/batches/${response.data.batch.id}`);
        } catch (err) {
            if (!requestSignal.aborted) {
                setError(commandError(err));
                setUncertain(!(err instanceof ApiError) || err.status >= 500);
                if (err instanceof ApiError && err.status < 500) attempt.current = null;
            }
        } finally {
            pendingRef.current = false;
            if (!requestSignal.aborted) setPending(false);
        }
    }
    return (
        <>
            <Link href={inventoryBase(scope)}>← К запасам</Link>
            <h1>Добавить продукт в запасы</h1>
            <p className={styles.muted}>
                {scope === 'family' ? 'Семья · общая партия для всех участников' : 'Личное · отдельная партия'}
            </p>
            <form onSubmit={(event) => void save(event)} className={styles.form}>
                <fieldset className={styles.lockable} disabled={pending || uncertain}>
                    <div className={styles.columns}>
                        <section className={styles.card}>
                            <h2>Продукт</h2>
                            <label>
                                Поиск в каталоге
                                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} />
                            </label>
                            {products.isPending ? (
                                <Loading />
                            ) : products.isError ? (
                                <Failure error={products.error} retry={() => void products.refetch()} />
                            ) : (
                                <>
                                    <div className={styles.form}>
                                        {products.data.items
                                            .filter((product) => scope === 'private' || product.status === 'approved')
                                            .map((product) => (
                                                <label className={styles.selection} key={product.id}>
                                                    <input
                                                        type="radio"
                                                        name="ingredient"
                                                        required
                                                        checked={selected === product.id}
                                                        onChange={() => {
                                                            setSelected(product.id);
                                                            setFields({
                                                                ...fields,
                                                                name: product.name,
                                                                unit: product.defaultUnit,
                                                            });
                                                        }}
                                                    />
                                                    {product.name}
                                                </label>
                                            ))}
                                    </div>
                                    {products.data.items.length === 0 && (
                                        <p>Совпадений нет. Можно предложить новый продукт.</p>
                                    )}
                                </>
                            )}
                            <Link href="/products/new">Не нашли продукт? Предложить новый</Link>
                        </section>
                        <section className={styles.card}>
                            <h2>Информация о партии</h2>
                            {locations.isPending ? (
                                <Loading />
                            ) : locations.isError ? (
                                <Failure error={locations.error} retry={() => void locations.refetch()} />
                            ) : (
                                <BatchFields
                                    key={selected}
                                    initial={fields}
                                    locations={locations.data}
                                    onChange={setFields}
                                />
                            )}
                            <Link href={`${inventoryBase(scope)}/locations`}>Управление местами хранения</Link>
                        </section>
                    </div>
                </fieldset>
                {error && (
                    <p role="alert" className={styles.notice}>
                        {error}
                    </p>
                )}
                <div className={styles.actions}>
                    <button
                        type="submit"
                        className="button primary"
                        disabled={pending || !selected || locations.isPending || locations.isError}
                    >
                        {pending ? <ArcInlineLoader label="Сохраняем" /> : 'Добавить в запасы'}
                    </button>
                    <Link
                        href={inventoryBase(scope)}
                        aria-disabled={pending}
                        tabIndex={pending ? -1 : undefined}
                        onClick={(event) => {
                            if (pending) event.preventDefault();
                        }}
                    >
                        Отмена
                    </Link>
                </div>
            </form>
        </>
    );
}
export function InventoryCreatePage({ scope = 'private' }: { scope?: InventoryScope }) {
    return (
        <InventoryShell scope={scope}>
            <Content scope={scope} />
        </InventoryShell>
    );
}
