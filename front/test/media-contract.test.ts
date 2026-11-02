import assert from 'node:assert/strict';
import test from 'node:test';

import { contracts } from '../src/shared/api/contracts.generated.js';
import { ApiClient } from '../src/shared/api/client.js';

void test('media download is generated as binary and never treated as JSON text', () => {
    const schema = contracts['GET /api/v1/media/assets/{id}/content'].success;
    const payload = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });

    assert.equal(schema.parse(payload), payload);
    assert.equal(schema.safeParse('binary response').success, false);
    assert.equal(schema.safeParse({ data: 'binary response' }).success, false);
});

void test('multipart media upload remains transport-specific in the generated contract', () => {
    assert.equal(contracts['PUT /api/v1/media/assets/{id}/content'].request, null);
});

void test('API client reads a successful media download as Blob', async () => {
    const image = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    const api = new ApiClient('https://meal.example.test', () =>
        Promise.resolve(new Response(image, { status: 200, headers: { 'content-type': 'image/jpeg' } })),
    );

    const result = await api.request('GET /api/v1/media/assets/{id}/content', undefined, undefined, {
        id: '550e8400-e29b-41d4-a716-446655440000',
    });
    assert.equal(result.type, 'image/jpeg');
    assert.deepEqual(new Uint8Array(await result.arrayBuffer()), new Uint8Array([0xff, 0xd8, 0xff]));
});
