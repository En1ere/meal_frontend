import type { ReactNode } from 'react';
import { inventoryShellClassName } from '../../../features/inventory/server.js';
import { GuardedUserAppShell } from '../../../widgets/user-app-shell/client.js';

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <GuardedUserAppShell context="user" scope="family" contentClassName={inventoryShellClassName}>
            {children}
        </GuardedUserAppShell>
    );
}
