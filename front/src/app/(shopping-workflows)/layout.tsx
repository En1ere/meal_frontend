import type { ReactNode } from 'react';
import { shoppingShellClassName } from '../../features/shopping/server.js';
import { GuardedUserAppShell } from '../../widgets/user-app-shell/client.js';

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <GuardedUserAppShell context="user" allowOffline scope="personal" contentClassName={shoppingShellClassName}>
            {children}
        </GuardedUserAppShell>
    );
}
