import { Suspense } from 'react';
import { ShoppingLoading, ShoppingPage } from '../../../../features/shopping/client.js';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return (
        <Suspense fallback={<ShoppingLoading />}>
            <ShoppingPage id={id} />
        </Suspense>
    );
}
