import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    changeAccountPassword,
    confirmAuthenticatorSetup,
    createCriticalReauth,
    loadAccountSecurity,
    regenerateAuthenticatorRecoveryCodes,
    requestAccountEmailChange,
    revokeAccountPin,
    setupAccountPin,
    startAuthenticatorSetup,
} from '../src/entities/account-security/api.js';
import { accountSecurityKeys } from '../src/entities/account-security/model.js';

void test('account-security keys preserve distinct settings and critical reauth cache lifecycles', () => {
    assert.deepEqual(accountSecurityKeys.settings, ['account', 'security']);
    assert.deepEqual(accountSecurityKeys.criticalReauth, ['auth', 'security', 'critical-reauth']);
    assert.notDeepEqual(accountSecurityKeys.settings, accountSecurityKeys.criticalReauth);
});

void test('account-security command adapter preserves prepared inputs, signals, projections and native errors', async () => {
    const calls: unknown[][] = [];
    const signal = new AbortController().signal;
    const enrollment = { challenge: 'challenge', expiresAt: 'expiry', enrollment: { secret: 'secret', uri: 'uri' } };
    const recovery = { recoveryCodes: ['one-time-code'] };
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            if (args[0] === 'POST /api/v1/auth/authenticator/setup') return Promise.resolve({ data: enrollment });
            if (String(args[0]).includes('authenticator')) return Promise.resolve({ data: recovery });
            return Promise.resolve({ data: {} });
        },
    };

    await changeAccountPassword(transport as never, { currentPassword: 'old', password: 'new' }, signal);
    await requestAccountEmailChange(transport as never, { password: 'old', email: 'next@test' }, signal);
    await setupAccountPin(transport as never, { password: 'old', pin: '123456' }, signal);
    await revokeAccountPin(transport as never, signal);
    assert.equal(
        await startAuthenticatorSetup(
            transport as never,
            { password: 'old', proof: { method: 'totp', code: '123456' } },
            signal,
        ),
        enrollment,
    );
    assert.equal(
        await confirmAuthenticatorSetup(transport as never, { challenge: 'challenge', code: '654321' }, signal),
        recovery,
    );
    assert.equal(
        await regenerateAuthenticatorRecoveryCodes(
            transport as never,
            { password: 'old', proof: { method: 'recovery', code: 'backup' } },
            signal,
        ),
        recovery,
    );
    assert.deepEqual(calls, [
        ['POST /api/v1/auth/password/change', { currentPassword: 'old', password: 'new' }, signal],
        ['POST /api/v1/auth/email/change', { password: 'old', email: 'next@test' }, signal],
        ['POST /api/v1/auth/pin/setup', { password: 'old', pin: '123456' }, signal],
        ['POST /api/v1/auth/pin/revoke', {}, signal],
        [
            'POST /api/v1/auth/authenticator/setup',
            { password: 'old', proof: { method: 'totp', code: '123456' } },
            signal,
        ],
        ['POST /api/v1/auth/authenticator/confirm', { challenge: 'challenge', code: '654321' }, signal],
        [
            'POST /api/v1/auth/authenticator/recovery-codes',
            { password: 'old', proof: { method: 'recovery', code: 'backup' } },
            signal,
        ],
    ]);

    const error = new Error('native security error');
    await assert.rejects(
        revokeAccountPin({ request: () => Promise.reject(error) } as never, signal),
        (actual) => actual === error,
    );
});

void test('account-security adapter preserves GET signal, POST body, data projection and error identity', async () => {
    const signal = new AbortController().signal;
    const calls: unknown[][] = [];
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            if (args[0] === 'GET /api/v1/auth/security') {
                return Promise.resolve({
                    data: { authenticatorEnabled: true, pinEnabled: false, pendingEmail: null },
                });
            }
            return Promise.resolve({
                data: {
                    reauthToken: 'reauth-token',
                    purpose: 'export',
                    expiresAt: '2026-11-06T12:00:00.000Z',
                },
            });
        },
    };

    assert.deepEqual(await loadAccountSecurity(transport as never, signal), {
        authenticatorEnabled: true,
        pinEnabled: false,
        pendingEmail: null,
    });
    assert.deepEqual(calls[0], ['GET /api/v1/auth/security', undefined, signal]);

    const input = {
        purpose: 'export' as const,
        password: 'secret',
        factor: { method: 'totp' as const, code: '123456' },
    };
    assert.deepEqual(await createCriticalReauth(transport as never, input), {
        reauthToken: 'reauth-token',
        purpose: 'export',
        expiresAt: '2026-11-06T12:00:00.000Z',
    });
    assert.deepEqual(calls[1], ['POST /api/v1/account/critical-reauth', input]);

    const error = new Error('risk held');
    await assert.rejects(
        loadAccountSecurity({ request: () => Promise.reject(error) } as never),
        (actual) => actual === error,
    );
});

void test('account-security consumers use the entity owner without changing reads or commands', async () => {
    const [settings, criticalReauth, adapter] = await Promise.all([
        readFile('src/features/auth/account-security.tsx', 'utf8'),
        readFile('src/entities/account-security/critical-reauth.tsx', 'utf8'),
        readFile('src/entities/account-security/api.ts', 'utf8'),
    ]);

    assert.match(settings, /queryKey: accountSecurityKeys\.settings/u);
    assert.match(settings, /invalidateQueries\(\{ queryKey: accountSecurityKeys\.settings \}\)/u);
    assert.doesNotMatch(settings, /queryKey: \[['"]account['"], ['"]security['"]\]/u);
    assert.match(settings, /loadAccountSecurity\(runtime\.api!, signal\)/u);
    assert.doesNotMatch(settings, /\.request\s*\(/u);
    for (const route of [
        'POST /api/v1/auth/password/change',
        'POST /api/v1/auth/email/change',
        'POST /api/v1/auth/pin/setup',
        'POST /api/v1/auth/pin/revoke',
        'POST /api/v1/auth/authenticator/setup',
        'POST /api/v1/auth/authenticator/confirm',
        'POST /api/v1/auth/authenticator/recovery-codes',
    ])
        assert.match(adapter, new RegExp(`['"]${route.replaceAll('/', '\\/')}['"]`, 'u'));
    assert.match(settings, /leaveRevokedSessions\(runtime\)/u);
    assert.match(settings, /await refresh\(\)/u);
    assert.match(settings, /runtime\.broadcast\(\)/u);
    assert.match(settings, /Date\.parse\(enrollment\.expiresAt\)/u);

    assert.match(criticalReauth, /queryKey: accountSecurityKeys\.criticalReauth/u);
    assert.doesNotMatch(criticalReauth, /queryKey: \[['"]auth['"], ['"]security['"], ['"]critical-reauth['"]\]/u);
    assert.match(criticalReauth, /enabled: open && !!api/u);
    assert.match(criticalReauth, /loadAccountSecurity\(api!, signal\)/u);
    assert.match(criticalReauth, /createCriticalReauth\(api!,/u);
    assert.doesNotMatch(criticalReauth, /\.request\(/u);
    assert.match(criticalReauth, /purpose,\s*password,/u);
    assert.match(criticalReauth, /factor: security\.data\?\.authenticatorEnabled/u);
    assert.match(criticalReauth, /mutation\.error instanceof ApiError/u);
    assert.match(criticalReauth, /setPassword\(['"]['"]\);\s*setCode\(['"]['"]\);/u);
    assert.match(criticalReauth, /onSuccess\(\{ token: value\.reauthToken, expiresAt: value\.expiresAt \}\)/u);
    assert.match(adapter, /'GET \/api\/v1\/auth\/security'/u);
    assert.match(adapter, /undefined, signal/u);
    assert.match(adapter, /'POST \/api\/v1\/account\/critical-reauth', input/u);
});
