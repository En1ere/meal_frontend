import type { ApiClient } from '../../shared/api/client.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import type { SearchType } from './query-keys.js';

export type SearchData = Success<'GET /api/v1/search'>['data'];
export type SearchTransport = Pick<ApiClient, 'request'>;

export async function loadSearchPage(
    transport: SearchTransport,
    input: { type: SearchType; query: string; limit: number; cursor: string | null },
    signal?: AbortSignal,
): Promise<SearchData> {
    return (
        await transport.request('GET /api/v1/search', undefined, signal, undefined, {
            query: {
                type: input.type,
                q: input.query,
                limit: String(input.limit),
                ...(input.cursor ? { cursor: input.cursor } : {}),
            },
        })
    ).data;
}
