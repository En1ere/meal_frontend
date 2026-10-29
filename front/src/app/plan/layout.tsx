import type { ReactNode } from 'react';
import { mealPlanShellClassName } from '../../features/meal-plan/server.js';
import { GuardedUserAppShell } from '../../widgets/user-app-shell/client.js';

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <GuardedUserAppShell context="user" scope="personal" contentClassName={mealPlanShellClassName}>
            {children}
        </GuardedUserAppShell>
    );
}
