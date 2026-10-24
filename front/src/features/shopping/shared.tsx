'use client';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect } from 'react';
import { useUi } from '../../app/providers.js';
import { Guard } from '../auth/session.js';
import { UserAppShell } from '../../ui/AppShell/UserAppShell.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import styles from './shopping.module.css';
export type ShoppingScope = 'private' | 'family';
const ShoppingScopeContext = createContext<ShoppingScope>('private');
export const useShoppingScope = () => useContext(ShoppingScopeContext);
export const shoppingBase = (scope: ShoppingScope) => (scope === 'family' ? '/family/shopping' : '/shopping');
export const receiptBase = (scope: ShoppingScope) => (scope === 'family' ? '/family/receipts' : '/receipts');
export const purchaseBase = (scope: ShoppingScope) => (scope === 'family' ? '/family/purchases' : '/purchases');
export function ShoppingShell({ children, scope = 'private' }: { children: ReactNode; scope?: ShoppingScope }) {
    const family = scope === 'family';
    const setScope = useUi((state) => state.setScope);
    useEffect(() => setScope(family ? 'family' : 'personal'), [family, setScope]);
    return (
        <Guard context="user" allowOffline={scope === 'private'}>
            <ShoppingScopeContext.Provider value={scope}>
                <UserAppShell scope={family ? 'family' : 'personal'} contentClassName={styles.main}>
                    {children}
                </UserAppShell>
            </ShoppingScopeContext.Provider>
        </Guard>
    );
}
export function ShoppingLoading() {
    return <ArcSkeleton variant="lines" lines={5} label="Загружаем покупки" />;
}
export const statusLabels = { active: 'Активен', completed: 'Завершён', archived: 'В архиве' };
