/* Meal Planner offline application shell. API responses and account data are never cached here. */
const CACHE = 'meal-planner-offline-shell-v1';
const PAGES = ['/recipes/offline', '/settings/offline', '/recipes/new', '/recipes/mine', '/shopping'];
const isOfflinePage = (pathname) =>
    PAGES.includes(pathname) ||
    /^\/shopping\/[^/]+$/.test(pathname) ||
    /^\/recipes\/[^/]+\/(edit|cook)$/.test(pathname);

async function cachePage(url) {
    const cache = await caches.open(CACHE);
    const response = await fetch(url, { credentials: 'same-origin', cache: 'reload' });
    if (!response.ok) return;
    await cache.put(url, response.clone());
    const html = await response.text();
    const assets = [...html.matchAll(/(?:src|href)="([^"?#]+)"/g)]
        .map((match) => match[1])
        .filter((value) => value.startsWith('/_next/static/'));
    await Promise.all(
        [...new Set(assets)].map(async (asset) => {
            try {
                const result = await fetch(asset, { cache: 'reload' });
                if (result.ok) await cache.put(asset, result);
            } catch {
                /* A later online navigation can fill a missing asset. */
            }
        }),
    );
}

async function precache() {
    await Promise.all(PAGES.map((page) => cachePage(page)));
}

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            caches
                .keys()
                .then((names) =>
                    Promise.all(
                        names
                            .filter((name) => name.startsWith('meal-planner-offline-') && name !== CACHE)
                            .map((name) => caches.delete(name)),
                    ),
                ),
        ]),
    );
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'PRECACHE') event.waitUntil(precache());
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/health/'))
        return;
    if (url.pathname.startsWith('/_next/static/')) {
        event.respondWith(
            caches.match(request).then(
                (cached) =>
                    cached ||
                    fetch(request).then((response) => {
                        if (response.ok) void caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
                        return response;
                    }),
            ),
        );
        return;
    }
    if (request.mode === 'navigate' && isOfflinePage(url.pathname)) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.ok) void caches.open(CACHE).then((cache) => cache.put(url.pathname, response.clone()));
                    return response;
                })
                .catch(async () => (await caches.match(url.pathname)) || Response.error()),
        );
    }
});

const PUSH_ROUTES = ['/notifications', '/settings/notifications', '/inventory', '/meal-plan', '/support'];
const safePushHref = (value) => {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/notifications';
    try {
        const url = new URL(value, self.location.origin);
        return url.origin === self.location.origin &&
            PUSH_ROUTES.some((route) => url.pathname === route || url.pathname.startsWith(`${route}/`))
            ? `${url.pathname}${url.search}`
            : '/notifications';
    } catch {
        return '/notifications';
    }
};

self.addEventListener('push', (event) => {
    event.waitUntil(
        (async () => {
            let payload = {};
            try {
                payload = event.data?.json() ?? {};
            } catch {
                payload = {};
            }
            const title =
                typeof payload.title === 'string' && payload.title.length <= 120 ? payload.title : 'Meal Planner';
            const body =
                typeof payload.body === 'string' && payload.body.length <= 300
                    ? payload.body
                    : 'Откройте приложение, чтобы посмотреть уведомление.';
            await self.registration.showNotification(title, {
                body,
                tag:
                    typeof payload.topic === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(payload.topic)
                        ? payload.topic
                        : undefined,
                data: { href: safePushHref(payload.href) },
            });
        })(),
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        (async () => {
            const href = safePushHref(event.notification.data?.href);
            const target = new URL(href, self.location.origin).href;
            const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
            const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
            if (existing) {
                await existing.navigate(target);
                return existing.focus();
            }
            return self.clients.openWindow(target);
        })(),
    );
});
