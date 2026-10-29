import { Suspense } from 'react';
import { ReceiptDetailPage, ShoppingLoading } from '../../../../features/shopping/client.js';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return (
        <Suspense fallback={<ShoppingLoading />}>
            <ReceiptDetailPage id={id} />
        </Suspense>
    );
}
