import { Suspense } from 'react';
import { ReceiptNewPage } from '../../../features/receipts/new-page.js';
import { ShoppingLoading } from '../../../features/shopping/shared.js';
export default function Page() {
    return (
        <Suspense fallback={<ShoppingLoading />}>
            <ReceiptNewPage />
        </Suspense>
    );
}
