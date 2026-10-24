'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useUi } from '../../app/providers.js';
import { UserAppShell } from '../../ui/AppShell/UserAppShell.js';
import { ApiError } from '../../shared/api/client.js';
import { Guard } from '../auth/session.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import styles from './inventory.module.css';

export type InventoryScope = 'private' | 'family';
export const inventoryBase = (scope: InventoryScope) => (scope === 'family' ? '/family/inventory' : '/inventory');
export const inventoryScopeQuery = (scope: InventoryScope) => ({ scope });
export function InventoryShell({ children, scope = 'private' }: { children: ReactNode; scope?: InventoryScope }) {
    const setScope = useUi((state) => state.setScope);
    useEffect(() => setScope(scope === 'family' ? 'family' : 'personal'), [scope, setScope]);
    return (
        <Guard context="user">
            <UserAppShell scope={scope === 'family' ? 'family' : 'personal'} contentClassName={styles.main}>
                {children}
            </UserAppShell>
        </Guard>
    );
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
export const units = { g: 'г', kg: 'кг', ml: 'мл', l: 'л', pcs: 'шт.', pack: 'уп.', serv: 'порц.' };
export const places = {
    fridge: 'Холодильник',
    freezer: 'Морозилка',
    cabinet: 'Шкаф',
    pantry: 'Кладовая',
    shelf: 'Полка',
};
export function localDate(now = new Date()) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function dateText(value: string | null) {
    return value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('ru-RU') : 'Не указана';
}
export function expiryText(value: string | null) {
    if (!value) return 'Срок не указан';
    const days = Math.round((Date.parse(value) - Date.parse(localDate())) / 86400000);
    return days < 0 ? 'Срок истёк' : days === 0 ? 'Истекает сегодня' : `Через ${days} дн.`;
}
export function commandError(error: unknown) {
    if (error instanceof ApiError)
        return error.status === 412
            ? 'Запись изменилась. Ваш ввод сохранён. Обновите данные и проверьте изменения перед повторным сохранением.'
            : error.message;
    return 'Ответ не получен. Проверьте состояние: повтор того же действия использует прежний ключ и не создаст дубль.';
}
