'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useRuntime } from '../../app/providers.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { Guard, useSession } from '../auth/session.js';
import { PersonalShell } from '../personalization/shell.js';
import { RecipeImage, Rating, categoryLabels } from '../recipes/shared.js';
import styles from './search.module.css';

type SearchType = 'product' | 'recipe' | 'brand' | 'store';
type SearchData = Success<'GET /api/v1/search'>['data'];
type SearchItem = SearchData['items'][number];
type SearchTab = 'all' | SearchType;

const tabs: { value: SearchTab; label: string }[] = [
    { value: 'all', label: 'Все' },
    { value: 'product', label: 'Продукты' },
    { value: 'recipe', label: 'Рецепты' },
    { value: 'brand', label: 'Бренды' },
    { value: 'store', label: 'Магазины' },
];

const sectionTitles: Record<SearchType, string> = {
    product: 'Продукты',
    recipe: 'Рецепты',
    brand: 'Бренды',
    store: 'Магазины',
};

const unitLabels: Record<string, string> = {
    g: 'г',
    kg: 'кг',
    ml: 'мл',
    l: 'л',
    pcs: 'шт.',
    pack: 'уп.',
};

function resultHref(tab: SearchTab, query: string) {
    const params = new URLSearchParams({ q: query });
    if (tab !== 'all') params.set('type', tab);
    return `/search?${params.toString()}`;
}

function ResultCard({ item, returnTo }: { item: SearchItem; returnTo: string }) {
    if (item.type === 'product')
        return (
            <article className={styles.card}>
                <div>
                    <p className={styles.eyebrow}>Продукт</p>
                    <h3>
                        <Link href={`/products/${item.id}`}>{item.name}</Link>
                    </h3>
                    <p>
                        {item.categoryCode} · базовая единица {unitLabels[item.defaultUnit] ?? item.defaultUnit}
                    </p>
                </div>
                {item.status === 'pending' && <span className={styles.pending}>Ваше предложение на проверке</span>}
            </article>
        );
    if (item.type === 'recipe')
        return (
            <article className={`${styles.card} ${styles.recipe}`}>
                <RecipeImage src={item.imageUrl} alt={item.title} className={styles.image} />
                <div>
                    <p className={styles.eyebrow}>
                        {item.category ? (categoryLabels[item.category] ?? item.category) : 'Категория не указана'}
                    </p>
                    <h3>
                        <Link href={`/recipes/${item.id}?returnTo=${encodeURIComponent(returnTo)}`}>{item.title}</Link>
                    </h3>
                    <p>{item.description || 'Описание пока не добавлено.'}</p>
                    <p className={styles.meta}>
                        {item.durationMinutes} мин · <Rating rating={item.rating} count={item.ratingCount} /> · @
                        {item.authorLogin}
                    </p>
                </div>
            </article>
        );
    if (item.type === 'brand')
        return (
            <article className={styles.card}>
                <div>
                    <p className={styles.eyebrow}>Бренд</p>
                    <h3>{item.name}</h3>
                    <p>
                        {item.productCount === 1
                            ? '1 доступный продукт'
                            : `${item.productCount.toLocaleString('ru-RU')} доступных продуктов`}
                    </p>
                </div>
            </article>
        );
    return (
        <article className={styles.card}>
            <div>
                <p className={styles.eyebrow}>Магазин</p>
                <h3>{item.name}</h3>
                <p>Карточка магазина из каталога.</p>
            </div>
        </article>
    );
}

function SearchSection({ type, query, compact }: { type: SearchType; query: string; compact: boolean }) {
    const { api } = useRuntime();
    const session = useSession('user');
    const search = useSearchParams();
    const pathname = usePathname();
    const limit = compact ? 4 : 20;
    const request = useInfiniteQuery({
        queryKey: ['unified-search', session.data?.id, type, query, limit],
        enabled: !!api && !!session.data && !!query,
        initialPageParam: null as string | null,
        queryFn: async ({ pageParam, signal }) =>
            (
                await api!.request('GET /api/v1/search', undefined, signal, undefined, {
                    query: {
                        type,
                        q: query,
                        limit: String(limit),
                        ...(pageParam ? { cursor: pageParam } : {}),
                    },
                })
            ).data,
        getNextPageParam: (page) => page.nextCursor ?? undefined,
    });
    const items =
        request.data?.pages.reduce<SearchItem[]>((all, page) => {
            all.push(...(page.items as SearchItem[]));
            return all;
        }, []) ?? [];
    const returnTo = `${pathname}${search.size ? `?${search.toString()}` : ''}`;
    return (
        <section className={styles.section} aria-labelledby={`search-${type}`}>
            <div className={styles['section-heading']}>
                <h2 id={`search-${type}`}>{sectionTitles[type]}</h2>
                {compact && items.length > 0 && <Link href={resultHref(type, query)}>Все результаты</Link>}
            </div>
            {request.isPending && <p role="status">Ищем…</p>}
            {request.isError && !request.data && (
                <div className={styles.state} role="alert">
                    <p>Не удалось загрузить этот раздел.</p>
                    <button className="button outline" onClick={() => void request.refetch()}>
                        Повторить
                    </button>
                </div>
            )}
            {request.isSuccess && items.length === 0 && (
                <p className={styles.empty}>По вашему запросу здесь ничего не найдено.</p>
            )}
            <div className={styles.results}>
                {items.map((item) => (
                    <ResultCard key={`${item.type}:${item.id}`} item={item} returnTo={returnTo} />
                ))}
            </div>
            {!compact && request.isFetchNextPageError && (
                <p role="alert">Не удалось загрузить следующую часть результатов.</p>
            )}
            {!compact && request.hasNextPage && (
                <button
                    className="button outline"
                    disabled={request.isFetchingNextPage}
                    onClick={() => void request.fetchNextPage()}
                >
                    {request.isFetchingNextPage ? 'Загружаем…' : 'Показать ещё'}
                </button>
            )}
            {type === 'store' && items.length > 0 && (
                <p className={styles.notice}>
                    Магазин найден в каталоге. Это не подтверждает наличие конкретного товара или доставку.
                </p>
            )}
        </section>
    );
}

function SearchForm({ active, query }: { active: SearchTab; query: string }) {
    const router = useRouter();
    const [draft, setDraft] = useState(query);
    useEffect(() => {
        const next = draft.trim().slice(0, 200);
        if (next === query) return;
        const timer = window.setTimeout(() => {
            router.replace(next ? resultHref(active, next) : '/search');
        }, 350);
        return () => window.clearTimeout(timer);
    }, [active, draft, query, router]);
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const next = draft.trim().slice(0, 200);
        if (!next) {
            router.push('/search');
            return;
        }
        router.push(resultHref(active, next));
    };
    return (
        <form className={styles.search} role="search" onSubmit={submit}>
            <label htmlFor="global-search">Поиск</label>
            <div>
                <input
                    id="global-search"
                    type="search"
                    value={draft}
                    maxLength={200}
                    placeholder="Например, рис или быстрый завтрак"
                    onChange={(event) => setDraft(event.target.value)}
                />
                <button className="button" type="submit">
                    Найти
                </button>
            </div>
        </form>
    );
}

function SearchContent() {
    const search = useSearchParams();
    const query = (search.get('q') ?? '').trim().slice(0, 200);
    const rawType = search.get('type');
    const active: SearchTab = tabs.some((tab) => tab.value === rawType) ? (rawType as SearchTab) : 'all';
    return (
        <div className={styles.page}>
            <header className={styles.hero}>
                <p className={styles.eyebrow}>Единый поиск</p>
                <h1>Что вы ищете?</h1>
                <p>Найдите продукты, рецепты, бренды и магазины в доступном вам каталоге.</p>
                <SearchForm key={`${active}:${query}`} active={active} query={query} />
            </header>

            <nav className={styles.tabs} aria-label="Тип результатов">
                {tabs.map((tab) => (
                    <Link
                        key={tab.value}
                        href={
                            query
                                ? resultHref(tab.value, query)
                                : tab.value === 'all'
                                  ? '/search'
                                  : `?type=${tab.value}`
                        }
                        aria-current={active === tab.value ? 'page' : undefined}
                    >
                        {tab.label}
                    </Link>
                ))}
            </nav>

            {!query ? (
                <section className={styles.state}>
                    <h2>Начните с запроса</h2>
                    <p>Поиск ничего не изменяет и показывает только доступные вашему аккаунту данные.</p>
                </section>
            ) : active === 'all' ? (
                <div className={styles.sections}>
                    {(['product', 'recipe', 'brand', 'store'] as const).map((type) => (
                        <SearchSection key={type} type={type} query={query} compact />
                    ))}
                </div>
            ) : (
                <SearchSection type={active} query={query} compact={false} />
            )}

            {query && (
                <aside className={styles.ai}>
                    <div>
                        <p className={styles.eyebrow}>AI-помощник</p>
                        <h2>Нужен ответ на естественный запрос?</h2>
                        <p>
                            Откройте отдельный AI-сценарий. Перед любым платным запуском мы покажем стоимость и попросим
                            подтверждение.
                        </p>
                    </div>
                    <Link className="button outline" href="/ai">
                        Перейти к предпросмотру
                    </Link>
                </aside>
            )}
        </div>
    );
}

export function SearchPage() {
    return (
        <Guard context="user">
            <PersonalShell>
                <SearchContent />
            </PersonalShell>
        </Guard>
    );
}
