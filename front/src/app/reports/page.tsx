import { Suspense } from 'react';
import { RecipeLoading, RecipeReports } from '../../features/recipes/client.js';
export default function Page() {
    return (
        <Suspense fallback={<RecipeLoading />}>
            <RecipeReports />
        </Suspense>
    );
}
