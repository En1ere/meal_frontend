'use client';

import { type ReactNode } from 'react';
import { ApiError } from '../../shared/api/client.js';
import styles from './moderation.module.css';

export const queueNames: Record<string, string> = {
    recipes: 'Рецепты',
    recipe_variants: 'Варианты рецептов',
    products: 'Продукты',
    reports: 'Жалобы',
    support: 'Поддержка',
    authorship: 'Авторство',
};

export function ModeratorShell({ children }: { children: ReactNode }) {
    return <>{children}</>;
}

export function PageState({ error, retry }: { error: unknown; retry: () => void }) {
    const message =
        error instanceof ApiError && error.status === 403
            ? 'Эта очередь недоступна по вашим правам.'
            : 'Не удалось загрузить данные.';
    return (
        <section className={styles.state} role="alert">
            <h1>{message}</h1>
            <button className="button outline" onClick={retry}>
                Повторить
            </button>
        </section>
    );
}
