import type { ReactNode } from 'react';
import styles from './PublicShell.module.css';

export interface PublicNavigationItem {
    href: string;
    label: string;
    active?: boolean;
    tone?: 'plain' | 'outline' | 'primary';
}

export interface PublicShellLinkRenderProps {
    href: string;
    className: string;
    children: ReactNode;
    ariaCurrent?: 'page';
}

export interface PublicShellProps {
    brand: ReactNode;
    navigation: readonly PublicNavigationItem[];
    renderLink: (props: PublicShellLinkRenderProps) => ReactNode;
    themeControl: ReactNode;
    children: ReactNode;
    footerNavigation?: readonly PublicNavigationItem[];
    footerNote?: ReactNode;
    contentClassName?: string;
}

function NavigationLink({
    item,
    renderLink,
}: {
    item: PublicNavigationItem;
    renderLink: PublicShellProps['renderLink'];
}) {
    return renderLink({
        href: item.href,
        className: `${styles.link} ${styles[item.tone ?? 'plain']}`.trim(),
        ...(item.active ? { ariaCurrent: 'page' as const } : {}),
        children: item.label,
    });
}

export function PublicShell({
    brand,
    navigation,
    renderLink,
    themeControl,
    children,
    footerNavigation = [],
    footerNote,
    contentClassName = '',
}: PublicShellProps) {
    const primaryNavigation = navigation.filter((item) => !item.tone);
    const actions = navigation.filter((item) => item.tone);

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.brand}>{brand}</div>
                <nav
                    className={styles.navigation}
                    aria-label="Публичная навигация"
                >
                    {primaryNavigation.map((item) => (
                        <NavigationLink
                            key={item.href}
                            item={item}
                            renderLink={renderLink}
                        />
                    ))}
                </nav>
                {!!actions.length && (
                    <div
                        className={styles.actions}
                        aria-label="Действия"
                    >
                        {actions.map((item) => (
                            <NavigationLink
                                key={item.href}
                                item={item}
                                renderLink={renderLink}
                            />
                        ))}
                    </div>
                )}
            </header>
            <main
                id="main"
                className={`${styles.content} ${contentClassName}`.trim()}
            >
                {children}
            </main>
            <footer className={styles.footer}>
                <div>{brand}</div>
                {footerNote && <div className={styles.footerNote}>{footerNote}</div>}
                {!!footerNavigation.length && (
                    <nav
                        className={styles.footerNavigation}
                        aria-label="Ссылки в подвале"
                    >
                        {footerNavigation.map((item) => (
                            <NavigationLink
                                key={item.href}
                                item={item}
                                renderLink={renderLink}
                            />
                        ))}
                    </nav>
                )}
                <div className={styles.footerTheme}>{themeControl}</div>
            </footer>
        </div>
    );
}
