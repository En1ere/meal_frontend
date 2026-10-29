import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import { sessionQueryKey, setUserSession, type UserSession } from '../src/entities/session/model.js';

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
