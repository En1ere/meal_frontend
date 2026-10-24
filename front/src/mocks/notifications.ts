import { z } from 'zod';
import { contracts } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';
import { hasConsent } from './legal.js';

const itemSchema = contracts['GET /api/v1/notifications'].success.shape.data.shape.items.element;
const preferencesSchema = contracts['GET /api/v1/notification-preferences'].success.shape.data;
const querySchema = z
    .object({
        category: z
            .enum([
                'all',
                'security',
                'inventory',
                'planning',
                'cooking',
                'family',
                'community',
                'moderation',
                'support',
                'subscription',
                'ai',
                'achievements',
                'news',
            ])
            .default('all'),
        unread: z.enum(['0', '1']).default('0'),
        limit: z.coerce.number().int().min(1).max(100).default(30),
        offset: z.coerce.number().int().min(0).max(10000).default(0),
    })
    .strict();
export const notificationsStateSchema = z.object({
    items: z.array(z.object({ userId: z.uuid(), item: itemSchema })),
    preferences: z.record(z.string(), preferencesSchema),
    seeded: z.array(z.string()),
    replay: z.record(z.string(), z.object({ input: z.string(), result: z.unknown() })),
});
export type NotificationsState = z.infer<typeof notificationsStateSchema>;
export const createNotificationsState = (): NotificationsState => ({
    items: [],
    preferences: {},
    seeded: [],
    replay: {},
});
const categories = [
    'security',
    'inventory',
    'planning',
    'cooking',
    'family',
    'community',
    'moderation',
    'support',
    'subscription',
    'ai',
    'achievements',
    'news',
] as const;
const labels: Record<(typeof categories)[number], [string, string, string | null]> = {
    security: ['Новый вход', 'В аккаунт выполнен вход с нового устройства.', '/settings/account'],
    inventory: ['Скоро истечёт срок', 'Проверьте продукты с ближайшим сроком годности.', '/inventory?expiry=soon'],
    planning: ['План на сегодня', 'В плане есть блюда на сегодня.', '/plan'],
    cooking: ['Незавершённое приготовление', 'Проверьте состояние начатого приготовления.', '/recipes'],
    family: ['Семейные события', 'Новых семейных событий пока нет.', null],
    community: ['Ответ на комментарий', 'В обсуждении появился новый ответ.', '/recipes'],
    moderation: ['Рецепт проверен', 'Статус публикации рецепта изменился.', '/recipes/mine'],
    support: ['Ответ поддержки', 'Поддержка ответила на обращение.', null],
    subscription: ['Текущий тариф', 'Проверьте состояние тарифа и trial.', '/settings/subscription'],
    ai: ['AI-действия', 'Доступный остаток AI-действий изменился.', '/settings'],
    achievements: ['Новое достижение', 'Открыто новое достижение.', null],
    news: ['Новости Meal Planner', 'Доступна новая подборка рецептов.', '/recipes'],
};
const defaults = () =>
    preferencesSchema.parse({
        categories: categories.map((category) => ({ category, push: false, email: false })),
        quietHours: { start: '22:00', end: '08:00' },
        planReminderTime: '08:00',
        timezone: 'Europe/Moscow',
        urgentFoodRisk: false,
        version: 1,
        deliveryAvailable: { push: false, email: false },
    });
function seed(state: MockState, userId: string, now: number) {
    if (state.notifications.seeded.includes(userId)) return;
    state.notifications.seeded.push(userId);
    state.notifications.preferences[userId] = defaults();
    categories.forEach((category, index) => {
        const [title, body, href] = labels[category];
        state.notifications.items.push({
            userId,
            item: itemSchema.parse({
                id: crypto.randomUUID(),
                category,
                priority:
                    category === 'security' || category === 'support'
                        ? 'critical'
                        : category === 'news'
                          ? 'marketing'
                          : index % 2
                            ? 'important'
                            : 'informational',
                title,
                body,
                href,
                occurredAt: new Date(now - index * 3600000).toISOString(),
                readAt: index > 7 ? new Date(now - index * 3600000 + 60000).toISOString() : null,
                groupedCount: index === 1 ? 3 : 1,
                version: 1,
            }),
        });
    });
}
const replay = (state: MockState, key: string, input: unknown, run: () => unknown) => {
    const body = JSON.stringify(input),
        old = state.notifications.replay[key];
    if (old) return old.input === body ? old.result : Symbol.for('conflict');
    const result = run();
    state.notifications.replay[key] = { input: body, result };
    return result;
};
export function notificationsHandle(c: {
    state: MockState;
    userId: string | null;
    path: string;
    params: Record<string, string>;
    method: string;
    query: URLSearchParams;
    input: unknown;
    now: number;
    success: (data: unknown) => Response;
    fail: (status: number) => Response;
}): Response | null {
    const { state, userId, path, params, method, query, input, now, success, fail } = c;
    if (!path.startsWith('/api/v1/notifications') && path !== '/api/v1/notification-preferences') return null;
    if (!userId) return fail(401);
    seed(state, userId, now);
    if (path === '/api/v1/notifications' && method === 'GET') {
        const parsed = querySchema.safeParse(Object.fromEntries(query));
        if (!parsed.success) return fail(400);
        const value = parsed.data;
        let items = state.notifications.items.filter((x) => x.userId === userId).map((x) => x.item);
        if (!hasConsent(state.legal, userId, 'marketing'))
            items = items.filter((item) => item.priority !== 'marketing');
        const all = items;
        const counts = Object.fromEntries(
            categories.map((category) => [category, all.filter((x) => x.category === category).length]),
        );
        if (value.category !== 'all') items = items.filter((x) => x.category === value.category);
        if (value.unread === '1') items = items.filter((x) => !x.readAt);
        return success({
            items: items.slice(value.offset, value.offset + value.limit),
            total: items.length,
            unreadCount: all.filter((x) => !x.readAt).length,
            categoryCounts: counts,
        });
    }
    if (path === '/api/v1/notification-preferences' && method === 'GET')
        return success(state.notifications.preferences[userId]);
    if (path === '/api/v1/notification-preferences' && method === 'PUT') {
        const body = contracts['PUT /api/v1/notification-preferences'].request.parse(input);
        const result = replay(state, `${userId}:preferences:${body.idempotencyKey}`, body, () => {
            const current = state.notifications.preferences[userId]!;
            if (body.expectedVersion !== current.version) return Symbol.for('version');
            const next = preferencesSchema.parse({
                ...body,
                version: current.version + 1,
                deliveryAvailable: { push: false, email: false },
            });
            state.notifications.preferences[userId] = next;
            return next;
        });
        if (result === Symbol.for('conflict')) return fail(409);
        if (result === Symbol.for('version')) return fail(412);
        return success(result);
    }
    if (path === '/api/v1/notifications/read-all' && method === 'POST') {
        const body = contracts['POST /api/v1/notifications/read-all'].request.parse(input);
        const result = replay(state, `${userId}:read-all:${body.idempotencyKey}`, body, () => {
            let updated = 0;
            state.notifications.items
                .filter(
                    (x) =>
                        x.userId === userId &&
                        (body.category === 'all' || x.item.category === body.category) &&
                        !x.item.readAt,
                )
                .forEach((x) => {
                    x.item.readAt = new Date(now).toISOString();
                    x.item.version++;
                    updated++;
                });
            return { updated };
        });
        return result === Symbol.for('conflict') ? fail(409) : success(result);
    }
    const match = /^\/api\/v1\/notifications\/([^/]+)\/read$/.exec(path);
    if (match && method === 'POST') {
        const body = contracts['POST /api/v1/notifications/{id}/read'].request.parse(input);
        const target = state.notifications.items.find((x) => x.userId === userId && x.item.id === params.id);
        if (!target) return fail(404);
        const result = replay(state, `${userId}:read:${target.item.id}:${body.idempotencyKey}`, body, () => {
            if (target.item.version !== body.expectedVersion) return Symbol.for('version');
            if (target.item.readAt) return { updated: 0 };
            target.item.readAt = new Date(now).toISOString();
            target.item.version++;
            return { updated: 1 };
        });
        if (result === Symbol.for('conflict')) return fail(409);
        if (result === Symbol.for('version')) return fail(412);
        return success(result);
    }
    return fail(404);
}
