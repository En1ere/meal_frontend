'use client';
import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
export type ShoppingScope = 'private' | 'family';
const ShoppingScopeContext = createContext<ShoppingScope>('private');
export const useShoppingScope = () => useContext(ShoppingScopeContext);
export const shoppingBase = (scope: ShoppingScope) => (scope === 'family' ? '/family/shopping' : '/shopping');
export const receiptBase = (scope: ShoppingScope) => (scope === 'family' ? '/family/receipts' : '/receipts');
export const purchaseBase = (scope: ShoppingScope) => (scope === 'family' ? '/family/purchases' : '/purchases');
export function ShoppingShell({ children, scope = 'private' }: { children: ReactNode; scope?: ShoppingScope }) {
    return <ShoppingScopeContext.Provider value={scope}>{children}</ShoppingScopeContext.Provider>;
}
export function ShoppingLoading() {
    return <ArcSkeleton variant="lines" lines={5} label="Загружаем покупки" />;
}
export const statusLabels = { active: 'Активен', completed: 'Завершён', archived: 'В архиве' };
