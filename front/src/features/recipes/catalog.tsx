'use client';
import Link from 'next/link';
import { useRef, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { useRuntime } from '../../shared/runtime/index.js';
import { useSession } from '../../entities/session/client.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { RecipeShell, RecipeLoading, RecipeError } from './shared.js';
import { RecipeImage, Rating } from '../../entities/recipe/client.js';
import {
    FollowAuthorButton,
    RecommendationFeedback,
    useRecommendationActions,
    type Recommendation,
} from '../../entities/recommendation/client.js';
import { catalogState, catalogHref } from './url-state.js';
import styles from './recipes.module.css';
type Summary = Success<'GET /api/v1/recipes'>['data']['items'][number];
type RecipeRecommendation = Extract<Recommendation, { type: 'recipe' }>;
type AuthorRecommendation = Extract<Recommendation, { type: 'author' }>;
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
const tabs = [
    ['for-you', 'Для вас'],
    ['inventory', 'По запасам'],
    ['new', 'Новые'],
] as const;
export function AvailabilityBadge({ value }: { value: Summary['availability'] }) {
    if (!value) return <span className={styles.badge}>Нужно проверить запасы</span>;
    return (
        <span className={`${styles.badge} ${value.canPrepare ? styles.available : styles.warning}`}>
            {value.canPrepare ? 'Можно приготовить' : `Не хватает ${value.requiredCount - value.presentCount}`}
            {value.needsQuantityCheck ? ' · Проверьте количество' : ''}
        </span>
    );
}
function RecipeCard({
    recipe,
    returnTo,
    featured = false,
    reason,
    safetyWarnings = [],
    onOpen,
    feedback,
}: {
    recipe: Summary;
    returnTo: string;
    featured?: boolean;
    reason?: string | undefined;
    safetyWarnings?: Array<{ code: string; text: string }>;
    onOpen?: (() => void) | undefined;
    feedback?: ReactNode;
}) {
    const href = `/recipes/${recipe.id}?returnTo=${encodeURIComponent(returnTo)}`;
    const content = (
        <>
            <h3 className={styles['card-title']}>
                <Link href={href} {...(onOpen ? { onClick: onOpen } : {})}>
                    {recipe.title}
                </Link>
            </h3>
            <p className={styles.muted}>{recipe.authorLogin ? `@${recipe.authorLogin}` : 'Автор не указан'}</p>
            <div className={styles.meta}>
                <span>◷ {recipe.durationMinutes === null ? 'Время не указано' : `${recipe.durationMinutes} мин`}</span>
                <Rating rating={recipe.rating} count={recipe.ratingCount} />
            </div>
            <AvailabilityBadge value={recipe.availability} />
            {reason && <p className={styles.reason}>Почему здесь: {reason}</p>}
            {safetyWarnings.map((warning) => (
                <p className={styles['safety-warning']} key={warning.code}>
                    {warning.text}
                </p>
            ))}
            {feedback}
        </>
    );
    if (featured)
        return (
            <article className={styles.feature}>
                <div className={styles['feature-copy']}>
                    <span className={styles.badge}>Рецепт из подборки</span>
                    <h2>
                        <Link href={href} {...(onOpen ? { onClick: onOpen } : {})}>
                            {recipe.title}
                        </Link>
                    </h2>
                    {recipe.description && <p className={styles.muted}>{recipe.description}</p>}
                    <div className={styles.meta}>
                        <span>
                            ◷ {recipe.durationMinutes === null ? 'Время не указано' : `${recipe.durationMinutes} мин`}
                        </span>
                        <Rating rating={recipe.rating} count={recipe.ratingCount} />
                    </div>
                    <AvailabilityBadge value={recipe.availability} />
                    {reason && <p className={styles.reason}>Почему здесь: {reason}</p>}
                    {safetyWarnings.map((warning) => (
                        <p className={styles['safety-warning']} key={warning.code}>
                            {warning.text}
                        </p>
                    ))}
                    {feedback}
                </div>
                <Link href={href} aria-label={recipe.title} {...(onOpen ? { onClick: onOpen } : {})}>
                    <RecipeImage src={recipe.imageUrl} alt={recipe.title} />
                </Link>
            </article>
        );
    return (
        <article className={styles['recipe-card']}>
            <Link href={href} aria-label={recipe.title} {...(onOpen ? { onClick: onOpen } : {})}>
                <RecipeImage src={recipe.imageUrl} alt={recipe.title} />
            </Link>
            <div className={styles['card-body']}>{content}</div>
        </article>
    );
}
function RecommendedRecipeCard({
    item,
    returnTo,
    position,
    featured = false,
}: {
    item: RecipeRecommendation;
    returnTo: string;
    position: number;
    featured?: boolean;
}) {
    const actions = useRecommendationActions(item, 'recipes', position);
    if (actions.hidden) return null;
    return (
        <RecipeCard
            recipe={item.recipe}
            returnTo={returnTo}
            featured={featured}
            reason={item.reasons[0]?.text}
            safetyWarnings={item.safetyWarnings}
            onOpen={actions.open}
            feedback={<RecommendationFeedback actions={actions} className={styles['recommendation-actions']} />}
        />
    );
}
function RecommendedAuthor({ item, position }: { item: AuthorRecommendation; position: number }) {
    const actions = useRecommendationActions(item, 'authors', position);
    if (actions.hidden) return null;
    return (
        <article className={styles['author-recommendation']}>
            <h3>
                <Link href={`/authors/${encodeURIComponent(item.author.username)}`} onClick={actions.open}>
                    @{item.author.username}
                </Link>
            </h3>
            <p className={styles.muted}>
                {item.author.recipeCount} рецептов · {item.author.followerCount} подписчиков
            </p>
            <p className={styles.reason}>{item.reasons[0]?.text}</p>
            <div className={styles['recommendation-actions']}>
                <FollowAuthorButton username={item.author.username} />
            </div>
            <RecommendationFeedback actions={actions} className={styles['recommendation-actions']} />
        </article>
    );
}
function Content() {
    const { api } = useRuntime();
    const session = useSession('user');
    const search = useSearchParams();
    const router = useRouter();
    const state = catalogState(new URLSearchParams(search));
    const href = catalogHref(state);
    const dialog = useRef<HTMLDialogElement>(null);
    const filterButton = useRef<HTMLButtonElement>(null);
    const personalized = state.tab === 'for-you' && !state.q && !state.category && state.page === 1;
    const query = useQuery({
        queryKey: ['recipes', 'catalog', session.data?.id, state],
        enabled: !!api && !!session.data && !personalized,
        queryFn: async ({ signal }) =>
            (
                await api!.request('GET /api/v1/recipes', undefined, signal, undefined, {
                    query: {
                        q: state.q,
                        ...(state.category ? { category: state.category } : {}),
                        tab: state.tab,
                        page: String(state.page),
                        limit: '12',
                    },
                })
            ).data,
    });
    const recommendations = useQuery({
        queryKey: ['recommendations', 'recipe', session.data?.id, 'private', 12],
        enabled: !!api && !!session.data && personalized,
        queryFn: async ({ signal }) =>
            (
                await api!.request('GET /api/v1/recommendations', undefined, signal, undefined, {
                    query: { type: 'recipe', scope: 'private', surface: 'recipes', limit: '12' },
                })
            ).data.items.filter((item): item is RecipeRecommendation => item.type === 'recipe'),
    });
    const authors = useQuery({
        queryKey: ['recommendations', 'author', session.data?.id, 3],
        enabled: !!api && !!session.data && state.tab === 'for-you',
        queryFn: async ({ signal }) =>
            (
                await api!.request('GET /api/v1/recommendations', undefined, signal, undefined, {
                    query: { type: 'author', scope: 'private', surface: 'authors', limit: '3' },
                })
            ).data.items.filter((item): item is AuthorRecommendation => item.type === 'author'),
    });
    return (
        <>
            <div className={styles.heading}>
                <div>
                    <h1>Рецепты</h1>
                    <p className={styles.muted}>Ищите, исследуйте и готовьте с удовольствием</p>
                </div>
                <div>
                    <Link className="button primary" href="/recipes/new">
                        ＋ Добавить рецепт
                    </Link>
                    <p className={styles['pending-note']}>
                        <Link href="/recipes/mine">Мои черновики и публикации</Link>
                    </p>
                </div>
            </div>
            <form
                className={styles.search}
                onSubmit={(e) => {
                    e.preventDefault();
                    const value = new FormData(e.currentTarget).get('q');
                    router.push(catalogHref({ ...state, q: typeof value === 'string' ? value : '', page: 1 }), {
                        scroll: false,
                    });
                }}
            >
                <label>
                    Найти рецепт
                    <input
                        key={state.q}
                        type="search"
                        name="q"
                        defaultValue={state.q}
                        maxLength={200}
                        placeholder="Например: паста, курица, ужин…"
                    />
                </label>
                <button className="button primary">Найти</button>
                <button
                    ref={filterButton}
                    type="button"
                    className="button outline"
                    onClick={() => dialog.current?.showModal()}
                >
                    Фильтры
                </button>
            </form>
            <nav className={styles.chips} aria-label="Категории">
                <Link
                    href={catalogHref({ ...state, category: '', page: 1 })}
                    aria-current={!state.category ? 'true' : undefined}
                    scroll={false}
                >
                    Всё
                </Link>
                {categories.map(([category, label]) => (
                    <Link
                        key={category}
                        href={catalogHref({ ...state, category, page: 1 })}
                        aria-current={state.category === category ? 'true' : undefined}
                        scroll={false}
                    >
                        {label}
                    </Link>
                ))}
            </nav>
            <nav className={styles.tabs} aria-label="Подборка рецептов">
                {tabs.map(([tab, label]) => (
                    <Link
                        key={tab}
                        href={catalogHref({ ...state, tab, page: 1 })}
                        aria-current={state.tab === tab ? 'true' : undefined}
                        scroll={false}
                    >
                        {label}
                    </Link>
                ))}
            </nav>
            {state.tab === 'for-you' && (
                <p className={styles['pending-note']}>
                    Персональная подборка учитывает запасы, сроки, настройки и вашу историю действий.
                </p>
            )}
            {state.tab === 'inventory' && (
                <p className={styles['pending-note']}>
                    Личные запасы · от 80% обязательных ингредиентов. Недостаточное или неизвестное количество требует
                    проверки.
                </p>
            )}
            <div className={styles['catalog-layout']}>
                <section
                    className={styles.stack}
                    aria-busy={personalized ? recommendations.isFetching : query.isFetching}
                >
                    {personalized && recommendations.isPending ? (
                        <RecipeLoading />
                    ) : personalized && recommendations.isError ? (
                        <RecipeError error={recommendations.error} retry={() => void recommendations.refetch()} />
                    ) : personalized && recommendations.data?.length === 0 ? (
                        <section className={styles.panel}>
                            <h2>Подборка пока пуста</h2>
                            <p>Добавьте продукты или заполните предпочтения, чтобы уточнить рекомендации.</p>
                        </section>
                    ) : personalized && recommendations.data ? (
                        <>
                            {recommendations.isFetching && <p role="status">Обновляем подборку…</p>}
                            <RecommendedRecipeCard
                                item={recommendations.data[0]!}
                                returnTo={href}
                                position={0}
                                featured
                            />
                            <h2>Рецепты для вас</h2>
                            <div className={styles.cards}>
                                {recommendations.data.slice(1).map((item, index) => (
                                    <RecommendedRecipeCard
                                        key={item.recommendationId}
                                        item={item}
                                        returnTo={href}
                                        position={index + 1}
                                    />
                                ))}
                            </div>
                        </>
                    ) : query.isPending ? (
                        <RecipeLoading />
                    ) : query.isError ? (
                        <RecipeError error={query.error} retry={() => void query.refetch()} />
                    ) : query.data.items.length === 0 ? (
                        <section className={styles.panel}>
                            <h2>Рецепты не найдены</h2>
                            <p>Попробуйте другой запрос или категорию.</p>
                            <Link href="/recipes">Сбросить фильтры</Link>
                        </section>
                    ) : (
                        <>
                            {query.isFetching && <p role="status">Обновляем подборку…</p>}
                            <RecipeCard recipe={query.data.items[0]!} returnTo={href} featured />
                            <h2>Рецепты подборки</h2>
                            <div className={styles.cards}>
                                {query.data.items.slice(1).map((recipe) => (
                                    <RecipeCard key={recipe.id} recipe={recipe} returnTo={href} />
                                ))}
                            </div>
                            <nav className={styles.actions} aria-label="Страницы рецептов">
                                {state.page > 1 && (
                                    <Link
                                        className="button outline"
                                        href={catalogHref({ ...state, page: state.page - 1 })}
                                    >
                                        Назад
                                    </Link>
                                )}
                                <span>
                                    Страница {query.data.page} · всего {query.data.total}
                                </span>
                                {state.page * query.data.limit < query.data.total && (
                                    <Link
                                        className="button outline"
                                        href={catalogHref({ ...state, page: state.page + 1 })}
                                    >
                                        Далее
                                    </Link>
                                )}
                            </nav>
                        </>
                    )}
                </section>
                <aside className={`${styles.stack} ${styles['catalog-aside']}`}>
                    {state.tab === 'for-you' && authors.data && authors.data.length > 0 && (
                        <section className={styles.panel}>
                            <h2>Авторы для вас</h2>
                            <p className={styles.muted}>
                                По рецептам и интересам — подписка остаётся под вашим контролем.
                            </p>
                            <div className={styles['author-list']}>
                                {authors.data.map((item, index) => (
                                    <RecommendedAuthor key={item.recommendationId} item={item} position={index} />
                                ))}
                            </div>
                        </section>
                    )}
                    <section className={styles.panel}>
                        <h2>Мои рецепты</h2>
                        <p className={styles.muted}>
                            <Link href="/recipes/mine">Мои черновики, варианты и публикации</Link>
                        </p>
                        <Link className="button outline" href="/recipes/new">
                            Создать рецепт
                        </Link>
                    </section>
                    <section className={styles.panel}>
                        <h2>Семейные рецепты</h2>
                        <span className={styles.badge}>Plus</span>
                        <p>Семейная коллекция появится в следующей итерации.</p>
                    </section>
                    <section className={styles.panel}>
                        <h2>Готовьте из того, что есть</h2>
                        <p>Проверьте личные продукты и их сроки годности.</p>
                        <Link href="/inventory">Открыть запасы →</Link>
                    </section>
                </aside>
            </div>
            <dialog
                className={styles.dialog}
                ref={dialog}
                aria-labelledby="recipe-filters-title"
                onClose={() => filterButton.current?.focus()}
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        const values = new FormData(e.currentTarget);
                        const categoryValue = values.get('category');
                        const tabValue = values.get('tab');
                        router.push(
                            catalogHref({
                                ...state,
                                category: typeof categoryValue === 'string' ? categoryValue : '',
                                tab: catalogState(
                                    new URLSearchParams({ tab: typeof tabValue === 'string' ? tabValue : '' }),
                                ).tab,
                                page: 1,
                            }),
                            { scroll: false },
                        );
                        dialog.current?.close();
                    }}
                >
                    <h2 id="recipe-filters-title">Фильтры рецептов</h2>
                    <label>
                        Категория
                        <select key={`category-${state.category}`} name="category" defaultValue={state.category}>
                            <option value="">Все категории</option>
                            {categories.map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Подборка
                        <select key={`tab-${state.tab}`} name="tab" defaultValue={state.tab}>
                            {tabs.map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button className="button primary">Применить</button>
                    <button type="button" className="button outline" onClick={() => dialog.current?.close()}>
                        Закрыть
                    </button>
                </form>
            </dialog>
        </>
    );
}
export function RecipesCatalog() {
    return (
        <RecipeShell>
            <Content />
        </RecipeShell>
    );
}
