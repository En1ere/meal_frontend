'use client';

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './ServiceShell.module.css';

export interface ServiceNavigationItem {
    href: string;
    label: string;
    active?: boolean;
    nested?: boolean;
}

export interface ServiceNavigationGroup {
    label: string;
    items: readonly ServiceNavigationItem[];
}

export interface ServiceShellLinkRenderProps {
    href: string;
    className: string;
    children: ReactNode;
    ariaCurrent?: 'page';
    onClick?: () => void;
}

export interface ServiceShellProps {
    brand: ReactNode;
    context: string;
    navigation: readonly ServiceNavigationGroup[];
    renderLink: (props: ServiceShellLinkRenderProps) => ReactNode;
    themeControl: ReactNode;
    children: ReactNode;
}

export function ServiceShell({ brand, context, navigation, renderLink, themeControl, children }: ServiceShellProps) {
    const [open, setOpen] = useState(false);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const drawerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        const node = dialogRef.current;
        if (!node) return;
        if (open && !node.open) {
            node.showModal();
            drawerRef.current?.querySelector<HTMLElement>('button, a[href]')?.focus();
        }
        if (!open && node.open) node.close();
    }, [open]);

    const closeDialog = () => setOpen(false);

    const navigationView = (onSelect?: () => void) => (
        <nav
            className={styles.navigation}
            aria-label="Разделы администрирования"
        >
            {navigation.map((group) => (
                <section
                    className={styles.group}
                    key={group.label}
                    aria-label={group.label}
                >
                    <h2>{group.label}</h2>
                    {group.items.map((item) => (
                        <Fragment key={item.href}>
                            {renderLink({
                                href: item.href,
                                className: `${styles.link} ${item.nested ? styles.nested : ''}`.trim(),
                                ...(item.active ? { ariaCurrent: 'page' as const } : {}),
                                ...(onSelect ? { onClick: onSelect } : {}),
                                children: item.label,
                            })}
                        </Fragment>
                    ))}
                </section>
            ))}
        </nav>
    );

    return (
        <div className={styles.shell}>
            <aside className={styles.sidebar}>
                <div className={styles.brand}>{brand}</div>
                <p className={styles.context}>{context}</p>
                <div className={styles.theme}>{themeControl}</div>
                {navigationView()}
            </aside>
            <header className={styles.mobileHeader}>
                <div>
                    {brand}
                    <p className={styles.context}>{context}</p>
                </div>
                <button
                    ref={triggerRef}
                    type="button"
                    onClick={() => setOpen(true)}
                    aria-expanded={open}
                >
                    Меню
                </button>
            </header>
            <main
                id="main"
                className={styles.main}
                tabIndex={-1}
            >
                {children}
            </main>
            <dialog
                ref={dialogRef}
                className={styles.scrim}
                aria-labelledby="service-menu-title"
                onClose={() => setOpen(false)}
                onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}
            >
                <div
                    ref={drawerRef}
                    className={styles.drawer}
                >
                    <header>
                        <strong id="service-menu-title">{context}</strong>
                        <button
                            type="button"
                            onClick={closeDialog}
                        >
                            Закрыть
                        </button>
                    </header>
                    <div className={styles.drawerTheme}>{themeControl}</div>
                    {navigationView(closeDialog)}
                </div>
            </dialog>
        </div>
    );
}
