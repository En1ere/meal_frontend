import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { notificationKeys } from '../src/entities/notification/model.js';
import {
    loadNotificationPreferences,
    loadNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    updateNotificationPreferences,
} from '../src/features/notifications/api.js';

void test('notification keys preserve exact broad, account, filter and settings tuples', () => {
    assert.deepEqual(notificationKeys.root, ['notifications']);
    assert.deepEqual(notificationKeys.forAccount(undefined), ['notifications', undefined]);
    assert.deepEqual(notificationKeys.forAccount('user-1'), ['notifications', 'user-1']);
    assert.deepEqual(notificationKeys.list(undefined, 'all', false), ['notifications', undefined, 'all', false]);
    assert.deepEqual(notificationKeys.list('user-1', 'family', true), ['notifications', 'user-1', 'family', true]);
    assert.deepEqual(notificationKeys.preferences(undefined), ['notification-preferences', undefined]);
    assert.deepEqual(notificationKeys.preferences('user-1'), ['notification-preferences', 'user-1']);
    assert.deepEqual(notificationKeys.pushConfig(undefined), ['notification-push-config', undefined]);
    assert.deepEqual(notificationKeys.pushConfig('user-1'), ['notification-push-config', 'user-1']);
});

void test('notification adapter preserves filters, signals, params, versions, projections and fresh commands', async () => {
    const calls: unknown[][] = [];
    const list = { items: [], total: 0, unreadCount: 0, categoryCounts: {} };
    const preferences = {
        categories: [{ category: 'security' as const, push: true, email: false }],
        quietHours: { start: '22:00', end: '07:00' },
        planReminderTime: '18:00',
        timezone: 'Asia/Yekaterinburg',
        urgentFoodRisk: true,
        version: 3,
        deliveryAvailable: { push: true, email: false },
    };
    const updated = { updated: 1 };
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            const route = args[0];
            return Promise.resolve({
                data:
                    route === 'GET /api/v1/notifications'
                        ? list
                        : route === 'GET /api/v1/notification-preferences' ||
                            route === 'PUT /api/v1/notification-preferences'
                          ? preferences
                          : updated,
            });
        },
    };
    const signal = new AbortController().signal;

    assert.equal(await loadNotifications(transport as never, 'family', true, signal), list);
    assert.equal(await markNotificationRead(transport as never, 'notification-a', 4), updated);
    assert.equal(await markNotificationRead(transport as never, 'notification-a', 4), updated);
    assert.equal(await markAllNotificationsRead(transport as never, 'all'), updated);
    assert.equal(await loadNotificationPreferences(transport as never, signal), preferences);
    assert.equal(
        await updateNotificationPreferences(transport as never, {
            categories: preferences.categories,
            quietHours: preferences.quietHours,
            planReminderTime: preferences.planReminderTime,
            timezone: preferences.timezone,
            urgentFoodRisk: preferences.urgentFoodRisk,
            expectedVersion: preferences.version,
        }),
        preferences,
    );

    assert.deepEqual(calls[0], [
        'GET /api/v1/notifications',
        undefined,
        signal,
        undefined,
        { query: { category: 'family', unread: '1', limit: '50', offset: '0' } },
    ]);
    const firstRead = calls[1]?.[1] as { idempotencyKey: string };
    const secondRead = calls[2]?.[1] as { idempotencyKey: string };
    assert.deepEqual(calls[1], [
        'POST /api/v1/notifications/{id}/read',
        { expectedVersion: 4, idempotencyKey: firstRead.idempotencyKey },
        undefined,
        { id: 'notification-a' },
    ]);
    assert.notEqual(firstRead.idempotencyKey, secondRead.idempotencyKey);
    const allBody = calls[3]?.[1] as { idempotencyKey: string };
    assert.deepEqual(calls[3], [
        'POST /api/v1/notifications/read-all',
        { category: 'all', idempotencyKey: allBody.idempotencyKey },
    ]);
    assert.deepEqual(calls[4], ['GET /api/v1/notification-preferences', undefined, signal]);
    const preferenceBody = calls[5]?.[1] as { idempotencyKey: string };
    assert.deepEqual(calls[5], [
        'PUT /api/v1/notification-preferences',
        {
            categories: preferences.categories,
            quietHours: preferences.quietHours,
            planReminderTime: preferences.planReminderTime,
            timezone: preferences.timezone,
            urgentFoodRisk: preferences.urgentFoodRisk,
            expectedVersion: 3,
            idempotencyKey: preferenceBody.idempotencyKey,
        },
    ]);
    assert.notEqual(allBody.idempotencyKey, preferenceBody.idempotencyKey);

    const error = new Error('transport failed');
    await assert.rejects(
        loadNotifications({ request: () => Promise.reject(error) } as never, 'all', false),
        (actual) => actual === error,
    );
});

void test('notification and family consumers use owners without changing commands, sync or WebPush flows', async () => {
    const [notifications, adapter, webPush, notice] = await Promise.all([
        readFile('src/features/notifications/notifications.tsx', 'utf8'),
        readFile('src/features/notifications/api.ts', 'utf8'),
        readFile('src/features/notifications/web-push.ts', 'utf8'),
        readFile('src/features/family/ownership-notice.tsx', 'utf8'),
    ]);

    assert.match(notifications, /const key = notificationKeys\.list\(session\.data\?\.id, category, unread\)/u);
    assert.match(notifications, /queryKey: notificationKeys\.forAccount\(session\.data\?\.id\)/u);
    assert.match(notifications, /queryKey: notificationKeys\.preferences\(session\.data\?\.id\)/u);
    assert.match(notifications, /queryKey: notificationKeys\.pushConfig\(session\.data\?\.id\)/u);
    assert.match(
        notifications,
        /queryClient\.setQueryData\(notificationKeys\.preferences\(session\.data\?\.id\), value\)/u,
    );
    assert.doesNotMatch(notifications, /\[['"]notifications['"]/u);
    assert.doesNotMatch(notifications, /\[['"]notification-(?:preferences|push-config)['"]/u);

    assert.doesNotMatch(notifications, /\.request\s*\(/u);
    for (const route of [
        'GET /api/v1/notifications',
        'POST /api/v1/notifications/{id}/read',
        'POST /api/v1/notifications/read-all',
        'GET /api/v1/notification-preferences',
        'PUT /api/v1/notification-preferences',
    ])
        assert.ok(adapter.includes(`'${route}'`) || adapter.includes(`"${route}"`), `${route} is preserved`);
    assert.equal(adapter.match(/idempotencyKey: crypto\.randomUUID\(\)/gu)?.length, 3);
    assert.match(notifications, /onSettled: refresh/u);
    assert.match(notifications, /onSuccess: broadcastNotificationChange/u);
    assert.match(notifications, /broadcastNotificationChange\(\)/u);
    assert.match(notifications, /setDraft\(null\)/u);
    assert.match(notifications, /connectWebPush\(pushTransport, session\.data\.id, publicKey\)/u);
    assert.match(notifications, /disconnectWebPush\(pushTransport, session\.data\.id\)/u);
    assert.match(webPush, /Notification\.requestPermission\(\)/u);
    assert.match(webPush, /navigator\.serviceWorker/u);

    assert.match(notice, /invalidateQueries\(\{ queryKey: notificationKeys\.root \}\)/u);
    assert.doesNotMatch(notice, /queryKey: \[['"]notifications['"]\]/u);
    assert.match(notice, /dismissFamilyOwnershipNotice\(api!,/u);
    assert.match(notice, /idempotencyKey: key\.current/u);
});
