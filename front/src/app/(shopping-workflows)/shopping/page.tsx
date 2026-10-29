import { Suspense } from 'react';
import { ShoppingLoading, ShoppingPage } from '../../../features/shopping/client.js';
export default function Page() {
    return (
        <Suspense fallback={<ShoppingLoading />}>
            <ShoppingPage />
        </Suspense>
    );
}
