import { Suspense } from 'react';
import { ShoppingPage } from '../../../features/recipes/shopping.js';
import { RecipeLoading } from '../../../features/recipes/shared.js';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return (
        <Suspense fallback={<RecipeLoading />}>
            <ShoppingPage id={id} />
        </Suspense>
    );
}
