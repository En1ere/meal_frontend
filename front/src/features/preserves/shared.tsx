'use client';
import { useEffect, type ReactNode } from 'react';
import { useUi } from '../../app/providers.js';
import { UserAppShell } from '../../ui/AppShell/UserAppShell.js';
import { Guard } from '../auth/session.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import styles from './preserves.module.css';
export function PreserveShell({ children, scope = 'private' }: { children: ReactNode; scope?: 'private' | 'family' }) {
    const family = scope === 'family';
    const setScope = useUi((state) => state.setScope);
    useEffect(() => setScope(family ? 'family' : 'personal'), [family, setScope]);
    return (
        <Guard context="user">
            <UserAppShell scope={family ? 'family' : 'personal'} contentClassName={styles.main}>
                {children}
            </UserAppShell>
        </Guard>
    );
}
export function PreserveLoading() {
    return <ArcSkeleton variant="lines" lines={6} label="Загружаем заготовки" />;
}
export function dayText(value: string | null) {
    return value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('ru-RU') : 'Не указана';
}
export function expiryLabel(value: string | null, today: string) {
    return !value ? 'Срок не указан' : value < today ? 'Срок прошёл — проверьте продукт' : `Годен до ${dayText(value)}`;
}
