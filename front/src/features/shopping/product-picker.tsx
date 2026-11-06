'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../shared/runtime/index.js';
import { useSession } from '../../entities/session/client.js';
import { useShoppingScope } from './shared.js';
import styles from './shopping.module.css';
import { shoppingKeys } from './query-keys.js';
import { loadShoppingProduct, loadShoppingProducts } from './api.js';
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
    const scope = useShoppingScope();
    const [q, setQ] = useState('');
    const products = useQuery({
        queryKey: shoppingKeys.catalogSearch(user.data?.id, scope, q),
        enabled: !!api && !!user.data,
        queryFn: ({ signal }) => loadShoppingProducts(api!, q, signal),
    });
    const detail = useQuery({
        queryKey: shoppingKeys.catalogDetail(user.data?.id, scope, ingredientId),
        enabled: !!api && !!ingredientId,
        queryFn: ({ signal }) => loadShoppingProduct(api!, ingredientId!, signal),
    });
    const visibleProducts = products.data?.items.filter(
        (product) => scope === 'private' || product.status === 'approved',
    );
    const selectedProductIsVisible = scope === 'private' || detail.data?.product.status === 'approved';
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
                            visibleProducts?.find((p) => p.id === e.target.value)?.name,
                        )
                    }
                >
                    <option value="">Без привязки</option>
                    {ingredientId &&
                        selectedProductIsVisible &&
                        !visibleProducts?.some((p) => p.id === ingredientId) && (
                            <option value={ingredientId}>{detail.data?.product.name ?? 'Выбранный продукт'}</option>
                        )}
                    {visibleProducts?.map((p) => (
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
