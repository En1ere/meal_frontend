import { Suspense } from 'react';
import { CommunityPage } from '../../features/community/community.js';
import { RecipeLoading } from '../../features/recipes/shared.js';
export const metadata = { title: 'Рецепты сообщества' };
export default function Page() {
    return (
        <Suspense fallback={<RecipeLoading />}>
            <CommunityPage />
        </Suspense>
    );
}
