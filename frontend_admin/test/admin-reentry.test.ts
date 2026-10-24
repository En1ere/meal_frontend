import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSync } from 'otplib';
import { MockApi } from '../src/mocks/api.js';
import { MemoryRepository } from '../src/mocks/repository.js';
import { contracts } from '../src/shared/api/contracts.generated.js';

function setup() {
    let now = Date.parse('2026-09-28T12:00:00Z');
    const origin = 'http://localhost:3002';
    const repository = new MemoryRepository();
    const api = new MockApi(repository, { origin, adminOnly: true, now: () => now, rateLimit: 100 });
    const cookies: Record<string, string> = {};
    let csrf = '',
        proof = '',
        secret = '';
    const send = async (path: string, body?: unknown, overrideProof = proof) => {
        const response = await api.handle(
            new Request(origin + '/api/v1/admin/' + path, {
                method: body === undefined ? 'GET' : 'POST',
                headers: {
                    origin,
                    'content-type': 'application/json',
                    'x-csrf-token': csrf,
                    'x-admin-unlock': overrideProof,
                },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            }),
            cookies,
        );
        for (const cookie of response.headers.getSetCookie()) {
            const [name, value] = cookie.split(';')[0]!.split('=');
            cookies[name!] = value!;
        }
        return response;
    };
    const code = () => generateSync({ secret, strategy: 'totp', digits: 6, period: 30, epoch: Math.floor(now / 1000) });
    return {
        send,
        repository,
        cookies,
        code,
        advance: (duration: number) => {
            now += duration;
        },
        now: () => now,
        proof: () => proof,
        login: async () => {
            csrf = contracts['GET /api/v1/admin/auth/csrf'].success.parse(await (await send('auth/csrf')).json()).data
                .token;
            const challenge = contracts['POST /api/v1/admin/auth/login'].success.parse(
                await (await send('auth/login', { login: 'ADMIN', password: '1', context: 'admin' })).json(),
            ).data;
            if (challenge.enrollment) secret = challenge.enrollment.secret;
            const verified = await send('auth/mfa/verify', {
                challenge: challenge.challenge,
                method: 'totp',
                code: code(),
            });
            assert.equal(verified.status, 200);
            const data = contracts['POST /api/v1/admin/auth/mfa/verify'].success.parse(await verified.json()).data;
            proof = data.unlockToken;
            return data;
        },
    };
}

await test('admin remembered cookie is fixed seven days; new tab locks while reload proof works; logout revokes all proofs', async () => {
    const client = setup();
    const first = await client.login();
    const initialExpiry = first.user.expiresAt;
    assert.equal(Date.parse(initialExpiry) - client.now(), 7 * 86400000);
    assert.equal((await client.send('users/search', { query: 'admin' })).status, 200);
    assert.equal((await client.send('auth/me', undefined, '')).status, 403);
    const locked = contracts['GET /api/v1/admin/auth/status'].success.parse(
        await (await client.send('auth/status', undefined, '')).json(),
    ).data;
    assert.equal(locked.status, 'locked');
    assert.equal(locked.criticalUntil, null);
    client.advance(30000);
    const unlocked = contracts['POST /api/v1/admin/auth/unlock'].success.parse(
        await (await client.send('auth/unlock', { method: 'totp', code: client.code() }, '')).json(),
    ).data;
    assert.notEqual(unlocked.unlockToken, client.proof());
    assert.equal(unlocked.user.expiresAt, initialExpiry);
    assert.equal((await client.send('auth/me', undefined, unlocked.unlockToken)).status, 200);
    assert.equal((await client.send('auth/me')).status, 200);
    assert.equal((await client.send('auth/unlock', { method: 'totp', code: client.code() }, '')).status, 401);
    assert.equal((await client.send('auth/logout', {}, '')).status, 200);
    assert.equal((await client.send('auth/me', undefined, unlocked.unlockToken)).status, 401);
    assert.equal((await client.send('auth/status')).status, 401);
});

await test('critical confirmation is TOTP-only, reusable thirty minutes, session scoped and expires without locking ordinary reads', async () => {
    const client = setup();
    await client.login();
    client.advance(30000);
    const input = { method: 'totp', code: client.code() };
    assert.equal((await client.send('auth/critical-confirm', input, '')).status, 403);
    assert.equal((await client.send('auth/critical-confirm', { ...input, password: '1' })).status, 400);
    const confirmed = contracts['POST /api/v1/admin/auth/critical-confirm'].success.parse(
        await (await client.send('auth/critical-confirm', input)).json(),
    ).data;
    assert.equal(Date.parse(confirmed.criticalUntil) - client.now(), 1800000);
    for (let i = 0; i < 2; i++) {
        const status = contracts['GET /api/v1/admin/auth/status'].success.parse(
            await (await client.send('auth/status')).json(),
        ).data;
        assert.equal(status.criticalUntil, confirmed.criticalUntil);
    }
    client.advance(30000);
    const reentry = contracts['POST /api/v1/admin/auth/unlock'].success.parse(
        await (await client.send('auth/unlock', { method: 'totp', code: client.code() }, '')).json(),
    ).data;
    assert.equal(reentry.criticalUntil, confirmed.criticalUntil);
    const oldProof = client.proof();
    client.advance(30000);
    await client.login();
    assert.equal((await client.send('auth/me', undefined, oldProof)).status, 403);
    const other = contracts['GET /api/v1/admin/auth/status'].success.parse(
        await (await client.send('auth/status')).json(),
    ).data;
    assert.equal(other.criticalUntil, null);
    client.advance(30000);
    await client.send('auth/critical-confirm', { method: 'totp', code: client.code() });
    client.advance(1800000);
    const expired = contracts['GET /api/v1/admin/auth/status'].success.parse(
        await (await client.send('auth/status')).json(),
    ).data;
    assert.equal(expired.criticalUntil, null);
    assert.equal((await client.send('queues/search', { queue: 'recipes' })).status, 200);
});

await test('admin recovery code is single-use; five failed session-bound codes revoke remembered cookie', async () => {
    const client = setup();
    const first = await client.login();
    const code = first.recoveryCodes[0]!;
    assert.equal((await client.send('auth/critical-confirm', { method: 'recovery', code })).status, 200);
    assert.equal((await client.send('auth/unlock', { method: 'recovery', code }, '')).status, 401);
    for (let i = 0; i < 4; i++) {
        const path = i % 2 ? 'auth/unlock' : 'auth/critical-confirm';
        assert.equal((await client.send(path, { method: 'recovery', code: '0'.repeat(32) })).status, 401);
    }
    assert.equal((await client.send('auth/status')).status, 401);
    assert.equal((await client.send('auth/unlock', { method: 'recovery', code: first.recoveryCodes[1]! })).status, 401);
});

await test('critical window is clamped to absolute session expiry and successful unlock cannot extend seven days', async () => {
    const client = setup();
    const first = await client.login();
    client.advance(7 * 86400000 - 60000);
    const confirmed = contracts['POST /api/v1/admin/auth/critical-confirm'].success.parse(
        await (await client.send('auth/critical-confirm', { method: 'totp', code: client.code() })).json(),
    ).data;
    assert.equal(confirmed.criticalUntil, first.user.expiresAt);
    client.advance(30000);
    const response = await client.send('auth/unlock', { method: 'totp', code: client.code() }, '');
    assert.equal(response.status, 200);
    assert.equal(
        contracts['POST /api/v1/admin/auth/unlock'].success.parse(await response.json()).data.user.expiresAt,
        first.user.expiresAt,
    );
    client.advance(30000);
    assert.equal((await client.send('auth/me')).status, 401);
    assert.equal(
        (await client.send('auth/unlock', { method: 'recovery', code: first.recoveryCodes[0]! }, '')).status,
        401,
    );
});

await test('legacy staff credentials cannot be promoted through copied admin cookies or challenges', async () => {
    const client = setup();
    const first = await client.login();
    await client.repository.transaction((state) => {
        const current = state.sessions.find((session) => session.principal.sessionId === first.user.sessionId)!;
        delete current.adminUnlocks;
    });
    assert.equal((await client.send('auth/status')).status, 401);
    assert.equal((await client.send('auth/unlock', { method: 'recovery', code: first.recoveryCodes[0]! })).status, 401);
    const challenge = contracts['POST /api/v1/admin/auth/login'].success.parse(
        await (await client.send('auth/login', { login: 'admin', password: '1', context: 'admin' })).json(),
    ).data;
    await client.repository.transaction((state) => {
        delete state.challenges.find((entry) => entry.token === challenge.challenge)!.adminPortal;
    });
    client.advance(30000);
    assert.equal(
        (await client.send('auth/mfa/verify', { challenge: challenge.challenge, method: 'totp', code: client.code() }))
            .status,
        401,
    );
});
