import { Suspense } from 'react';
import { RecipeCooking, RecipeLoading } from '../../../../features/recipes/client.js';
import { recipeShellClassName } from '../../../../features/recipes/server.js';
import { GuardedUserAppShell } from '../../../../widgets/user-app-shell/client.js';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return (
        <Suspense fallback={<RecipeLoading />}>
            <GuardedUserAppShell context="user" allowOffline scope="personal" contentClassName={recipeShellClassName()}>
                <RecipeCooking id={id} />
            </GuardedUserAppShell>
        </Suspense>
    );
}
