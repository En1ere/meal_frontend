'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRuntime } from '../../shared/runtime/index.js';
import { useSession } from '../../entities/session/client.js';
import { units } from '../../entities/measurement/model.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import {
    ShoppingShell,
    ShoppingLoading,
    statusLabels,
    shoppingBase,
    receiptBase,
    useShoppingScope,
    type ShoppingScope,
} from './shared.js';
import { useShoppingCommand } from './use-command.js';
import { ItemForm } from './item-form.js';
import { PurchaseReview, emptyPurchaseLine } from './purchase-review.js';
import styles from './shopping.module.css';
import { readOfflineOwner } from '../../entities/offline/store.js';
import { readOfflineSnapshotData, saveOfflineSnapshot } from '../../entities/offline/snapshots.js';
import { CostEstimateBadge } from '../../entities/finance-cost/client.js';
type List = Success<'GET /api/v1/shopping-lists/{id}'>['data'];
function Content({ id }: { id?: string }) {
    const scope = useShoppingScope();
    const base = shoppingBase(scope);
    const { api } = useRuntime();
    const user = useSession('user');
    const router = useRouter();
    const search = useSearchParams();
    const cmd = useShoppingCommand();
    const owner = user.data?.id ?? readOfflineOwner();
    const [title, setTitle] = useState(''),
        [editing, setEditing] = useState<string | null>(null),
        [review, setReview] = useState(false);
    const query = {
        q: search.get('q') ?? '',
        status: search.get('status') ?? 'active',
        ...(search.get('cursor') ? { cursor: search.get('cursor')! } : {}),
        scope,
    };
    const lists = useQuery({
        queryKey: ['shopping', owner, 'lists', query],
        enabled: !!api && !!owner && !id,
        queryFn: async ({ signal }) => {
            const key = `shopping:lists:${JSON.stringify(query)}`;
            if (!navigator.onLine && scope === 'private') {
                const cached = await readOfflineSnapshotData<Success<'GET /api/v1/shopping-lists'>['data']>(
                    owner!,
                    key,
                );
                if (!cached) throw new Error('Этот список не сохранён для offline-доступа.');
                return cached;
            }
            const data = (await api!.request('GET /api/v1/shopping-lists', undefined, signal, undefined, { query }))
                .data;
            if (scope === 'private') await saveOfflineSnapshot(owner!, key, data);
            return data;
        },
    });
    const detail = useQuery({
        queryKey: ['shopping', owner, scope, id],
        enabled: !!api && !!owner && !!id,
        queryFn: async ({ signal }) => {
            const key = `shopping:${id}`;
            if (!navigator.onLine && scope === 'private') {
                const cached = await readOfflineSnapshotData<List>(owner!, key);
                if (!cached) throw new Error('Этот список не сохранён для offline-доступа.');
                return cached;
            }
            const data = (
                await api!.request(
                    'GET /api/v1/shopping-lists/{id}',
                    undefined,
                    signal,
                    { id: id! },
                    { query: { scope } },
                )
            ).data;
            if (scope === 'private') await saveOfflineSnapshot(owner!, key, data);
            return data;
        },
    });
    const history = useQuery({
        queryKey: ['shopping', owner, scope, id, 'history'],
        enabled: !!api && !!owner && !!id && typeof navigator !== 'undefined' && navigator.onLine,
        queryFn: async ({ signal }) =>
            (
                await api!.request(
                    'GET /api/v1/shopping-lists/{id}/history',
                    undefined,
                    signal,
                    { id: id! },
                    { query: { scope } },
                )
            ).data,
    });
    const recipeId = search.get('recipeId');
    const servings = String(Math.max(1, Math.min(1000, Number(search.get('servings')) || 1)));
    const recipe = useQuery({
        queryKey: ['shopping', user.data?.id, 'recipe-preview', recipeId, servings],
        enabled: !!api && !!recipeId,
        queryFn: async ({ signal }) =>
            (
                await api!.request('GET /api/v1/shopping-lists/recipe-preview', undefined, signal, undefined, {
                    query: { recipeId: recipeId!, servings, scope },
                })
            ).data,
    });
    const href = (patch: Record<string, string>) => {
        const p = new URLSearchParams(search);
        for (const [k, v] of Object.entries(patch)) {
            if (v) p.set(k, v);
            else p.delete(k);
        }
        if (!('cursor' in patch)) p.delete('cursor');
        return `${base}${p.size ? '?' + p.toString() : ''}`;
    };
    async function create() {
        const r = await cmd.run('POST /api/v1/shopping-lists', { title });
        if (r) router.push(`${base}/${r.id}${recipeId ? `?recipeId=${recipeId}&servings=${servings}` : ''}`);
    }
    async function action(action: 'rename' | 'complete' | 'reopen' | 'archive' | 'restore') {
        if (!detail.data || !id) return;
        await cmd.run(
            'POST /api/v1/shopping-lists/{id}/command',
            { version: detail.data.version, action, ...(action === 'rename' ? { title } : {}) },
            { id },
        );
    }
    async function editStatus(item: List['items'][number], status: 'pending' | 'purchased' | 'removed') {
        const {
            name,
            quantity,
            unit,
            ingredientId,
            productId,
            allowAnalog,
            requirements,
            estimatedPriceMinor,
            recipeOrigin,
        } = item;
        await cmd.run(
            'POST /api/v1/shopping-lists/{id}/items/{itemId}',
            {
                version: item.version,
                status,
                fields: {
                    name,
                    quantity,
                    unit,
                    ingredientId,
                    productId,
                    allowAnalog,
                    requirements,
                    recipeOrigin,
                    estimatedPriceMinor,
                },
            },
            { id: id!, itemId: item.id },
        );
    }
    async function move(index: number, delta: number) {
        if (!detail.data) return;
        const ids = detail.data.items.map((i) => i.id);
        [ids[index], ids[index + delta]] = [ids[index + delta]!, ids[index]!];
        await cmd.run(
            'POST /api/v1/shopping-lists/{id}/reorder',
            { version: detail.data.version, itemIds: ids },
            { id: id! },
        );
    }
    return (
        <>
            <Link href={id ? base : scope === 'family' ? '/family' : '/'}>
                ← {id ? 'Покупки' : scope === 'family' ? 'Семья' : 'Дом'}
            </Link>
            <div className={styles.heading}>
                <h1>{id ? (detail.data?.title ?? 'Список покупок') : 'Списки покупок'}</h1>
                <Link className="button outline" href={`${receiptBase(scope)}/new`}>
                    Добавить из чека
                </Link>
            </div>
            <p>{scope === 'family' ? 'Общие списки семьи · Plus' : 'Личные списки · Free'}</p>
            {id && scope === 'private' && (
                <CostEstimateBadge route="GET /api/v1/finance/costs/shopping-lists/{id}" id={id} />
            )}
            {cmd.error && <p role="alert">{cmd.error}</p>}
            {cmd.unknown && (
                <button disabled={cmd.pending} onClick={() => void cmd.retry()}>
                    Повторить прежний запрос
                </button>
            )}
            {recipeId && (
                <section className={styles.panel}>
                    <h2>Добавление из рецепта · {servings} порций</h2>
                    {recipe.isPending ? (
                        <ShoppingLoading />
                    ) : recipe.isError ? (
                        <p role="alert">Не удалось получить потребность рецепта.</p>
                    ) : (
                        <>
                            <ul>
                                {recipe.data.items.map((i, n) => (
                                    <li key={n}>
                                        {i.name}: {i.quantity ?? 'Проверьте количество'} {i.unit ?? ''}
                                    </li>
                                ))}
                            </ul>
                            {id && detail.data ? (
                                <button
                                    disabled={cmd.pending || detail.data.status !== 'active'}
                                    onClick={() =>
                                        void (async () => {
                                            const r = await cmd.run(
                                                'POST /api/v1/shopping-lists/{id}/items',
                                                {
                                                    version: detail.data.version,
                                                    items: recipe.data.items.map(({ needsQuantityCheck, ...i }) => {
                                                        void needsQuantityCheck;
                                                        return i;
                                                    }),
                                                },
                                                { id },
                                            );
                                            if (r) router.replace(`${base}/${id}`);
                                        })()
                                    }
                                >
                                    Подтвердить добавление
                                </button>
                            ) : (
                                <p>Выберите список или создайте новый.</p>
                            )}
                        </>
                    )}
                </section>
            )}
            {!id ? (
                <>
                    <form
                        className={styles.actions}
                        onSubmit={(e) => {
                            e.preventDefault();
                            void create();
                        }}
                    >
                        <label className={styles.field}>
                            Новый список
                            <input
                                required
                                value={title}
                                maxLength={200}
                                disabled={cmd.pending || cmd.unknown}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </label>
                        <button disabled={cmd.pending}>Создать список</button>
                    </form>
                    <label className={styles.field}>
                        Поиск
                        <input value={query.q} onChange={(e) => router.replace(href({ q: e.target.value }))} />
                    </label>
                    <nav className={styles.tabs}>
                        {[
                            ['active', 'Активные'],
                            ['completed', 'Завершённые'],
                            ['archived', 'В архиве'],
                            ['all', 'Все'],
                        ].map(([k, v]) => (
                            <Link
                                key={k}
                                href={href({ status: k! })}
                                aria-current={query.status === k ? 'page' : undefined}
                            >
                                {v}
                            </Link>
                        ))}
                    </nav>
                    <div className={styles.detail}>
                        <section>
                            {lists.isPending ? (
                                <ShoppingLoading />
                            ) : lists.isError ? (
                                <div role="alert">
                                    Не удалось загрузить списки.
                                    <button onClick={() => void lists.refetch()}>Повторить</button>
                                </div>
                            ) : (
                                <>
                                    <div className={styles.cards}>
                                        {lists.data.items.map((l) => (
                                            <article className={styles.card} key={l.id}>
                                                <span className={styles.label}>{statusLabels[l.status]}</span>
                                                <h2>{l.title}</h2>
                                                <p>
                                                    {l.createdAt
                                                        ? new Date(l.createdAt).toLocaleDateString('ru-RU')
                                                        : 'Дата не указана'}
                                                </p>
                                                {l.progress && (
                                                    <>
                                                        <p>
                                                            Куплено {l.progress.purchased} из {l.progress.total}
                                                        </p>
                                                        <progress
                                                            max={Math.max(1, l.progress.total)}
                                                            value={l.progress.purchased}
                                                        />
                                                    </>
                                                )}
                                                <Link
                                                    className="button primary"
                                                    href={`${base}/${l.id}${recipeId ? `?recipeId=${recipeId}&servings=${servings}` : ''}`}
                                                >
                                                    Открыть список
                                                </Link>
                                            </article>
                                        ))}
                                    </div>
                                    {!lists.data.items.length && <p>Списков по выбранным условиям нет.</p>}
                                    <div className={styles.actions}>
                                        {query.cursor && <Link href={href({ cursor: '' })}>К началу</Link>}
                                        {lists.data.nextCursor && (
                                            <Link href={href({ cursor: lists.data.nextCursor })}>
                                                Следующая страница
                                            </Link>
                                        )}
                                    </div>
                                </>
                            )}
                        </section>
                        <aside className={`${styles.panel} ${styles.summary}`}>
                            <h2>Покупки под контролем</h2>
                            <p>Отмечайте покупки в списке. Поступление в запасы подтверждается отдельно.</p>
                            {scope === 'family' ? (
                                <>
                                    <h3>Общие списки семьи · Plus</h3>
                                    <p>Списки, покупки и поступления доступны всем активным участникам семьи.</p>
                                </>
                            ) : (
                                <>
                                    <h3>Семейные списки · Plus</h3>
                                    <p>Личные списки изолированы от общей семейной области.</p>
                                </>
                            )}
                        </aside>
                    </div>
                </>
            ) : detail.isPending ? (
                <ShoppingLoading />
            ) : detail.isError ? (
                <section role="alert">
                    Список недоступен.<button onClick={() => void detail.refetch()}>Повторить</button>
                </section>
            ) : (
                <>
                    <div className={styles.actions}>
                        <span className={styles.label}>{statusLabels[detail.data.status]}</span>
                        <button onClick={() => void detail.refetch()}>Перечитать, сохранив ввод</button>
                    </div>
                    {editing && (
                        <ItemForm
                            listId={id}
                            listVersion={detail.data.version}
                            {...(editing !== 'new' && detail.data.items.find((i) => i.id === editing)
                                ? { item: detail.data.items.find((i) => i.id === editing)! }
                                : {})}
                            onDone={() => setEditing(null)}
                        />
                    )}
                    <div className={styles.detail}>
                        <section className={styles.panel}>
                            <h2>Товары</h2>
                            {detail.data.items.map((item, index) => (
                                <div className={styles.line} key={item.id}>
                                    <label className={styles.check}>
                                        <input
                                            type="checkbox"
                                            checked={item.status === 'purchased'}
                                            disabled={detail.data.status !== 'active' || cmd.pending || cmd.unknown}
                                            onChange={() =>
                                                void editStatus(
                                                    item,
                                                    item.status === 'purchased' ? 'pending' : 'purchased',
                                                )
                                            }
                                        />
                                        <strong>{item.name}</strong>
                                    </label>
                                    <span>
                                        {item.quantity ?? 'Количество неизвестно'}{' '}
                                        {item.unit ? (units[item.unit] ?? item.unit) : ''}
                                        <br />
                                        {item.manual ? 'Вручную' : 'Из рецепта'}
                                        {item.allocatedQuantity !== null && ` · Зачтено ${item.allocatedQuantity}`}
                                    </span>
                                    <div className={styles.actions}>
                                        <button
                                            disabled={detail.data.status !== 'active' || cmd.pending}
                                            onClick={() => setEditing(item.id)}
                                        >
                                            Изменить
                                        </button>
                                        <button
                                            disabled={detail.data.status !== 'active' || cmd.pending || index === 0}
                                            onClick={() => void move(index, -1)}
                                        >
                                            Выше
                                        </button>
                                        <button
                                            disabled={
                                                detail.data.status !== 'active' ||
                                                cmd.pending ||
                                                index === detail.data.items.length - 1
                                            }
                                            onClick={() => void move(index, 1)}
                                        >
                                            Ниже
                                        </button>
                                        <button
                                            disabled={detail.data.status !== 'active' || cmd.pending}
                                            onClick={() => void editStatus(item, 'removed')}
                                        >
                                            Убрать
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {!detail.data.items.length && <p>Список пока пуст.</p>}
                            <button disabled={detail.data.status !== 'active'} onClick={() => setEditing('new')}>
                                Добавить товар
                            </button>
                        </section>
                        <aside className={`${styles.panel} ${styles.summary}`}>
                            <h2>Итого по списку</h2>
                            <p>
                                {detail.data.items.filter((i) => i.status === 'purchased').length} из{' '}
                                {detail.data.items.length} куплено
                            </p>
                            <p>Стоимость не рассчитана. Финансовый учёт в Free не создаётся.</p>
                            <label className={styles.field}>
                                Название
                                <input
                                    disabled={cmd.pending || detail.data.status === 'archived'}
                                    value={title}
                                    placeholder={detail.data.title}
                                    onChange={(e) => setTitle(e.target.value)}
                                />
                            </label>
                            <button
                                disabled={!title.trim() || cmd.pending || detail.data.status === 'archived'}
                                onClick={() => void action('rename')}
                            >
                                Переименовать
                            </button>
                            <button
                                disabled={cmd.pending}
                                onClick={() =>
                                    void action(
                                        detail.data.status === 'archived'
                                            ? 'restore'
                                            : detail.data.status === 'completed'
                                              ? 'reopen'
                                              : 'complete',
                                    )
                                }
                            >
                                {detail.data.status === 'archived'
                                    ? 'Восстановить'
                                    : detail.data.status === 'completed'
                                      ? 'Вернуть в активные'
                                      : 'Завершить список'}
                            </button>
                            {detail.data.status !== 'archived' && (
                                <button disabled={cmd.pending} onClick={() => void action('archive')}>
                                    В архив
                                </button>
                            )}
                            <button
                                disabled={detail.data.status !== 'active' || !detail.data.items.length}
                                onClick={() => setReview((v) => !v)}
                            >
                                Проверить покупку
                            </button>
                            <p>Завершение списка не архивирует его и не добавляет продукты в запас.</p>
                        </aside>
                    </div>
                    {review && (
                        <PurchaseReview
                            id={id}
                            kind="shopping"
                            version={detail.data.version}
                            initialLines={detail.data.items.map((i) => ({
                                ...emptyPurchaseLine(i.name),
                                quantity: i.quantity,
                                unit: i.unit,
                                ingredientId: i.ingredientId,
                                productId: i.productId,
                                shoppingItemId: i.id,
                            }))}
                            onDone={() => {
                                setReview(false);
                                void detail.refetch();
                            }}
                        />
                    )}
                    <section className={styles.panel}>
                        <h2>История изменений</h2>
                        {history.isPending ? (
                            <ShoppingLoading />
                        ) : history.isError ? (
                            <p role="alert">История временно недоступна.</p>
                        ) : history.data.items.length ? (
                            <ol>
                                {history.data.items.map((event) => (
                                    <li key={event.id}>
                                        {event.actorLogin ?? 'Системное действие'} · {event.action} ·{' '}
                                        {new Date(event.at).toLocaleString('ru-RU')}
                                    </li>
                                ))}
                            </ol>
                        ) : (
                            <p>Изменений пока нет.</p>
                        )}
                    </section>
                </>
            )}
        </>
    );
}
export function ShoppingPage({ id, scope = 'private' }: { id?: string; scope?: ShoppingScope }) {
    return (
        <ShoppingShell scope={scope}>
            <Content {...(id ? { id } : {})} />
        </ShoppingShell>
    );
}
