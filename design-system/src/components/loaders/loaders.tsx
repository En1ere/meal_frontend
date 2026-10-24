import type { CSSProperties } from 'react';
import styles from './loaders.module.css';

export interface SkeletonProps {
    variant?: 'block' | 'lines';
    height?: CSSProperties['height'];
    width?: CSSProperties['width'];
    lines?: number;
    gap?: CSSProperties['gap'];
    lastLineWidth?: CSSProperties['width'];
    className?: string;
    label?: string | null;
}

export function Skeleton({
    variant = 'block',
    height = '1em',
    width = '100%',
    lines = 3,
    gap = '0.65em',
    lastLineWidth = '70%',
    className = '',
    label = 'Загрузка данных',
}: SkeletonProps) {
    const count = variant === 'lines' && Number.isFinite(lines) ? Math.min(100, Math.max(1, Math.floor(lines))) : 1;
    return (
        <span
            className={`${styles.skeleton} ${className}`.trim()}
            role={label ? 'status' : undefined}
            aria-live={label ? 'polite' : undefined}
            aria-hidden={label ? undefined : true}
            style={{ width, gap }}
        >
            {label && <span className={styles.skeletonLabel}>{label}</span>}
            {Array.from({ length: count }, (_, index) => (
                <span
                    key={index}
                    className={styles.skeletonSurface}
                    aria-hidden="true"
                    style={{ height, width: variant === 'lines' && index === count - 1 ? lastLineWidth : '100%' }}
                />
            ))}
        </span>
    );
}

export interface InlineLoaderProps {
    size?: CSSProperties['width'];
    label?: string | null;
    className?: string;
}

export function InlineLoader({ size = '1em', label = 'Загрузка', className = '' }: InlineLoaderProps) {
    return (
        <span
            className={`${styles.inlineLoader} ${className}`.trim()}
            role={label ? 'status' : undefined}
            aria-live={label ? 'polite' : undefined}
            aria-hidden={label ? undefined : true}
        >
            <span className={styles.spinner} style={{ width: size, height: size }} aria-hidden="true" />
            {label && <span className={styles.loaderLabel}>{label}</span>}
        </span>
    );
}

export interface PageLoaderProps {
    label?: string;
    className?: string;
}

export function PageLoader({ label = 'Загружаем страницу…', className = '' }: PageLoaderProps) {
    return (
        <div className={`${styles.pageLoader} ${className}`.trim()} role="status" aria-live="polite">
            <InlineLoader size="2em" label={null} />
            <span>{label}</span>
        </div>
    );
}
