import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSync } from 'otplib';
import { MockApi } from '../src/mocks/api.js';
import { MemoryRepository } from '../src/mocks/repository.js';
import { contracts, type Route, type Success } from '../src/shared/api/contracts.generated.js';
import { createSeed, mockStateSchema } from '../src/mocks/model.js';

const origin = 'http://localhost:3000';
const password = 'Strong-pass-123';
class Browser {
    cookies: Record<string, string> = {};
    csrf = '';
    constructor(readonly api: MockApi) {}
    async send(route: string, body?: unknown) {
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
                },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            }),
        );
        for (const header of response.headers.getSetCookie()) {
            const pair = header.split(';')[0]!;
            const at = pair.indexOf('=');
            this.cookies[pair.slice(0, at)] = pair.slice(at + 1);
        }
        return response;
    }
    async ok<R extends Route>(route: R, body?: unknown): Promise<Success<R>> {
        const response = await this.send(route, body);
        assert.equal(response.status, 200, await response.clone().text());
        return contracts[route].success.parse(await response.json()) as Success<R>;
    }
    async prepare() {
        this.csrf = (await this.ok('GET /api/v1/auth/csrf')).data.token;
    }
    async login(email = 'user1@meal-planner.test', value = '1') {
        await this.prepare();
        return this.ok('POST /api/v1/auth/login', { email, password: value });
    }
    async mail(email: string, kind: 'verify' | 'reset' | 'email-confirm' | 'email-cancel') {
        const messages = (await this.ok('POST /api/v1/dev/mailbox', { email })).data.messages;
        const message = messages.find((m) => m.kind === kind);
        assert.ok(message);
        return message;
    }
}
function setup() {
    let now = Date.parse('2026-09-28T12:00:00Z');
    const repository = new MemoryRepository();
    const api = new MockApi(repository, { origin, now: () => now, rateLimit: 100 });
    return {
        repository,
        api,
        browser: new Browser(api),
        advance: (ms: number) => {
            now += ms;
        },
        now: () => now,
    };
}
const totp = (secret: string, now: number) =>
    generateSync({ secret, strategy: 'totp', digits: 6, period: 30, epoch: Math.floor(now / 1000) });

await test('registration validates password/consent, normalizes identity, verifies once and does not auto-login', async () => {
    const { browser } = setup();
    await browser.prepare();
    const input = {
        username: 'New_User',
        displayName: 'New user',
        email: 'New@meal-planner.test',
        password,
        acceptTerms: true,
        acceptPrivacy: true,
    };
    for (const invalid of [
        'short',
        'all-lowercase-123!',
        'ALL-UPPERCASE-123!',
        'NoDigitsInPassword!',
        'NoSymbols123456',
    ])
        assert.equal((await browser.send('POST /api/v1/auth/register', { ...input, password: invalid })).status, 400);
    assert.equal((await browser.send('POST /api/v1/auth/register', { ...input, acceptTerms: false })).status, 400);
    await browser.ok('POST /api/v1/auth/register', input);
    assert.equal((await browser.send('POST /api/v1/auth/login', { email: input.email, password })).status, 401);
    const message = await browser.mail(input.email, 'verify');
    await browser.ok('POST /api/v1/auth/email/verify', { token: message.token });
    assert.equal((await browser.send('POST /api/v1/auth/email/verify', { token: message.token })).status, 400);
    assert.equal((await browser.send('GET /api/v1/auth/me')).status, 401);
    await browser.login(input.email, password);
    assert.equal((await browser.ok('GET /api/v1/profile')).data.profile.username, 'new_user');
    assert.equal((await browser.ok('GET /api/v1/profile')).data.profile.timezone, 'Europe/Moscow');
    assert.equal(
        (
            await browser.send('POST /api/v1/auth/register', {
                ...input,
                email: 'other@meal-planner.test',
                username: 'NEW_USER',
            })
        ).status,
        409,
    );
});
await test('resend invalidates previous links, limits messages and preserves neutral recovery responses', async () => {
    const { browser, advance } = setup();
    await browser.prepare();
    const email = 'pending@meal-planner.test';
    await browser.ok('POST /api/v1/auth/register', {
        username: 'pending',
        displayName: 'Pending',
        email,
        password,
        acceptTerms: true,
        acceptPrivacy: true,
    });
    const first = await browser.mail(email, 'verify');
    assert.equal((await browser.send('POST /api/v1/auth/email/resend', { email })).status, 429);
    advance(60000);
    await browser.ok('POST /api/v1/auth/email/resend', { email });
    const second = await browser.mail(email, 'verify');
    assert.notEqual(first.token, second.token);
    assert.equal((await browser.send('POST /api/v1/auth/email/verify', { token: first.token })).status, 400);
    advance(86400001);
    assert.equal((await browser.send('POST /api/v1/auth/email/verify', { token: second.token })).status, 400);
    for (let index = 0; index < 5; index++)
        await browser.ok('POST /api/v1/auth/password/recovery', { email: `unknown${index}@meal-planner.test` });
    assert.equal(
        (await browser.send('POST /api/v1/auth/password/recovery', { email: 'sixth@meal-planner.test' })).status,
        429,
    );
});
await test('reset links expire, check is non-consuming, concurrent reset has one winner and revokes sessions/PIN', async () => {
    const { browser, api, advance } = setup();
    await browser.login();
    await browser.ok('POST /api/v1/auth/pin/setup', { password: '1', pin: '345678' });
    const second = new Browser(api);
    await second.login();
    const email = 'user1@meal-planner.test';
    await browser.ok('POST /api/v1/auth/password/recovery', { email });
    const expired = await browser.mail(email, 'reset');
    advance(1800000);
    assert.equal((await browser.send('POST /api/v1/auth/password/reset/check', { token: expired.token })).status, 400);
    await browser.ok('POST /api/v1/auth/password/recovery', { email });
    const fresh = await browser.mail(email, 'reset');
    await browser.ok('POST /api/v1/auth/password/reset/check', { token: fresh.token });
    const results = await Promise.all([
        browser.send('POST /api/v1/auth/password/reset', { token: fresh.token, password }),
        second.send('POST /api/v1/auth/password/reset', { token: fresh.token, password }),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
    assert.equal((await second.send('GET /api/v1/auth/me')).status, 401);
    assert.equal((await browser.send('POST /api/v1/auth/pin/login', { pin: '345678' })).status, 401);
    assert.equal((await browser.send('POST /api/v1/auth/login', { email, password: '1' })).status, 401);
    await browser.login(email, password);
});
await test('PIN is device-bound, survives logout and is disabled on fifth invalid attempt', async () => {
    const { browser, api } = setup();
    await browser.login();
    await browser.ok('POST /api/v1/auth/pin/setup', { password: '1', pin: '345678' });
    assert.equal((await browser.ok('GET /api/v1/auth/security')).data.pinEnabled, true);
    const other = new Browser(api);
    await other.prepare();
    assert.equal((await other.send('POST /api/v1/auth/pin/login', { pin: '345678' })).status, 401);
    await browser.ok('POST /api/v1/auth/logout');
    await browser.ok('POST /api/v1/auth/pin/login', { pin: '345678' });
    await browser.ok('POST /api/v1/auth/logout');
    for (let index = 0; index < 5; index++)
        assert.equal((await browser.send('POST /api/v1/auth/pin/login', { pin: '000000' })).status, 401);
    assert.equal((await browser.send('POST /api/v1/auth/pin/login', { pin: '345678' })).status, 401);
    await browser.login();
    assert.equal((await browser.ok('GET /api/v1/auth/security')).data.pinEnabled, false);
});
await test('password change requires current password and revokes both user and staff sessions', async () => {
    const { browser, api, now } = setup();
    await browser.login('admin@meal-planner.test');
    const staff = new Browser(api);
    await staff.prepare();
    const challenge = (
        await staff.ok('POST /api/v1/staff/auth/login', {
            email: 'admin@meal-planner.test',
            password: '1',
            context: 'admin',
        })
    ).data;
    assert.ok(challenge.enrollment);
    await staff.ok('POST /api/v1/staff/auth/mfa/verify', {
        challenge: challenge.challenge,
        method: 'totp',
        code: totp(challenge.enrollment.secret, now()),
    });
    assert.equal(
        (await browser.send('POST /api/v1/auth/password/change', { currentPassword: 'bad', password })).status,
        401,
    );
    await browser.ok('POST /api/v1/auth/password/change', { currentPassword: '1', password });
    assert.equal((await browser.send('GET /api/v1/auth/me')).status, 401);
    assert.equal((await staff.send('GET /api/v1/staff/auth/me')).status, 401);
    await browser.login('admin@meal-planner.test', password);
    assert.equal((await browser.ok('GET /api/v1/auth/security')).data.authenticatorEnabled, true);
});
await test('authenticator enrollment, alternative TOTP, replay rejection and replacement are atomic', async () => {
    const { browser, now, advance } = setup();
    await browser.login();
    const initial = (await browser.ok('POST /api/v1/auth/authenticator/setup', { password: '1' })).data;
    const codes = (
        await browser.ok('POST /api/v1/auth/authenticator/confirm', {
            challenge: initial.challenge,
            code: totp(initial.enrollment.secret, now()),
        })
    ).data.recoveryCodes;
    assert.equal(codes.length, 10);
    await browser.ok('POST /api/v1/auth/logout');
    assert.equal(
        (
            await browser.send('POST /api/v1/auth/totp/login', {
                email: 'user1@meal-planner.test',
                code: totp(initial.enrollment.secret, now()),
            })
        ).status,
        401,
    );
    advance(30000);
    const logged = (
        await browser.ok('POST /api/v1/auth/totp/login', {
            email: 'user1@meal-planner.test',
            code: totp(initial.enrollment.secret, now()),
        })
    ).data.user;
    assert.equal(logged.context, 'user');
    assert.equal((await browser.send('GET /api/v1/staff/auth/me')).status, 401);
    assert.equal((await browser.send('POST /api/v1/auth/authenticator/setup', { password: '1' })).status, 401);
    const regenerated = (
        await browser.ok('POST /api/v1/auth/authenticator/recovery-codes', {
            password: '1',
            proof: { method: 'recovery', code: codes[0] },
        })
    ).data.recoveryCodes;
    assert.equal(
        (
            await browser.send('POST /api/v1/auth/authenticator/setup', {
                password: '1',
                proof: { method: 'recovery', code: codes[1] },
            })
        ).status,
        401,
    );
    const replacement = (
        await browser.ok('POST /api/v1/auth/authenticator/setup', {
            password: '1',
            proof: { method: 'recovery', code: regenerated[0] },
        })
    ).data;
    await browser.ok('POST /api/v1/auth/authenticator/confirm', {
        challenge: replacement.challenge,
        code: totp(replacement.enrollment.secret, now()),
    });
    assert.equal(
        (
            await browser.send('POST /api/v1/auth/authenticator/confirm', {
                challenge: replacement.challenge,
                code: totp(replacement.enrollment.secret, now()),
            })
        ).status,
        401,
    );
    advance(30000);
    await browser.ok('POST /api/v1/auth/logout');
    assert.equal(
        (
            await browser.send('POST /api/v1/auth/totp/login', {
                email: 'user1@meal-planner.test',
                code: totp(initial.enrollment.secret, now()),
            })
        ).status,
        401,
    );
    await browser.ok('POST /api/v1/auth/totp/login', {
        email: 'user1@meal-planner.test',
        code: totp(replacement.enrollment.secret, now()),
    });
});
await test('email change can be cancelled by old address and applies only 24h after confirmation', async () => {
    const { browser, advance } = setup();
    await browser.login();
    const email = 'new-mail@meal-planner.test';
    await browser.ok('POST /api/v1/auth/email/change', { password: '1', email });
    const cancel = await browser.mail('user1@meal-planner.test', 'email-cancel');
    const confirm = await browser.mail(email, 'email-confirm');
    await browser.ok('POST /api/v1/auth/email/change/confirm', { token: confirm.token });
    await browser.ok('POST /api/v1/auth/email/change/cancel', { token: cancel.token });
    advance(60000);
    await browser.ok('POST /api/v1/auth/email/change', { password: '1', email });
    const next = await browser.mail(email, 'email-confirm');
    await browser.ok('POST /api/v1/auth/email/change/confirm', { token: next.token });
    assert.equal((await browser.ok('GET /api/v1/profile')).data.profile.email, 'user1@meal-planner.test');
    advance(86400000);
    assert.equal((await browser.send('GET /api/v1/auth/me')).status, 401);
    await browser.login(email);
    assert.equal((await browser.ok('GET /api/v1/profile')).data.profile.email, email);
});
await test('existing mock storage upgrades account metadata without losing users/sessions', () => {
    const seed = createSeed();
    const { account: _account, ...old } = seed;
    assert.equal(_account.mail.length, 0);
    const restored = mockStateSchema.parse(old);
    assert.equal(restored.users.length, 8);
    assert.deepEqual(restored.account.mail, []);
});

await test('factor setup challenge belongs to its originating session and five wrong codes exhaust it', async () => {
    const { browser, api, now } = setup();
    await browser.login();
    const other = new Browser(api);
    await other.login();
    const setupResult = (await browser.ok('POST /api/v1/auth/authenticator/setup', { password: '1' })).data;
    const code = totp(setupResult.enrollment.secret, now());
    assert.equal(
        (await other.send('POST /api/v1/auth/authenticator/confirm', { challenge: setupResult.challenge, code }))
            .status,
        401,
    );
    const wrong = code === '000000' ? '111111' : '000000';
    for (let n = 0; n < 5; n++)
        assert.equal(
            (
                await browser.send('POST /api/v1/auth/authenticator/confirm', {
                    challenge: setupResult.challenge,
                    code: wrong,
                })
            ).status,
            401,
        );
    assert.equal(
        (await browser.send('POST /api/v1/auth/authenticator/confirm', { challenge: setupResult.challenge, code }))
            .status,
        401,
    );
});
await test('reset cancels pending email change and preserves existing authenticator', async () => {
    const { browser, now, advance } = setup();
    await browser.login();
    const enrollment = (await browser.ok('POST /api/v1/auth/authenticator/setup', { password: '1' })).data;
    await browser.ok('POST /api/v1/auth/authenticator/confirm', {
        challenge: enrollment.challenge,
        code: totp(enrollment.enrollment.secret, now()),
    });
    await browser.ok('POST /api/v1/auth/email/change', { password: '1', email: 'pending-new@meal-planner.test' });
    const pending = await browser.mail('pending-new@meal-planner.test', 'email-confirm');
    await browser.ok('POST /api/v1/auth/email/change/confirm', { token: pending.token });
    await browser.ok('POST /api/v1/auth/password/recovery', { email: 'user1@meal-planner.test' });
    const reset = await browser.mail('user1@meal-planner.test', 'reset');
    await browser.ok('POST /api/v1/auth/password/reset', { token: reset.token, password });
    advance(86400000);
    await browser.login('user1@meal-planner.test', password);
    const security = (await browser.ok('GET /api/v1/auth/security')).data;
    assert.equal(security.authenticatorEnabled, true);
    assert.equal(security.pendingEmail, null);
});
await test('generated password contract supports Unicode classes, symbols and exact length boundaries', () => {
    const schema = contracts['POST /api/v1/auth/password/reset'].request;
    const valid = (password: string) => schema.safeParse({ token: 'a'.repeat(43), password }).success;
    assert.equal(valid('Яя1!' + 'я'.repeat(8)), true);
    assert.equal(valid('Aa1!' + 'a'.repeat(124)), true);
    assert.equal(valid('Aa1!' + 'a'.repeat(125)), false);
    assert.equal(valid('Aa1 ' + 'a'.repeat(8)), false);
});

await test('email-change reauthentication is throttled even when the password is wrong', async () => {
    const { browser } = setup();
    await browser.login();
    const request = { password: 'wrong', email: 'other@meal-planner.test' };
    assert.equal((await browser.send('POST /api/v1/auth/email/change', request)).status, 401);
    assert.equal((await browser.send('POST /api/v1/auth/email/change', request)).status, 429);
    assert.equal((await browser.ok('GET /api/v1/auth/security')).data.pendingEmail, null);
});
await test('staff initial enrollment invalidates a competing ordinary enrollment challenge', async () => {
    const { browser, now } = setup();
    await browser.login('admin@meal-planner.test');
    const pending = (await browser.ok('POST /api/v1/auth/authenticator/setup', { password: '1' })).data;
    await browser.ok('POST /api/v1/staff/auth/login', {
        email: 'admin@meal-planner.test',
        password: '1',
        context: 'admin',
    });
    assert.equal(
        (
            await browser.send('POST /api/v1/auth/authenticator/confirm', {
                challenge: pending.challenge,
                code: totp(pending.enrollment.secret, now()),
            })
        ).status,
        401,
    );
});
