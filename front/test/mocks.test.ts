import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSync } from 'otplib';
import { indexedDB } from 'fake-indexeddb';
import fixture from '../contracts/dev-users.json' with { type: 'json' };
import cases from '../contracts/http-cases.json' with { type: 'json' };
import { contracts, errorSchema, type Route } from '../src/shared/api/contracts.generated.js';
import { ApiClient } from '../src/shared/api/client.js';
import { MockApi } from '../src/mocks/api.js';
import { MemoryRepository, IndexedDbRepository } from '../src/mocks/repository.js';
import { createMockServer } from '../src/mocks/server.js';
import { moderationActionsForStatus } from '../src/mocks/moderation.js';

const origin = 'http://localhost:3000';
class Browser {
    cookies: Record<string, string> = {};
    csrf = '';
    constructor(readonly api: MockApi) {}
    async send(route: string, body?: unknown, extra?: Record<string, string>) {
        const [method, path] = route.split(' ');
        const response = await this.api.handle(
            new Request(origin + path, {
                method: method!,
                headers: {
                    origin,
                    'content-type': 'application/json',
                    'x-csrf-token': this.csrf,
                    cookie: Object.entries(this.cookies)
                        .map(([k, v]) => `${k}=${v}`)
                        .join('; '),
                    ...extra,
                },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            }),
        );
        for (const cookie of response.headers.getSetCookie()) {
            const pair = cookie.split(';')[0]!;
            const index = pair.indexOf('=');
            this.cookies[pair.slice(0, index)] = pair.slice(index + 1);
        }
        return response;
    }
    async ok<R extends Route>(route: R, body?: unknown) {
        const response = await this.send(route, body);
        assert.equal(response.status, 200, await response.clone().text());
        const parsed = contracts[route].success.parse(await response.json());
        assert.equal(response.headers.get('x-request-id'), parsed.meta.requestId);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        return parsed;
    }
    async prepare() {
        const response = await this.send('GET /api/v1/auth/csrf');
        this.csrf = contracts['GET /api/v1/auth/csrf'].success.parse(await response.json()).data.token;
    }
    async login(login = 'user1') {
        await this.prepare();
        const response = await this.send('POST /api/v1/auth/login', {
            email: `${login}@meal-planner.test`,
            password: '1',
        });
        assert.equal(response.status, 200);
        return contracts['POST /api/v1/auth/login'].success.parse(await response.json()).data.user;
    }
    async staff(login = 'admin', context: 'admin' | 'moderator' = 'admin') {
        await this.prepare();
        const response = await this.send('POST /api/v1/staff/auth/login', {
            email: `${login}@meal-planner.test`,
            password: '1',
            context,
        });
        assert.equal(response.status, 200);
        return contracts['POST /api/v1/staff/auth/login'].success.parse(await response.json()).data;
    }
}
function setup() {
    let now = Date.parse('2026-09-25T12:00:00Z');
    let ready = true;
    const repository = new MemoryRepository();
    const api = new MockApi(repository, { origin, now: () => now, ready: () => ready, rateLimit: 100 });
    return {
        api,
        repository,
        browser: new Browser(api),
        now: () => now,
        advance: (ms: number) => {
            now += ms;
        },
        availability: (value: boolean) => {
            ready = value;
        },
    };
}
async function error(response: Response, status: number, code: string) {
    assert.equal(response.status, status);
    const parsed = errorSchema.parse(await response.json());
    assert.equal(parsed.error.code, code);
    assert.equal(parsed.error.details, null);
}

await test('stale personalization returns 412 without persisting a non-cloneable replay marker', async () => {
    const { browser, repository } = setup();
    await browser.login();
    const currentResponse = await browser.send('GET /api/v1/personalization');
    assert.equal(currentResponse.status, 200);
    const current = contracts['GET /api/v1/personalization'].success.parse(await currentResponse.json()).data
        .preferences;
    const input = {
        diets: current.diets,
        allergens: current.allergens,
        dislikes: current.dislikes,
        allergenMode: current.allergenMode,
        equipment: current.equipment,
        goals: current.goals,
        expectedVersion: current.version,
        idempotencyKey: crypto.randomUUID(),
    };
    const updated = await browser.send('PUT /api/v1/personalization/preferences', input);
    assert.equal(updated.status, 200, await updated.clone().text());
    const stale = await browser.send('PUT /api/v1/personalization/preferences', {
        ...input,
        idempotencyKey: crypto.randomUUID(),
    });
    await error(stale, 412, 'VERSION_CONFLICT');
    await repository.transaction((state) => {
        assert.equal(
            Object.values(state.personalization.replay).some((entry) => typeof entry.result === 'symbol'),
            false,
        );
    });
});

await test('deletion finalize persists a 200 blocked snapshot until export and retention gates are ready', async () => {
    const { browser, repository, now, advance } = setup();
    const user = await browser.login();
    await repository.transaction((state) => {
        state.accountLifecycle.accounts[user.id] = {
            archived: false,
            deletion: {
                id: crypto.randomUUID(),
                status: 'ready',
                requestedAt: new Date(now() - 86_400_000).toISOString(),
                cancelUntil: null,
                finalizationNotBefore: new Date(now() + 60_000).toISOString(),
                cancelledAt: null,
                finalizedAt: null,
                policyVersion: 'mock-policy-v1',
                blockers: [],
                version: 1,
            },
        };
    });
    const reauthResponse = await browser.send('POST /api/v1/account/critical-reauth', {
        purpose: 'account_lifecycle',
        password: '1',
        factor: null,
    });
    assert.equal(reauthResponse.status, 200);
    const reauth = contracts['POST /api/v1/account/critical-reauth'].success.parse(await reauthResponse.json());
    const blockedResponse = await browser.send('POST /api/v1/account/deletion/finalize', {
        reauthToken: reauth.data.reauthToken,
        expectedVersion: 1,
    });
    assert.equal(blockedResponse.status, 200);
    const blocked = (await blockedResponse.json()) as {
        data: { status: string; version: number; blockers: Array<{ code: string }> };
    };
    assert.equal(blocked.data.status, 'blocked');
    assert.equal(blocked.data.version, 2);
    assert.deepEqual(
        blocked.data.blockers.map((item) => item.code),
        ['retention_wait', 'export_not_ready'],
    );
    const readback = (await (await browser.send('GET /api/v1/account/lifecycle')).json()) as {
        data: { deletion: typeof blocked.data };
    };
    assert.equal(readback.data.deletion.status, 'blocked');
    assert.equal(readback.data.deletion.version, 2);
    assert.deepEqual(
        readback.data.deletion.blockers.map((item) => item.code),
        ['retention_wait', 'export_not_ready'],
    );
    await repository.transaction((state) => {
        assert.equal(state.users.find((candidate) => candidate.id === user.id)?.active, true);
        assert.equal(
            state.sessions.some((session) => session.principal.id === user.id && !session.revoked),
            true,
        );
    });

    const previewResponse = await browser.send('POST /api/v1/exports/preview', {
        scope: 'private',
        domain: 'personal_data',
        format: 'json',
        startsOn: null,
        endsOn: null,
    });
    assert.equal(previewResponse.status, 200);
    const preview = contracts['POST /api/v1/exports/preview'].success.parse(await previewResponse.json());
    const exportReauthResponse = await browser.send('POST /api/v1/account/critical-reauth', {
        purpose: 'export',
        password: '1',
        factor: null,
    });
    assert.equal(exportReauthResponse.status, 200);
    const exportReauth = contracts['POST /api/v1/account/critical-reauth'].success.parse(
        await exportReauthResponse.json(),
    );
    const createdResponse = await browser.send('POST /api/v1/exports', {
        previewId: preview.data.previewId,
        idempotencyKey: crypto.randomUUID(),
        reauthToken: exportReauth.data.reauthToken,
    });
    assert.equal(createdResponse.status, 200);
    const created = contracts['POST /api/v1/exports'].success.parse(await createdResponse.json());
    await repository.transaction((state) => {
        const job = state.exports.jobs.find((row) => row.job.id === created.data.job.id)!.job;
        job.status = 'ready';
        job.completedAt = new Date(now()).toISOString();
        job.expiresAt = new Date(now() + 5 * 60_000).toISOString();
        job.failureCode = null;
    });
    const waitingReauthResponse = await browser.send('POST /api/v1/account/critical-reauth', {
        purpose: 'account_lifecycle',
        password: '1',
        factor: null,
    });
    assert.equal(waitingReauthResponse.status, 200);
    const waitingReauth = contracts['POST /api/v1/account/critical-reauth'].success.parse(
        await waitingReauthResponse.json(),
    );
    const waitingResponse = await browser.send('POST /api/v1/account/deletion/finalize', {
        reauthToken: waitingReauth.data.reauthToken,
        expectedVersion: 2,
    });
    assert.equal(waitingResponse.status, 200);
    const waiting = (await waitingResponse.json()) as {
        data: { status: string; version: number; blockers: Array<{ code: string }> };
    };
    assert.equal(waiting.data.status, 'blocked');
    assert.equal(waiting.data.version, 3);
    assert.deepEqual(
        waiting.data.blockers.map((item) => item.code),
        ['retention_wait'],
    );
    advance(60_001);
    const finalReauthResponse = await browser.send('POST /api/v1/account/critical-reauth', {
        purpose: 'account_lifecycle',
        password: '1',
        factor: null,
    });
    assert.equal(finalReauthResponse.status, 200);
    const finalReauth = contracts['POST /api/v1/account/critical-reauth'].success.parse(
        await finalReauthResponse.json(),
    );
    const finalizedResponse = await browser.send('POST /api/v1/account/deletion/finalize', {
        reauthToken: finalReauth.data.reauthToken,
        expectedVersion: 3,
    });
    assert.equal(finalizedResponse.status, 200);
    const finalized = contracts['POST /api/v1/account/deletion/finalize'].success.parse(await finalizedResponse.json());
    assert.equal(finalized.data.status, 'finalized');
    assert.equal(finalized.data.version, 4);
    await repository.transaction((state) => {
        assert.equal(state.users.find((candidate) => candidate.id === user.id)?.active, false);
        assert.equal(
            state.sessions.every((session) => session.principal.id !== user.id || session.revoked),
            true,
        );
    });
});
const totp = (secret: string, now: number) =>
    generateSync({ secret, epoch: Math.floor(now / 1000), period: 30, digits: 6 });

await test('same portable HTTP cases as real backend: validation and CSRF precede database readiness', async () => {
    const context = setup();
    context.availability(false);
    await context.browser.prepare();
    for (const item of cases) {
        const response = await context.browser.send(
            `${item.method} ${item.path}`,
            item.body,
            item.csrf ? {} : { 'x-csrf-token': '' },
        );
        assert.equal(response.status, item.status, item.name);
        if (item.code) assert.equal(errorSchema.parse(await response.json()).error.code, item.code, item.name);
    }
});

await test('all eight canonical fixtures authenticate with exact identities; user login never creates staff access', async () => {
    const { api } = setup();
    for (const user of fixture.users) {
        const browser = new Browser(api);
        const principal = await browser.login(user.login);
        assert.equal(principal.id, user.id);
        assert.equal(principal.displayName, user.name);
        assert.equal(principal.context, 'user');
        await error(await browser.send('GET /api/v1/staff/auth/me'), 401, 'UNAUTHORIZED');
    }
});
await test('strict request fields, email normalization, neutral bad credentials and CSRF', async () => {
    const { browser } = setup();
    const input = { email: 'USER1@MEAL-PLANNER.TEST', password: '1' };
    await error(await browser.send('POST /api/v1/auth/login', input), 403, 'FORBIDDEN');
    await browser.prepare();
    await browser.ok('POST /api/v1/auth/login', input);
    for (const body of [
        { ...input, extra: true },
        { ...input, email: ' user1@meal-planner.test' },
    ])
        await error(await browser.send('POST /api/v1/auth/login', body), 400, 'INVALID_REQUEST');
    await error(await browser.send('POST /api/v1/auth/login', { ...input, password: 'wrong' }), 401, 'UNAUTHORIZED');
    await error(
        await browser.send('POST /api/v1/auth/login', input, { origin: 'https://other.test' }),
        403,
        'FORBIDDEN',
    );
    await error(await browser.send('POST /api/v1/auth/login', input, { 'x-csrf-token': 'wrong' }), 403, 'FORBIDDEN');
    await error(
        await browser.send('GET /api/v1/auth/me', undefined, { cookie: '', 'X-Mock-User-Id': fixture.users[0]!.id }),
        401,
        'UNAUTHORIZED',
    );
    await browser.ok('GET /api/v1/inventory-locations');
});
await test('session scopes, revoke others, absolute expiry and idempotent logout', async () => {
    const context = setup();
    const a = context.browser,
        b = new Browser(context.api),
        c = new Browser(context.api);
    const user = await a.login();
    assert.equal(Date.parse(user.expiresAt) - context.now(), 40 * 86400000);
    await b.login();
    await c.login('user2');
    await a.ok('GET /api/v1/auth/sessions');
    const result = await a.send('POST /api/v1/auth/sessions/revoke-others');
    assert.equal(
        contracts['POST /api/v1/auth/sessions/revoke-others'].success.parse(await result.json()).data.revokedCount,
        1,
    );
    await error(await b.send('GET /api/v1/auth/me'), 401, 'UNAUTHORIZED');
    await c.ok('GET /api/v1/auth/me');
    await a.ok('GET /api/v1/auth/me');
    context.advance(40 * 86400000);
    await error(await a.send('GET /api/v1/auth/me'), 401, 'UNAUTHORIZED');
    await a.ok('POST /api/v1/auth/logout');
    await a.ok('POST /api/v1/auth/logout');
});
await test('MFA enrollment has random secrets, real TOTP, one challenge winner and ten one-time recovery codes', async () => {
    const { browser, now } = setup();
    await browser.login('admin');
    const first = await browser.staff();
    assert.ok(first.enrollment);
    assert.equal(browser.cookies.meal_staff, undefined);
    await error(await browser.send('GET /api/v1/staff/auth/me'), 401, 'UNAUTHORIZED');
    const input = { challenge: first.challenge, code: totp(first.enrollment.secret, now()), method: 'totp' };
    const results = await Promise.all([
        browser.send('POST /api/v1/staff/auth/mfa/verify', input),
        browser.send('POST /api/v1/staff/auth/mfa/verify', input),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 401]);
    const accepted = contracts['POST /api/v1/staff/auth/mfa/verify'].success.parse(
        await results.find((r) => r.status === 200)!.json(),
    ).data;
    assert.equal(new Set(accepted.recoveryCodes).size, 10);
    assert.equal(Date.parse(accepted.user.expiresAt) - now(), 86400000);
    await browser.ok('GET /api/v1/staff/auth/me');
    await browser.ok('GET /api/v1/auth/me');
    await browser.ok('POST /api/v1/staff/auth/logout');
    await browser.ok('GET /api/v1/auth/me');
    const second = await browser.staff();
    assert.equal(second.enrollment, null);
    await error(
        await browser.send('POST /api/v1/staff/auth/mfa/verify', { ...input, challenge: second.challenge }),
        401,
        'UNAUTHORIZED',
    );
    const recovery = accepted.recoveryCodes[0]!;
    const response = await browser.send('POST /api/v1/staff/auth/mfa/verify', {
        challenge: second.challenge,
        code: recovery,
        method: 'recovery',
    });
    assert.deepEqual(
        contracts['POST /api/v1/staff/auth/mfa/verify'].success.parse(await response.json()).data.recoveryCodes,
        [],
    );
    const third = await browser.staff();
    await error(
        await browser.send('POST /api/v1/staff/auth/mfa/verify', {
            challenge: third.challenge,
            code: recovery,
            method: 'recovery',
        }),
        401,
        'UNAUTHORIZED',
    );
});
await test('MFA five failed attempts persist, replaced/expired challenge cannot finish enrollment', async () => {
    const { browser, now, advance } = setup();
    const first = await browser.staff();
    const second = await browser.staff();
    assert.notEqual(first.enrollment?.secret, second.enrollment?.secret);
    await error(
        await browser.send('POST /api/v1/staff/auth/mfa/verify', {
            challenge: first.challenge,
            code: totp(first.enrollment!.secret, now()),
            method: 'totp',
        }),
        401,
        'UNAUTHORIZED',
    );
    for (let n = 0; n < 5; n++)
        await error(
            await browser.send('POST /api/v1/staff/auth/mfa/verify', {
                challenge: second.challenge,
                code: 'nototp',
                method: 'totp',
            }),
            401,
            'UNAUTHORIZED',
        );
    await error(
        await browser.send('POST /api/v1/staff/auth/mfa/verify', {
            challenge: second.challenge,
            code: totp(second.enrollment!.secret, now()),
            method: 'totp',
        }),
        401,
        'UNAUTHORIZED',
    );
    const third = await browser.staff();
    advance(600000);
    await error(
        await browser.send('POST /api/v1/staff/auth/mfa/verify', {
            challenge: third.challenge,
            code: totp(third.enrollment!.secret, now()),
            method: 'totp',
        }),
        401,
        'UNAUTHORIZED',
    );
});
await test('moderator duration and role/factor removal immediately revoke observed staff access', async () => {
    const { browser, now, repository } = setup();
    const challenge = await browser.staff('moderator', 'moderator');
    const response = await browser.send('POST /api/v1/staff/auth/mfa/verify', {
        challenge: challenge.challenge,
        code: totp(challenge.enrollment!.secret, now()),
        method: 'totp',
    });
    const user = contracts['POST /api/v1/staff/auth/mfa/verify'].success.parse(await response.json()).data.user;
    assert.equal(Date.parse(user.expiresAt) - now(), 14 * 86400000);
    await repository.transaction((state) => {
        state.users.find((u) => u.id === user.id)!.role = 'admin';
    });
    await error(await browser.send('GET /api/v1/staff/auth/me'), 401, 'UNAUTHORIZED');
});
await test('health availability and login limiter are independent and rate limit survives a new API instance', async () => {
    const state = setup();
    state.availability(false);
    await state.browser.ok('GET /health/live');
    await error(await state.browser.send('GET /health/ready'), 503, 'UNAVAILABLE');
    state.availability(true);
    await state.browser.ok('GET /health/ready');
    const api = new MockApi(state.repository, { origin, now: state.now, rateLimit: 2 });
    const browser = new Browser(api);
    await browser.prepare();
    for (let n = 0; n < 2; n++)
        await error(
            await browser.send('POST /api/v1/auth/login', { email: 'nobody@meal-planner.test', password: 'bad' }),
            401,
            'UNAUTHORIZED',
        );
    const fresh = new Browser(new MockApi(state.repository, { origin, now: state.now, rateLimit: 2 }));
    await fresh.prepare();
    await error(
        await fresh.send('POST /api/v1/auth/login', { email: 'user1@meal-planner.test', password: '1' }),
        429,
        'RATE_LIMITED',
    );
    state.advance(60001);
    await fresh.login();
});
await test('IndexedDB instances serialize competing transactions and keep failed MFA attempts', async () => {
    globalThis.indexedDB = indexedDB;
    const name = `test-${crypto.randomUUID()}`;
    const a = new IndexedDbRepository(name),
        b = new IndexedDbRepository(name);
    await Promise.all(
        Array.from({ length: 30 }, (_, n) =>
            (n % 2 ? a : b).transaction((state) => {
                state.limits.counter ??= { attempts: 0, started: 0 };
                state.limits.counter.attempts++;
            }),
        ),
    );
    assert.equal(await new IndexedDbRepository(name).transaction((state) => state.limits.counter?.attempts), 30);
    const api = new MockApi(a, { origin });
    const browser = new Browser(api);
    const challenge = await browser.staff();
    await browser.send('POST /api/v1/staff/auth/mfa/verify', {
        challenge: challenge.challenge,
        code: 'nototp',
        method: 'totp',
    });
    assert.equal(await b.transaction((state) => state.challenges[0]?.attempts), 1);
});
await test('MSW intercepts real fetch using the same handlers and OpenAPI envelopes', async () => {
    const { server } = createMockServer({ origin });
    server.listen({ onUnhandledRequest: 'error' });
    try {
        const result = await fetch(origin + '/health/live');
        contracts['GET /health/live'].success.parse(await result.json());
        const csrfResponse = await fetch(origin + '/api/v1/auth/csrf', { credentials: 'include' });
        const csrf = contracts['GET /api/v1/auth/csrf'].success.parse(await csrfResponse.json()).data.token;
        const login = await fetch(origin + '/api/v1/auth/login', {
            method: 'POST',
            credentials: 'include',
            headers: { origin, 'content-type': 'application/json', 'x-csrf-token': csrf },
            body: JSON.stringify({ email: 'user1@meal-planner.test', password: '1' }),
        });
        assert.equal(login.status, 200);
        contracts['POST /api/v1/auth/login'].success.parse(await login.json());
        const me = await fetch(origin + '/api/v1/auth/me', { credentials: 'include' });
        assert.equal(me.status, 200);
        contracts['GET /api/v1/auth/me'].success.parse(await me.json());
        await error(await fetch(origin + '/api/v1/not-implemented'), 404, 'NOT_FOUND');
    } finally {
        server.close();
    }
});
await test('API client rejects stale responses even if transport ignores AbortSignal', async () => {
    let finish!: (response: Response) => void;
    const transport: typeof fetch = () =>
        new Promise((resolve) => {
            finish = resolve;
        });
    const client = new ApiClient(origin, transport);
    const pending = client.request('GET /health/live');
    client.invalidate();
    finish(new Response(JSON.stringify({ data: { status: 'ok' }, meta: { requestId: crypto.randomUUID() } })));
    await assert.rejects(pending, { name: 'AbortError' });
});

await test('staff session listing/revoke-others preserve user sessions and consume recovery under contention', async () => {
    const context = setup();
    const a = context.browser,
        b = new Browser(context.api);
    await a.login('admin');
    const first = await a.staff();
    const enrolled = await a.send('POST /api/v1/staff/auth/mfa/verify', {
        challenge: first.challenge,
        method: 'totp',
        code: totp(first.enrollment!.secret, context.now()),
    });
    const codes = contracts['POST /api/v1/staff/auth/mfa/verify'].success.parse(await enrolled.json()).data
        .recoveryCodes;
    const next = await b.staff();
    const command = { challenge: next.challenge, method: 'recovery', code: codes[0] };
    const races = await Promise.all([
        b.send('POST /api/v1/staff/auth/mfa/verify', command),
        b.send('POST /api/v1/staff/auth/mfa/verify', command),
    ]);
    assert.deepEqual(races.map((r) => r.status).sort(), [200, 401]);
    const sessions = await a.send('GET /api/v1/staff/auth/sessions');
    assert.equal(
        contracts['GET /api/v1/staff/auth/sessions'].success.parse(await sessions.json()).data.sessions.length,
        2,
    );
    const revoke = await a.send('POST /api/v1/staff/auth/sessions/revoke-others');
    assert.equal(
        contracts['POST /api/v1/staff/auth/sessions/revoke-others'].success.parse(await revoke.json()).data
            .revokedCount,
        1,
    );
    await error(await b.send('GET /api/v1/staff/auth/me'), 401, 'UNAUTHORIZED');
    await a.ok('GET /api/v1/auth/me');
    await a.ok('GET /api/v1/staff/auth/me');
    await context.repository.transaction((state) => {
        state.factors.forEach((factor) => {
            factor.revoked = true;
        });
    });
    await error(await a.send('GET /api/v1/staff/auth/me'), 401, 'UNAUTHORIZED');
});
await test('TOTP accepts only the agreed adjacent steps and recovery cannot enroll a factor', async () => {
    for (const offset of [-30000, 30000, 60000]) {
        const { browser, now } = setup();
        const challenge = await browser.staff();
        await error(
            await browser.send('POST /api/v1/staff/auth/mfa/verify', {
                challenge: challenge.challenge,
                method: 'recovery',
                code: 'not-a-code',
            }),
            401,
            'UNAUTHORIZED',
        );
        const response = await browser.send('POST /api/v1/staff/auth/mfa/verify', {
            challenge: challenge.challenge,
            method: 'totp',
            code: totp(challenge.enrollment!.secret, now() + offset),
        });
        assert.equal(response.status, Math.abs(offset) <= 30000 ? 200 : 401);
    }
});
await test('malformed JSON, payload limits and media type match HTTP errors', async () => {
    const { api } = setup();
    for (const [body, contentType, status, code] of [
        ['{oops', 'application/json', 400, 'INVALID_REQUEST'],
        ['x'.repeat(65537), 'application/json', 413, 'PAYLOAD_TOO_LARGE'],
        ['body', 'application/xml', 415, 'UNSUPPORTED_MEDIA_TYPE'],
    ] as const) {
        await error(
            await api.handle(
                new Request(origin + '/api/v1/auth/login', {
                    method: 'POST',
                    headers: { 'content-type': contentType },
                    body,
                }),
            ),
            status,
            code,
        );
    }
});

await test('moderator test controls preserve one-shot faults and keep sticky faults active until cleared', async () => {
    const previousE2eMocks = process.env.NEXT_PUBLIC_E2E_PRODUCTION_MOCKS;
    process.env.NEXT_PUBLIC_E2E_PRODUCTION_MOCKS = '1';
    try {
        const { browser, now } = setup();
        const challenge = await browser.staff('moderator', 'moderator');
        const verified = await browser.send('POST /api/v1/staff/auth/mfa/verify', {
            challenge: challenge.challenge,
            code: totp(challenge.enrollment!.secret, now()),
            method: 'totp',
        });
        assert.equal(verified.status, 200);

        const control = (mode: 'once' | 'sticky') =>
            Buffer.from(
                JSON.stringify({
                    nonce: crypto.randomUUID(),
                    path: '/api/v1/moderator/overview',
                    method: 'GET',
                    status: 503,
                    mode,
                }),
            ).toString('base64url');

        browser.cookies.moderator_test_control = control('once');
        const oneShot = await Promise.all([
            browser.send('GET /api/v1/moderator/overview'),
            browser.send('GET /api/v1/moderator/overview'),
        ]);
        assert.deepEqual(oneShot.map((response) => response.status).sort(), [200, 503]);

        browser.cookies.moderator_test_control = control('sticky');
        const sticky = await Promise.all([
            browser.send('GET /api/v1/moderator/overview'),
            browser.send('GET /api/v1/moderator/overview'),
        ]);
        assert.deepEqual(
            sticky.map((response) => response.status),
            [503, 503],
        );

        delete browser.cookies.moderator_test_control;
        assert.equal((await browser.send('GET /api/v1/moderator/overview')).status, 200);
    } finally {
        if (previousE2eMocks === undefined) delete process.env.NEXT_PUBLIC_E2E_PRODUCTION_MOCKS;
        else process.env.NEXT_PUBLIC_E2E_PRODUCTION_MOCKS = previousE2eMocks;
    }
});

await test('moderator mock enforces assignment, transition compatibility and closed-ticket reopen', async () => {
    assert.deepEqual(moderationActionsForStatus('in_review'), ['approve', 'reject']);
    assert.deepEqual(moderationActionsForStatus('approved'), ['publish', 'reject']);
    assert.deepEqual(moderationActionsForStatus('published'), ['hide', 'unpublish']);
    assert.deepEqual(moderationActionsForStatus('rejected'), []);

    const { browser, now } = setup();
    const challenge = await browser.staff('moderator', 'moderator');
    const verified = await browser.send('POST /api/v1/staff/auth/mfa/verify', {
        challenge: challenge.challenge,
        code: totp(challenge.enrollment!.secret, now()),
        method: 'totp',
    });
    assert.equal(verified.status, 200);

    const firstQueue = await browser.send('GET /api/v1/moderator/queues/recipes');
    assert.equal(firstQueue.status, 200);
    const firstPage = contracts['GET /api/v1/moderator/queues/{queue}'].success.parse(await firstQueue.json()).data;
    assert.equal(firstPage.items.length, 2);
    assert.equal(firstPage.nextCursor, '2');
    const secondQueue = await browser.send('GET /api/v1/moderator/queues/recipes?cursor=2');
    assert.equal(secondQueue.status, 200);
    const secondPage = contracts['GET /api/v1/moderator/queues/{queue}'].success.parse(await secondQueue.json()).data;
    assert.equal(secondPage.items.length, 1);
    assert.equal(secondPage.nextCursor, null);
    assert.equal(new Set([...firstPage.items, ...secondPage.items].map((item) => item.id)).size, 3);

    const variantId = 'c1000000-0000-4000-8000-000000000002';
    const approve = await browser.send(`POST /api/v1/moderator/items/${variantId}/decision`, {
        action: 'approve',
        category: 'quality',
        reason: 'Проверено',
        version: 2,
        idempotencyKey: crypto.randomUUID(),
    });
    assert.equal(approve.status, 200, await approve.clone().text());
    const approved = contracts['POST /api/v1/moderator/items/{id}/decision'].success.parse(await approve.json()).data;
    assert.equal(approved.status, 'approved');
    assert.deepEqual(approved.actions, ['publish', 'reject']);

    await error(
        await browser.send(`POST /api/v1/moderator/items/${variantId}/decision`, {
            action: 'approve',
            category: 'quality',
            reason: 'Повторное недоступное действие',
            version: approved.version,
            idempotencyKey: crypto.randomUUID(),
        }),
        409,
        'CONFLICT',
    );
    const rejected = await browser.send(`POST /api/v1/moderator/items/${variantId}/decision`, {
        action: 'reject',
        category: 'quality',
        reason: 'Отклонено после дополнительной проверки',
        version: approved.version,
        idempotencyKey: crypto.randomUUID(),
    });
    assert.equal(rejected.status, 200, await rejected.clone().text());
    assert.equal(
        contracts['POST /api/v1/moderator/items/{id}/decision'].success.parse(await rejected.json()).data.status,
        'rejected',
    );
    await error(
        await browser.send('GET /api/v1/moderator/items/c1000000-0000-4000-8000-000000000005'),
        403,
        'FORBIDDEN',
    );

    const closedId = 'c1000000-0000-4000-8000-000000000007';
    const closed = await browser.send(`GET /api/v1/moderator/support/${closedId}`);
    assert.equal(closed.status, 200);
    const closedTicket = contracts['GET /api/v1/moderator/support/{id}'].success.parse(await closed.json()).data;
    assert.equal(closedTicket.canReply, false);
    assert.equal(closedTicket.canReopen, true);
    const reopened = await browser.send(`POST /api/v1/moderator/support/${closedId}/reopen`, {
        version: closedTicket.version,
        idempotencyKey: crypto.randomUUID(),
    });
    assert.equal(reopened.status, 200, await reopened.clone().text());
    const reopenedTicket = contracts['POST /api/v1/moderator/support/{id}/reopen'].success.parse(
        await reopened.json(),
    ).data;
    assert.equal(reopenedTicket.status, 'waiting_for_support');
    assert.equal(reopenedTicket.canReply, true);
    assert.equal(reopenedTicket.canReopen, false);
});
