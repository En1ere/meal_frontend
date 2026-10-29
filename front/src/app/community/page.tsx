import { Suspense } from 'react';
import { CommunityPage, RecipeLoading } from '../../features/recipes/client.js';
import { PublicShell } from '../../widgets/public-shell/index.js';
export const metadata = { title: 'Рецепты сообщества' };
export default function Page() {
    return (
        <PublicShell current="community">
            <Suspense fallback={<RecipeLoading />}>
                <CommunityPage />
            </Suspense>
        </PublicShell>
    );
}
