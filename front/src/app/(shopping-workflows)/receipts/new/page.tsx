import { Suspense } from 'react';
import { ReceiptNewPage, ShoppingLoading } from '../../../../features/shopping/client.js';
export default function Page() {
    return (
        <Suspense fallback={<ShoppingLoading />}>
            <ReceiptNewPage />
        </Suspense>
    );
}
