import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient, ApiError } from '../src/shared/api/client.js';
import { getAdminUnlock, initializeAdminUnlock, setAdminUnlock } from '../src/shared/auth/unlock.js';

const principal = {
    id: '00000000-0000-4000-8000-000000000001',
    displayName: 'Admin',
    context: 'admin',
    sessionId: '00000000-0000-4000-8000-000000000002',
    expiresAt: '2027-01-01T00:00:00.000Z',
};
const success = (data: unknown) => Response.json({ data, meta: { requestId: '00000000-0000-4000-8000-000000000003' } });
const denied = (status = 401) =>
    Response.json(
        {
            error: { code: 'UNAUTHORIZED', message: 'Session rejected', details: null },
            meta: { requestId: '00000000-0000-4000-8000-000000000003' },
        },
        { status },
    );

void test('confirmed protected 401 clears once, aborts concurrent stale responses and allows a later authenticated session', async () => {
    let reject = false;
    let notifications = 0;
    let resolveSlow: ((response: Response) => void) | undefined;
    const client = new ApiClient(
        'http://localhost:3002',
        async (url) => {
            if ((url instanceof Request ? url.url : url.toString()).endsWith('/auth/me'))
                return reject ? denied() : success({ user: principal });
            if ((url instanceof Request ? url.url : url.toString()).endsWith('/notification-preferences'))
                return new Promise<Response>((resolve) => {
                    resolveSlow = resolve;
                });
            return denied();
        },
        () => {
            notifications++;
        },
    );
    await client.request('GET /api/v1/admin/auth/me');
    const slow = client.request('GET /api/v1/admin/notification-preferences');
    reject = true;
    await assert.rejects(client.request('GET /api/v1/admin/auth/sessions'), ApiError);
    resolveSlow!(
        success({
            preferences: { browser: false, mobilePush: false, email: false },
            verifiedEmail: 'admin@example.test',
        }),
    );
    await assert.rejects(slow, { name: 'AbortError' });
    await assert.rejects(client.request('GET /api/v1/admin/auth/me'), ApiError);
    await assert.rejects(client.request('GET /api/v1/admin/auth/sessions'), ApiError);
    assert.equal(notifications, 1);
    reject = false;
    await client.request('GET /api/v1/admin/auth/me');
    await assert.rejects(client.request('GET /api/v1/admin/auth/sessions'), ApiError);
    assert.equal(notifications, 2);
});

void test('anonymous bootstrap, invalid login credentials and ordinary 403 do not invalidate private context', async () => {
    let notifications = 0;
    const client = new ApiClient(
        'http://localhost:3002',
        (url) =>
            Promise.resolve(
                (url instanceof Request ? url.url : url.toString()).endsWith('/csrf')
                    ? success({ token: 'a'.repeat(43) })
                    : denied((url instanceof Request ? url.url : url.toString()).endsWith('/sessions') ? 403 : 401),
            ),
        () => {
            notifications++;
        },
    );
    await assert.rejects(client.request('GET /api/v1/admin/auth/me'), ApiError);
    await assert.rejects(
        client.request('POST /api/v1/admin/auth/login', {
            login: 'admin',
            password: '1',
            context: 'admin',
        }),
        ApiError,
    );
    await assert.rejects(client.request('GET /api/v1/admin/auth/sessions'), ApiError);
    assert.equal(notifications, 0);
});

void test('tab proof is transported; wrong MFA code preserves it, while server lock rejects private context', async () => {
    const proof = 'u'.repeat(43);
    setAdminUnlock(proof);
    let notifications = 0;
    const client = new ApiClient(
        'http://localhost:3002',
        async (url, init) => {
            await Promise.resolve();
            const path = new URL(url instanceof Request ? url.url : url.toString()).pathname;
            assert.equal(new Headers(init?.headers).get('x-admin-unlock'), proof);
            if (path.endsWith('/csrf')) return success({ token: 'c'.repeat(43) });
            if (path.endsWith('/critical-confirm')) return denied();
            if (path.endsWith('/me')) return success({ user: principal });
            return Response.json(
                {
                    error: { code: 'ADMIN_LOCKED', message: 'Unlock required', details: null },
                    meta: { requestId: '00000000-0000-4000-8000-000000000003' },
                },
                { status: 403 },
            );
        },
        () => {
            notifications++;
        },
    );
    try {
        await client.request('GET /api/v1/admin/auth/me');
        await assert.rejects(
            client.request('POST /api/v1/admin/auth/critical-confirm', { method: 'totp', code: '000000' }),
            ApiError,
        );
        assert.equal(getAdminUnlock(), proof);
        assert.equal(notifications, 0);
        await assert.rejects(client.request('GET /api/v1/admin/auth/sessions'), ApiError);
        assert.equal(getAdminUnlock(), undefined);
        assert.equal(notifications, 1);
    } finally {
        setAdminUnlock();
    }
});

void test('a copied sessionStorage proof cannot unlock a different Firefox tab', () => {
    const descriptors = {
        window: Object.getOwnPropertyDescriptor(globalThis, 'window'),
        sessionStorage: Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage'),
        performance: Object.getOwnPropertyDescriptor(globalThis, 'performance'),
    };
    const values = new Map<string, string>();
    const storage = {
        getItem: (name: string) => values.get(name) ?? null,
        setItem: (name: string, value: string) => values.set(name, value),
        removeItem: (name: string) => values.delete(name),
    };
    const tab = { name: '' };

    Object.defineProperties(globalThis, {
        window: { configurable: true, value: tab },
        sessionStorage: { configurable: true, value: storage },
        performance: { configurable: true, value: { getEntriesByType: () => [{ type: 'reload' }] } },
    });

    try {
        const proof = 'f'.repeat(43);
        setAdminUnlock(proof);
        const unlockedTabName = tab.name;
        initializeAdminUnlock();
        assert.equal(getAdminUnlock(), proof, 'the same reloaded tab restores its proof');

        tab.name = '';
        initializeAdminUnlock();
        assert.equal(getAdminUnlock(), undefined, 'a new tab rejects the copied proof');
        assert.equal(storage.getItem('meal-admin-tab-unlock'), null);
        assert.notEqual(unlockedTabName, '');
    } finally {
        setAdminUnlock();
        for (const [name, descriptor] of Object.entries(descriptors)) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else Reflect.deleteProperty(globalThis, name);
        }
    }
});
