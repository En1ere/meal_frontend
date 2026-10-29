'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ApiError } from '../../shared/api/client.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import type { InventoryScope } from '../../entities/inventory/model.js';
import styles from './inventory.module.css';

export type { InventoryScope } from '../../entities/inventory/model.js';
export { inventoryScopeQuery, places } from '../../entities/inventory/model.js';
export { expiryText } from '../../entities/inventory/presentation.js';
export { units } from '../../entities/measurement/model.js';
export { commandError } from '../../shared/api/command-error.js';
export { dateText, localDate } from '../../shared/lib/date.js';
export { inventoryBase } from '../../entities/inventory/routes.js';
export function InventoryShell({ children, scope = 'private' }: { children: ReactNode; scope?: InventoryScope }) {
    void scope;
    return children;
}
export function Loading() {
    return <ArcSkeleton variant="lines" lines={6} label="Загружаем запасы" />;
}
export function Failure({ error, retry }: { error: unknown; retry: () => void }) {
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
