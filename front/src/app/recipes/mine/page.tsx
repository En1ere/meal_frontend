import { Suspense } from 'react';
import { MyRecipes, RecipeLoading } from '../../../features/recipes/client.js';
import { recipeShellClassName } from '../../../features/recipes/server.js';
import { GuardedUserAppShell } from '../../../widgets/user-app-shell/client.js';
export const metadata = { title: 'Мои рецепты', robots: { index: false, follow: false } };
export default function Page() {
    return (
        <Suspense fallback={<RecipeLoading />}>
            <GuardedUserAppShell context="user" allowOffline scope="personal" contentClassName={recipeShellClassName()}>
                <MyRecipes />
            </GuardedUserAppShell>
        </Suspense>
    );
}
