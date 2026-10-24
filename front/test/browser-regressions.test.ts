import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient } from '../src/shared/api/client.js';
import { MockApi } from '../src/mocks/api.js';
import { MemoryRepository } from '../src/mocks/repository.js';

const origin = 'http://localhost:3000';
await test('path parameters are encoded and dot segments never reach transport', async () => {
    let calls = 0;
    const client = new ApiClient(origin, (input) => {
        calls++;
        assert.ok(input instanceof URL);
        assert.equal(input.href, origin + '/api/v1/authors/a%2Fb%3F%23%25');
        return Promise.resolve(
            Response.json({
                data: {
                    profile: {
                        username: 'a/b?#%',
                        avatarUrl: null,
                        recipeCount: null,
                        reputationLabel: null,
                        achievements: null,
                    },
                },
                meta: { requestId: crypto.randomUUID() },
            }),
        );
    });
    await client.request('GET /api/v1/authors/{username}', undefined, undefined, { username: 'a/b?#%' });
    for (const username of ['.', '..']) {
        await assert.rejects(
            client.request('GET /api/v1/authors/{username}', undefined, undefined, { username }),
            /Invalid URL path segment/,
        );
    }
    assert.equal(calls, 1);
});
await test('API transport is called without binding ApiClient as native fetch receiver', async () => {
    const client = new ApiClient(origin, function (this: unknown) {
        assert.equal(this, undefined);
        return Promise.resolve(Response.json({ data: { status: 'ok' }, meta: { requestId: crypto.randomUUID() } }));
    });
    assert.equal((await client.request('GET /health/live')).data.status, 'ok');
});

await test('browser metadata fallback keeps strict Node Origin and CSRF validation', async () => {
    const api = new MockApi(new MemoryRepository(), { origin });
    const csrfResponse = await api.handle(new Request(origin + '/api/v1/auth/csrf'));
    const { data } = (await csrfResponse.json()) as { data: { token: string } };
    const nonce = csrfResponse.headers.get('set-cookie')?.match(/meal_csrf=([^;]+)/)?.[1];
    assert.ok(nonce);
    const send = (headers: Record<string, string>, browserOrigin?: string) =>
        api.handle(
            new Request(origin + '/api/v1/auth/logout', { method: 'POST', headers }),
            { meal_csrf: nonce },
            browserOrigin,
        );
    assert.equal((await send({ 'x-csrf-token': data.token })).status, 403);
    assert.equal((await send({ 'x-csrf-token': data.token }, origin)).status, 200);
    assert.equal((await send({ origin: 'https://foreign.test', 'x-csrf-token': data.token }, origin)).status, 403);
    assert.equal((await send({ 'sec-fetch-site': 'cross-site', 'x-csrf-token': data.token }, origin)).status, 403);
    assert.equal((await send({ 'x-csrf-token': 'invalid' }, origin)).status, 403);
    assert.equal(
        (
            await api.handle(
                new Request(origin + '/api/v1/auth/logout', {
                    method: 'POST',
                    headers: { 'x-csrf-token': data.token },
                }),
                {},
                origin,
            )
        ).status,
        403,
    );
});

await test('inventory transport preserves query, optimistic version and multipart boundary', async () => {
    const seen: Array<{ url: URL; init: RequestInit }> = [];
    const client = new ApiClient(origin, async (input, init) => {
        const url = new URL(input instanceof Request ? input.url : input);
        if (url.pathname.endsWith('/csrf'))
            return Response.json({ data: { token: 'fixture' }, meta: { requestId: crypto.randomUUID() } });
        seen.push({ url, init: init ?? {} });
        await Promise.resolve();
        return Response.json(
            { error: { code: 'CONFLICT', message: 'Test', details: null }, meta: { requestId: crypto.randomUUID() } },
            { status: 409 },
        );
    });
    await assert.rejects(
        client.request('GET /api/v1/inventory', undefined, undefined, undefined, {
            query: { q: 'молоко & рис', localDate: '2026-09-28' },
            ifMatch: 3,
        }),
    );
    assert.equal(seen[0]!.url.searchParams.get('q'), 'молоко & рис');
    assert.equal(new Headers(seen[0]!.init.headers).get('if-match'), '"3"');
    const form = new FormData();
    form.append('file', new Blob(['name,quantity\nRice,1'], { type: 'text/csv' }), 'sample.csv');
    await assert.rejects(client.upload('POST /api/v1/inventory/ingest/import', form));
    const upload = seen[1]!;
    assert.equal(upload.init.body, form);
    assert.equal(new Headers(upload.init.headers).has('content-type'), false);
    assert.equal(new Headers(upload.init.headers).get('x-csrf-token'), 'fixture');
    assert.equal(upload.init.credentials, 'include');
});
