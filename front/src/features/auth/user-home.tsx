'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../shared/runtime/index.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import { useSession } from '../../entities/session/client.js';
import { useWorkspaceScope } from '../../entities/workspace-scope/client.js';
import {
    RecommendationFeedback,
    useRecommendationActions,
    type Recommendation,
} from '../../entities/recommendation/client.js';
import styles from './user-home.module.css';

const mealName = (value: string) =>
    ({ breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин', snack: 'Перекус' })[value] ?? value;
const greeting = () => {
    const hour = new Date().getHours();
    return hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
};
type RecipeRecommendation = Extract<Recommendation, { type: 'recipe' }>;
function HomeRecommendationCard({ item, position }: { item: RecipeRecommendation; position: number }) {
    const actions = useRecommendationActions(item, 'home', position);
    if (actions.hidden) return null;
    return (
        <article className={styles.card}>
            <h3>
                <Link className={styles['card-link']} href={`/recipes/${item.recipe.id}`} onClick={actions.open}>
                    {item.recipe.title}
                </Link>
            </h3>
            <p>
                {item.recipe.durationMinutes === null ? 'Время не указано' : `${item.recipe.durationMinutes} мин`} ·{' '}
                {item.recipe.availability?.presencePercent ?? 0}% продуктов
            </p>
            <p className={styles.reason}>Почему здесь: {item.reasons[0]?.text}</p>
            {item.safetyWarnings.map((warning) => (
                <p className={styles['safety-warning']} key={warning.code}>
                    {warning.text}
                </p>
            ))}
            <RecommendationFeedback actions={actions} className={styles['recommendation-actions']} />
        </article>
    );
}
function Content() {
    const { api } = useRuntime();
    const scope = useWorkspaceScope((state) => state.scope);
    const inventoryPath = scope === 'family' ? '/family/inventory' : '/inventory';
    const recipesPath = scope === 'family' ? '/family/recipes' : '/recipes';
    const planPath = scope === 'family' ? '/family/plan' : '/plan';
    const receiptsPath = scope === 'family' ? '/family/receipts' : '/receipts';
    const session = useSession('user');
    const query = useQuery({
        queryKey: ['home', session.data?.id],
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/home', undefined, signal)).data,
    });
    const recommendations = useQuery({
        queryKey: ['recommendations', 'recipe', session.data?.id, scope, 3],
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) =>
            (
                await api!.request('GET /api/v1/recommendations', undefined, signal, undefined, {
                    query: {
                        type: 'recipe',
                        scope: scope === 'family' ? 'family' : 'private',
                        surface: 'home',
                        limit: '3',
                    },
                })
            ).data.items.filter((item): item is RecipeRecommendation => item.type === 'recipe'),
    });
    if (query.isPending)
        return (
            <div className={styles.stack}>
                <ArcSkeleton height="10em" label="Загружаем главную" />
                <ArcSkeleton variant="lines" lines={5} label={null} />
            </div>
        );
    if (query.isError)
        return (
            <section className={styles.panel} role="alert">
                <h1>Главная не загрузилась</h1>
                <p>Проверьте подключение и попробуйте снова.</p>
                <button className="button outline" onClick={() => void query.refetch()}>
                    Повторить
                </button>
            </section>
        );
    const home = query.data;
    return (
        <>
            <section className={styles.hero}>
                <div>
                    <p>{greeting()},</p>
                    <h1>{session.data?.displayName ?? 'пользователь'}!</h1>
                    <p>Планируйте питание из того, что уже есть дома.</p>
                </div>
                <img src="/assets/achievements-kitchen-cover.webp" alt="" />
            </section>
            {home.onboarding.status !== 'completed' && home.onboarding.status !== 'skipped' && (
                <section className={styles.notice}>
                    <div>
                        <h2>Настроим Meal Planner под вас</h2>
                        <p>Выберите короткий, подробный или демонстрационный сценарий.</p>
                    </div>
                    <Link className="button primary" href="/onboarding">
                        Начать
                    </Link>
                </section>
            )}
            <section>
                <div className={styles['section-heading']}>
                    <div>
                        <h2>Можно приготовить</h2>
                        <p>Подборка по {scope === 'family' ? 'семейным' : 'личным'} запасам и вашим предпочтениям</p>
                    </div>
                    <Link href="/recipes?tab=inventory">Все рецепты</Link>
                </div>
                {recommendations.isPending ? (
                    <ArcSkeleton variant="lines" lines={3} label="Подбираем рецепты" />
                ) : recommendations.isError ? (
                    <p className={styles.empty} role="alert">
                        Персональная подборка временно недоступна.
                    </p>
                ) : recommendations.data.length ? (
                    <div className={styles.cards}>
                        {recommendations.data.map((item, position) => (
                            <HomeRecommendationCard item={item} position={position} key={item.recommendationId} />
                        ))}
                    </div>
                ) : (
                    <p className={styles.empty}>Добавьте продукты, чтобы получить подборку.</p>
                )}
            </section>
            <section>
                <h2>Быстрые действия</h2>
                <div className={styles.actions}>
                    <Link className={styles['action-link']} href={`${inventoryPath}/new`}>
                        ＋ Добавить продукт
                    </Link>
                    <Link className={styles['action-link']} href={recipesPath}>
                        Найти рецепт
                    </Link>
                    <Link className={styles['action-link']} href={planPath}>
                        Открыть план
                    </Link>
                    <Link className={styles['action-link']} href={`${receiptsPath}/new`}>
                        Добавить чек
                    </Link>
                </div>
            </section>
            <div className={styles.columns}>
                <section className={styles.panel}>
                    <div className={styles['section-heading']}>
                        <h2>Скоро испортится</h2>
                        <Link href="/inventory?attention=expiring">Личные запасы</Link>
                    </div>
                    {home.expiring.length ? (
                        <ul className={styles.list}>
                            {home.expiring.map((item) => (
                                <li key={item.id}>
                                    <span>{item.name}</span>
                                    <strong>
                                        {item.daysLeft < 0
                                            ? `Просрочено ${Math.abs(item.daysLeft)} дн.`
                                            : item.daysLeft === 0
                                              ? 'Сегодня'
                                              : `${item.daysLeft} дн.`}
                                    </strong>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className={styles.empty}>Продуктов с ближайшим сроком нет.</p>
                    )}
                </section>
                <section className={styles.panel}>
                    <div className={styles['section-heading']}>
                        <h2>Сегодня и завтра</h2>
                        <Link href="/plan">План</Link>
                    </div>
                    {home.plan.length ? (
                        <ul className={styles.list}>
                            {home.plan.map((item) => (
                                <li key={item.id}>
                                    <span>
                                        {mealName(item.meal)} ·{' '}
                                        {new Date(`${item.date}T00:00:00`).toLocaleDateString('ru', {
                                            day: 'numeric',
                                            month: 'short',
                                        })}
                                    </span>
                                    <strong>{item.title ?? 'Без рецепта'}</strong>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className={styles.empty}>В плане пока нет блюд.</p>
                    )}
                </section>
            </div>
            <section className={styles.stats}>
                <Link className={styles['stat-link']} href="/inventory">
                    <strong>{home.inventoryCount}</strong>
                    <span>личных продуктов в запасах</span>
                </Link>
                <Link className={styles['stat-link']} href="/shopping">
                    <strong>{home.activeShoppingLists}</strong>
                    <span>активных списков</span>
                </Link>
            </section>
        </>
    );
}
export function UserHome() {
    return (
        <>
            <Content />
        </>
    );
}
