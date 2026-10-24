import { Suspense } from 'react';
import { ReceiptDetailPage } from '../../../features/receipts/detail-page.js';
import { ShoppingLoading } from '../../../features/shopping/shared.js';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return (
        <Suspense fallback={<ShoppingLoading />}>
            <ReceiptDetailPage id={id} />
        </Suspense>
    );
}
