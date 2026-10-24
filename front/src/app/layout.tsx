import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@meal-planner/design-system/styles.css';
import { Providers } from './providers.js';
import { OfflineStatus } from '../features/offline/status.js';
import './globals.css';
export const metadata: Metadata = {
    title: { default: 'Meal Planner', template: '%s · Meal Planner' },
    description: 'Запасы, рецепты и покупки — в одном месте.',
};
export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="ru" suppressHydrationWarning>
            <body>
                <a className="skip-link" href="#main">
                    К содержимому
                </a>
                <OfflineStatus />
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
