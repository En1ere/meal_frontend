import { Suspense } from 'react';
import { PurchasePage, ShoppingLoading } from '../../../../features/shopping/client.js';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return (
        <Suspense fallback={<ShoppingLoading />}>
            <PurchasePage id={id} />
        </Suspense>
    );
}
