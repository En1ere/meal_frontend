import { z } from 'zod';
import {
    notificationCenterSchema,
    notificationCenterUpdateSchema,
    notificationReadSchema,
    validNotificationTimeZone,
    type NotificationCenter,
} from '../features/notifications/center-contracts.js';

export const notificationCenterStateSchema = z.record(z.string(), notificationCenterSchema);
export type NotificationCenterState = z.infer<typeof notificationCenterStateSchema>;
export function createNotificationCenter(): NotificationCenter {
    const channels = () => ({ browser: false, mobilePush: false, email: false });
    return {
        version: 1,
        verifiedEmail: null,
        deliveryConnected: false,
        settings: {
            categories: {
                security: channels(),
                payments: channels(),
                support: channels(),
                moderation: channels(),
                operations: channels(),
                campaigns: channels(),
            },
            quietHours: { start: '22:00', end: '08:00', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
            thresholds: { count: 5, windowMinutes: 10, repeatMinutes: 30 },
        },
        items: [
            {
                id: 'c0000000-0000-4000-8000-000000000003',
                category: 'payments',
                title: 'Проверка возврата',
                summary:
                    'Демонстрационное событие: результат запроса возврата требует проверки. Денежная операция не выполнялась.',
                createdAt: '2026-09-28T08:06:00.000Z',
                readAt: null,
                occurrences: 1,
                destination: '/admin/payments',
            },
            {
                id: 'c0000000-0000-4000-8000-000000000004',
                category: 'support',
                title: 'Обращение ожидает ответа',
                summary: 'Демонстрационное обращение поступило в общую очередь поддержки.',
                createdAt: '2026-09-28T08:07:00.000Z',
                readAt: null,
                occurrences: 1,
                destination: '/admin/support',
            },
            {
                id: 'c0000000-0000-4000-8000-000000000005',
                category: 'moderation',
                title: 'Материалы на проверку',
                summary: 'Демонстрационные материалы ожидают решения в очереди модерации.',
                createdAt: '2026-09-28T08:08:00.000Z',
                readAt: null,
                occurrences: 1,
                destination: '/admin/queues/recipes',
            },
            {
                id: 'c0000000-0000-4000-8000-000000000006',
                category: 'campaigns',
                title: 'Предпросмотр рассылки готов',
                summary: 'Демонстрационное событие: проверьте содержание и аудиторию. Фактической отправки не было.',
                createdAt: '2026-09-28T08:09:00.000Z',
                readAt: null,
                occurrences: 1,
                destination: '/admin/news',
            },
            {
                id: 'c0000000-0000-4000-8000-000000000001',
                category: 'security',
                title: 'Проверка защиты аккаунта',
                summary: 'Демонстрационное уведомление: проверьте активные служебные сессии.',
                createdAt: '2026-09-28T08:00:00.000Z',
                readAt: null,
                occurrences: 1,
                destination: '/admin/access',
            },
            {
                id: 'c0000000-0000-4000-8000-000000000002',
                category: 'operations',
                title: 'Повторяющаяся ошибка фоновой задачи',
                summary: 'Демонстрационный инцидент. Подробности доступны в разделе ошибок.',
                createdAt: '2026-09-28T08:05:00.000Z',
                readAt: null,
                occurrences: 5,
                destination: '/admin/errors',
            },
        ],
    };
}
// Invoked only after central dispatch has checked admin session, tab unlock, Origin and CSRF.
export function notificationCenterHandle(context: {
    state: NotificationCenterState;
    userId: string;
    verifiedEmail: string | null;
    path: string;
    method: string;
    body: unknown;
    now: number;
    success: (data: unknown) => Response;
    fail: (status: number) => Response;
}): Response {
    const c = context;
    const current = c.state[c.userId] ?? createNotificationCenter();
    current.verifiedEmail = c.verifiedEmail;
    if (c.path === '/api/v1/admin/notification-center' && c.method === 'GET') {
        c.state[c.userId] = current;
        return c.success(notificationCenterSchema.parse(current));
    }
    if (c.path.endsWith('/settings') && c.method === 'POST') {
        const parsed = notificationCenterUpdateSchema.safeParse(c.body);
        if (!parsed.success) return c.fail(400);
        const { settings, expectedVersion } = parsed.data;
        if (
            !validNotificationTimeZone(settings.quietHours.timeZone) ||
            settings.quietHours.start === settings.quietHours.end
        )
            return c.fail(400);
        if (expectedVersion !== current.version) return c.fail(409);
        if (!c.verifiedEmail && Object.values(settings.categories).some((value) => value.email)) return c.fail(400);
        current.settings = settings;
        current.version++;
    } else if (c.path.endsWith('/read') && c.method === 'POST') {
        const parsed = notificationReadSchema.safeParse(c.body);
        if (!parsed.success) return c.fail(400);
        const item = current.items.find((entry) => entry.id === parsed.data.id);
        if (!item) return c.fail(404);
        item.readAt ??= new Date(c.now).toISOString();
    } else return c.fail(404);
    c.state[c.userId] = current;
    return c.success(notificationCenterSchema.parse(current));
}
