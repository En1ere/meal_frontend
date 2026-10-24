'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../app/providers.js';
import { useSession } from '../auth/session.js';
import styles from './shopping.module.css';
export function ProductPicker({
    ingredientId,
    productId,
    onChange,
    disabled = false,
}: {
    ingredientId: string | null;
    productId: string | null;
    onChange: (ingredientId: string | null, productId: string | null, name?: string) => void;
    disabled?: boolean;
}) {
    const { api } = useRuntime();
    const user = useSession('user');
    const [q, setQ] = useState('');
    const products = useQuery({
        queryKey: ['shopping-catalog', user.data?.id, 'search', q],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/products', undefined, signal, undefined, { query: { q, limit: '20' } }))
                .data,
    });
    const detail = useQuery({
        queryKey: ['shopping-catalog', user.data?.id, 'detail', ingredientId],
        enabled: !!api && !!ingredientId,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/products/{id}', undefined, signal, { id: ingredientId! })).data,
    });
    return (
        <div className={styles.fields}>
            <label className={styles.field}>
                Найти продукт
                <input disabled={disabled} value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <label className={styles.field}>
                Продукт каталога
                <select
                    disabled={disabled}
                    value={ingredientId ?? ''}
                    onChange={(e) =>
                        onChange(
                            e.target.value || null,
                            null,
                            products.data?.items.find((p) => p.id === e.target.value)?.name,
                        )
                    }
                >
                    <option value="">Без привязки</option>
                    {ingredientId && !products.data?.items.some((p) => p.id === ingredientId) && (
                        <option value={ingredientId}>{detail.data?.product.name ?? 'Выбранный продукт'}</option>
                    )}
                    {products.data?.items.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.name}
                        </option>
                    ))}
                </select>
            </label>
            {ingredientId && (
                <label className={styles.field}>
                    Конкретный товар
                    <select
                        disabled={disabled}
                        value={productId ?? ''}
                        onChange={(e) => onChange(ingredientId, e.target.value || null)}
                    >
                        <option value="">Любой подходящий</option>
                        {detail.data?.product.variants.flatMap((v) =>
                            v.products.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            )),
                        )}
                    </select>
                </label>
            )}
            {(products.isError || detail.isError) && (
                <p role="alert">Каталог недоступен. Проверьте подключение и повторите поиск.</p>
            )}
        </div>
    );
}
