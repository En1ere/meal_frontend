export type AuthContext = 'admin';
export const authRoutes = { admin: { login: '/auth', home: '/', mfa: '/auth/mfa' } } as const;
// Only existing local protected destinations may be used after sign-in.
export function safeReturnTo(value: string | null | undefined, context: AuthContext): string {
    const canonicalPath =
        /^\/admin\/(?:queues\/recipes|moderation\/[0-9a-f-]{36}|operations\/jobs\/[0-9a-f-]{36}|catalog\/(?:allergens(?:\/[a-z0-9._~%-]+)?|achievements(?:\/[0-9a-f-]{36})?|reputation))$/i;
    const adminPath =
        /^\/admin(?:\/(?:overview|queues|users|sanctions|subscriptions|families|payments|support|catalog|releases|news|audit|rollback|legal-requests|operations|errors|metrics|access)(?:\/[0-9a-f-]{36})?)?$/i;
    return value &&
        (value === '/' ||
            value === '/settings/notifications' ||
            value === '/settings/recipes' ||
            value === '/notifications' ||
            value === '/dev/scenarios' ||
            adminPath.test(value) ||
            canonicalPath.test(value))
        ? value
        : authRoutes[context].home;
}
