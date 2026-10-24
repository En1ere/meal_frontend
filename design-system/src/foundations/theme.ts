export const themeNames = ['coffee-light', 'coffee-dark', 'nature-light', 'nature-dark'] as const;

export type ThemeName = (typeof themeNames)[number];
export type ThemeFamily = 'coffee' | 'nature';
export type ThemeMode = 'light' | 'dark';

export const defaultClientTheme: ThemeName = 'coffee-light';
export const defaultAdminTheme: ThemeName = 'nature-dark';

export function isThemeName(value: unknown): value is ThemeName {
    return typeof value === 'string' && themeNames.includes(value as ThemeName);
}

export function resolveTheme(value: unknown, fallback: ThemeName): ThemeName {
    if (isThemeName(value)) return value;
    if (value === 'coffee') return fallback.startsWith('coffee-') ? fallback : 'coffee-light';
    if (value === 'nature') return fallback.startsWith('nature-') ? fallback : 'nature-light';
    return fallback;
}

export function themeFamily(theme: ThemeName): ThemeFamily {
    return theme.startsWith('coffee-') ? 'coffee' : 'nature';
}

export function themeMode(theme: ThemeName): ThemeMode {
    return theme.endsWith('-dark') ? 'dark' : 'light';
}
