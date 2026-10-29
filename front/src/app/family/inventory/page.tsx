import { Suspense } from 'react';
import { InventoryPage, Loading } from '../../../features/inventory/client.js';
export const metadata = { title: 'Семейные запасы', robots: { index: false, follow: false } };
export default function Page() {
    return (
        <Suspense fallback={<Loading />}>
            <InventoryPage scope="family" />
        </Suspense>
    );
}
