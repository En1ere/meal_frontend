'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRuntime } from '../../app/providers.js';
import { ApiError } from '../../shared/api/client.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { useSession } from '../auth/session.js';
import { useRequestSignal } from '../auth/use-request-signal.js';
import { InlineLoader as ArcInlineLoader } from '@meal-planner/design-system';
import {
    RecipeShell,
    RecipeImage,
    RecipeLoading,
    RecipeError,
    Rating,
    recipeUnits,
    categoryLabels,
    methodLabels,
} from './shared.js';
import { detailState, safeCatalogReturn, scaleQuantity } from './url-state.js';
import { AvailabilityBadge } from './catalog.js';
import styles from './recipes.module.css';
import { RecipeCommunity } from './community.js';
import { PublicComments } from '../community/community.js';
import { useRecipeCommand } from './use-command.js';
import { storeRecipeCache, clearBrowserRecipeCache } from './offline-cache.js';
import { SavedRecipesReader } from './offline.js';
import { RecipeAllergens } from './allergens.js';
import { CostEstimateBadge } from '../finance/finance-page.js';
export type RecipeDetailData = Success<'GET /api/v1/recipes/{id}'>['data']['recipe'];
type Personal = Success<'GET /api/v1/recipes/{id}/personal'>['data'];
const tabs = [
    ['ingredients', 'Ингредиенты'],
    ['steps', 'Шаги'],
    ['variants', 'Варианты'],
    ['comments', 'Комментарии'],
] as const;
function Author({ login }: { login: string | null }) {
    return login ? <Link href={`/authors/${encodeURIComponent(login)}`}>@{login}</Link> : <span>Автор не указан</span>;
}
function Content({ id, initialData }: { id: string; initialData?: RecipeDetailData | undefined }) {
    const { api, queryClient } = useRuntime();
    const user = useSession('user');
    const search = useSearchParams();
    const router = useRouter();
    const signal = useRequestSignal();
    const variantCommand = useRecipeCommand();
    const [pending, setPending] = useState(false);
    const [bookmarkError, setBookmarkError] = useState('');
    const [shareStatus, setShareStatus] = useState('');
    const attempt = useRef<{ bookmarked: boolean; idempotencyKey: string } | null>(null);
    const query = useQuery({
        queryKey: ['recipes', 'public', id],
        initialData,
        staleTime: 30000,
        enabled: !!api,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/recipes/{id}', undefined, signal, { id })).data.recipe,
    });
    const state = detailState(new URLSearchParams(search), query.data?.baseServings ?? 1);
    const personal = useQuery({
        queryKey: ['recipes', 'personal', user.data?.id, id, state.servings],
        enabled: !!api && !!user.data && query.isSuccess,
        queryFn: async ({ signal }) =>
            (
                await api!.request(
                    'GET /api/v1/recipes/{id}/personal',
                    undefined,
                    signal,
                    { id },
                    { query: { servings: String(state.servings) } },
                )
            ).data,
    });
    const statistics = useQuery({
        queryKey: ['recipes', 'statistics', id, state.servings],
        enabled: !!api,
        queryFn: async ({ signal }) =>
            (
                await api!.request(
                    'GET /api/v1/recipes/{id}/cooking-statistics',
                    undefined,
                    signal,
                    { id },
                    { query: { servings: String(state.servings) } },
                )
            ).data,
    });
    useEffect(() => {
        if (query.error instanceof ApiError && [403, 404].includes(query.error.status)) {
            clearBrowserRecipeCache();
            return;
        }
        if (query.data && user.data && !query.isError) {
            try {
                storeRecipeCache(localStorage, user.data.id, query.data);
            } catch {
                /* Optional storage is unavailable. */
            }
        }
    }, [query.data, query.error, query.isError, user.data]);
    function update(values: Record<string, string>) {
        const params = new URLSearchParams(search);
        for (const [key, value] of Object.entries(values)) params.set(key, value);
        router.push(`/recipes/${id}?${params.toString()}`, { scroll: false });
    }
    async function bookmark() {
        if (!api || !personal.data || pending) return;
        attempt.current ??= { bookmarked: !personal.data.bookmarked, idempotencyKey: crypto.randomUUID() };
        setPending(true);
        setBookmarkError('');
        const abort = signal();
        try {
            await api.request('POST /api/v1/recipes/{id}/bookmark', attempt.current, abort, { id });
            if (abort.aborted) return;
            attempt.current = null;
            await queryClient.invalidateQueries({ queryKey: ['recipes', 'personal', user.data?.id, id] });
        } catch (error) {
            if (!abort.aborted) {
                if (error instanceof ApiError && error.status === 401) {
                    api.invalidate();
                    queryClient.setQueryData(['session', 'user'], null);
                    queryClient.removeQueries({ queryKey: ['recipes', 'personal'] });
                }
                setBookmarkError(
                    error instanceof ApiError
                        ? error.message
                        : 'Ответ не получен. Повторите тот же запрос — он не создаст дубль.',
                );
                if (error instanceof ApiError && error.status < 500) attempt.current = null;
            }
        } finally {
            if (!abort.aborted) setPending(false);
        }
    }
    async function share() {
        const url = `${window.location.origin}/recipes/${id}`;
        try {
            await navigator.clipboard.writeText(url);
            setShareStatus('Ссылка скопирована');
        } catch {
            setShareStatus(`Ссылка: ${url}`);
        }
    }
    if (query.isPending) return <RecipeLoading />;
    if (query.isError)
        return (
            <>
                <RecipeError error={query.error} retry={() => void query.refetch()} />
                {!(query.error instanceof ApiError) && <SavedRecipesReader />}
            </>
        );
    const recipe = query.data;
    if (!recipe) return <RecipeLoading />;
    const back = safeCatalogReturn(search.get('returnTo'));
    const loginReturnTo = `/recipes/${id}${search.size ? `?${search.toString()}` : ''}`;
    const tabHref = (tab: string) => {
        const params = new URLSearchParams(search);
        params.set('tab', tab);
        return `/recipes/${id}?${params}`;
    };
    const ingredientQuantity = (item: RecipeDetailData['ingredients'][number]) =>
        scaleQuantity(item.quantity, recipe.baseServings, state.servings);
    return (
        <>
            <Link href={back}>← Рецепты</Link>
            <div className={styles.heading}>
                <div>
                    <h1>{recipe.title}</h1>
                    {recipe.description && <p className={styles.muted}>{recipe.description}</p>}
                </div>
                <div className={styles.actions}>
                    {user.data ? (
                        <button
                            className="button outline"
                            disabled={pending || !personal.data}
                            onClick={() => void bookmark()}
                        >
                            {pending ? (
                                <ArcInlineLoader label="Сохраняем" />
                            ) : bookmarkError ? (
                                'Повторить сохранение'
                            ) : personal.data?.bookmarked ? (
                                '♥ В закладках'
                            ) : (
                                '♡ В закладки'
                            )}
                        </button>
                    ) : (
                        <Link className="button outline" href={`/auth?returnTo=${encodeURIComponent(loginReturnTo)}`}>
                            Войти для закладок
                        </Link>
                    )}
                    <button className="button outline" onClick={() => void share()}>
                        Поделиться
                    </button>
                </div>
            </div>
            {user.data && <CostEstimateBadge route="GET /api/v1/finance/costs/recipes/{id}" id={recipe.id} />}
            {bookmarkError && (
                <p role="alert" className={styles.error}>
                    {bookmarkError}
                </p>
            )}
            {shareStatus && <p role="status">{shareStatus}</p>}
            <div className={styles.chips}>
                {recipe.category && (
                    <span className={styles.badge}>{categoryLabels[recipe.category] ?? recipe.category}</span>
                )}
                {recipe.tags.map((tag) => (
                    <span className={styles.badge} key={tag}>
                        {tag}
                    </span>
                ))}
            </div>
            <div className={styles['detail-layout']}>
                <div className={styles.stack}>
                    <section className={styles.hero}>
                        <RecipeImage
                            key={recipe.imageUrl}
                            src={recipe.imageUrl}
                            alt={recipe.title}
                            className={styles['hero-image']}
                        />
                        <div className={styles['hero-copy']}>
                            <div>
                                <p className={styles.muted}>Автор рецепта</p>
                                <Author login={recipe.authorLogin} />
                            </div>
                            <Rating rating={recipe.rating} count={recipe.ratingCount} />
                            {recipe.description && <p>{recipe.description}</p>}
                            <div className={styles.meta}>
                                <span>
                                    ◷{' '}
                                    {recipe.durationMinutes === null
                                        ? 'Время не указано'
                                        : `${recipe.durationMinutes} мин`}
                                </span>
                                <span>{recipe.baseServings} порц. автора</span>
                                <span>{methodLabels[recipe.method] ?? (recipe.method || 'Способ не указан')}</span>
                            </div>
                            <RecipeAllergens key={recipe.revisionId} recipe={recipe} />
                        </div>
                    </section>
                    <section className={styles.panel}>
                        <h2>Пищевая ценность</h2>
                        <p className={styles.muted}>
                            {recipe.nutrition?.basis === 'recipe' ? 'На весь рецепт в порциях автора' : 'На порцию'}
                        </p>
                        <dl className={styles.nutrition}>
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
                                    <dd>
                                        {recipe.nutrition?.[key] != null
                                            ? `${recipe.nutrition[key]} ${unit}`
                                            : 'Нет данных'}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </section>
                    <nav className={styles.tabs} aria-label="Разделы рецепта">
                        {tabs.map(([tab, label]) => (
                            <Link
                                key={tab}
                                href={tabHref(tab)}
                                scroll={false}
                                aria-current={state.tab === tab ? 'true' : undefined}
                            >
                                {label} (
                                {tab === 'ingredients'
                                    ? recipe.ingredients.length
                                    : tab === 'steps'
                                      ? recipe.steps.length
                                      : tab === 'variants'
                                        ? recipe.variants.length
                                        : recipe.commentsTotal}
                                )
                            </Link>
                        ))}
                    </nav>
                    <section className={styles.panel}>
                        {state.tab === 'ingredients' && (
                            <>
                                <div className={styles.heading}>
                                    <h2>Ингредиенты</h2>
                                    <span>На {state.servings} порц.</span>
                                </div>
                                {recipe.ingredients.length === 0 ? (
                                    <p>Список ингредиентов пока не заполнен.</p>
                                ) : (
                                    <ul className={styles.ingredients}>
                                        {recipe.ingredients.map((item) => {
                                            const stock = personal.data?.availability.items.find(
                                                (x) => x.id === item.id,
                                            );
                                            return (
                                                <li key={item.id}>
                                                    <div>
                                                        {item.ingredientId ? (
                                                            <Link href={`/products/${item.ingredientId}`}>
                                                                {item.name}
                                                            </Link>
                                                        ) : (
                                                            <strong>{item.name}</strong>
                                                        )}
                                                        {item.optional && (
                                                            <p className={styles['pending-note']}>
                                                                По желанию · не участвует в расчёте наличия
                                                            </p>
                                                        )}
                                                        {stock && (
                                                            <p className={styles['pending-note']}>
                                                                {!stock.present
                                                                    ? 'Нет в личных запасах'
                                                                    : stock.needsQuantityCheck
                                                                      ? 'Есть · проверьте количество'
                                                                      : 'Есть в личных запасах'}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <span>
                                                        {ingredientQuantity(item) === null
                                                            ? 'Количество не указано'
                                                            : `${ingredientQuantity(item)} ${item.unit ? (recipeUnits[item.unit] ?? item.unit) : ''}`}
                                                    </span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </>
                        )}
                        {state.tab === 'steps' && (
                            <>
                                <h2>Шаги приготовления</h2>
                                {recipe.steps.length ? (
                                    <ol className={styles.steps}>
                                        {recipe.steps.map((step) => (
                                            <li key={step.id}>
                                                <p>{step.text}</p>
                                                <p className={styles.muted}>
                                                    {step.durationSeconds !== null
                                                        ? `${Math.ceil(step.durationSeconds / 60)} мин`
                                                        : ''}
                                                    {step.temperature !== null ? ` · ${step.temperature} °C` : ''}
                                                </p>
                                            </li>
                                        ))}
                                    </ol>
                                ) : (
                                    <p>Шаги пока не заполнены.</p>
                                )}
                            </>
                        )}
                        {state.tab === 'variants' && (
                            <>
                                <h2>Варианты рецепта</h2>
                                {recipe.variants.length ? (
                                    <ul>
                                        {recipe.variants.map((variant) => (
                                            <li key={variant.id}>
                                                <Link
                                                    href={`/recipes/${variant.id}?returnTo=${encodeURIComponent(back)}`}
                                                >
                                                    {variant.title}
                                                </Link>{' '}
                                                · <Author login={variant.authorLogin} />
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p>Вариантов пока нет.</p>
                                )}
                                <button
                                    className="button outline"
                                    disabled={!user.data || variantCommand.pending}
                                    onClick={() =>
                                        void variantCommand
                                            .run('POST /api/v1/recipe-workspace/{id}/variant', {}, { id })
                                            .then((result) => {
                                                if (result) router.push(`/recipes/${result.recipe.id}/edit`);
                                            })
                                    }
                                >
                                    Создать личный вариант
                                </button>
                                {variantCommand.error && <p role="alert">{variantCommand.error}</p>}
                            </>
                        )}
                        {state.tab === 'comments' && (
                            <>
                                <h2>Комментарии</h2>
                                {!user.data && <PublicComments recipeId={id} />}
                                <RecipeCommunity id={id} />
                            </>
                        )}
                    </section>
                </div>
                <aside className={styles.stack}>
                    <section className={styles.panel}>
                        <h2>Мой план приготовления</h2>
                        {statistics.data &&
                            statistics.data.sampleSize >= 3 &&
                            statistics.data.medianSeconds !== null && (
                                <p>
                                    Обычно занимает {Math.round(statistics.data.medianSeconds / 60)} мин · диапазон{' '}
                                    {Math.round((statistics.data.lowerQuartileSeconds ?? 0) / 60)}–
                                    {Math.round((statistics.data.upperQuartileSeconds ?? 0) / 60)} мин, по{' '}
                                    {statistics.data.sampleSize} подтверждённым приготовлениям. Время автора остаётся
                                    основным ориентиром.
                                </p>
                            )}
                        <p className={styles.muted}>Для меня · личные запасы</p>
                        <label htmlFor="recipe-servings">Порции</label>
                        <div className={styles.servings}>
                            <button
                                className="button outline"
                                disabled={state.servings <= 1}
                                aria-label="Уменьшить порции"
                                onClick={() => update({ servings: String(state.servings - 1) })}
                            >
                                −
                            </button>
                            <input
                                id="recipe-servings"
                                key={state.servings}
                                type="number"
                                min={1}
                                max={1000}
                                defaultValue={state.servings}
                                onBlur={(e) => {
                                    const value = Number(e.target.value);
                                    if (
                                        Number.isInteger(value) &&
                                        value >= 1 &&
                                        value <= 1000 &&
                                        value !== state.servings
                                    )
                                        update({ servings: String(value) });
                                    else e.target.value = String(state.servings);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.currentTarget.blur();
                                }}
                            />
                            <button
                                className="button outline"
                                disabled={state.servings >= 1000}
                                aria-label="Увеличить порции"
                                onClick={() => update({ servings: String(state.servings + 1) })}
                            >
                                ＋
                            </button>
                        </div>
                        <p className={styles['pending-note']}>
                            Ингредиенты пересчитываются; время автора не масштабируется.
                        </p>
                        {user.isPending ? (
                            <ArcInlineLoader label="Проверяем вход" />
                        ) : user.isError ? (
                            <p>
                                Не удалось проверить вход.{' '}
                                <button onClick={() => void user.refetch()}>Повторить</button>
                            </p>
                        ) : !user.data ? (
                            <p>
                                <Link href={`/auth?returnTo=${encodeURIComponent(loginReturnTo)}`}>Войдите</Link>, чтобы
                                проверить личные запасы.
                            </p>
                        ) : personal.isPending ? (
                            <ArcInlineLoader label="Проверяем запасы" />
                        ) : personal.isError ? (
                            <section role="alert">
                                <p>Наличие продуктов сейчас неизвестно.</p>
                                <button onClick={() => void personal.refetch()}>Повторить проверку</button>
                            </section>
                        ) : (
                            <PersonalAvailability data={personal.data} recipe={recipe} />
                        )}
                        <Link className="button primary" href={`/recipes/${id}/cook?servings=${state.servings}`}>
                            Начать готовить
                        </Link>
                        <p className={styles['pending-note']}>
                            Продукты списываются после проверки фактического расхода.
                        </p>
                        <Link className="button outline" href={`/shopping?recipeId=${id}&servings=${state.servings}`}>
                            Добавить недостающее в покупки
                        </Link>
                        {user.data && (
                            <Link
                                className="button outline"
                                href={`/preserves?create=1&recipeRevisionId=${recipe.revisionId}`}
                            >
                                Создать заготовку по рецепту
                            </Link>
                        )}
                    </section>
                    <section className={styles.panel}>
                        <p>Готовить — значит заботиться о себе.</p>
                        <Link href="/inventory">Проверить свои запасы →</Link>
                        <details>
                            <summary>Читать сохранённые рецепты без сети</summary>
                            <SavedRecipesReader />
                        </details>
                    </section>
                </aside>
            </div>
        </>
    );
}
function PersonalAvailability({ data, recipe }: { data: Personal; recipe: RecipeDetailData }) {
    const missing = data.availability.items.filter((x) => !x.optional && !x.present);
    const check = data.availability.items.filter((x) => x.present && x.needsQuantityCheck);
    const name = (id: string) => recipe.ingredients.find((x) => x.id === id)?.name ?? 'Ингредиент';
    return (
        <section className={styles.panel}>
            <AvailabilityBadge value={data.availability} />
            <p>
                {data.availability.presentCount} из {data.availability.requiredCount} обязательных ингредиентов ·{' '}
                {data.availability.presencePercent}%
            </p>
            {missing.length > 0 && (
                <div>
                    <strong>Не хватает:</strong>
                    <ul>
                        {missing.map((x) => (
                            <li key={x.id}>{name(x.id)}</li>
                        ))}
                    </ul>
                </div>
            )}
            {check.length > 0 && (
                <div>
                    <strong>Проверьте количество:</strong>
                    <ul>
                        {check.map((x) => (
                            <li key={x.id}>{name(x.id)}</li>
                        ))}
                    </ul>
                </div>
            )}
            <Link href="/inventory">Открыть запасы</Link>
        </section>
    );
}
export function RecipeDetail({ id, initialData }: { id: string; initialData?: RecipeDetailData | undefined }) {
    return (
        <RecipeShell detail>
            <Content key={id} id={id} initialData={initialData} />
        </RecipeShell>
    );
}
