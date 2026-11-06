import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadNewsDetail, loadNewsPage, markNewsRead } from '../src/features/news/api.js';
import { newsKeys } from '../src/features/news/query-keys.js';

const page = { items: [], nextCursor: null } as const;
const detail = {
    id: '73000000-0000-4000-8000-000000000002',
    type: 'news',
    title: 'News',
    publishedAt: '2026-11-05T00:00:00.000Z',
    coverImage: null,
    pages: [{ blocks: [{ kind: 'text', text: 'Body' }] }],
    readAt: null,
} as const;
const readResult = { readAt: '2026-11-05T01:00:00.000Z' } as const;

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
        if (route === 'GET /api/v1/news') return Promise.resolve({ data: page });
        if (route === 'GET /api/v1/news/{id}') return Promise.resolve({ data: detail });
        return Promise.resolve({ data: readResult });
    };
    return { requests, transport: { request } };
}

void test('news keys preserve exact guest and account-isolated tuples', () => {
    assert.deepEqual(newsKeys.list(undefined), ['news', 'guest']);
    assert.deepEqual(newsKeys.list('user-a'), ['news', 'user-a']);
    assert.deepEqual(newsKeys.detail(undefined, detail.id), ['news-detail', 'guest', detail.id]);
    assert.deepEqual(newsKeys.detail('user-a', detail.id), ['news-detail', 'user-a', detail.id]);
});

void test('news query adapter preserves pagination, params, signals and exact data', async () => {
    const { requests, transport } = transportFixture();
    const controller = new AbortController();
    assert.equal(await loadNewsPage(transport, null, controller.signal), page);
    assert.equal(await loadNewsPage(transport, 'cursor-2', controller.signal), page);
    assert.equal(await loadNewsDetail(transport, detail.id, controller.signal), detail);
    assert.deepEqual(requests, [
        {
            route: 'GET /api/v1/news',
            body: undefined,
            signal: controller.signal,
            params: undefined,
            options: { query: { limit: '12' } },
        },
        {
            route: 'GET /api/v1/news',
            body: undefined,
            signal: controller.signal,
            params: undefined,
            options: { query: { limit: '12', cursor: 'cursor-2' } },
        },
        {
            route: 'GET /api/v1/news/{id}',
            body: undefined,
            signal: controller.signal,
            params: { id: detail.id },
            options: undefined,
        },
    ]);
});

void test('mark-read adapter preserves params and creates a fresh idempotency key per invocation', async () => {
    const { requests, transport } = transportFixture();
    assert.equal(await markNewsRead(transport, detail.id), readResult);
    assert.equal(await markNewsRead(transport, detail.id), readResult);
    assert.deepEqual(
        requests.map(({ route, signal, params, options }) => ({ route, signal, params, options })),
        [
            {
                route: 'POST /api/v1/news/{id}/read',
                signal: undefined,
                params: { id: detail.id },
                options: undefined,
            },
            {
                route: 'POST /api/v1/news/{id}/read',
                signal: undefined,
                params: { id: detail.id },
                options: undefined,
            },
        ],
    );
    const keys = requests.map(({ body }) => (body as { idempotencyKey: string }).idempotencyKey);
    assert.equal(new Set(keys).size, 2);
    for (const key of keys) assert.match(key, /^[0-9a-f-]{36}$/u);
});

void test('news UI consumes private owners without direct transport calls', async () => {
    const source = await readFile('src/features/news/news.tsx', 'utf8');
    assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.match(source, /newsKeys\.list\(session\.data\?\.id\)/u);
    assert.match(source, /newsKeys\.detail\(session\.data\?\.id, item\.id\)/u);
    assert.match(source, /newsKeys\.detail\(session\.data\?\.id, id\)/u);
    assert.match(source, /loadNewsPage\(api!, pageParam, signal\)/u);
    assert.match(source, /loadNewsDetail\(api!, id, signal\)/u);
    assert.match(source, /markNewsRead\(api!, item\.id\)/u);
});
