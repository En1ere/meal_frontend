'use client';
import Link from 'next/link';
import { PurchaseResolution } from './purchase-resolution.js';
import { ShoppingShell, shoppingBase, useShoppingScope, type ShoppingScope } from './shared.js';
import styles from './shopping.module.css';

function PurchaseContent({ id }: { id: string }) {
    const scope = useShoppingScope();
    return (
        <>
            <div className={styles.heading}>
                <div>
                    <p>Зафиксированная покупка</p>
                    <h1>Покупка</h1>
                </div>
                <Link href={shoppingBase(scope)}>К спискам</Link>
            </div>
            <PurchaseResolution id={id} />
        </>
    );
}
export function PurchasePage({ id, scope = 'private' }: { id: string; scope?: ShoppingScope }) {
    return (
        <ShoppingShell scope={scope}>
            <PurchaseContent id={id} />
        </ShoppingShell>
    );
}
