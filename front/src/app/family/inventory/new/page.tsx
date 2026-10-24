import { Suspense } from 'react';
import { InventoryCreatePage } from '../../../../features/inventory/create-page.js';
import { Loading } from '../../../../features/inventory/shared.js';
export const metadata = { title: 'Добавить в семейные запасы', robots: { index: false, follow: false } };
export default function Page() {
    return (
        <Suspense fallback={<Loading />}>
            <InventoryCreatePage scope="family" />
        </Suspense>
    );
}
