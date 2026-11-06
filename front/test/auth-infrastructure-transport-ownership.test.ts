import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadMockMailbox } from '../src/features/auth/mock-mailbox-api.js';
import { loadSessionList, logoutSession, revokeOtherSessions } from '../src/features/auth/sessions-api.js';

void test('auth infrastructure adapters preserve explicit user/staff routes, signals, projections and native errors', async () => {
    const calls: unknown[][] = [];
    const sessions = [{ id: 'session-a' }];
    const messages = [{ id: 'message-a' }];
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            const route = args[0];
            if (route === 'GET /api/v1/auth/sessions' || route === 'GET /api/v1/staff/auth/sessions')
                return Promise.resolve({ data: { sessions } });
            if (route === 'POST /api/v1/dev/mailbox') return Promise.resolve({ data: { messages } });
            if (String(route).includes('revoke-others')) return Promise.resolve({ data: { revokedCount: 2 } });
            return Promise.resolve({ data: {} });
        },
    };
    const signal = new AbortController().signal;

    assert.equal(await loadSessionList(transport as never, 'user', signal), sessions);
    assert.equal(await loadSessionList(transport as never, 'staff', signal), sessions);
    await logoutSession(transport as never, 'user', signal);
    await logoutSession(transport as never, 'staff', signal);
    assert.equal(await revokeOtherSessions(transport as never, 'user', signal), 2);
    assert.equal(await revokeOtherSessions(transport as never, 'staff', signal), 2);
    assert.equal(await loadMockMailbox(transport as never, 'test@example.com', signal), messages);

    assert.deepEqual(calls, [
        ['GET /api/v1/auth/sessions', undefined, signal],
        ['GET /api/v1/staff/auth/sessions', undefined, signal],
        ['POST /api/v1/auth/logout', undefined, signal],
        ['POST /api/v1/staff/auth/logout', undefined, signal],
        ['POST /api/v1/auth/sessions/revoke-others', undefined, signal],
        ['POST /api/v1/staff/auth/sessions/revoke-others', undefined, signal],
        ['POST /api/v1/dev/mailbox', { email: 'test@example.com' }, signal],
    ]);

    const error = new Error('transport failed');
    await assert.rejects(
        loadSessionList({ request: () => Promise.reject(error) } as never, 'user'),
        (actual) => actual === error,
    );
    await assert.rejects(
        loadMockMailbox({ request: () => Promise.reject(error) } as never, 'test@example.com'),
        (actual) => actual === error,
    );
});

void test('sessions and mailbox use narrow adapters while browser and session orchestration stays in UI', async () => {
    const [panel, mailbox, sessionsAdapter, mailboxAdapter] = await Promise.all([
        readFile('src/features/auth/sessions-panel.tsx', 'utf8'),
        readFile('src/features/auth/mock-mailbox.tsx', 'utf8'),
        readFile('src/features/auth/sessions-api.ts', 'utf8'),
        readFile('src/features/auth/mock-mailbox-api.ts', 'utf8'),
    ]);
    for (const source of [panel, mailbox]) assert.doesNotMatch(source, /\.request\s*\(/u);

    assert.match(panel, /loadSessionList\(runtime\.api, kind, signal\)/u);
    assert.match(panel, /logoutSession\(runtime\.api, kind, signal\)/u);
    assert.match(panel, /revokeOtherSessions\(runtime\.api, kind, signal\)/u);
    assert.match(panel, /forgetBrowserWebPush\(principal\.data\.id\)/u);
    assert.match(panel, /runtime\.reset\(\)/u);
    assert.match(panel, /runtime\.broadcast\(\)/u);
    assert.match(panel, /router\.replace\(authRoutes\[context\]\.login\)/u);
    assert.match(panel, /invalidateQueries\(\{ queryKey: sessionListQueryKey\(context\) \}\)/u);
    assert.match(mailbox, /loadMockMailbox\(runtime\.api!, email, signal\)/u);
    assert.match(mailbox, /signal\.throwIfAborted\(\)/u);
    assert.match(sessionsAdapter, /kind === ['"]user['"]/u);
    assert.match(mailboxAdapter, /\{ email \}/u);
});
