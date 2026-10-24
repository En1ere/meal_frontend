import type { ReactNode } from 'react';
import { AuthShell as DesignSystemAuthShell } from '@meal-planner/design-system';
import { Brand } from '../../shared/ui/brand.js';
import { ThemeControl } from '../../ui/ThemeControl/ThemeControl.js';
export function AuthShell({ children, staff = false }: { children: ReactNode; staff?: boolean }) {
    return (
        <DesignSystemAuthShell
            service={staff}
            brand={<Brand large />}
            themeControl={<ThemeControl />}
            art={{ src: '/assets/auth-cover-720x768.webp', alt: 'Уютная кухня в зелёной теме' }}
            artCaption={
                <p>
                    Планируйте вкусные блюда и экономьте
                    <br />
                    время каждый день.
                </p>
            }
        >
            {children}
        </DesignSystemAuthShell>
    );
}
