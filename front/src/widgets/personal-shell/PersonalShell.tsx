'use client';
import type { ReactNode } from 'react';
import { UserAppShell } from '../user-app-shell/client.js';
import { OwnershipNotice } from '../../features/family/client.js';
import { SessionGuard } from '../session-guard/client.js';
export function PersonalShell({ children, allowOffline = false }: { children: ReactNode; allowOffline?: boolean }) {
    return (
        <SessionGuard context="user" allowOffline={allowOffline}>
            <UserAppShell>
                <OwnershipNotice />
                {children}
            </UserAppShell>
        </SessionGuard>
    );
}
