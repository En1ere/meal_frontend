import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    createNotificationCenter,
    notificationCenterHandle,
    type NotificationCenterState,
} from '../src/mocks/notification-center.js';
import { notificationQuietNow } from '../src/features/notifications/center-contracts.js';

void test('notification settings reject stale versions and isolate administrators', () => {
    const state: NotificationCenterState = {};
    const call = (userId: string, body: unknown) =>
        notificationCenterHandle({
            state,
            userId,
            verifiedEmail: 'admin@example.test',
            path: '/api/v1/admin/notification-center/settings',
            method: 'POST',
            body,
            now: Date.now(),
            success: (data) => Response.json(data),
            fail: (status) => new Response(null, { status }),
        });
    const settings = createNotificationCenter().settings;
    settings.categories.security.email = true;
    assert.equal(call('a', { expectedVersion: 1, settings }).status, 200);
    assert.equal(call('a', { expectedVersion: 1, settings }).status, 409);
    assert.equal(state.a!.version, 2);
    assert.equal(state.b, undefined);
    assert.equal(call('b', { expectedVersion: 1, settings: createNotificationCenter().settings }).status, 200);
    assert.equal(state.b!.settings.categories.security.email, false);
});

void test('quiet hours follow selected timezone across midnight, security bypasses only scheduling', () => {
    const settings = createNotificationCenter().settings;
    settings.quietHours.timeZone = 'Europe/Moscow';
    assert.equal(notificationQuietNow(settings, 'support', new Date('2026-09-28T19:00:00Z')), true);
    assert.equal(notificationQuietNow(settings, 'support', new Date('2026-09-29T04:59:00Z')), true);
    assert.equal(notificationQuietNow(settings, 'support', new Date('2026-09-29T05:00:00Z')), false);
    assert.equal(notificationQuietNow(settings, 'security', new Date('2026-09-28T19:00:00Z')), false);
    assert.equal(settings.categories.security.email, false);
});

void test('read acknowledgement is idempotent and never changes another notification', () => {
    const state: NotificationCenterState = { a: createNotificationCenter() };
    const acknowledge = (id: string, now: number) =>
        notificationCenterHandle({
            state,
            userId: 'a',
            verifiedEmail: null,
            path: '/api/v1/admin/notification-center/read',
            method: 'POST',
            body: { id },
            now,
            success: (data) => Response.json(data),
            fail: (status) => new Response(null, { status }),
        });
    const id = state.a!.items[0]!.id;
    assert.equal(acknowledge(id, 1000).status, 200);
    assert.equal(acknowledge(id, 2000).status, 200);
    assert.equal(state.a!.items[0]!.readAt, new Date(1000).toISOString());
    assert.equal(state.a!.items[1]!.readAt, null);
    assert.equal(acknowledge('c0000000-0000-4000-8000-000000000099', 3000).status, 404);
});

void test('invalid timezone, degenerate quiet interval and unverified email are rejected without changing state', () => {
    const state: NotificationCenterState = {};
    const settings = createNotificationCenter().settings;
    const update = () =>
        notificationCenterHandle({
            state,
            userId: 'a',
            verifiedEmail: null,
            path: '/api/v1/admin/notification-center/settings',
            method: 'POST',
            body: { expectedVersion: 1, settings },
            now: 0,
            success: (data) => Response.json(data),
            fail: (status) => new Response(null, { status }),
        });
    settings.quietHours.timeZone = 'Invalid/Zone';
    assert.equal(update().status, 400);
    settings.quietHours.timeZone = 'UTC';
    settings.quietHours.end = '22:00';
    assert.equal(update().status, 400);
    settings.quietHours.end = '08:00';
    settings.categories.security.email = true;
    assert.equal(update().status, 400);
    assert.equal(state.a, undefined);
});
