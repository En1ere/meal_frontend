import type { ReactNode } from 'react';
import styles from './AuthShell.module.css';

export interface AuthShellProps {
    brand: ReactNode;
    themeControl: ReactNode;
    art: { src: string; alt: string };
    artCaption?: ReactNode;
    children: ReactNode;
    service?: boolean;
}

export function AuthShell({ brand, themeControl, art, artCaption, children, service = false }: AuthShellProps) {
    return (
        <main
            id="main"
            className={`${styles.layout} ${service ? styles.service : ''}`.trim()}
        >
            <aside
                className={styles.art}
                aria-label={art.alt}
            >
                <img
                    src={art.src}
                    alt=""
                />
                {artCaption && <div className={styles.caption}>{artCaption}</div>}
            </aside>
            <section className={styles.panel}>
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        {brand}
                        <div className={styles.theme}>{themeControl}</div>
                    </div>
                    <div className={`${styles.body} auth-content`}>{children}</div>
                </div>
            </section>
        </main>
    );
}
