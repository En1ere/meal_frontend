import type { ReactNode } from 'react';
import { recipeShellClassName } from '../../../features/recipes/server.js';
import { GuardedUserAppShell } from '../../../widgets/user-app-shell/client.js';

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <GuardedUserAppShell context="user" scope="family" contentClassName={recipeShellClassName()}>
            {children}
        </GuardedUserAppShell>
    );
}
