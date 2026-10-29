import { Suspense } from 'react';
import { PreparedStocks, RecipeLoading } from '../../../features/recipes/client.js';
export default function Page() {
    return (
        <Suspense fallback={<RecipeLoading />}>
            <PreparedStocks />
        </Suspense>
    );
}
