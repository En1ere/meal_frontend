import { RecipeEditor } from '../../../features/recipes/client.js';
import { recipeShellClassName } from '../../../features/recipes/server.js';
import { GuardedUserAppShell } from '../../../widgets/user-app-shell/client.js';
export const metadata = { title: 'Новый рецепт', robots: { index: false, follow: false } };
export default function Page() {
    return (
        <GuardedUserAppShell context="user" allowOffline scope="personal" contentClassName={recipeShellClassName()}>
            <RecipeEditor />
        </GuardedUserAppShell>
    );
}
