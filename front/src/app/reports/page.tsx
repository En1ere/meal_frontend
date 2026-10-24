import { Suspense } from 'react';
import { RecipeReports } from '../../features/recipes/reports.js';
import { RecipeLoading } from '../../features/recipes/shared.js';
export default function Page() {
    return (
        <Suspense fallback={<RecipeLoading />}>
            <RecipeReports />
        </Suspense>
    );
}
