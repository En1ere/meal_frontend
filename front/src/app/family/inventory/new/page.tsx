import { Suspense } from 'react';
import { InventoryCreatePage, Loading } from '../../../../features/inventory/client.js';
export const metadata = { title: 'Добавить в семейные запасы', robots: { index: false, follow: false } };
export default function Page() {
    return (
        <Suspense fallback={<Loading />}>
            <InventoryCreatePage scope="family" />
        </Suspense>
    );
}
