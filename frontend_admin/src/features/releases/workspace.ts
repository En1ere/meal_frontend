import { useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../app/providers.js';
import { loadReleaseWorkspace } from './api.js';

export const releaseWorkspaceKey = ['admin', 'content-releases'] as const;

export function useReleaseWorkspace() {
    const { api } = useRuntime();
    return useQuery({
        queryKey: releaseWorkspaceKey,
        enabled: !!api,
        queryFn: ({ signal }) => {
            if (!api) throw new Error('Подключение не готово');
            return loadReleaseWorkspace(api, signal);
        },
    });
}

export const groupLabels = {
    culinary: 'Кулинарные',
    inventory_planning: 'Запасы и план',
    author: 'Авторские',
    community_catalog: 'Сообщество и каталог',
    collections_family: 'Коллекции и семья',
    seasonal_secret: 'Сезонные и секретные',
} as const;

export async function checksum(value: unknown) {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function achievementIconUrl(icon: { fallbackKey: string }) {
    const allowed = new Set([
        'food-014',
        'food-020',
        'food-087',
        'medal-gold-chef',
        'medal-silver-dialog',
        'medal-bronze-book',
    ]);
    const key = allowed.has(icon.fallbackKey) ? icon.fallbackKey : 'medal-bronze-book';
    return `/assets/achievements/${key}.png`;
}
