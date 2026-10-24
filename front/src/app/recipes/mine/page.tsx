import { Suspense } from 'react';
import { MyRecipes } from '../../../features/recipes/mine.js';
import { RecipeLoading } from '../../../features/recipes/shared.js';
export const metadata = { title: 'Мои рецепты', robots: { index: false, follow: false } };
export default function Page() {
    return (
        <Suspense fallback={<RecipeLoading />}>
            <MyRecipes />
        </Suspense>
    );
}
