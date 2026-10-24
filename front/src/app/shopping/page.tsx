import { Suspense } from 'react';
import { ShoppingPage } from '../../features/recipes/shopping.js';
import { RecipeLoading } from '../../features/recipes/shared.js';
export default function Page() {
    return (
        <Suspense fallback={<RecipeLoading />}>
            <ShoppingPage />
        </Suspense>
    );
}
