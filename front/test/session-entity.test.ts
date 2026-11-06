import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import {
    sessionListQueryKey,
    sessionQueryKey,
    setUserSession,
    type UserSession,
} from '../src/entities/session/model.js';

const user: Exclude<UserSession, null> = {
    id: '10000000-0000-4000-8000-000000000001',
    displayName: 'Test user',
    context: 'user',
    expiresAt: '2027-01-01T00:00:00.000Z',
    sessionId: '10000000-0000-4000-8000-000000000002',
};

await test('session entity preserves exact user and staff query keys', () => {
    assert.deepEqual(sessionQueryKey('user'), ['session', 'user']);
    assert.deepEqual(sessionQueryKey('moderator'), ['session', 'staff']);
    assert.deepEqual(sessionListQueryKey('user'), ['sessions', 'user']);
    assert.deepEqual(sessionListQueryKey('moderator'), ['sessions', 'staff']);
    assert.notDeepEqual(sessionListQueryKey('user'), sessionQueryKey('user'));
    assert.notDeepEqual(sessionListQueryKey('moderator'), sessionQueryKey('moderator'));
});

await test('user session writes keep offline lifecycle synchronized', () => {
    const queryClient = new QueryClient();
    const events: string[] = [];
    const runtime = {
        queryClient,
        sessionLifecycle: {
            onUserAuthenticated: (userId: string) => events.push(`authenticated:${userId}`),
            onUserUnauthorized: () => events.push('unauthorized'),
        },
    };

    setUserSession(runtime, user);
    assert.deepEqual(queryClient.getQueryData(sessionQueryKey('user')), user);
    assert.deepEqual(events, [`authenticated:${user.id}`]);

    setUserSession(runtime, (current) => (current ? { ...current, displayName: 'Updated user' } : current));
    assert.equal(
        (queryClient.getQueryData(sessionQueryKey('user')) as Exclude<UserSession, null>).displayName,
        'Updated user',
    );
    assert.deepEqual(events, [`authenticated:${user.id}`, `authenticated:${user.id}`]);

    setUserSession(runtime, null);
    assert.equal(queryClient.getQueryData(sessionQueryKey('user')), null);
    assert.deepEqual(events, [`authenticated:${user.id}`, `authenticated:${user.id}`, 'unauthorized']);
});

await test('staff auth and 401 recovery use the canonical session owner without changing commands', async () => {
    const [auth, signInApi, item, queue, sessions, sessionsApi, moderationApi] = await Promise.all([
        readFile('src/features/auth/auth-screen.tsx', 'utf8'),
        readFile('src/features/auth/sign-in-api.ts', 'utf8'),
        readFile('src/features/moderation/item-route.tsx', 'utf8'),
        readFile('src/features/moderation/queue-route.tsx', 'utf8'),
        readFile('src/features/auth/sessions-panel.tsx', 'utf8'),
        readFile('src/features/auth/sessions-api.ts', 'utf8'),
        readFile('src/features/moderation/api.ts', 'utf8'),
    ]);

    assert.deepEqual(
        [auth, item, queue].map((source) => source.match(/sessionQueryKey\('moderator'\)/gu)?.length ?? 0),
        [1, 1, 1],
    );
    for (const source of [auth, item, queue]) assert.doesNotMatch(source, /\[['"]session['"], ['"]staff['"]\]/u);

    assert.match(signInApi, /'POST \/api\/v1\/staff\/auth\/mfa\/verify'/u);
    assert.match(auth, /runtime\.queryClient\.clear\(\)/u);
    assert.match(auth, /setQueryData\(sessionQueryKey\('moderator'\), result\.user\)/u);
    assert.match(auth, /runtime\.broadcast\(\)/u);

    for (const source of [item, queue]) {
        assert.match(source, /error instanceof ApiError && error\.status === 401/u);
        assert.match(source, /invalidateQueries\(\{ queryKey: sessionQueryKey\('moderator'\) \}\)/u);
    }
    assert.match(moderationApi, /'POST \/api\/v1\/moderator\/items\/\{id\}\/decision'/u);
    assert.match(item, /version: query\.data!\.version/u);
    assert.match(item, /idempotencyKey: crypto\.randomUUID\(\)/u);
    assert.match(moderationApi, /'POST \/api\/v1\/moderator\/items\/\{id\}\/claim'/u);
    assert.match(moderationApi, /'POST \/api\/v1\/moderator\/items\/\{id\}\/skip'/u);
    assert.match(queue, /\{ version, idempotencyKey: crypto\.randomUUID\(\) \}/u);
    assert.match(sessions, /queryKey: sessionListQueryKey\(context\)/u);
    assert.match(sessions, /invalidateQueries\(\{ queryKey: sessionListQueryKey\(context\) \}\)/u);
    assert.doesNotMatch(sessions, /queryKey: \[['"]sessions['"], kind\]/u);
    assert.match(sessions, /const kind = context === ['"]user['"] \? ['"]user['"] : ['"]staff['"]/u);
    assert.match(sessions, /loadSessionList\(runtime\.api, kind, signal\)/u);
    assert.match(sessions, /logoutSession\(runtime\.api, kind, signal\)/u);
    assert.match(sessions, /revokeOtherSessions\(runtime\.api, kind, signal\)/u);
    assert.doesNotMatch(sessions, /\.request\s*\(/u);
    assert.match(sessionsApi, /['"]GET \/api\/v1\/auth\/sessions['"]/u);
    assert.match(sessionsApi, /['"]GET \/api\/v1\/staff\/auth\/sessions['"]/u);
    assert.match(sessionsApi, /['"]POST \/api\/v1\/auth\/sessions\/revoke-others['"]/u);
    assert.match(sessionsApi, /['"]POST \/api\/v1\/staff\/auth\/sessions\/revoke-others['"]/u);
    assert.match(sessions, /signal\.throwIfAborted\(\);\s*await runtime\.queryClient\.invalidateQueries/u);
});
