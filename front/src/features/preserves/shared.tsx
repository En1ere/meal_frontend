'use client';
import type { ReactNode } from 'react';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
export function PreserveShell({ children, scope = 'private' }: { children: ReactNode; scope?: 'private' | 'family' }) {
    void scope;
    return children;
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
