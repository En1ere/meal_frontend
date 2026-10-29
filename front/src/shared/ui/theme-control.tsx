'use client';

import { ThemeSwitcher } from '@meal-planner/design-system';
import { useUi } from '../runtime/index.js';

export function ThemeControl({ compact = true, className }: { compact?: boolean; className?: string }) {
    const theme = useUi((state) => state.theme);
    const setTheme = useUi((state) => state.setTheme);
    return <ThemeSwitcher value={theme} onChange={setTheme} compact={compact} {...(className ? { className } : {})} />;
}
