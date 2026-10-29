import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GET } from '../src/app/healthz/route.js';

await test('frontend health is local, non-cacheable and independent from backend readiness', async () => {
    const response = GET();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), {
        status: 'ok',
        service: 'meal-frontend',
        version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown',
    });
});
