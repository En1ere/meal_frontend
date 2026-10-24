import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSync } from 'otplib';
import { MockApi } from '../src/mocks/api.js';
import { MemoryRepository } from '../src/mocks/repository.js';
import { contracts } from '../src/shared/api/contracts.generated.js';
import { safeReturnTo } from '../src/shared/auth/routes.js';

const origin = 'http://localhost:3002';
function browser() {
    const repository = new MemoryRepository();
    const api = new MockApi(repository, { origin, adminOnly: true });
    const cookies: Record<string, string> = {};
    let csrf = '';
    let unlockToken = '';
    const send = async (path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') => {
        const response = await api.handle(
            new Request(origin + path, {
                method,
                headers: {
                    origin,
                    'content-type': 'application/json',
                    'x-csrf-token': csrf,
                    'x-admin-unlock': unlockToken,
                },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            }),
            cookies,
        );
        for (const cookie of response.headers.getSetCookie()) {
            const pair = cookie.split(';')[0]!;
            const index = pair.indexOf('=');
            cookies[pair.slice(0, index)] = pair.slice(index + 1);
        }
        if (path === '/api/v1/admin/auth/mfa/verify' && response.ok) {
            unlockToken = contracts['POST /api/v1/admin/auth/mfa/verify'].success.parse(await response.clone().json())
                .data.unlockToken;
        }
        return response;
    };
    return {
        repository,
        cookies,
        send,
        prepare: async () => {
            const response = await send('/api/v1/admin/auth/csrf');
            csrf = contracts['GET /api/v1/admin/auth/csrf'].success.parse(await response.json()).data.token;
        },
    };
}

await test('admin adapter rejects unrelated routes and both ordinary users and moderator', async () => {
    const client = browser();
    await client.prepare();
    assert.ok(client.cookies.meal_admin_csrf);
    assert.equal(client.cookies.meal_csrf, undefined);
    for (const email of ['user1', 'moderator']) {
        const response = await client.send('/api/v1/admin/auth/login', {
            login: email,
            password: '1',
            context: 'admin',
        });
        assert.equal(response.status, 401);
    }
    assert.equal(
        (
            await client.send('/api/v1/admin/auth/login', {
                login: 'moderator',
                password: '1',
                context: 'moderator',
            })
        ).status,
        400,
    );
    for (const path of ['/api/v1/auth/me', '/api/v1/profile', '/api/v1/authors/admin', '/health/ready'])
        assert.equal((await client.send(path)).status, 404);
    assert.equal((await client.send('/api/v1/admin/auth/me')).status, 401);
});

await test('admin password requires MFA; distinct cookie, role revocation and replay checks', async () => {
    const client = browser();
    await client.prepare();
    const response = await client.send('/api/v1/admin/auth/login', {
        login: 'admin',
        password: '1',
        context: 'admin',
    });
    assert.equal(response.status, 200);
    const challenge = contracts['POST /api/v1/admin/auth/login'].success.parse(await response.json()).data;
    assert.ok(challenge.enrollment);
    assert.equal((await client.send('/api/v1/admin/auth/me')).status, 401);
    const input = {
        challenge: challenge.challenge,
        method: 'totp',
        code: generateSync({
            secret: challenge.enrollment.secret,
            epoch: Math.floor(Date.now() / 1000),
            period: 30,
            digits: 6,
        }),
    };
    const verified = await client.send('/api/v1/admin/auth/mfa/verify', input);
    assert.equal(verified.status, 200);
    const data = contracts['POST /api/v1/admin/auth/mfa/verify'].success.parse(await verified.json()).data;
    assert.equal(data.user.context, 'admin');
    assert.equal(data.recoveryCodes.length, 10);
    assert.ok(client.cookies.meal_admin);
    assert.equal(client.cookies.meal_staff, undefined);
    assert.equal((await client.send('/api/v1/admin/auth/me')).status, 200);
    assert.equal((await client.send('/api/v1/admin/auth/mfa/verify', input)).status, 401);
    await client.repository.transaction((state) => {
        const user = state.users.find((entry) => entry.id === data.user.id)!;
        user.role = 'moderator';
    });
    assert.equal((await client.send('/api/v1/admin/auth/me')).status, 401);
});

await test('untrusted returnTo never leaves admin home or redirects into login', () => {
    assert.equal(safeReturnTo('/settings/notifications', 'admin'), '/settings/notifications');
    assert.equal(safeReturnTo('/notifications', 'admin'), '/notifications');
    assert.equal(safeReturnTo('/dev/scenarios', 'admin'), '/dev/scenarios');
    assert.equal(safeReturnTo('/admin', 'admin'), '/admin');
    assert.equal(safeReturnTo('/admin/releases', 'admin'), '/admin/releases');
    assert.equal(
        safeReturnTo('/admin/releases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'admin'),
        '/admin/releases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
    assert.equal(safeReturnTo('/admin/catalog/allergens/milk', 'admin'), '/admin/catalog/allergens/milk');
    assert.equal(safeReturnTo('/admin/catalog/achievements', 'admin'), '/admin/catalog/achievements');
    assert.equal(safeReturnTo('/admin/catalog/reputation', 'admin'), '/admin/catalog/reputation');
    for (const value of [
        null,
        '/',
        '/auth',
        '/auth/mfa',
        '//evil.test',
        'https://evil.test',
        '/?token=x',
        '/admin/unknown',
    ])
        assert.equal(safeReturnTo(value, 'admin'), '/');
});

await test('all admin sections enforce auth, exact user lookup and support idempotency', async () => {
    const client = browser();
    await client.prepare();
    assert.equal((await client.send('/api/v1/admin/users/search', {})).status, 401);
    const login = await client.send('/api/v1/admin/auth/login', {
        login: 'admin',
        password: '1',
        context: 'admin',
    });
    const challenge = contracts['POST /api/v1/admin/auth/login'].success.parse(await login.json()).data;
    const verified = await client.send('/api/v1/admin/auth/mfa/verify', {
        challenge: challenge.challenge,
        method: 'totp',
        code: generateSync({
            strategy: 'totp',
            secret: challenge.enrollment!.secret,
            epoch: Math.floor(Date.now() / 1000),
            period: 30,
            digits: 6,
        }),
    });
    assert.equal(verified.status, 200);
    for (const section of [
        'overview',
        'queues',
        'users',
        'sanctions',
        'subscriptions',
        'payments',
        'support',
        'catalog',
        'news',
        'audit',
        'rollback',
        'legal-requests',
        'operations',
        'errors',
        'metrics',
        'access',
    ]) {
        const response = await client.send(`/api/v1/admin/${section}/search`, {});
        assert.equal(response.status, 200, section);
        const page = contracts['POST /api/v1/admin/{section}/search'].success.parse(await response.json()).data;
        assert.equal(page.section, section);
        if (section === 'users' || section === 'access' || section === 'subscriptions')
            assert.equal(page.availability, 'requires_query');
        else assert.ok(page.items.length > 0, section);
        if (section !== 'overview')
            for (const item of page.items) {
                const detail = await client.send(`/api/v1/admin/${section}/${item.id}`);
                assert.equal(detail.status, 200);
                contracts['GET /api/v1/admin/{section}/{id}'].success.parse(await detail.json());
            }
    }
    assert.equal((await client.send('/api/v1/admin/users/search', { query: 'admin@meal-planner.test' })).status, 400);
    const lookup = await client.send('/api/v1/admin/users/search', { query: 'ADMIN' });
    const found = contracts['POST /api/v1/admin/{section}/search'].success.parse(await lookup.json()).data;
    assert.equal(found.items.length, 1);
    const list = await client.send('/api/v1/admin/support/search', {});
    const ticket = contracts['POST /api/v1/admin/{section}/search'].success
        .parse(await list.json())
        .data.items.find((i) => i.status !== 'closed')!;
    const command = { version: ticket.version, idempotencyKey: crypto.randomUUID(), body: 'Проверим семейный план.' };
    const path = `/api/v1/admin/support/${ticket.id}/reply`;
    const first = await client.send(path, command);
    assert.equal(first.status, 200);
    const result = contracts['POST /api/v1/admin/support/{id}/reply'].success.parse(await first.json()).data;
    const second = await client.send(path, command);
    assert.deepEqual(
        contracts['POST /api/v1/admin/support/{id}/reply'].success.parse(await second.json()).data,
        result,
    );
    assert.equal((await client.send(path, { ...command, body: 'Другой текст' })).status, 409);
    assert.equal((await client.send(path, { ...command, idempotencyKey: crypto.randomUUID() })).status, 409);
    const messages = await client.send(`/api/v1/admin/support/${ticket.id}/messages/search`, {});
    const thread = contracts['POST /api/v1/admin/support/{id}/messages/search'].success.parse(
        await messages.json(),
    ).data;
    assert.equal(thread.items.length, 1);
    assert.equal(thread.items[0]!.body, command.body);
    const prefs = await client.send('/api/v1/admin/notification-preferences', { channel: 'email', enabled: true });
    assert.equal(prefs.status, 200);
    assert.equal(
        contracts['POST /api/v1/admin/notification-preferences'].success.parse(await prefs.json()).data.preferences
            .email,
        true,
    );
    await client.repository.transaction((state) => {
        state.users.find((u) => u.role === 'admin')!.active = false;
    });
    assert.equal((await client.send('/api/v1/admin/support/search', {})).status, 401);
});
