'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppIcon, type AppIconName } from '../AppIcon/AppIcon.js';
import styles from './AppShell.module.css';

export interface AppNavigationItem {
    href: string;
    label: string;
    icon: AppIconName;
    active?: boolean;
    badge?: string;
}

export interface AppNavigationGroup {
    label: string;
    items: readonly AppNavigationItem[];
}

export interface AppShellLinkRenderProps {
    href: string;
    className: string;
    children: ReactNode;
    ariaCurrent?: 'page';
    onClick?: () => void;
}

export interface AppShellProps {
    brand: ReactNode;
    navigation: readonly AppNavigationGroup[];
    mobilePrimary: readonly AppNavigationItem[];
    mobileMore: readonly AppNavigationGroup[];
    renderLink: (props: AppShellLinkRenderProps) => ReactNode;
    search: ReactNode;
    utilities: ReactNode;
    children: ReactNode;
    collapsed?: boolean;
    onCollapsedChange?: (collapsed: boolean) => void;
    sidebarFooter?: ReactNode;
    mobileMoreFooter?: ReactNode;
    contentClassName?: string | undefined;
}

function NavItem({
    item,
    renderLink,
    onClick,
}: {
    item: AppNavigationItem;
    renderLink: AppShellProps['renderLink'];
    onClick?: () => void;
}) {
    return renderLink({
        href: item.href,
        className: `${styles.navItem} ${item.active ? styles.active : ''}`.trim(),
        ...(item.active ? { ariaCurrent: 'page' as const } : {}),
        ...(onClick ? { onClick } : {}),
        children: (
            <>
                <AppIcon
                    name={item.icon}
                    className={styles.icon}
                />
                <span className={styles.itemLabel}>{item.label}</span>
                {item.badge && <span className={styles.badge}>{item.badge}</span>}
            </>
        ),
    });
}

export function AppShell({
    brand,
    navigation,
    mobilePrimary,
    mobileMore,
    renderLink,
    search,
    utilities,
    children,
    collapsed = false,
    onCollapsedChange,
    sidebarFooter,
    mobileMoreFooter,
    contentClassName = '',
}: AppShellProps) {
    const [moreOpen, setMoreOpen] = useState(false);
    const drawerRef = useRef<HTMLDivElement>(null);
    const moreButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!moreOpen) return;
        const previousOverflow = document.body.style.overflow;
        const moreButton = moreButtonRef.current;
        document.body.style.overflow = 'hidden';
        const drawer = drawerRef.current;
        const focusable = () =>
            Array.from(drawer?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []);
        focusable()[0]?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setMoreOpen(false);
                return;
            }
            if (event.key !== 'Tab') return;
            const items = focusable();
            if (!items.length) return;
            const first = items[0]!;
            const last = items.at(-1)!;
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', onKeyDown);
            moreButton?.focus();
        };
    }, [moreOpen]);

    const moreActive = mobileMore.some((group) => group.items.some((item) => item.active));
    return (
        <div className={`${styles.shell} ${collapsed ? styles.collapsed : ''}`.trim()}>
            <aside
                className={styles.sidebar}
                aria-label="Боковая навигация"
            >
                <div className={styles.brand}>{brand}</div>
                <nav
                    className={styles.sidebarNav}
                    aria-label="Основная навигация"
                >
                    {navigation.map((group) => (
                        <section
                            className={styles.navGroup}
                            key={group.label}
                            aria-label={group.label}
                        >
                            <p className={styles.groupLabel}>{group.label}</p>
                            {group.items.map((item) => (
                                <NavItem
                                    key={item.href}
                                    item={item}
                                    renderLink={renderLink}
                                />
                            ))}
                        </section>
                    ))}
                </nav>
                {onCollapsedChange && (
                    <button
                        className={styles.collapseButton}
                        type="button"
                        onClick={() => onCollapsedChange(!collapsed)}
                        aria-expanded={!collapsed}
                    >
                        <span aria-hidden="true">«</span>
                        <span className={styles.itemLabel}>Свернуть меню</span>
                    </button>
                )}
                {sidebarFooter && <div className={styles.sidebarFooter}>{sidebarFooter}</div>}
            </aside>
            <div className={styles.workspace}>
                <header className={styles.topbar}>
                    <div className={styles.mobileBrand}>{brand}</div>
                    <div className={styles.search}>{search}</div>
                    <div className={styles.utilities}>{utilities}</div>
                </header>
                <main
                    id="main"
                    className={`${styles.content} ${contentClassName}`.trim()}
                >
                    {children}
                </main>
            </div>
            <nav
                className={styles.mobileDock}
                aria-label="Мобильная навигация"
            >
                {mobilePrimary.map((item) => (
                    <NavItem
                        key={item.href}
                        item={item}
                        renderLink={renderLink}
                    />
                ))}
                <button
                    ref={moreButtonRef}
                    className={`${styles.navItem} ${moreActive ? styles.active : ''}`.trim()}
                    type="button"
                    onClick={() => setMoreOpen(true)}
                    aria-expanded={moreOpen}
                >
                    <AppIcon
                        name="more"
                        className={styles.icon}
                    />
                    <span className={styles.itemLabel}>Ещё</span>
                </button>
            </nav>
            {moreOpen && (
                <div
                    className={styles.scrim}
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setMoreOpen(false);
                    }}
                >
                    <div
                        ref={drawerRef}
                        className={styles.drawer}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="app-more-title"
                    >
                        <div
                            className={styles.drawerHandle}
                            aria-hidden="true"
                        />
                        <header className={styles.drawerHeader}>
                            <h2 id="app-more-title">Ещё</h2>
                            <button
                                type="button"
                                onClick={() => setMoreOpen(false)}
                                aria-label="Закрыть меню"
                            >
                                <AppIcon name="close" />
                            </button>
                        </header>
                        <div className={styles.drawerContent}>
                            {mobileMore.map((group) => (
                                <section
                                    className={styles.drawerGroup}
                                    key={group.label}
                                    aria-label={group.label}
                                >
                                    <h3>{group.label}</h3>
                                    <div className={styles.drawerItems}>
                                        {group.items.map((item) => (
                                            <NavItem
                                                key={item.href}
                                                item={item}
                                                renderLink={renderLink}
                                                onClick={() => setMoreOpen(false)}
                                            />
                                        ))}
                                    </div>
                                </section>
                            ))}
                            {mobileMoreFooter && <div className={styles.drawerFooter}>{mobileMoreFooter}</div>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
