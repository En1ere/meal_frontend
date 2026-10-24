'use client';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRuntime } from '../../app/providers.js';
import { PublicShell } from '../public-info/public-shell.js';
import { RecipeImage, RecipeLoading, RecipeError, Rating } from '../recipes/shared.js';
import styles from '../recipes/recipes.module.css';

const categories = [
    ['breakfast', 'Завтраки'],
    ['soups', 'Супы'],
    ['mains', 'Основные блюда'],
    ['salads', 'Салаты'],
    ['baking', 'Выпечка'],
    ['desserts', 'Десерты'],
    ['snacks', 'Закуски'],
    ['sauces', 'Соусы'],
] as const;

export function PublicRecipeFeed({
    author,
    q = '',
    category = '',
    sort = 'newest',
    returnTo = '/community',
}: {
    author?: string;
    q?: string;
    category?: string;
    sort?: 'newest' | 'oldest';
    returnTo?: string;
}) {
    const { api } = useRuntime();
    const query = useInfiniteQuery({
        queryKey: ['community', author, q, category, sort],
        enabled: !!api,
        initialPageParam: null as string | null,
        queryFn: async ({ signal, pageParam }) =>
            (
                await api!.request('GET /api/v1/community', undefined, signal, undefined, {
                    query: {
                        q,
                        ...(category ? { category } : {}),
                        sort,
                        limit: '12',
                        ...(author ? { author } : {}),
                        ...(pageParam ? { cursor: pageParam } : {}),
                    },
                })
            ).data,
        getNextPageParam: (page) => page.nextCursor ?? undefined,
    });
    const items = query.data?.pages.flatMap((page) => page.items) ?? [];
    const unique = items.filter((item, index) => items.findIndex((other) => other.id === item.id) === index);
    if (query.isPending) return <RecipeLoading />;
    if (query.isError && !query.data) return <RecipeError error={query.error} retry={() => void query.refetch()} />;
    return (
        <div className={styles.stack}>
            {!unique.length && <p role="status">Опубликованные рецепты не найдены. Попробуйте изменить поиск.</p>}
            {!!unique.length && <h2 className={styles['feed-title']}>Все опубликованные</h2>}
            <div className={styles.cards}>
                {unique.map((recipe) => (
                    <article className={styles['recipe-card']} key={recipe.id}>
                        <Link
                            className={styles['card-link']}
                            href={`/recipes/${recipe.id}?returnTo=${encodeURIComponent(returnTo)}`}
                            aria-label={recipe.title}
                        />
                        <div className={styles['card-media']}>
                            <RecipeImage src={recipe.imageUrl} alt={recipe.title} />
                        </div>
                        <div className={styles['card-body']}>
                            <h3 className={styles['card-title']}>{recipe.title}</h3>
                            {recipe.authorLogin && (
                                <Link
                                    className={styles['card-author']}
                                    href={`/authors/${encodeURIComponent(recipe.authorLogin)}`}
                                >
                                    @{recipe.authorLogin}
                                </Link>
                            )}
                            <p>{recipe.description}</p>
                            <div className={styles.meta}>
                                <span>
                                    {recipe.durationMinutes === null
                                        ? 'Время не указано'
                                        : `${recipe.durationMinutes} мин`}
                                </span>
                                <Rating rating={recipe.rating} count={recipe.ratingCount} />
                            </div>
                        </div>
                    </article>
                ))}
            </div>
            {query.isFetchNextPageError && <p role="alert">Не удалось загрузить следующую часть. Повторите попытку.</p>}
            {query.hasNextPage && (
                <button
                    className="button outline"
                    disabled={query.isFetchingNextPage}
                    onClick={() => void query.fetchNextPage()}
                >
                    {query.isFetchingNextPage ? 'Загружаем…' : 'Показать ещё'}
                </button>
            )}
        </div>
    );
}

export function CommunityPage() {
    const params = useSearchParams(),
        router = useRouter();
    const q = (params.get('q') ?? '').slice(0, 200),
        category = (params.get('category') ?? '').slice(0, 100),
        author = (params.get('author') ?? '').slice(0, 256),
        sort = params.get('sort') === 'oldest' ? 'oldest' : 'newest';
    const returnTo = `/community${params.size ? `?${params.toString()}` : ''}`;
    const categoryHref = (value: string) => {
        const next = new URLSearchParams(params.toString());
        if (value) next.set('category', value);
        else next.delete('category');
        return `/community${next.size ? `?${next.toString()}` : ''}`;
    };
    return (
        <PublicShell current="community">
            <div className={`${styles.main} ${styles['public-main']}`}>
                <div className={`${styles.heading} ${styles['community-heading']}`}>
                    <div>
                        <h1>Сообщество рецептов</h1>
                        <p>Настоящие рецепты увлечённых кулинаров. Готовьте, вдохновляйтесь, делитесь!</p>
                    </div>
                </div>
                <form
                    className={styles['community-search']}
                    key={params.toString()}
                    onSubmit={(event) => {
                        event.preventDefault();
                        const values = new FormData(event.currentTarget),
                            next = new URLSearchParams();
                        for (const key of ['q', 'category', 'author', 'sort']) {
                            const entry = values.get(key);
                            const value = typeof entry === 'string' ? entry.trim() : '';
                            if (value && !(key === 'sort' && value === 'newest')) next.set(key, value);
                        }
                        router.push(`/community${next.size ? `?${next}` : ''}`);
                    }}
                >
                    <label className={styles['search-field']}>
                        <span className={styles['visually-hidden']}>Поиск</span>
                        <input name="q" defaultValue={q} maxLength={200} placeholder="Название или описание рецепта" />
                    </label>
                    <button className="button primary">Найти</button>
                    <details className={styles['advanced-filters']}>
                        <summary>Дополнительные фильтры</summary>
                        <div className={styles['advanced-fields']}>
                            <label>
                                Категория
                                <select name="category" defaultValue={category}>
                                    <option value="">Все категории</option>
                                    {categories.map(([code, name]) => (
                                        <option value={code} key={code}>
                                            {name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                Автор
                                <input name="author" defaultValue={author} maxLength={256} placeholder="Логин автора" />
                            </label>
                            <label>
                                Порядок
                                <select name="sort" defaultValue={sort}>
                                    <option value="newest">Сначала новые</option>
                                    <option value="oldest">Сначала старые</option>
                                </select>
                            </label>
                            <Link href="/community">Сбросить всё</Link>
                        </div>
                    </details>
                </form>
                <nav className={styles['category-chips']} aria-label="Категории рецептов">
                    <Link href={categoryHref('')} aria-current={!category ? 'page' : undefined}>
                        Все
                    </Link>
                    {categories.map(([code, name]) => (
                        <Link
                            href={categoryHref(code)}
                            aria-current={category === code ? 'page' : undefined}
                            key={code}
                        >
                            {name}
                        </Link>
                    ))}
                </nav>
                <PublicRecipeFeed q={q} category={category} author={author} sort={sort} returnTo={returnTo} />
            </div>
        </PublicShell>
    );
}

export function PublicComments({ recipeId }: { recipeId: string }) {
    const { api } = useRuntime();
    const query = useInfiniteQuery({
        queryKey: ['public-comments', recipeId],
        enabled: !!api,
        initialPageParam: null as string | null,
        queryFn: async ({ signal, pageParam }) =>
            (
                await api!.request(
                    'GET /api/v1/community/recipes/{id}/comments',
                    undefined,
                    signal,
                    { id: recipeId },
                    { query: { limit: '20', ...(pageParam ? { cursor: pageParam } : {}) } },
                )
            ).data,
        getNextPageParam: (page) => page.nextCursor ?? undefined,
    });
    if (query.isPending) return <p role="status">Загружаем комментарии…</p>;
    if (query.isError && !query.data) return <RecipeError error={query.error} retry={() => void query.refetch()} />;
    const items = query.data?.pages.flatMap((page) => page.items) ?? [];
    return (
        <div className={styles.stack}>
            {!items.length && <p>Пока нет комментариев.</p>}
            {items.map((item) => (
                <article key={item.id} className={styles.panel}>
                    {item.authorLogin ? (
                        <Link href={`/authors/${encodeURIComponent(item.authorLogin)}`}>@{item.authorLogin}</Link>
                    ) : (
                        <span>Автор не указан</span>
                    )}
                    <time dateTime={item.createdAt}>
                        {' '}
                        · {new Date(item.createdAt).toLocaleDateString('ru-RU', { timeZone: 'UTC' })}
                    </time>
                    {item.edited && <small> · отредактировано</small>}
                    {item.replyToId && <p className={styles.muted}>Ответ на комментарий</p>}
                    <p>{item.body}</p>
                </article>
            ))}
            {query.isFetchNextPageError && <p role="alert">Не удалось загрузить комментарии.</p>}
            {query.hasNextPage && (
                <button
                    className="button outline"
                    disabled={query.isFetchingNextPage}
                    onClick={() => void query.fetchNextPage()}
                >
                    {query.isFetchingNextPage ? 'Загружаем…' : 'Показать ещё'}
                </button>
            )}
        </div>
    );
}
