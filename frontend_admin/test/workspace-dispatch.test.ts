import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSync } from 'otplib';
import { MockApi } from '../src/mocks/api.js';
import { MemoryRepository } from '../src/mocks/repository.js';
import { contracts, errorSchema, type Route } from '../src/shared/api/contracts.generated.js';

const origin = 'http://localhost:3002';
function browser() {
    const repository = new MemoryRepository();
    const now = Date.now();
    const api = new MockApi(repository, { origin, adminOnly: true, now: () => now });
    const cookies: Record<string, string> = {};
    let csrf = '';
    let unlock = '';
    async function send(path: string, body?: unknown) {
        const response = await api.handle(
            new Request(origin + path, {
                method: body === undefined ? 'GET' : 'POST',
                headers: { origin, 'content-type': 'application/json', 'x-csrf-token': csrf, 'x-admin-unlock': unlock },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            }),
            cookies,
        );
        for (const cookie of response.headers.getSetCookie()) {
            const pair = cookie.split(';')[0]!;
            const split = pair.indexOf('=');
            cookies[pair.slice(0, split)] = pair.slice(split + 1);
        }
        return response;
    }
    async function prepare() {
        const response = await send('/api/v1/admin/auth/csrf');
        csrf = contracts['GET /api/v1/admin/auth/csrf'].success.parse(await response.json()).data.token;
    }
    async function login() {
        await prepare();
        const response = await send('/api/v1/admin/auth/login', { login: 'admin', password: '1', context: 'admin' });
        const challenge = contracts['POST /api/v1/admin/auth/login'].success.parse(await response.json()).data;
        assert.ok(challenge.enrollment);
        const verified = await send('/api/v1/admin/auth/mfa/verify', {
            challenge: challenge.challenge,
            method: 'totp',
            code: generateSync({
                secret: challenge.enrollment.secret,
                epoch: Math.floor(now / 1000),
                period: 30,
                digits: 6,
            }),
        });
        assert.equal(verified.status, 200);
        const data = contracts['POST /api/v1/admin/auth/mfa/verify'].success.parse(await verified.json()).data;
        unlock = data.unlockToken;
        return data.user;
    }
    return { repository, send, prepare, login };
}
type RequestCase = { route: Route; path: string; body?: unknown };
async function routes(repository: MemoryRepository): Promise<RequestCase[]> {
    return repository.transaction((state) => {
        const first = (table: string) => {
            const value = state.admin.tables[table]?.[0]?.id;
            assert.equal(typeof value, 'string', `${table} fixture must exist`);
            return String(value);
        };
        const user = state.users.find((u) => u.login === 'pro1')!;
        const cases: RequestCase[] = [
            {
                route: 'GET /api/v1/admin/support/{id}/workspace',
                path: `/api/v1/admin/support/${first('support_tickets')}/workspace`,
            },
            { route: 'GET /api/v1/admin/news-workspace', path: '/api/v1/admin/news-workspace' },
            { route: 'GET /api/v1/admin/notification-center', path: '/api/v1/admin/notification-center' },
        ];
        for (const [section, id] of [
            ['users', user.id],
            ['subscriptions', first('subscriptions')],
            ['payments', first('billing_orders')],
        ])
            cases.push({
                route: 'GET /api/v1/admin/billing/{section}/{id}',
                path: `/api/v1/admin/billing/${section}/${id}`,
            });
        for (const [section, id] of [
            ['users', user.id],
            ['sanctions', first('sanctions')],
            ['access', first('staff_role_assignments')],
        ])
            cases.push({
                route: 'GET /api/v1/admin/governance/{section}/{id}',
                path: `/api/v1/admin/governance/${section}/${id}`,
            });
        for (const [section, id] of [
            ['queues', first('moderation_cases')],
            ['catalog', first('brand_products')],
        ])
            cases.push({
                route: 'GET /api/v1/admin/content-workspace/{section}/{id}',
                path: `/api/v1/admin/content-workspace/${section}/${id}`,
            });
        for (const [section, id] of [
            ['legal-requests', first('legal_requests')],
            ['rollback', first('compensation_requests')],
        ])
            cases.push({
                route: 'GET /api/v1/admin/review-workspace/{section}/{id}',
                path: `/api/v1/admin/review-workspace/${section}/${id}`,
            });
        cases.push({
            route: 'POST /api/v1/admin/operations-workspace/inspect',
            path: '/api/v1/admin/operations-workspace/inspect',
            body: {
                section: 'operations',
                id: first('background_jobs'),
                action: 'inspect',
                operation: 'retry',
                reason: '',
                ignoreUntil: null,
                expectedVersion: '1',
                idempotencyKey: crypto.randomUUID(),
            },
        });
        return cases;
    });
}
await test('central workspace dispatch authenticates every route and returns its own generated contract', async () => {
    const guest = browser();
    await guest.prepare();
    const guestRoutes = await routes(guest.repository);
    for (const entry of guestRoutes) {
        const response = await guest.send(entry.path, entry.body);
        assert.equal(response.status, 401, entry.path);
        errorSchema.parse(await response.json());
    }
    const client = browser();
    const user = await client.login();
    const cases = await routes(client.repository);
    for (const entry of cases) {
        const response = await client.send(entry.path, entry.body);
        assert.equal(response.status, 200, entry.path);
        const value: unknown = await response.json();
        contracts[entry.route].success.parse(value);
        if (entry.route !== 'GET /api/v1/admin/notification-center')
            assert.equal(
                'categories' in (value as { data: Record<string, unknown> }).data,
                false,
                `notification handler intercepted ${entry.path}`,
            );
    }
    const me = contracts['GET /api/v1/admin/auth/me'].success.parse(
        await (await client.send('/api/v1/admin/auth/me')).json(),
    );
    assert.equal(me.data.user.id, user.id);
});
await test('workspace error and empty scenarios recover without clearing authenticated session or data', async () => {
    const client = browser();
    const user = await client.login();
    const cases = await routes(client.repository);
    for (const mode of ['error', 'empty', 'normal']) {
        await client.repository.transaction((state) => {
            state.admin.tables.__scenario = [{ id: 'mode', mode }];
        });
        for (const entry of cases) {
            const response = await client.send(entry.path, entry.body);
            assert.equal(response.status, mode === 'error' ? 503 : 200, `${mode}: ${entry.path}`);
            const value: unknown = await response.json();
            if (mode === 'error') errorSchema.parse(value);
            else {
                contracts[entry.route].success.parse(value);
                if (mode === 'empty') {
                    const data = (value as { data: Record<string, unknown> }).data;
                    for (const key of ['items', 'messages', 'attachments', 'cards', 'history'])
                        if (Array.isArray(data[key])) assert.equal(data[key].length, 0, `${entry.path}: ${key}`);
                }
            }
        }
        const me = await client.send('/api/v1/admin/auth/me');
        assert.equal(me.status, 200);
        assert.equal(contracts['GET /api/v1/admin/auth/me'].success.parse(await me.json()).data.user.id, user.id);
    }
    const support = cases.find((entry) => entry.route === 'GET /api/v1/admin/support/{id}/workspace')!;
    const response = await client.send(support.path);
    const data = contracts['GET /api/v1/admin/support/{id}/workspace'].success.parse(await response.json()).data;
    assert.ok(data.messages.length > 0, 'empty scenario must not erase mock support messages');
});
