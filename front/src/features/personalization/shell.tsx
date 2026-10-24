'use client';
import type { ReactNode } from 'react';
import { UserAppShell } from '../../ui/AppShell/UserAppShell.js';
import { OwnershipNotice } from '../family/ownership-notice.js';
export function PersonalShell({ children }: { children: ReactNode }) {
    return (
        <UserAppShell>
            <OwnershipNotice />
            {children}
        </UserAppShell>
    );
}
