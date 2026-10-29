import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiClient } from '../src/shared/api/client.js';

await test('API transport reports successful requests through the composition callback', async () => {
    let successfulRequests = 0;
    const client = new ApiClient(
        'http://localhost:3000',
        () => Promise.resolve(Response.json({ data: { status: 'ok' }, meta: { requestId: crypto.randomUUID() } })),
        () => successfulRequests++,
    );
    await client.request('GET /health/live');
    assert.equal(successfulRequests, 1);
});
