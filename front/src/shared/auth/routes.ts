import type { Principal } from '../api/contracts.generated.js';
export type AuthContext = Exclude<Principal['context'], 'admin'>;
export const authRoutes = {
    user: { login: '/auth', home: '/', mfa: '/auth' },
    moderator: { login: '/moderation/sign-in', home: '/moderation', mfa: '/moderation/mfa' },
} as const;
// Only currently implemented protected destinations are allowed; expand alongside actual routes/guards.
export function safeReturnTo(value: string | null | undefined, context: AuthContext): string {
    const fallback = authRoutes[context].home;
    if (
        !value ||
        value.length > 2048 ||
        value !== value.trim() ||
        /[\\\u0000-\u0020]/.test(value) ||
        !value.startsWith('/') ||
        value.startsWith('//')
    )
        return fallback;
    try {
        const url = new URL(value, 'https://internal.invalid');
        const allowed: readonly string[] =
            context === 'user'
                ? [
                      '/',
                      '/profile',
                      '/achievements',
                      '/reputation',
                      '/community',
                      '/support',
                      '/support/new',
                      '/ai',
                      '/ai/history',
                      '/ai/balance',
                      '/diary',
                      '/diary/analytics',
                      '/settings',
                      '/settings/privacy',
                      '/search',
                      '/exports',
                      '/ai/appeals',
                      '/settings/preferences',
                      '/settings/notifications',
                      '/settings/account',
                      '/settings/account/lifecycle',
                      '/settings/offline',
                      '/settings/subscription',
                      '/inventory',
                      '/inventory/new',
                      '/inventory/locations',
                      '/inventory/history',
                      '/inventory/scan',
                      '/inventory/import',
                      '/products/new',
                      '/recipes',
                      '/recipes/new',
                      '/recipes/mine',
                      '/recipes/offline',
                      '/shopping',
                      '/plan',
                      '/receipts/new',
                      '/reports',
                      '/preserves',
                      '/inventory/prepared',
                      '/family',
                      '/family/access',
                      '/family/members',
                      '/family/setup',
                      '/family/plan',
                      '/family/chat',
                      '/family/notes',
                      '/family/notes/new',
                      '/family/preserves',
                      '/family/invite',
                      '/family/ownership',
                      '/family/inventory',
                      '/family/inventory/new',
                      '/family/inventory/locations',
                      '/family/inventory/history',
                      '/family/inventory/scan',
                      '/family/inventory/import',
                      '/family/recipes',
                      '/family/recipes/new',
                      '/family/shopping',
                      '/family/receipts/new',
                  ]
                : [fallback];
        const domain =
            (context === 'user' &&
                (/^\/authors\/[a-zA-Z0-9_%.-]+(?:\/(?:achievements|reputation))?$/.test(url.pathname) ||
                    /^\/(?:inventory\/batches|products|recipes|shopping|receipts|purchases|reports|preserves|support|ai\/appeals|family\/(?:notes|preserves|purchases|receipts|shopping))\/[0-9a-f-]{36}$/i.test(
                        url.pathname,
                    ) ||
                    /^\/family\/inventory\/batches\/[0-9a-f-]{36}$/i.test(url.pathname) ||
                    /^\/family\/recipes\/[0-9a-f-]{36}(?:\/edit)?$/i.test(url.pathname) ||
                    /^\/ai\/[0-9a-f-]{36}$/i.test(url.pathname) ||
                    /^\/family\/notes\/[0-9a-f-]{36}\/edit$/i.test(url.pathname) ||
                    /^\/family\/ownership\/requests\/[0-9a-f-]{36}$/i.test(url.pathname) ||
                    /^\/recipes\/[0-9a-f-]{36}\/(?:cook|edit)$/i.test(url.pathname))) ||
            (context === 'moderator' &&
                (/^\/moderation\/queues\/(?:recipes|recipe_variants|products|reports|support|authorship)$/.test(
                    url.pathname,
                ) ||
                    /^\/moderation\/(?:items|support)\/[0-9a-f-]{36}$/i.test(url.pathname)));
        if (
            url.origin !== 'https://internal.invalid' ||
            (!allowed.includes(url.pathname) && !domain) ||
            (url.search &&
                !(
                    /^\/(?:search|community|settings\/subscription|inventory|products|recipes|shopping|receipts|purchases|reports|preserves|plan|family\/(?:plan|notes|chat|preserves|invite|inventory|recipes|shopping|receipts|purchases))(?:\/|$)/.test(
                        url.pathname,
                    ) ||
                    (context === 'moderator' && /^\/moderation\/queues\//.test(url.pathname))
                )) ||
            url.hash
        )
            return fallback;
        return url.pathname + url.search;
    } catch {
        return fallback;
    }
}
