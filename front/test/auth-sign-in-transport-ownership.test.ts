import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { signInUser, startStaffSignIn, verifyStaffMfa } from '../src/features/auth/sign-in-api.js';

void test('sign-in adapter preserves explicit user methods, staff context, MFA inputs, signals and native errors', async () => {
    const calls: unknown[][] = [];
    const user = { id: 'user-id' };
    const challenge = { status: 'mfa_required', challenge: 'challenge', expiresAt: 'expiry', enrollment: null };
    const verified = { user, recoveryCodes: ['recovery'] };
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            if (args[0] === 'POST /api/v1/staff/auth/login') return Promise.resolve({ data: challenge });
            if (args[0] === 'POST /api/v1/staff/auth/mfa/verify') return Promise.resolve({ data: verified });
            return Promise.resolve({ data: { user } });
        },
    };
    const signal = new AbortController().signal;

    assert.equal(
        await signInUser(transport as never, 'password', { email: 'user@test', secret: 'password' }, signal),
        user,
    );
    assert.equal(await signInUser(transport as never, 'totp', { email: 'user@test', secret: '123456' }, signal), user);
    assert.equal(
        await signInUser(transport as never, 'pin', { email: 'ignored@test', secret: '654321' }, signal),
        user,
    );
    assert.equal(
        await startStaffSignIn(transport as never, 'moderator', { email: 'staff@test', password: 'secret' }, signal),
        challenge,
    );
    assert.equal(
        await verifyStaffMfa(transport as never, { challenge: 'challenge', code: '123456', method: 'totp' }, signal),
        verified,
    );

    assert.deepEqual(calls, [
        ['POST /api/v1/auth/login', { email: 'user@test', password: 'password' }, signal],
        ['POST /api/v1/auth/totp/login', { email: 'user@test', code: '123456' }, signal],
        ['POST /api/v1/auth/pin/login', { pin: '654321' }, signal],
        ['POST /api/v1/staff/auth/login', { email: 'staff@test', password: 'secret', context: 'moderator' }, signal],
        ['POST /api/v1/staff/auth/mfa/verify', { challenge: 'challenge', code: '123456', method: 'totp' }, signal],
    ]);

    const error = new Error('native transport error');
    await assert.rejects(
        signInUser(
            { request: () => Promise.reject(error) } as never,
            'password',
            { email: 'user@test', secret: 'bad' },
            signal,
        ),
        (actual) => actual === error,
    );
});

void test('auth screen uses the private adapter while retaining session, challenge and navigation orchestration', async () => {
    const [screen, adapter] = await Promise.all([
        readFile('src/features/auth/auth-screen.tsx', 'utf8'),
        readFile('src/features/auth/sign-in-api.ts', 'utf8'),
    ]);
    assert.doesNotMatch(screen, /\.request\s*\(/u);
    assert.match(screen, /signInUser\(runtime\.api, method, \{ email, secret: password \}, signal\)/u);
    assert.match(screen, /startStaffSignIn\(runtime\.api, context, \{ email, password \}, signal\)/u);
    assert.match(screen, /verifyStaffMfa\(runtime\.api, \{ challenge: flow\.challenge, code, method \}, signal\)/u);
    for (const marker of [
        /signal\.throwIfAborted\(\)/u,
        /runtime\.reset\(\)/u,
        /setUserSession\(runtime, user\)/u,
        /runtime\.setMfa\(\{ \.\.\.challenge, context, returnTo \}\)/u,
        /runtime\.api\.invalidate\(\)/u,
        /runtime\.queryClient\.clear\(\)/u,
        /runtime\.broadcast\(\)/u,
        /safeReturnTo\(requestedReturnTo \?\? null, context\)/u,
        /error instanceof DOMException && error\.name === 'AbortError'/u,
    ])
        assert.match(screen, marker);
    assert.match(adapter, /method === 'password'/u);
    assert.match(adapter, /method === 'totp'/u);
});
