import { z } from 'zod';
import { contracts } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';

const listSchema = contracts['GET /api/v1/ai/appeals'].success.shape.data;
const detailSchema = contracts['GET /api/v1/ai/appeals/{id}'].success.shape.data;
const supportDetailSchema = contracts['GET /api/v1/support/{id}'].success.shape.data;
const restrictionSchema = listSchema.shape.restriction.unwrap();
const storedAppealSchema = detailSchema.shape.appeal.omit({ ticket: true }).extend({
    userId: z.uuid(),
    ticketId: z.uuid(),
});

export const aiAppealsStateSchema = z.object({
    restrictions: z.array(restrictionSchema.extend({ userId: z.uuid() })),
    appeals: z.array(storedAppealSchema),
    seeded: z.array(z.uuid()),
    replay: z.record(z.string(), z.object({ input: z.string(), result: z.unknown() })),
});
export type AiAppealsState = z.infer<typeof aiAppealsStateSchema>;
const fixtureRestriction = restrictionSchema.extend({ userId: z.uuid() }).parse({
    id: '61000000-0000-4000-8000-000000000001',
    userId: '10000000-0000-4000-8000-000000000007',
    status: 'active',
    startsAt: '2026-10-01T00:00:00.000Z',
    endsAt: null,
    reasonCategory: 'safety_policy',
    reasonLabel: 'Ограничение по правилам безопасного использования AI',
});
export const createAiAppealsState = (): AiAppealsState => ({
    restrictions: [{ ...fixtureRestriction }],
    appeals: [],
    seeded: [],
    replay: {},
});

function restriction(state: MockState, userId: string, sanctionId?: string) {
    return state.aiAppeals.restrictions.find(
        (item) => item.userId === userId && (!sanctionId || item.id === sanctionId),
    );
}

function publicRestriction(value: ReturnType<typeof restriction>) {
    if (!value) return null;
    const { userId: _userId, ...result } = value;
    void _userId;
    return result;
}

function detail(state: MockState, userId: string, appealId: string) {
    const appeal = state.aiAppeals.appeals.find((item) => item.userId === userId && item.id === appealId);
    if (!appeal) return null;
    const support = state.support.tickets.find(
        (item) => item.userId === userId && item.ticket.id === appeal.ticketId && item.ticket.category === 'ai_appeal',
    );
    const currentRestriction = restriction(state, userId, appeal.sanctionId);
    if (!support || !currentRestriction) return null;
    const { userId: _userId, ticketId: _ticketId, ...summary } = appeal;
    void _userId;
    void _ticketId;
    return detailSchema.parse({
        restriction: publicRestriction(currentRestriction),
        appeal: { ...summary, ticket: support.ticket },
        messages: support.messages,
    });
}

function replay(state: MockState, key: string, input: unknown, run: () => unknown) {
    const serialized = JSON.stringify(input);
    const previous = state.aiAppeals.replay[key];
    if (previous) return previous.input === serialized ? previous.result : Symbol.for('conflict');
    const result = run();
    if (typeof result !== 'symbol') state.aiAppeals.replay[key] = { input: serialized, result };
    return result;
}

export function aiAppealsHandle(c: {
    state: MockState;
    userId: string | null;
    path: string;
    method: string;
    input: unknown;
    now: number;
    success: (data: unknown) => Response;
    fail: (status: number) => Response;
}): Response | null {
    const { state, userId, path, method, input, now, success, fail } = c;
    if (!path.startsWith('/api/v1/ai/appeals')) return null;
    if (!userId) return fail(401);
    if (path === '/api/v1/ai/appeals' && method === 'GET') {
        const items = state.aiAppeals.appeals
            .filter((item) => item.userId === userId)
            .map((item) => detail(state, userId, item.id)!.appeal);
        return success(listSchema.parse({ restriction: publicRestriction(restriction(state, userId)), items }));
    }
    if (path === '/api/v1/ai/appeals' && method === 'POST') {
        const body = contracts['POST /api/v1/ai/appeals'].request.parse(input);
        const result = replay(state, `${userId}:ai-appeal:${body.sanctionId}:${body.idempotencyKey}`, body, () => {
            const currentRestriction = restriction(state, userId, body.sanctionId);
            if (!currentRestriction || currentRestriction.status !== 'active') return Symbol.for('restriction');
            if (
                state.aiAppeals.appeals.some(
                    (item) =>
                        item.userId === userId && item.sanctionId === body.sanctionId && item.status === 'pending',
                )
            )
                return Symbol.for('pending');
            const ticketId = crypto.randomUUID();
            const appealId = crypto.randomUUID();
            const createdAt = new Date(now).toISOString();
            const ticket = supportDetailSchema.parse({
                ticket: {
                    id: ticketId,
                    number: `MP-${ticketId.slice(0, 8).toUpperCase()}`,
                    category: 'ai_appeal',
                    categoryLabel: 'Обращение по AI',
                    status: 'open',
                    statusLabel: 'Открыто',
                    subject: 'Апелляция по ограничению AI',
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
            state.support.tickets.unshift({ userId, ...ticket });
            state.aiAppeals.appeals.unshift({
                userId,
                ticketId,
                id: appealId,
                sanctionId: body.sanctionId,
                status: 'pending',
                submittedAt: createdAt,
                resolvedAt: null,
                response: null,
                version: 1,
            });
            return detail(state, userId, appealId)!;
        });
        return typeof result === 'symbol' ? fail(409) : success(result);
    }
    const match = path.match(/^\/api\/v1\/ai\/appeals\/([0-9a-f-]+)$/i);
    if (match && method === 'GET') {
        const value = detail(state, userId, match[1]!);
        return value ? success(value) : fail(404);
    }
    return fail(404);
}
