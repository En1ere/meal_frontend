import { http } from 'msw';
import type { MockApi } from './api.js';

export function createHandlers(api: MockApi, origin: string) {
    const respond = async (request: Request, cookies: Record<string, string>) => {
        // MSW intercepts fetch before the browser adds its network Origin header.
        // Only the same-origin browser adapter supplies that missing metadata;
        // explicit origins and Node/contract requests retain strict validation.
        const browserOrigin =
            typeof window !== 'undefined' && new URL(request.url).origin === window.location.origin
                ? window.location.origin
                : undefined;
        // The model creates HttpResponse directly: native Response strips Set-Cookie in browsers.
        return api.handle(request, cookies, browserOrigin);
    };
    // Catch unknown API routes too: legacy contracts must not fall through to a real backend.
    return [
        http.all(`${origin}/api/*`, ({ request, cookies }) => respond(request, cookies)),
        http.all(`${origin}/health/*`, ({ request, cookies }) => respond(request, cookies)),
    ];
}
