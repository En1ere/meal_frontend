import { Suspense } from 'react';
import { RecipesCatalog } from '../../features/recipes/catalog.js';
import { RecipeLoading } from '../../features/recipes/shared.js';
export const metadata = { title: 'Рецепты', robots: { index: false, follow: false } };
export default function Page() {
    return (
        <Suspense fallback={<RecipeLoading />}>
            <RecipesCatalog />
        </Suspense>
    );
}
