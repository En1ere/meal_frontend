import type { ReactNode } from 'react';
import { PersonalShell } from '../../../widgets/personal-shell/client.js';

export default function Layout({ children }: { children: ReactNode }) {
    return <PersonalShell>{children}</PersonalShell>;
}
