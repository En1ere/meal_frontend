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
