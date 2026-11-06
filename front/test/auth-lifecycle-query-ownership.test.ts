import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { authLifecycleKeys } from '../src/features/auth/lifecycle/query-keys.js';
import {
    cancelEmailChange,
    checkPasswordResetLink,
    confirmEmailChange,
    registerAccount,
    requestPasswordRecovery,
    resendVerificationEmail,
    resetPassword,
    verifyEmail,
} from '../src/features/auth/lifecycle/api.js';

void test('auth lifecycle keys preserve exact public manifest and reset-link tuples', () => {
    assert.deepEqual(authLifecycleKeys.publicLegalManifest, ['public-legal-manifest']);
    assert.deepEqual(authLifecycleKeys.resetLink('token-a'), ['reset-link', 'token-a']);
    assert.deepEqual(authLifecycleKeys.resetLink(''), ['reset-link', '']);
});

void test('auth lifecycle adapter preserves prepared inputs, signals, projections and native errors', async () => {
    const calls: unknown[][] = [];
    const signal = new AbortController().signal;
    const registration = { prepared: 'legal-evidence-command' };
    const resetCheck = { valid: true, expiresAt: 'expiry' };
    const confirmation = { effectiveAt: 'effective-at' };
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            if (args[0] === 'POST /api/v1/auth/password/reset/check') return Promise.resolve({ data: resetCheck });
            if (args[0] === 'POST /api/v1/auth/email/change/confirm') return Promise.resolve({ data: confirmation });
            return Promise.resolve({ data: {} });
        },
    };

    await registerAccount(transport as never, registration as never, signal);
    await resendVerificationEmail(transport as never, { email: 'user@test' }, signal);
    await requestPasswordRecovery(transport as never, { email: 'user@test' }, signal);
    await verifyEmail(transport as never, { token: 'verify-token' }, signal);
    assert.equal(await confirmEmailChange(transport as never, { token: 'confirm-token' }, signal), confirmation);
    await cancelEmailChange(transport as never, { token: 'cancel-token' }, signal);
    assert.equal(await checkPasswordResetLink(transport as never, { token: 'reset-token' }, signal), resetCheck);
    await resetPassword(transport as never, { token: 'reset-token', password: 'new-password' }, signal);
    assert.deepEqual(calls, [
        ['POST /api/v1/auth/register/v2', registration, signal],
        ['POST /api/v1/auth/email/resend', { email: 'user@test' }, signal],
        ['POST /api/v1/auth/password/recovery', { email: 'user@test' }, signal],
        ['POST /api/v1/auth/email/verify', { token: 'verify-token' }, signal],
        ['POST /api/v1/auth/email/change/confirm', { token: 'confirm-token' }, signal],
        ['POST /api/v1/auth/email/change/cancel', { token: 'cancel-token' }, signal],
        ['POST /api/v1/auth/password/reset/check', { token: 'reset-token' }, signal],
        ['POST /api/v1/auth/password/reset', { token: 'reset-token', password: 'new-password' }, signal],
    ]);

    const error = new Error('native lifecycle error');
    await assert.rejects(
        requestPasswordRecovery({ request: () => Promise.reject(error) } as never, { email: 'user@test' }, signal),
        (actual) => actual === error,
    );
});

void test('lifecycle pages use private owners without changing registration or reset behavior', async () => {
    const [source, adapter] = await Promise.all([
        readFile('src/features/auth/lifecycle-pages.tsx', 'utf8'),
        readFile('src/features/auth/lifecycle/api.ts', 'utf8'),
    ]);

    assert.match(source, /queryKey: authLifecycleKeys\.publicLegalManifest/u);
    assert.match(source, /queryKey: authLifecycleKeys\.resetLink\(token\)/u);
    assert.doesNotMatch(source, /queryKey: \[['"](?:public-legal-manifest|reset-link)['"]/u);

    assert.match(
        source,
        /retry: false,\s*enabled: !!runtime\.api,\s*queryFn: \(\{ signal \}\) => getPublicLegalManifest/u,
    );
    assert.match(source, /const token = params\.get\(['"]token['"]\) \?\? ['"]/u);
    assert.match(source, /enabled: !!runtime\.api && !!token,\s*gcTime: 0,\s*retry: false/u);
    assert.match(source, /checkPasswordResetLink\(runtime\.api!, \{ token \}, signal\)/u);
    assert.match(source, /resetPassword\(runtime\.api!, \{ token, password \}, signal\)/u);
    assert.doesNotMatch(source, /\.request\s*\(/u);
    for (const route of [
        'POST /api/v1/auth/register/v2',
        'POST /api/v1/auth/email/resend',
        'POST /api/v1/auth/password/recovery',
        'POST /api/v1/auth/email/verify',
        'POST /api/v1/auth/email/change/confirm',
        'POST /api/v1/auth/email/change/cancel',
        'POST /api/v1/auth/password/reset/check',
        'POST /api/v1/auth/password/reset',
    ])
        assert.match(adapter, new RegExp(`['"]${route.replaceAll('/', '\\/')}['"]`, 'u'));
    assert.match(source, /hasPublishedRegistrationDocuments/u);
    assert.match(source, /hasReviewableRegistrationDocuments/u);
    assert.match(source, /cause instanceof ApiError && cause\.code === ['"]LEGAL_DOCUMENT_STALE['"]/u);
    assert.match(source, /setTermsAcceptedFor\(null\)/u);
    assert.match(source, /await legal\.refetch\(\)/u);
    assert.match(source, /window\.history\.replaceState\(null, ['"]{2}, window\.location\.pathname\)/u);
    assert.match(source, /leaveRevokedSessions\(runtime\)/u);
    assert.doesNotMatch(adapter, /idempotencyKey|randomUUID/u);
});
