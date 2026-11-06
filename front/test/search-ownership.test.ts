import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadSearchPage } from '../src/features/search/api.js';
import { searchKeys } from '../src/features/search/query-keys.js';

const page = { items: [], nextCursor: null } as const;

interface RecordedRequest {
    route: string;
    body: unknown;
    signal: AbortSignal | undefined;
    params: unknown;
    options: unknown;
}

function transportFixture() {
    const requests: RecordedRequest[] = [];
    const request = (route: string, body?: unknown, signal?: AbortSignal, params?: unknown, options?: unknown) => {
        requests.push({ route, body, signal, params, options });
        return Promise.resolve({ data: page });
    };
    return { requests, transport: { request } };
}

void test('search keys preserve exact anonymous and account-scoped tuples', () => {
    assert.deepEqual(searchKeys.results(undefined, 'product', 'рис', 4), [
        'unified-search',
        undefined,
        'product',
        'рис',
        4,
    ]);
    assert.deepEqual(searchKeys.results('user-a', 'store', 'магазин', 20), [
        'unified-search',
        'user-a',
        'store',
        'магазин',
        20,
    ]);
});

void test('search adapter preserves cursor omission, cursor presence, signal and exact data', async () => {
    const { requests, transport } = transportFixture();
    const controller = new AbortController();
    assert.equal(
        await loadSearchPage(transport, { type: 'recipe', query: 'ужин', limit: 4, cursor: null }, controller.signal),
        page,
    );
    assert.equal(
        await loadSearchPage(
            transport,
            { type: 'brand', query: 'молоко', limit: 20, cursor: 'cursor-2' },
            controller.signal,
        ),
        page,
    );
    assert.deepEqual(requests, [
        {
            route: 'GET /api/v1/search',
            body: undefined,
            signal: controller.signal,
            params: undefined,
            options: { query: { type: 'recipe', q: 'ужин', limit: '4' } },
        },
        {
            route: 'GET /api/v1/search',
            body: undefined,
            signal: controller.signal,
            params: undefined,
            options: { query: { type: 'brand', q: 'молоко', limit: '20', cursor: 'cursor-2' } },
        },
    ]);
});

void test('search UI consumes private owners without direct transport or route literals', async () => {
    const source = await readFile('src/features/search/search-page.tsx', 'utf8');
    assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.doesNotMatch(source, /['"]GET \/api\/v1\/search['"]/u);
    assert.match(source, /searchKeys\.results\(session\.data\?\.id, type, query, limit\)/u);
    assert.match(source, /loadSearchPage\(api!, \{ type, query, limit, cursor: pageParam \}, signal\)/u);
});
