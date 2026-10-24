import { Suspense } from 'react';
import { InventoryPage } from '../../features/inventory/list-page.js';
import { Loading } from '../../features/inventory/shared.js';
export const metadata = { title: 'Мои запасы', robots: { index: false, follow: false } };
export default function Page() {
    return (
        <Suspense fallback={<Loading />}>
            <InventoryPage />
        </Suspense>
    );
}
