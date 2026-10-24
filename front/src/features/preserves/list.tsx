'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRuntime } from '../../app/providers.js';
import { useSession } from '../auth/session.js';
import { localDate, units } from '../inventory/shared.js';
import { PreserveShell, PreserveLoading, expiryLabel, dayText } from './shared.js';
import { RecipeImage } from '../recipes/shared.js';
import { PreserveForm } from './form.js';
import { preserveTypes } from './types.js';
import styles from './preserves.module.css';
function Content({ scope }: { scope: 'private' | 'family' }) {
    const { api } = useRuntime();
    const user = useSession('user');
    const router = useRouter();
    const search = useSearchParams();
    const query = Object.fromEntries(
        ['q', 'type', 'locationId', 'status', 'attention', 'page'].flatMap((k) =>
            search.get(k) ? [[k, search.get(k)!]] : [],
        ),
    );
    const list = useQuery({
        queryKey: ['preserves', user.data?.id, scope, 'list', query],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (
                await api!.request('GET /api/v1/preserves', undefined, signal, undefined, {
                    query: { ...query, localDate: localDate(), limit: '20', scope },
                })
            ).data,
    });
    const locations = useQuery({
        queryKey: ['inventory-locations', user.data?.id, scope],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/inventory-locations', undefined, signal, undefined, { query: { scope } }))
                .data,
    });
    function href(patch: Record<string, string>) {
        const next = new URLSearchParams(search);
        for (const [k, v] of Object.entries(patch)) {
            if (v) next.set(k, v);
            else next.delete(k);
        }
        if (!('page' in patch)) next.delete('page');
        const base = scope === 'family' ? '/family/preserves' : '/preserves';
        return `${base}${next.size ? '?' + next.toString() : ''}`;
    }
    const base = scope === 'family' ? '/family/preserves' : '/preserves';
    const returnTo = `${base}${search.size ? '?' + search.toString() : ''}`;
    return (
        <>
            <div className={styles.heading}>
                <div>
                    <h1>{scope === 'family' ? 'Заготовки семьи' : 'Мои заготовки'}</h1>
                    <p>
                        {scope === 'family' ? 'Общие домашние заготовки семьи' : 'Домашние заготовки в личных запасах'}
                    </p>
                </div>
                <Link className="button primary" href={href({ create: '1' })}>
                    Добавить заготовку
                </Link>
            </div>
            {search.get('create') === '1' && (
                <PreserveForm
                    recipeRevisionId={search.get('recipeRevisionId')}
                    scope={scope}
                    onCancel={() => router.push(href({ create: '' }))}
                    onSaved={(p) => router.push(`${base}/${p.id}`)}
                />
            )}
            <div className={styles.filters}>
                <label className={styles.field}>
                    Поиск
                    <input
                        value={search.get('q') ?? ''}
                        onChange={(e) => router.replace(href({ q: e.target.value }), { scroll: false })}
                        placeholder="Поиск по заготовкам"
                    />
                </label>
                <label className={styles.field}>
                    Тип
                    <select
                        value={search.get('type') ?? ''}
                        onChange={(e) => router.push(href({ type: e.target.value }))}
                    >
                        <option value="">Все типы</option>
                        {Object.entries(preserveTypes).map(([k, v]) => (
                            <option key={k} value={k}>
                                {v}
                            </option>
                        ))}
                    </select>
                </label>
                <label className={styles.field}>
                    Срок
                    <select
                        value={search.get('attention') ?? 'all'}
                        onChange={(e) => router.push(href({ attention: e.target.value }))}
                    >
                        <option value="all">Все сроки</option>
                        <option value="expiring">Требует внимания: до 14 дней</option>
                        <option value="expired">Срок прошёл</option>
                        <option value="unknown">Срок не указан</option>
                    </select>
                </label>
            </div>
            <nav className={styles.tabs} aria-label="Место хранения">
                <Link href={href({ locationId: '' })} aria-current={!search.get('locationId') ? 'page' : undefined}>
                    Все места
                </Link>
                {locations.data?.items.map((l) => (
                    <Link
                        key={l.id}
                        href={href({ locationId: l.id })}
                        aria-current={search.get('locationId') === l.id ? 'page' : undefined}
                    >
                        {l.name}
                    </Link>
                ))}
                <Link
                    href={href({ locationId: 'none' })}
                    aria-current={search.get('locationId') === 'none' ? 'page' : undefined}
                >
                    Место не указано
                </Link>
            </nav>
            <nav className={styles.tabs} aria-label="Состояние заготовок">
                {[
                    ['active', 'Активные'],
                    ['archived', 'Архив'],
                    ['all', 'Все'],
                ].map(([k, v]) => (
                    <Link
                        key={k}
                        href={href({ status: k! })}
                        aria-current={(search.get('status') ?? 'active') === k ? 'page' : undefined}
                    >
                        {v}
                    </Link>
                ))}
            </nav>
            {!!list.data?.attentionCount && (
                <Link href={href({ attention: 'expiring' })}>Требует внимания · {list.data.attentionCount}</Link>
            )}
            {list.isPending ? (
                <PreserveLoading />
            ) : list.isError ? (
                <section role="alert" className={styles.panel}>
                    Не удалось загрузить заготовки.<button onClick={() => void list.refetch()}>Повторить</button>
                </section>
            ) : (
                <>
                    <div className={styles.panel}>
                        {!list.data.items.length && <p>Заготовок по выбранным условиям нет.</p>}
                        {Object.entries(preserveTypes).map(([type, title]) => {
                            const items = list.data.items.filter((p) => p.type === type);
                            return items.length ? (
                                <section key={type}>
                                    <h2>{title}</h2>
                                    {items.map((p) => (
                                        <Link
                                            className={styles.row}
                                            key={p.id}
                                            href={`${base}/${p.id}?returnTo=${encodeURIComponent(returnTo)}`}
                                        >
                                            <span className={styles.identity}>
                                                <RecipeImage src={p.imageUrl} alt={p.name} className={styles.thumb} />
                                                <span>
                                                    <strong>{p.name}</strong>
                                                    {p.archivedAt
                                                        ? 'В архиве'
                                                        : p.quantity === '0'
                                                          ? 'Полностью использована'
                                                          : p.containers.some((c) => c.openedAt)
                                                            ? 'Есть открытые банки'
                                                            : 'Не открыто'}
                                                </span>
                                            </span>
                                            <span>
                                                {p.quantity === null
                                                    ? 'Количество не указано'
                                                    : `${p.quantity} ${p.unit ? units[p.unit] : ''}`}
                                            </span>
                                            <span>
                                                {locations.data?.items.find((l) => l.id === p.locationId)?.name ??
                                                    'Место не указано'}
                                                <br />
                                                Приготовлено {dayText(p.createdOn)}
                                            </span>
                                            <span>{expiryLabel(p.expiryOn, localDate())}</span>
                                        </Link>
                                    ))}
                                </section>
                            ) : null;
                        })}
                    </div>
                    <nav className={styles.actions} aria-label="Страницы">
                        <button
                            disabled={list.data.page <= 1}
                            onClick={() => router.push(href({ page: String(list.data.page - 1) }))}
                        >
                            Назад
                        </button>
                        <span>
                            Страница {list.data.page} · Всего {list.data.total}
                        </span>
                        <button
                            disabled={list.data.page * list.data.limit >= list.data.total}
                            onClick={() => router.push(href({ page: String(list.data.page + 1) }))}
                        >
                            Далее
                        </button>
                    </nav>
                </>
            )}
        </>
    );
}
export function PreservesPage({ scope = 'private' }: { scope?: 'private' | 'family' }) {
    return (
        <PreserveShell scope={scope}>
            <Content scope={scope} />
        </PreserveShell>
    );
}
