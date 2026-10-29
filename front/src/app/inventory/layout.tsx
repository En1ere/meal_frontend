import type { ReactNode } from 'react';
import { InventoryRouteShell } from './route-shell.js';

export default function Layout({ children }: { children: ReactNode }) {
    return <InventoryRouteShell>{children}</InventoryRouteShell>;
}
