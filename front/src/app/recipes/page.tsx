import { Suspense } from 'react';
import { RecipeLoading, RecipesCatalog } from '../../features/recipes/client.js';
import { recipeShellClassName } from '../../features/recipes/server.js';
import { GuardedUserAppShell } from '../../widgets/user-app-shell/client.js';
export const metadata = { title: 'Рецепты', robots: { index: false, follow: false } };
export default function Page() {
    return (
        <Suspense fallback={<RecipeLoading />}>
            <GuardedUserAppShell context="user" scope="personal" contentClassName={recipeShellClassName()}>
                <RecipesCatalog />
            </GuardedUserAppShell>
        </Suspense>
    );
}
