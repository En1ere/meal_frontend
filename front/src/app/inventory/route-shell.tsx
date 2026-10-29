'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { inventoryShellClassName } from '../../features/inventory/server.js';
import { recipeShellClassName } from '../../features/recipes/server.js';
import { GuardedUserAppShell } from '../../widgets/user-app-shell/client.js';

export function InventoryRouteShell({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    return (
        <GuardedUserAppShell
            context="user"
            scope="personal"
            contentClassName={pathname === '/inventory/prepared' ? recipeShellClassName() : inventoryShellClassName}
        >
            {children}
        </GuardedUserAppShell>
    );
}
