import Link from 'next/link';
import { AppIcon } from '@meal-planner/design-system';
import { PublicShell } from '../../widgets/public-shell/index.js';

export const metadata = {
    title: 'Meal Planner — планируйте вкусную жизнь',
    description: 'Планирование питания, рецепты и семейные запасы в одном месте.',
};
export default function AboutPage() {
    return (
        <PublicShell current="about">
            <div className="landing">
                <section className="landing-hero">
                    <div className="landing-hero-copy">
                        <h1>Знайте, что есть дома. Решайте, что приготовить.</h1>
                        <p>Запасы, рецепты и покупки — в одном месте.</p>
                        <div className="actions">
                            <Link href="/auth/sign-up" className="button primary">
                                Создать аккаунт
                            </Link>
                            <Link href="/community" className="button outline">
                                Смотреть рецепты
                            </Link>
                        </div>
                        <div className="landing-hero-meta">
                            <span>Базовые возможности — бесплатно.</span>
                            <Link href="/pricing">Сравнить тарифы →</Link>
                        </div>
                    </div>
                    <img
                        src="/assets/food-160-hero-720.webp"
                        srcSet="/assets/food-160-hero-720.webp 720w, /assets/food-160-hero-960.webp 960w"
                        sizes="(max-width: 760px) 100vw, 50vw"
                        alt="Паста с томатами и свежим базиликом"
                        fetchPriority="high"
                    />
                </section>
                <section id="features" className="landing-section">
                    <h2>От продуктов дома до готового ужина</h2>
                    <p className="section-subtitle">Простой и понятный путь — каждый день.</p>
                    <div className="feature-grid">
                        <article>
                            <span className="feature-number">1</span>
                            <img
                                src="/assets/food-014-card-400.webp"
                                srcSet="/assets/food-014-card-400.webp 400w, /assets/food-014-card-640.webp 640w"
                                sizes="(max-width: 760px) 42vw, 30vw"
                                alt="Свежие томаты"
                                loading="lazy"
                                decoding="async"
                            />
                            <h3>Учитывайте запасы</h3>
                            <p>Добавляйте продукты, которые есть дома, и следите за остатками.</p>
                        </article>
                        <article>
                            <span className="feature-number">2</span>
                            <img
                                src="/assets/food-162-card-400.webp"
                                srcSet="/assets/food-162-card-400.webp 400w, /assets/food-162-card-640.webp 640w"
                                sizes="(max-width: 760px) 42vw, 30vw"
                                alt="Греческий салат"
                                loading="lazy"
                                decoding="async"
                            />
                            <h3>Выбирайте рецепты</h3>
                            <p>Находите подходящие блюда из доступных ингредиентов или изучайте новые идеи.</p>
                        </article>
                        <article>
                            <span className="feature-number">3</span>
                            <img
                                src="/assets/landing-grocery-bag-card-400.webp"
                                srcSet="/assets/landing-grocery-bag-card-400.webp 400w, /assets/landing-grocery-bag-card-640.webp 640w"
                                sizes="(max-width: 760px) 42vw, 30vw"
                                alt="Сумка с продуктами"
                                loading="lazy"
                                decoding="async"
                            />
                            <h3>Планируйте покупки</h3>
                            <p>Составляйте список недостающих продуктов.</p>
                        </article>
                    </div>
                    <p className="feature-note">После готовки обновите запасы.</p>
                </section>
                <section className="landing-tools" aria-label="Дополнительные возможности">
                    <Link href="/plan">
                        <AppIcon name="plan" />
                        <span>
                            <strong>Планирование</strong>Планы питания и списки покупок.
                        </span>
                    </Link>
                    <Link href="/ai">
                        <AppIcon name="ai" />
                        <span>
                            <strong>AI-помощник</strong>Помощь в сценариях вашего тарифа; нужны доступные AI-действия.
                        </span>
                    </Link>
                    <Link href="/family">
                        <AppIcon name="family" />
                        <span>
                            <strong>Для семьи</strong>Общие запасы, планы и покупки — в Plus и Pro.
                        </span>
                    </Link>
                </section>
                <section id="recipes" className="landing-recipes">
                    <div>
                        <p className="eyebrow">Готовьте с удовольствием</p>
                        <h2>Открывайте новые рецепты</h2>
                        <p>
                            Просматривайте публичные рецепты без регистрации. Для сохранения понравившихся рецептов
                            создайте аккаунт.
                        </p>
                        <Link href="/community" className="button outline">
                            Смотреть рецепты
                        </Link>
                    </div>
                    <div className="landing-recipe-examples">
                        <p>Примеры подачи</p>
                        <div className="recipe-preview-grid">
                            {[
                                { image: 'food-161', name: 'Нежный тыквенный суп' },
                                { image: 'food-162', name: 'Греческий салат' },
                                { image: 'food-160', name: 'Паста с овощами' },
                            ].map((recipe) => (
                                <article key={recipe.name}>
                                    <img
                                        src={`/assets/${recipe.image}-card-400.webp`}
                                        srcSet={`/assets/${recipe.image}-card-400.webp 400w, /assets/${recipe.image}-card-640.webp 640w`}
                                        sizes="(max-width: 760px) 30vw, 18vw"
                                        alt={recipe.name}
                                        loading="lazy"
                                        decoding="async"
                                    />
                                    <h3>{recipe.name}</h3>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>
            </div>
        </PublicShell>
    );
}
