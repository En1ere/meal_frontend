import type { ApiClient } from '../../shared/api/client.js';
import type { Success } from '../../shared/api/contracts.generated.js';

type NewsPage = Success<'GET /api/v1/news'>['data'];
type NewsDetail = Success<'GET /api/v1/news/{id}'>['data'];
type MarkNewsReadResult = Success<'POST /api/v1/news/{id}/read'>['data'];

export type NewsTransport = Pick<ApiClient, 'request'>;

export async function loadNewsPage(
    transport: NewsTransport,
    cursor: string | null,
    signal?: AbortSignal,
): Promise<NewsPage> {
    return (
        await transport.request('GET /api/v1/news', undefined, signal, undefined, {
            query: { limit: '12', ...(cursor ? { cursor } : {}) },
        })
    ).data;
}

export async function loadNewsDetail(transport: NewsTransport, id: string, signal?: AbortSignal): Promise<NewsDetail> {
    return (await transport.request('GET /api/v1/news/{id}', undefined, signal, { id })).data;
}

export async function markNewsRead(transport: NewsTransport, id: string): Promise<MarkNewsReadResult> {
    return (
        await transport.request('POST /api/v1/news/{id}/read', { idempotencyKey: crypto.randomUUID() }, undefined, {
            id,
        })
    ).data;
}
