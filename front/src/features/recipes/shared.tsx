'use client';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { useUi } from '../../app/providers.js';
import { UserAppShell } from '../../ui/AppShell/UserAppShell.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import { ApiError } from '../../shared/api/client.js';
import styles from './recipes.module.css';
export function RecipeShell({
    children,
    detail = false,
    family = false,
}: {
    children: ReactNode;
    detail?: boolean;
    family?: boolean;
}) {
    const setScope = useUi((state) => state.setScope);
    useEffect(() => setScope(family ? 'family' : 'personal'), [family, setScope]);
    return (
        <UserAppShell
            scope={family ? 'family' : 'personal'}
            contentClassName={`${styles.main} ${detail ? styles['detail-page'] : ''}`.trim()}
        >
            {children}
        </UserAppShell>
    );
}
export function RecipeImage({
    src,
    alt,
    className,
}: {
    src: string | null;
    alt: string;
    className?: string | undefined;
}) {
    const [failed, setFailed] = useState(false);
    if (!src || (!/^\/(?!\/)/.test(src) && !/^https:\/\//.test(src)) || failed)
        return (
            <div className={className ?? styles.panel} role="img" aria-label={`Изображение отсутствует: ${alt}`}>
                Фото ещё не добавлено
            </div>
        );
    return (
        <img src={src} alt={alt} className={className} onError={() => setFailed(true)} referrerPolicy="no-referrer" />
    );
}
export function RecipeLoading() {
    return (
        <div className={styles.stack}>
            <ArcSkeleton height="3em" width="65%" label="Загружаем рецепты" />
            <ArcSkeleton height="18em" label={null} />
        </div>
    );
}
export function RecipeError({ error, retry }: { error: unknown; retry: () => void }) {
    return (
        <section className={styles.panel} role="alert">
            <h2>
                {error instanceof ApiError && error.status === 404
                    ? 'Рецепт недоступен'
                    : 'Не удалось загрузить рецепты'}
            </h2>
            <p>{error instanceof ApiError ? error.message : 'Проверьте подключение и повторите запрос.'}</p>
            <button className="button outline" onClick={retry}>
                Повторить
            </button>
            <Link href="/recipes">К каталогу</Link>
        </section>
    );
}
export function Rating({ rating, count }: { rating: number | null; count: number }) {
    return (
        <span>
            {rating !== null && count > 0
                ? `★ ${rating.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} (${count})`
                : 'Пока нет оценок'}
        </span>
    );
}
export const recipeUnits: Record<string, string> = {
    g: 'г',
    kg: 'кг',
    ml: 'мл',
    l: 'л',
    pcs: 'шт.',
    pack: 'уп.',
    serv: 'порц.',
};

export const categoryLabels: Record<string, string> = {
    breakfast: 'Завтраки',
    soups: 'Супы',
    mains: 'Основные блюда',
    salads: 'Салаты',
    baking: 'Выпечка',
    desserts: 'Десерты',
    snacks: 'Закуски',
    sauces: 'Соусы',
};
export const methodLabels: Record<string, string> = {
    stovetop: 'На плите',
    oven: 'В духовке',
    baking: 'Выпекание',
    boiling: 'Варка',
    frying: 'Жарка',
    steaming: 'На пару',
    raw: 'Без нагрева',
    no_cook: 'Без нагрева',
    grill: 'На гриле',
};
