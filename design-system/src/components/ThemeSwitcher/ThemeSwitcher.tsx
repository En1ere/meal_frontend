import type { ChangeEventHandler } from 'react';
import { themeNames, type ThemeName } from '../../foundations/theme.js';
import styles from './ThemeSwitcher.module.css';

const labels: Record<ThemeName, string> = {
    'coffee-light': 'Кофе · светлая',
    'coffee-dark': 'Кофе · тёмная',
    'nature-light': 'Зелёная · светлая',
    'nature-dark': 'Зелёная · тёмная',
};

export interface ThemeSwitcherProps {
    value: ThemeName;
    onChange: (theme: ThemeName) => void;
    compact?: boolean;
    label?: string;
    className?: string;
}

export function ThemeSwitcher({
    value,
    onChange,
    compact = false,
    label = 'Тема интерфейса',
    className = '',
}: ThemeSwitcherProps) {
    const handleChange: ChangeEventHandler<HTMLSelectElement> = (event) => onChange(event.target.value as ThemeName);
    return (
        <label className={`${styles.root} ${compact ? styles.compact : ''} ${className}`.trim()}>
            <span className={styles.label}>{label}</span>
            <select className={styles.select} value={value} onChange={handleChange} aria-label={compact ? label : undefined}>
                {themeNames.map((theme) => (
                    <option key={theme} value={theme}>
                        {labels[theme]}
                    </option>
                ))}
            </select>
        </label>
    );
}
