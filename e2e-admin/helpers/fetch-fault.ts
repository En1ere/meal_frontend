import type { BrowserContext, Page } from '@playwright/test';

type FetchFault = {
    path: string;
    method: string;
    status: 409 | 412 | 503;
    remaining: number;
    commitBeforeFailure?: boolean;
};

const storageKey = 'e2e-admin-fetch-fault';

export async function installFetchFaultHarness(context: BrowserContext) {
    await context.addInitScript((key) => {
        const nativeFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
            const raw = sessionStorage.getItem(key);
            const fault = raw ? (JSON.parse(raw) as FetchFault) : null;
            const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
            const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
            if (
                fault &&
                fault.remaining > 0 &&
                method === fault.method &&
                new URL(url, location.origin).pathname === fault.path
            ) {
                const next = { ...fault, remaining: fault.remaining - 1 };
                if (next.remaining > 0) sessionStorage.setItem(key, JSON.stringify(next));
                else sessionStorage.removeItem(key);
                if (fault.commitBeforeFailure) await nativeFetch(input, init);
                const messages = {
                    409: ['CONFLICT', 'Данные изменились. Перечитайте актуальную версию.'],
                    412: ['PRECONDITION_FAILED', 'Версия устарела. Перечитайте актуальные данные.'],
                    503: ['UNAVAILABLE', 'Сервис временно недоступен.'],
                } as const;
                const [code, message] = messages[fault.status];
                return new Response(
                    JSON.stringify({
                        error: { code, message, details: null },
                        meta: { requestId: crypto.randomUUID() },
                    }),
                    { status: fault.status, headers: { 'content-type': 'application/json' } },
                );
            }
            return nativeFetch(input, init);
        };
    }, storageKey);
}

export async function armFetchFault(page: Page, fault: Omit<FetchFault, 'remaining'> & { remaining?: number }) {
    await page.evaluate(([key, value]) => sessionStorage.setItem(key, JSON.stringify(value)), [
        storageKey,
        { ...fault, remaining: fault.remaining ?? 1 },
    ] as const);
}

export async function clearFetchFault(page: Page) {
    await page.evaluate((key) => sessionStorage.removeItem(key), storageKey);
}
