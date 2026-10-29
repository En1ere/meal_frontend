'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import {
    AppIcon,
    AppShell,
    type AppNavigationGroup,
    type AppNavigationItem,
    type AppShellLinkRenderProps,
} from '@meal-planner/design-system';
import { useUi } from '../../shared/runtime/index.js';
import { useSession } from '../../entities/session/client.js';
import { useWorkspaceScope } from '../../entities/workspace-scope/client.js';
import { SessionGuard } from '../session-guard/client.js';
import type { AuthContext } from '../../shared/auth/routes.js';
import { Brand } from '../../shared/ui/brand.js';
import { ThemeControl } from '../../shared/ui/theme-control.js';
import styles from './UserAppShell.module.css';

type Scope = 'personal' | 'family';

export interface UserAppShellProps {
    children: ReactNode;
    scope?: Scope;
    contentClassName?: string | undefined;
}

const activeSection = (pathname: string) => {
    if (pathname === '/') return 'home';
    if (/^\/(?:family\/)?inventory(?:\/|$)|^\/products(?:\/|$)/.test(pathname)) return 'inventory';
    if (/^\/(?:family\/)?recipes(?:\/|$)|^\/reports(?:\/|$)/.test(pathname)) return 'recipes';
    if (/^\/(?:family\/)?plan(?:\/|$)/.test(pathname)) return 'plan';
    if (/^\/(?:family\/)?(?:shopping|receipts|purchases)(?:\/|$)/.test(pathname)) return 'shopping';
    if (/^\/family(?:\/|$)/.test(pathname)) return 'family';
    if (/^\/community(?:\/|$)/.test(pathname)) return 'community';
    if (/^\/pro(?:\/|$)/.test(pathname)) return 'pro';
    if (/^\/diary(?:\/|$)/.test(pathname)) return 'diary';
    if (/^\/finance(?:\/|$)/.test(pathname)) return 'finance';
    if (/^\/(?:profile|achievements|reputation)(?:\/|$)/.test(pathname)) return 'profile';
    if (/^\/settings(?:\/|$)/.test(pathname)) return 'settings';
    return null;
};

const withActive = (item: AppNavigationItem, section: string | null) => ({ ...item, active: item.href === section });

export function UserAppShell({ children, scope: scopeOverride, contentClassName }: UserAppShellProps) {
    const pathname = usePathname();
    const storedScope = useWorkspaceScope((state) => state.scope);
    const collapsed = useUi((state) => state.collapsed);
    const toggleSidebar = useUi((state) => state.toggleSidebar);
    const session = useSession(pathname.startsWith('/moderation') ? 'moderator' : 'user');
    const scope = scopeOverride ?? storedScope;
    const family = scope === 'family';
    const section = activeSection(pathname);
    const targets = {
        inventory: family ? '/family/inventory' : '/inventory',
        recipes: family ? '/family/recipes' : '/recipes',
        plan: family ? '/family/plan' : '/plan',
        shopping: family ? '/family/shopping' : '/shopping',
    };
    const planning = [
        { href: 'home', label: 'Дом', icon: 'home' },
        { href: 'inventory', label: 'Запасы', icon: 'inventory' },
        { href: 'recipes', label: 'Рецепты', icon: 'recipes' },
        { href: 'plan', label: 'План', icon: 'plan' },
        { href: 'shopping', label: 'Покупки', icon: 'shopping' },
    ] as const;
    const navigation: AppNavigationGroup[] = [
        {
            label: 'Планирование',
            items: planning.map((item) =>
                withActive(
                    { ...item, href: item.href === 'home' ? '/' : targets[item.href] },
                    section === 'home' ? '/' : section ? (targets[section as keyof typeof targets] ?? section) : null,
                ),
            ),
        },
        {
            label: 'Вместе',
            items: [
                withActive(
                    { href: '/family', label: 'Семья', icon: 'family', badge: 'Plus' },
                    section === 'family' ? '/family' : null,
                ),
                withActive(
                    { href: '/community', label: 'Сообщество', icon: 'community' },
                    section === 'community' ? '/community' : null,
                ),
            ],
        },
        {
            label: 'Pro',
            items: [
                withActive(
                    { href: '/pro', label: 'Обзор Pro', icon: 'achievements' },
                    section === 'pro' ? '/pro' : null,
                ),
                withActive({ href: '/diary', label: 'Дневник', icon: 'diary' }, section === 'diary' ? '/diary' : null),
                withActive(
                    { href: '/finance', label: 'Финансы', icon: 'shopping' },
                    section === 'finance' ? '/finance' : null,
                ),
            ],
        },
        {
            label: 'Аккаунт',
            items: [
                withActive(
                    { href: '/profile', label: 'Профиль', icon: 'profile' },
                    section === 'profile' ? '/profile' : null,
                ),
                withActive(
                    { href: '/settings', label: 'Настройки', icon: 'settings' },
                    section === 'settings' ? '/settings' : null,
                ),
            ],
        },
    ];
    const mobilePrimary = navigation[0]!.items.slice(0, 4);
    const mobileMore: AppNavigationGroup[] = [
        {
            label: 'Основное',
            items: [
                navigation[0]!.items[4]!,
                navigation[1]!.items[0]!,
                navigation[1]!.items[1]!,
                { href: '/ai', label: 'AI-помощник', icon: 'ai', active: pathname.startsWith('/ai') },
            ],
        },
        {
            label: 'Pro',
            items: navigation[2]!.items,
        },
        {
            label: 'Аккаунт',
            items: [
                navigation[3]!.items[0]!,
                {
                    href: '/achievements',
                    label: 'Достижения',
                    icon: 'achievements',
                    active: pathname === '/achievements',
                },
                {
                    href: '/notifications',
                    label: 'Уведомления',
                    icon: 'notifications',
                    active: pathname.startsWith('/notifications'),
                },
                navigation[3]!.items[1]!,
            ],
        },
        {
            label: 'Помощь',
            items: [
                { href: '/news', label: 'Новости', icon: 'news', active: pathname.startsWith('/news') },
                { href: '/support', label: 'Поддержка', icon: 'support', active: pathname.startsWith('/support') },
            ],
        },
    ];
    const renderLink = ({ href, className, children: linkChildren, ariaCurrent, onClick }: AppShellLinkRenderProps) => (
        <Link
            href={href}
            className={className}
            {...(ariaCurrent ? { 'aria-current': ariaCurrent } : {})}
            {...(onClick ? { onClick } : {})}
        >
            {linkChildren}
        </Link>
    );
    const initials = session.data?.displayName?.trim().slice(0, 2).toUpperCase() || 'МП';
    return (
        <AppShell
            brand={<Brand />}
            navigation={navigation}
            mobilePrimary={mobilePrimary}
            mobileMore={mobileMore}
            renderLink={renderLink}
            collapsed={collapsed}
            onCollapsedChange={() => toggleSidebar()}
            contentClassName={contentClassName}
            search={
                <form className={styles.search} action="/search">
                    <AppIcon name="search" />
                    <input
                        name="q"
                        type="search"
                        aria-label="Поиск"
                        placeholder="Поиск рецептов, продуктов, авторов…"
                    />
                </form>
            }
            utilities={
                <>
                    <div className={styles['desktop-theme']}>
                        <ThemeControl />
                    </div>
                    <Link className={styles.utility} href="/notifications" aria-label="Уведомления">
                        <AppIcon name="notifications" />
                    </Link>
                    <Link
                        className={styles.avatar}
                        href="/profile"
                        aria-label={session.data?.displayName ? `Профиль: ${session.data.displayName}` : 'Профиль'}
                    >
                        {initials}
                    </Link>
                </>
            }
            mobileMoreFooter={<ThemeControl compact={false} />}
            sidebarFooter={<span>Meal Planner</span>}
        >
            {children}
        </AppShell>
    );
}

export function GuardedUserAppShell({
    context,
    allowOffline = false,
    ...shellProps
}: UserAppShellProps & { context: AuthContext; allowOffline?: boolean }) {
    return (
        <SessionGuard context={context} allowOffline={allowOffline}>
            <UserAppShell {...shellProps} />
        </SessionGuard>
    );
}
