import { Suspense } from 'react';
import { PurchasePage } from '../../../features/shopping/purchase-page.js';
import { ShoppingLoading } from '../../../features/shopping/shared.js';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return (
        <Suspense fallback={<ShoppingLoading />}>
            <PurchasePage id={id} />
        </Suspense>
    );
}
