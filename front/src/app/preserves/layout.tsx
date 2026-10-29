import type { ReactNode } from 'react';
import { preservesShellClassName } from '../../features/preserves/server.js';
import { GuardedUserAppShell } from '../../widgets/user-app-shell/client.js';

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <GuardedUserAppShell context="user" scope="personal" contentClassName={preservesShellClassName}>
            {children}
        </GuardedUserAppShell>
    );
}
