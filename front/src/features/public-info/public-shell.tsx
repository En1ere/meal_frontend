import Link from 'next/link';
import type { ReactNode } from 'react';
import { PublicShell as DesignSystemPublicShell, type PublicNavigationItem } from '@meal-planner/design-system';
import { Brand } from '../../shared/ui/brand.js';
import { ThemeControl } from '../../ui/ThemeControl/ThemeControl.js';
import styles from './public-info.module.css';

type PublicSection = 'about' | 'community' | 'help' | 'pricing' | 'news' | 'legal';

export function PublicShell({ current, children }: { current: PublicSection; children: ReactNode }) {
    const navigation: PublicNavigationItem[] = [
        { href: '/community', label: 'Рецепты', active: current === 'community' },
        { href: '/plan', label: 'Планирование' },
        { href: '/ai', label: 'AI-помощник' },
        { href: '/family', label: 'Для семьи' },
        { href: '/auth', label: 'Войти', tone: 'outline' },
        { href: '/auth/sign-up', label: 'Создать аккаунт', tone: 'primary' },
    ];
    return (
        <DesignSystemPublicShell
            brand={<Brand />}
            navigation={navigation}
            themeControl={<ThemeControl />}
            contentClassName={['help', 'pricing', 'news', 'legal'].includes(current) ? (styles.main ?? '') : ''}
            footerNote="© 2026 Meal Planner. Все права защищены."
            footerNavigation={[
                { href: '/help', label: 'Справка' },
                { href: '/legal/privacy', label: 'Правовые документы' },
            ]}
            renderLink={({ href, className, children: content, ariaCurrent }) => (
                <Link href={href} className={className} aria-current={ariaCurrent}>
                    {content}
                </Link>
            )}
        >
            {children}
        </DesignSystemPublicShell>
    );
}
