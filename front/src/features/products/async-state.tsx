'use client';

import Link from 'next/link';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import { ApiError } from '../../shared/api/client.js';
import styles from './products.module.css';

export function ProductLoading() {
    return <ArcSkeleton variant="lines" lines={6} label="Загружаем запасы" />;
}

export function ProductFailure({ error, retry }: { error: unknown; retry: () => void }) {
    return (
        <section role="alert" className={styles.card}>
            <h2>
                {error instanceof ApiError && error.status === 404
                    ? 'Запись недоступна'
                    : 'Не удалось загрузить данные'}
            </h2>
            <p>{error instanceof ApiError ? error.message : 'Проверьте подключение.'}</p>
            <button className="button outline" onClick={retry}>
                Повторить
            </button>
            <Link href="/inventory">К запасам</Link>
        </section>
    );
}
