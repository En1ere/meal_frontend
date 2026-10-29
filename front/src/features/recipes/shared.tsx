'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
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
    void family;
    void detail;
    return <>{children}</>;
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
