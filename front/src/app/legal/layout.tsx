import type { ReactNode } from 'react';
import { PublicShell } from '../../widgets/public-shell/PublicShell.js';

export default function LegalLayout({ children }: { children: ReactNode }) {
    return <PublicShell current="legal">{children}</PublicShell>;
}
