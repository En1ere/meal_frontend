import { z } from 'zod';
import { contracts } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';
const detailSchema = contracts['GET /api/v1/support/{id}'].success.shape.data;
const detailStored = detailSchema.extend({ userId: z.uuid() });
const publicDetail = (value: z.infer<typeof detailStored>) =>
    detailSchema.parse({ ticket: value.ticket, messages: value.messages });
export const supportStateSchema = z.object({
    tickets: z.array(detailStored),
    seeded: z.array(z.uuid()),
    replay: z.record(z.string(), z.object({ input: z.string(), result: z.unknown() })),
});
export type SupportState = z.infer<typeof supportStateSchema>;
export const createSupportState = (): SupportState => ({ tickets: [], seeded: [], replay: {} });

export function createAllergenReportSupportTicket(input: {
    state: MockState;
    userId: string;
    recipeTitle: string;
    recipeId: string;
    revisionId: string;
    ingredientNames: string[];
    note: string;
    now: number;
}) {
    const id = crypto.randomUUID();
    const number = `MP-${id.slice(0, 8).toUpperCase()}`;
    const createdAt = new Date(input.now).toISOString();
    const details = [
        `Рецепт: ${input.recipeTitle} (${input.recipeId})`,
        `Редакция: ${input.revisionId}`,
        `Нет данных для: ${input.ingredientNames.join(', ')}`,
        input.note ? `Комментарий: ${input.note}` : '',
    ]
        .filter(Boolean)
        .join('\n');
    input.state.support.tickets.unshift(
        detailStored.parse({
            userId: input.userId,
            ticket: {
                id,
                number,
                category: 'general',
                categoryLabel: 'Общий вопрос',
                status: 'open',
                statusLabel: 'Открыто',
                subject: `Нет данных об аллергенах: ${input.recipeTitle}`,
                createdAt,
                closedAt: null,
                version: 1,
            },
            messages: [
                {
                    id: crypto.randomUUID(),
                    body: details,
                    author: 'user',
                    authorLabel: 'Вы',
                    own: true,
                    createdAt,
                    edited: false,
                    version: 1,
                    attachments: [],
                },
            ],
        }),
    );
    return { ticketId: id, ticketNumber: number };
}
const categories = [
    ['general', 'Общий вопрос'],
    ['ai_appeal', 'Обращение по AI'],
    ['ownership_change', 'Смена владельца семьи'],
    ['insurance_extension', 'Продление срока хранения'],
    ['payments', 'Оплата и тариф'],
    ['complaints', 'Жалоба'],
    ['recipe_authorship', 'Рецепт и авторство'],
] as const;
const statuses = {
    open: 'Открыто',
    waiting_for_support: 'Ждёт ответа поддержки',
    waiting_for_user: 'Нужен ваш ответ',
    closed: 'Закрыто',
} as const;
const attachmentPolicy = {
    maxFiles: 5 as const,
    maxBytes: 10485760 as const,
    maxVideoSeconds: 10 as const,
    mime: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4', 'video/webm', 'video/quicktime'],
};
function seed(state: MockState, userId: string, now: number) {
    if (state.support.seeded.includes(userId)) return;
    state.support.seeded.push(userId);
    (['waiting_for_user', 'waiting_for_support', 'closed'] as const).forEach((status, index) => {
        const id = crypto.randomUUID(),
            createdAt = new Date(now - (index + 1) * 86400000).toISOString();
        state.support.tickets.push(
            detailStored.parse({
                userId,
                ticket: {
                    id,
                    number: `MP-DEMO-${index + 1}`,
                    category: categories[index]![0],
                    categoryLabel: categories[index]![1],
                    status,
                    statusLabel: statuses[status],
                    subject: ['Нужны дополнительные данные', 'Вопрос уже в очереди', 'Закрытое обращение'][index],
                    createdAt,
                    closedAt: status === 'closed' ? new Date(now - 3600000).toISOString() : null,
                    version: 1,
                },
                messages: [
                    {
                        id: crypto.randomUUID(),
                        body: 'Тестовое сообщение пользователя для проверки переписки.',
                        author: 'user',
                        authorLabel: 'Вы',
                        own: true,
                        createdAt,
                        edited: index === 0,
                        version: index === 0 ? 2 : 1,
                        attachments: [],
                    },
                    ...(status === 'waiting_for_user'
                        ? [
                              {
                                  id: crypto.randomUUID(),
                                  body: 'Уточните, пожалуйста, номер операции и дату.',
                                  author: 'support' as const,
                                  authorLabel: 'Поддержка',
                                  own: false,
                                  createdAt: new Date(now - 3600000).toISOString(),
                                  edited: false,
                                  version: 1,
                                  attachments: [],
                              },
                          ]
                        : []),
                ],
            }),
        );
    });
}
const replay = (state: MockState, key: string, input: unknown, run: () => unknown) => {
    const body = JSON.stringify(input),
        old = state.support.replay[key];
    if (old) return old.input === body ? old.result : Symbol.for('conflict');
    const result = run();
    state.support.replay[key] = { input: body, result };
    return result;
};
export function supportHandle(c: {
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
    if (!path.startsWith('/api/v1/support')) return null;
    if (!userId) return fail(401);
    seed(state, userId, now);
    if (path === '/api/v1/support/meta' && method === 'GET')
        return success({
            categories: categories.map(([code, label]) => ({ code, label })),
            uploadMode: 'unavailable',
            attachmentPolicy,
        });
    if (path === '/api/v1/support' && method === 'GET') {
        let items = state.support.tickets.filter((x) => x.userId === userId).map((x) => x.ticket);
        const category = query.get('category') ?? 'all',
            status = query.get('status') ?? 'all';
        if (category !== 'all') items = items.filter((x) => x.category === category);
        if (status === 'active') items = items.filter((x) => x.status !== 'closed');
        else if (status !== 'all') items = items.filter((x) => x.status === status);
        return success({ items, total: items.length });
    }
    if (path === '/api/v1/support' && method === 'POST') {
        const body = contracts['POST /api/v1/support'].request.parse(input);
        if (body.attachments?.length) return fail(409);
        const result = replay(state, `${userId}:create:${body.idempotencyKey}`, body, () => {
            const id = crypto.randomUUID(),
                createdAt = new Date(now).toISOString(),
                label = categories.find((x) => x[0] === body.category)![1],
                ticket = detailStored.parse({
                    userId,
                    ticket: {
                        id,
                        number: `MP-${id.slice(0, 8).toUpperCase()}`,
                        category: body.category,
                        categoryLabel: label,
                        status: 'open',
                        statusLabel: statuses.open,
                        subject: body.subject,
                        createdAt,
                        closedAt: null,
                        version: 1,
                    },
                    messages: [
                        {
                            id: crypto.randomUUID(),
                            body: body.body,
                            author: 'user',
                            authorLabel: 'Вы',
                            own: true,
                            createdAt,
                            edited: false,
                            version: 1,
                            attachments: [],
                        },
                    ],
                });
            state.support.tickets.unshift(ticket);
            return publicDetail(ticket);
        });
        return result === Symbol.for('conflict') ? fail(409) : success(result);
    }
    const ticket = state.support.tickets.find((x) => x.userId === userId && x.ticket.id === params.id);
    if (!ticket) return fail(404);
    if (path === `/api/v1/support/${params.id}` && method === 'GET') return success(publicDetail(ticket));
    const mutate = (key: string, body: { idempotencyKey: string; expectedVersion: number }, run: () => unknown) => {
        const result = replay(state, `${userId}:${key}:${body.idempotencyKey}`, body, () =>
            body.expectedVersion !== ticket.ticket.version ? Symbol.for('version') : run(),
        );
        if (result === Symbol.for('conflict')) return fail(409);
        if (result === Symbol.for('version')) return fail(412);
        return success(result);
    };
    if (path.endsWith('/reply') && method === 'POST') {
        const body = contracts['POST /api/v1/support/{id}/reply'].request.parse(input);
        if (body.attachments?.length) return fail(409);
        if (ticket.ticket.status === 'closed') return fail(409);
        return mutate(`reply:${params.id}`, body, () => {
            ticket.messages.push({
                id: crypto.randomUUID(),
                body: body.body,
                author: 'user',
                authorLabel: 'Вы',
                own: true,
                createdAt: new Date(now).toISOString(),
                edited: false,
                version: 1,
                attachments: [],
            });
            ticket.ticket.status = 'waiting_for_support';
            ticket.ticket.statusLabel = statuses.waiting_for_support;
            ticket.ticket.version++;
            return publicDetail(ticket);
        });
    }
    if (path.includes('/messages/') && method === 'PATCH') {
        const body = contracts['PATCH /api/v1/support/{id}/messages/{messageId}'].request.parse(input),
            message = ticket.messages.find((x) => x.id === params.messageId && x.own);
        if (!message) return fail(404);
        if (ticket.ticket.status === 'closed') return fail(409);
        if (message.version !== body.messageVersion) return fail(412);
        return mutate(`edit:${params.messageId}`, body, () => {
            message.body = body.body;
            message.edited = true;
            message.version++;
            ticket.ticket.version++;
            return publicDetail(ticket);
        });
    }
    if ((path.endsWith('/close') || path.endsWith('/reopen')) && method === 'POST') {
        const reopen = path.endsWith('/reopen'),
            body = (
                reopen ? contracts['POST /api/v1/support/{id}/reopen'] : contracts['POST /api/v1/support/{id}/close']
            ).request.parse(input);
        if (reopen ? ticket.ticket.status !== 'closed' : ticket.ticket.status === 'closed') return fail(409);
        return mutate(`${reopen ? 'reopen' : 'close'}:${params.id}`, body, () => {
            ticket.ticket.status = reopen ? 'waiting_for_support' : 'closed';
            ticket.ticket.statusLabel = statuses[ticket.ticket.status];
            ticket.ticket.closedAt = reopen ? null : new Date(now).toISOString();
            ticket.ticket.version++;
            return publicDetail(ticket);
        });
    }
    return fail(404);
}
