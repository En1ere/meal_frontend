'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../app/providers.js';
import { useSession } from '../auth/session.js';
import { InventoryShell, Loading, Failure, units, localDate, expiryText, dateText } from '../inventory/shared.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import styles from '../inventory/inventory.module.css';
import productStyles from './products.module.css';
import { productView, updateViewUrl } from './url-state.js';
type Product = Success<'GET /api/v1/products/{id}'>['data']['product'];
const tabs = [
    ['about', 'О продукте'],
    ['nutrition', 'Пищевая ценность'],
    ['allergens', 'Аллергены и состав'],
    ['source', 'Источники'],
] as const;
function Info({ product }: { product: Product }) {
    const search = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const { variantId, skuId, tab } = productView(new URLSearchParams(search), product.variants);
    const update = (changes: Record<string, string | null>) =>
        router.push(updateViewUrl(pathname, new URLSearchParams(search), changes), { scroll: false });
    const variant = product.variants.find((x) => x.id === variantId);
    const sku = variant?.products.find((x) => x.id === skuId);
    const nutrition = sku ? sku.nutrition : product.nutrition;
    const allergens = sku ? sku.allergens : product.allergens;
    const contains = allergens.filter((x) => x.status === 'contains');
    return (
        <div className={styles.history}>
            <section className={styles.card}>
                <h2>{sku?.name ?? variant?.name ?? product.name}</h2>
                {variant && !sku && (
                    <p className={styles.muted}>
                        Пищевая ценность и аллергены ниже относятся к базовому ингредиенту. Чтобы увидеть данные
                        конкретной упаковки, выберите товар.
                    </p>
                )}
                {product.variants.length > 0 && (
                    <label>
                        Вариант
                        <select
                            value={variantId}
                            onChange={(e) => {
                                update({ variant: e.target.value, sku: null });
                            }}
                        >
                            <option value="">Базовый ингредиент</option>
                            {product.variants.map((x) => (
                                <option key={x.id} value={x.id}>
                                    {x.name}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                {variant && (
                    <label>
                        Товар и фасовка
                        <select value={skuId} onChange={(e) => update({ sku: e.target.value })}>
                            <option value="">Без конкретного товара</option>
                            {variant.products.map((x) => (
                                <option key={x.id} value={x.id}>
                                    {x.name}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                <dl className={styles.details}>
                    <dt>Бренд</dt>
                    <dd>{sku?.brand ?? 'Нет данных'}</dd>
                    <dt>Фасовка</dt>
                    <dd>
                        {sku?.packageQuantity != null
                            ? `${sku.packageQuantity} ${units[sku.packageUnit]}`
                            : 'Нет данных'}
                    </dd>
                    <dt>Штрихкод товара</dt>
                    <dd>{sku?.barcodes.length ? sku.barcodes.join(', ') : 'Нет данных'}</dd>
                    <dt>Категория</dt>
                    <dd>{product.categoryCode}</dd>
                </dl>
                {contains.length > 0 && (
                    <p className={`${styles.notice} ${styles.danger}`}>
                        Содержит аллерген: {contains.map((x) => x.name).join(', ')}
                    </p>
                )}
            </section>
            <div className={productStyles.tabs} aria-label="Сведения о продукте">
                {tabs.map(([value, label]) => (
                    <button
                        className="button outline"
                        key={value}
                        aria-pressed={tab === value}
                        onClick={() => update({ tab: value === 'about' ? null : value })}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <section className={styles.card} aria-live="polite">
                <h2>{tabs.find(([value]) => value === tab)?.[1]}</h2>
                {tab === 'about' && (
                    <>
                        <p>{nutrition?.compositionText ?? 'Описание и состав пока не указаны.'}</p>
                        <p>Другие названия: {product.aliases.length ? product.aliases.join(', ') : 'Нет данных'}</p>
                        <p>
                            Базовая единица: {units[product.defaultUnit]}. Масса и объём не пересчитываются без данных о
                            плотности; фасовка неизвестного размера не равна одной штуке.
                        </p>
                    </>
                )}
                {tab === 'nutrition' && (
                    <>
                        <p>
                            {nutrition
                                ? `На ${nutrition.basisQuantity} ${units[nutrition.basisUnit]}`
                                : 'Базис пищевой ценности неизвестен'}
                        </p>
                        <dl className={productStyles.nutrients}>
                            {(
                                [
                                    ['kcal', 'Калории', 'ккал'],
                                    ['protein', 'Белки', 'г'],
                                    ['fat', 'Жиры', 'г'],
                                    ['carbs', 'Углеводы', 'г'],
                                ] as const
                            ).map(([key, label, unit]) => (
                                <div key={key}>
                                    <dt>{label}</dt>
                                    <dd>{nutrition?.[key] != null ? `${nutrition[key]} ${unit}` : 'Нет данных'}</dd>
                                </div>
                            ))}
                        </dl>
                    </>
                )}
                {tab === 'allergens' && (
                    <>
                        <p>{nutrition?.compositionText ?? 'Состав неизвестен.'}</p>
                        {allergens.length === 0 ? (
                            <p>
                                Данные об аллергенах отсутствуют. Это не означает, что продукт безопасен при аллергии.
                            </p>
                        ) : (
                            <ul>
                                {allergens.map((x) => (
                                    <li key={x.code}>
                                        {x.name}:{' '}
                                        {x.status === 'contains'
                                            ? 'содержит'
                                            : x.status === 'may_contain'
                                              ? 'может содержать'
                                              : 'неизвестно'}{' '}
                                        · источник: {x.source || 'не указан'}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                )}
                {tab === 'source' && (
                    <dl className={styles.details}>
                        <dt>Каталог</dt>
                        <dd>{product.provenance || 'Источник не указан'}</dd>
                        <dt>Пищевая ценность</dt>
                        <dd>{nutrition?.source ?? 'Нет данных'}</dd>
                        <dt>Версия</dt>
                        <dd>{product.version}</dd>
                        <dt>Проверка</dt>
                        <dd>{product.status === 'pending' ? 'Ожидает модерации' : 'Проверенный каталог'}</dd>
                    </dl>
                )}
            </section>
        </div>
    );
}
function Content({ id }: { id: string }) {
    const { api } = useRuntime();
    const user = useSession('user');
    const query = useQuery({
        queryKey: ['product', user.data?.id, id],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/products/{id}', undefined, signal, { id })).data.product,
    });
    const batches = useQuery({
        queryKey: ['inventory', 'product', user.data?.id, id],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (
                await api!.request('GET /api/v1/inventory', undefined, signal, undefined, {
                    query: { ingredientId: id, localDate: localDate(), limit: '100' },
                })
            ).data,
    });
    const locations = useQuery({
        queryKey: ['inventory-locations', user.data?.id],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/inventory-locations', undefined, signal)).data.items,
    });
    if (query.isPending) return <Loading />;
    if (query.isError) return <Failure error={query.error} retry={() => void query.refetch()} />;
    const product = query.data;
    return (
        <>
            <Link href="/inventory">← К запасам</Link>
            <h1>{product.name}</h1>
            {product.status === 'pending' && (
                <p className={styles.notice}>
                    Ваш продукт ожидает проверки модератором. Вы уже можете использовать его в личных запасах; в общий
                    каталог он ещё не опубликован.
                </p>
            )}
            <div className={styles.columns}>
                <Info key={product.id} product={product} />
                <aside className={styles.history}>
                    <section className={styles.card}>
                        <Link
                            className="button primary"
                            href={`/inventory/new?name=${encodeURIComponent(product.name)}`}
                        >
                            Добавить в запасы
                        </Link>
                        <p>Укажите количество, срок и место хранения новой партии.</p>
                    </section>
                    <section className={styles.card}>
                        <h2>У меня в запасах</h2>
                        <p className={styles.muted}>Только ваши личные партии</p>
                        {batches.isPending ? (
                            <Loading />
                        ) : batches.isError ? (
                            <Failure error={batches.error} retry={() => void batches.refetch()} />
                        ) : batches.data.items.length === 0 ? (
                            <p>Пока нет активных партий этого продукта.</p>
                        ) : (
                            <>
                                {batches.data.items.map((batch) => (
                                    <article className={styles.card} key={batch.id}>
                                        <Link href={`/inventory/batches/${batch.id}`}>{batch.name}</Link>
                                        <strong>
                                            {batch.quantity === null
                                                ? 'Количество неизвестно'
                                                : `${batch.quantity} ${units[batch.unit]}`}
                                        </strong>
                                        <p>
                                            {expiryText(batch.expiryOn)} · {dateText(batch.expiryOn)}
                                        </p>
                                        <p>
                                            {locations.data?.find((x) => x.id === batch.locationId)?.name ??
                                                'Место не указано'}
                                        </p>
                                    </article>
                                ))}
                                {batches.data.total > batches.data.items.length && (
                                    <p>
                                        Показаны {batches.data.items.length} из {batches.data.total} партий. Остальные
                                        доступны в реестре.
                                    </p>
                                )}
                            </>
                        )}
                    </section>
                </aside>
            </div>
        </>
    );
}
export function ProductDetailPage({ id }: { id: string }) {
    return (
        <InventoryShell>
            <Content key={id} id={id} />
        </InventoryShell>
    );
}
