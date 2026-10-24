import { contracts, errorSchema, type Route, type Success } from './contracts.generated.js';
import { markOfflineSync } from '../../features/offline/offline-store.js';

export class ApiError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
        readonly requestId: string,
    ) {
        super(message);
    }
}
export class ApiClient {
    private csrf: string | undefined;
    private csrfRequest: Promise<string> | undefined;
    private epoch = 0;
    private controller = new AbortController();
    constructor(
        private readonly origin: string,
        private readonly transport: typeof fetch = fetch,
    ) {}
    // Call on logout/account/scope change before committing new private state.
    invalidate() {
        this.epoch++;
        this.controller.abort();
        this.controller = new AbortController();
        this.csrf = undefined;
        this.csrfRequest = undefined;
    }
    private async csrfToken(): Promise<string> {
        if (this.csrf) return this.csrf;
        if (this.csrfRequest) return this.csrfRequest;
        const epoch = this.epoch;
        const pending = this.request('GET /api/v1/auth/csrf').then((response) => {
            if (epoch !== this.epoch) throw new DOMException('Stale auth context', 'AbortError');
            return (this.csrf = response.data.token);
        });
        this.csrfRequest = pending;
        try {
            return await pending;
        } finally {
            if (this.csrfRequest === pending) this.csrfRequest = undefined;
        }
    }
    async request<R extends Route>(
        route: R,
        body?: unknown,
        signal?: AbortSignal,
        params?: Record<string, string>,
        options?: { query?: Record<string, string>; ifMatch?: number },
    ): Promise<Success<R>> {
        const epoch = this.epoch;
        const contextSignal = this.controller.signal;
        const index = route.indexOf(' ');
        const method = route.slice(0, index);
        let path = route.slice(index + 1);
        const schema = contracts[route];
        if (schema.params) {
            const values: Record<string, string> = schema.params.parse(params);
            path = path.replace(/\{([^}]+)\}/g, (_, name: string) => {
                const value = values[name]!;
                if (value === '.' || value === '..') throw new TypeError('Invalid URL path segment');
                return encodeURIComponent(value);
            });
        }
        const multipart = body instanceof FormData;
        if (schema.request && !multipart) schema.request.parse(body);
        const headers: Record<string, string> = {};
        if (options?.ifMatch !== undefined) headers['if-match'] = `"${options.ifMatch}"`;
        if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) headers['x-csrf-token'] = await this.csrfToken();
        if (body !== undefined && !multipart) headers['content-type'] = 'application/json';
        contextSignal.throwIfAborted();
        // Native browser fetch must not receive ApiClient as its receiver.
        const transport = this.transport;
        const url = new URL(path, this.origin);
        for (const [key, value] of Object.entries(options?.query ?? {})) url.searchParams.set(key, value);
        const response = await transport(url, {
            method,
            headers,
            credentials: 'include',
            cache: 'no-store',
            signal: signal ? AbortSignal.any([signal, contextSignal]) : contextSignal,
            ...(body !== undefined ? { body: multipart ? body : JSON.stringify(body) } : {}),
        });
        const value: unknown = await response.json();
        if (epoch !== this.epoch || contextSignal.aborted || signal?.aborted)
            throw new DOMException('Stale API response', 'AbortError');
        if (!response.ok) {
            const parsed = errorSchema.parse(value);
            throw new ApiError(response.status, parsed.error.code, parsed.error.message, parsed.meta.requestId);
        }
        markOfflineSync();
        // Runtime schema is selected by the same route key as the generic response type.
        return schema.success.parse(value) as Success<R>;
    }
    upload<R extends Route>(route: R, body: FormData, signal?: AbortSignal): Promise<Success<R>> {
        if (!route.startsWith('POST /api/v1/inventory/ingest/')) throw new TypeError('Unsupported upload route');
        return this.request(route, body, signal);
    }
}
