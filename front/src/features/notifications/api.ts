import type { z } from 'zod';
import type { ApiClient } from '../../shared/api/client.js';
import type { contracts, Success } from '../../shared/api/contracts.generated.js';

export type NotificationList = Success<'GET /api/v1/notifications'>['data'];
export type NotificationPreferences = Success<'GET /api/v1/notification-preferences'>['data'];
export type NotificationCategory = z.input<
    (typeof contracts)['POST /api/v1/notifications/read-all']['request']
>['category'];
export type UpdateNotificationPreferencesCommand = Omit<
    z.input<(typeof contracts)['PUT /api/v1/notification-preferences']['request']>,
    'idempotencyKey'
>;
export type NotificationsTransport = Pick<ApiClient, 'request'>;

export async function loadNotifications(
    transport: NotificationsTransport,
    category: NotificationCategory,
    unread: boolean,
    signal?: AbortSignal,
): Promise<NotificationList> {
    return (
        await transport.request('GET /api/v1/notifications', undefined, signal, undefined, {
            query: { category, unread: unread ? '1' : '0', limit: '50', offset: '0' },
        })
    ).data;
}

export async function markNotificationRead(
    transport: NotificationsTransport,
    id: string,
    expectedVersion: number,
): Promise<Success<'POST /api/v1/notifications/{id}/read'>['data']> {
    return (
        await transport.request(
            'POST /api/v1/notifications/{id}/read',
            { expectedVersion, idempotencyKey: crypto.randomUUID() },
            undefined,
            { id },
        )
    ).data;
}

export async function markAllNotificationsRead(
    transport: NotificationsTransport,
    category: NotificationCategory,
): Promise<Success<'POST /api/v1/notifications/read-all'>['data']> {
    return (
        await transport.request('POST /api/v1/notifications/read-all', {
            category,
            idempotencyKey: crypto.randomUUID(),
        })
    ).data;
}

export async function loadNotificationPreferences(
    transport: NotificationsTransport,
    signal?: AbortSignal,
): Promise<NotificationPreferences> {
    return (await transport.request('GET /api/v1/notification-preferences', undefined, signal)).data;
}

export async function updateNotificationPreferences(
    transport: NotificationsTransport,
    command: UpdateNotificationPreferencesCommand,
): Promise<NotificationPreferences> {
    return (
        await transport.request('PUT /api/v1/notification-preferences', {
            ...command,
            idempotencyKey: crypto.randomUUID(),
        })
    ).data;
}
