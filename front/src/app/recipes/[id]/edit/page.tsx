import { RecipeEditor } from '../../../../features/recipes/client.js';
import { recipeShellClassName } from '../../../../features/recipes/server.js';
import { GuardedUserAppShell } from '../../../../widgets/user-app-shell/client.js';
export const metadata = { title: 'Редактор рецепта', robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return (
        <GuardedUserAppShell context="user" allowOffline scope="personal" contentClassName={recipeShellClassName()}>
            <RecipeEditor id={id} />
        </GuardedUserAppShell>
    );
}
