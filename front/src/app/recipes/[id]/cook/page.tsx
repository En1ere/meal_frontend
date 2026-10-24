import { Suspense } from 'react';
import { RecipeCooking } from '../../../../features/recipes/cooking.js';
import { RecipeLoading } from '../../../../features/recipes/shared.js';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return (
        <Suspense fallback={<RecipeLoading />}>
            <RecipeCooking id={id} />
        </Suspense>
    );
}
