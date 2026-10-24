import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeed } from '../src/mocks/model.js';
import { recipePolicyHandle } from '../src/mocks/recipe-policy.js';
import { safeReturnTo } from '../src/shared/auth/routes.js';
import { ApiClient } from '../src/shared/api/client.js';
void test('PUT settings obtains CSRF through the shared client', async () => {
    const seen: Array<{ method: string | undefined; csrf: string | null }> = [];
    const api = new ApiClient('http://localhost:3002', async (url, init) => {
        await Promise.resolve();
        seen.push({ method: init?.method, csrf: new Headers(init?.headers).get('x-csrf-token') });
        const target = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
        const data = target.endsWith('/csrf')
            ? { token: 'csrf-value' }
            : { version: 2, submissionDailyLimit: 12, commentHourlyLimit: 30, reportDailyLimit: 10 };
        return Response.json({ data, meta: { requestId: crypto.randomUUID() } });
    });
    await api.request('PUT /api/v1/admin/settings/recipe-policy', {
        expectedVersion: 1,
        submissionDailyLimit: 12,
        commentHourlyLimit: 30,
        reportDailyLimit: 10,
    });
    assert.deepEqual(seen, [
        { method: 'GET', csrf: null },
        { method: 'PUT', csrf: 'csrf-value' },
    ]);
});
void test('recipe policy settings require critical confirmation, reject stale edits, persist and audit changes', async () => {
    const state = createSeed();
    const context = {
        state,
        method: 'PUT',
        body: { expectedVersion: 1, submissionDailyLimit: 12, commentHourlyLimit: 35, reportDailyLimit: 8 },
        actor: {
            id: state.users[0]!.id,
            displayName: 'Admin',
            context: 'admin' as const,
            expiresAt: '2030-01-01T00:00:00Z',
            sessionId: crypto.randomUUID(),
        },
        critical: false,
        now: Date.now(),
        requestId: crypto.randomUUID(),
        success: (data: unknown) => Response.json(data),
        fail: (status: number) => new Response(null, { status }),
    };
    assert.equal(recipePolicyHandle(context).status, 403);
    assert.equal(state.admin.tables.__recipe_policy, undefined);
    context.critical = true;
    const updated = recipePolicyHandle(context);
    assert.equal(updated.status, 200);
    assert.deepEqual(await updated.json(), {
        version: 2,
        submissionDailyLimit: 12,
        commentHourlyLimit: 35,
        reportDailyLimit: 8,
    });
    assert.equal(recipePolicyHandle(context).status, 409);
    assert.equal(
        state.admin.tables.audit_events!.filter((row) => row.action === 'admin.recipe_policy.updated').length,
        1,
    );
    context.method = 'GET';
    assert.equal(((await recipePolicyHandle(context).json()) as { version: number }).version, 2);
    assert.equal(safeReturnTo('/settings/recipes', 'admin'), '/settings/recipes');
});
