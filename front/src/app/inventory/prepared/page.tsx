import { Suspense } from 'react';
import { PreparedStocks } from '../../../features/recipes/prepared.js';
import { RecipeLoading } from '../../../features/recipes/shared.js';
export default function Page() {
    return (
        <Suspense fallback={<RecipeLoading />}>
            <PreparedStocks />
        </Suspense>
    );
}
