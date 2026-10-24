import { z } from 'zod';
import { contracts } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';
const bucket = contracts['GET /api/v1/ai/balance'].success.shape.data.shape.buckets.element;
const historyItem = contracts['GET /api/v1/ai/history'].success.shape.data.shape.items.element;
const preview = contracts['POST /api/v1/ai/preview'].success.shape.data;
const conversation = contracts['GET /api/v1/ai/tasks/{id}'].success.shape.data;
const transfer = contracts['GET /api/v1/ai/family-sharing'].success.shape.data.shape.transfers.element;
const mockConversationSchema = z.object({
    userId: z.uuid(),
    taskId: z.uuid(),
    usePersonalData: z.boolean().default(false),
    intervalStartedAt: z.number(),
    clarificationsUsed: z.number().int().min(0).max(2),
    messages: z.array(conversation.shape.messages.element),
});
const historyCursorSchema = z.strictObject({
    archived: z.enum(['active', 'archived', 'all']),
    createdAt: z.iso.datetime(),
    id: z.uuid(),
});
export const aiStateSchema = z.object({
    buckets: z.array(
        bucket.extend({
            userId: z.uuid().nullable(),
            familyId: z.uuid().nullable().default(null),
            requiresConfirmation: z.boolean().default(false),
        }),
    ),
    history: z.array(
        historyItem.extend({
            userId: z.uuid(),
            archived: z.boolean().default(false),
            version: z.number().int().positive().default(1),
        }),
    ),
    previews: z.array(
        preview.extend({ userId: z.uuid(), prompt: z.string(), usePersonalData: z.boolean().default(false) }),
    ),
    conversations: z.array(mockConversationSchema),
    transfers: z.array(transfer.extend({ familyId: z.uuid() })),
    seeded: z.array(z.uuid()),
    replay: z.record(z.string(), z.object({ input: z.string(), result: z.unknown() })),
});
export type AiState = z.infer<typeof aiStateSchema>;
export const createAiState = (): AiState => ({
    buckets: [],
    history: [],
    previews: [],
    conversations: [],
    transfers: [],
    seeded: [],
    replay: {},
});
const taskTypes = [
    {
        code: 'culinary_question',
        label: 'Кулинарный вопрос',
        taskClass: 'standard',
        cost: 1,
        tokenBudget: { maxInputTokens: 8000, maxOutputTokens: 1500 },
    },
    {
        code: 'substitution',
        label: 'Подбор замены',
        taskClass: 'standard',
        cost: 1,
        tokenBudget: { maxInputTokens: 8000, maxOutputTokens: 1500 },
    },
    {
        code: 'storage_advice',
        label: 'Совет по хранению',
        taskClass: 'standard',
        cost: 1,
        tokenBudget: { maxInputTokens: 8000, maxOutputTokens: 1500 },
    },
    {
        code: 'ingredient_extraction',
        label: 'Извлечение ингредиентов',
        taskClass: 'standard',
        cost: 1,
        tokenBudget: { maxInputTokens: 8000, maxOutputTokens: 1500 },
    },
    {
        code: 'product_classification',
        label: 'Классификация продукта',
        taskClass: 'standard',
        cost: 1,
        tokenBudget: { maxInputTokens: 8000, maxOutputTokens: 1500 },
    },
    {
        code: 'recipe_from_stock',
        label: 'Рецепт из запасов',
        taskClass: 'advanced',
        cost: 2,
        tokenBudget: { maxInputTokens: 16000, maxOutputTokens: 3000 },
    },
    {
        code: 'nutrition_calculation',
        label: 'Расчёт КБЖУ',
        taskClass: 'advanced',
        cost: 2,
        tokenBudget: { maxInputTokens: 16000, maxOutputTokens: 3000 },
    },
    {
        code: 'personal_recommendation',
        label: 'Персональная рекомендация',
        taskClass: 'advanced',
        cost: 2,
        tokenBudget: { maxInputTokens: 16000, maxOutputTokens: 3000 },
    },
    {
        code: 'beverage_pairing',
        label: 'Подбор напитка',
        taskClass: 'advanced',
        cost: 2,
        tokenBudget: { maxInputTokens: 16000, maxOutputTokens: 3000 },
    },
    {
        code: 'portion_cost_calculation',
        label: 'Порции и стоимость',
        taskClass: 'advanced',
        cost: 2,
        tokenBudget: { maxInputTokens: 16000, maxOutputTokens: 3000 },
    },
    {
        code: 'recipe_adaptation',
        label: 'Адаптация рецепта',
        taskClass: 'advanced',
        cost: 2,
        tokenBudget: { maxInputTokens: 16000, maxOutputTokens: 3000 },
    },
    {
        code: 'shopping_list_generation',
        label: 'Список покупок',
        taskClass: 'heavy',
        cost: 3,
        tokenBudget: { maxInputTokens: 32000, maxOutputTokens: 5000 },
    },
    {
        code: 'registry_analysis',
        label: 'Анализ реестра',
        taskClass: 'heavy',
        cost: 3,
        tokenBudget: { maxInputTokens: 32000, maxOutputTokens: 5000 },
    },
    {
        code: 'review_summary',
        label: 'Саммаризация отзывов',
        taskClass: 'heavy',
        cost: 3,
        tokenBudget: { maxInputTokens: 32000, maxOutputTokens: 5000 },
    },
    {
        code: 'meal_plan_generation',
        label: 'План питания',
        taskClass: 'heavy',
        cost: 4,
        tokenBudget: { maxInputTokens: 48000, maxOutputTokens: 7000 },
    },
    {
        code: 'seasonal_analysis',
        label: 'Анализ сезонности',
        taskClass: 'heavy',
        cost: 4,
        tokenBudget: { maxInputTokens: 48000, maxOutputTokens: 7000 },
    },
    {
        code: 'event_menu',
        label: 'Меню для события',
        taskClass: 'heavy',
        cost: 4,
        tokenBudget: { maxInputTokens: 48000, maxOutputTokens: 7000 },
    },
    {
        code: 'document_analysis',
        label: 'Анализ документа',
        taskClass: 'heavy',
        cost: 5,
        tokenBudget: { maxInputTokens: 64000, maxOutputTokens: 10000 },
    },
] as const;
const AI_TASK_RULE_VERSION = 'ai-task-policy-v2';
const legacyTaskTypes = new Set(['culinary_question', 'recipe_from_stock', 'substitution', 'storage_advice']);
const wireHistoryItem = (value: z.infer<typeof historyItem> & { userId: string }) => {
    const { userId: _userId, ...item } = value;
    void _userId;
    return historyItem.parse(item);
};
export function ensureAiState(state: MockState, userId: string, now: number) {
    if (state.ai.seeded.includes(userId)) return;
    state.ai.seeded.push(userId);
    const user = state.users.find((candidate) => candidate.id === userId)!;
    const family = state.family.families.find(
        (candidate) =>
            !candidate.archived &&
            candidate.members.some((member) => member.userId === userId && member.leftAt === null),
    );
    const effectivePlan = family?.plan ?? user.plan;
    const allowance = effectivePlan === 'pro' ? 120 : effectivePlan === 'plus' ? 40 : 0;
    const recipients = family ? family.members.filter((member) => member.leftAt === null).length : 1;
    const granted = allowance ? Math.floor(allowance / recipients) : 40;
    const spent = Math.min(8, granted);
    state.ai.buckets.push({
        userId,
        familyId: allowance && family ? family.id : null,
        id: crypto.randomUUID(),
        kind: allowance ? 'subscription' : 'purchased',
        granted,
        balance: granted - spent,
        reserved: 0,
        available: granted - spent,
        requiresConfirmation: false,
        expiresAt: allowance ? (family?.periodEndsAt ?? new Date(now + 31 * 86_400_000).toISOString()) : null,
    });
    const familyReserve = family ? allowance - granted * recipients : 0;
    if (
        family &&
        familyReserve > 0 &&
        !state.ai.buckets.some((entry) => entry.kind === 'family_reserve' && entry.familyId === family.id)
    )
        state.ai.buckets.push({
            userId: null,
            familyId: family.id,
            id: crypto.randomUUID(),
            kind: 'family_reserve',
            granted: familyReserve,
            balance: familyReserve,
            reserved: 0,
            available: familyReserve,
            requiresConfirmation: true,
            expiresAt: family.periodEndsAt,
        });
    const completed = {
        userId,
        id: crypto.randomUUID(),
        title: 'Как хранить свежую зелень',
        taskType: 'storage_advice' as const,
        status: 'completed' as const,
        cost: 1,
        createdAt: new Date(now - 86400000).toISOString(),
        result: 'Промойте зелень, полностью обсушите и храните в закрытом контейнере с сухим бумажным полотенцем.',
        archived: false,
        version: 1,
    };
    const refunded = {
        userId,
        id: crypto.randomUUID(),
        title: 'Замена сливок',
        taskType: 'substitution' as const,
        status: 'refunded' as const,
        cost: 1,
        createdAt: new Date(now - 172800000).toISOString(),
        result: null,
        archived: false,
        version: 1,
    };
    state.ai.history.push(completed, refunded);
    state.ai.conversations.push({
        userId,
        taskId: completed.id,
        usePersonalData: false,
        intervalStartedAt: now - 86400000,
        clarificationsUsed: 0,
        messages: [
            {
                id: crypto.randomUUID(),
                role: 'user',
                body: completed.title,
                createdAt: completed.createdAt,
            },
            {
                id: crypto.randomUUID(),
                role: 'assistant',
                body: completed.result,
                createdAt: new Date(Date.parse(completed.createdAt) + 1000).toISOString(),
            },
        ],
    });
}
const balance = (state: MockState, userId: string) => {
    const family = state.family.families.find(
        (candidate) =>
            !candidate.archived &&
            candidate.members.some((member) => member.userId === userId && member.leftAt === null),
    );
    const buckets = state.ai.buckets
            .filter((x) => x.userId === userId || (x.kind === 'family_reserve' && x.familyId === family?.id))
            .map(({ userId: _userId, familyId: _familyId, ...value }) => {
                void _userId;
                void _familyId;
                return bucket.parse(value);
            }),
        total = buckets.reduce((n, x) => n + x.balance, 0),
        reserved = buckets.reduce((n, x) => n + x.reserved, 0);
    return {
        buckets,
        total,
        reserved,
        available: total - reserved,
        debitOrder: ['subscription', 'transferred', 'family_reserve', 'purchased'] as const,
        packageOffer: {
            actions: 40 as const,
            amountMinor: 19900 as const,
            currency: 'RUB' as const,
            purchaseMode: 'simulation' as const,
        },
    };
};
const replay = (state: MockState, key: string, input: unknown, run: () => unknown) => {
    const data = JSON.stringify(input),
        old = state.ai.replay[key];
    if (old) return old.input === data ? old.result : Symbol.for('conflict');
    const result = run();
    if (typeof result !== 'symbol') state.ai.replay[key] = { input: data, result };
    return result;
};
const detail = (state: MockState, userId: string, taskId: string, now: number) => {
    const item = state.ai.history.find((entry) => entry.userId === userId && entry.id === taskId),
        chat = state.ai.conversations.find((entry) => entry.userId === userId && entry.taskId === taskId);
    if (!item || !chat) return null;
    const endsAt = chat.intervalStartedAt + 600000,
        within = endsAt > now && item.status !== 'refunded',
        wait = within && chat.clarificationsUsed >= 2;
    return conversation.parse({
        item: wireHistoryItem(item),
        messages: chat.messages,
        continuation: {
            state: wait ? 'wait' : 'ready',
            clarificationsUsed: within ? chat.clarificationsUsed : 0,
            clarificationsRemaining: within ? Math.max(0, 2 - chat.clarificationsUsed) : 2,
            intervalEndsAt: within ? new Date(endsAt).toISOString() : null,
            nextMessageCost: within ? 0 : item.cost,
        },
    });
};
export function aiHandle(c: {
    state: MockState;
    userId: string | null;
    path: string;
    params: Record<string, string>;
    method: string;
    query?: URLSearchParams;
    input: unknown;
    now: number;
    success: (data: unknown) => Response;
    fail: (status: number, code?: string) => Response;
}): Response | null {
    const { state, userId, path, method, input, now, success, fail } = c;
    const query = c.query ?? new URLSearchParams();
    if (!path.startsWith('/api/v1/ai')) return null;
    if (!userId) return fail(401);
    ensureAiState(state, userId, now);
    if (path === '/api/v1/ai/capabilities' && method === 'GET')
        return success({
            provider: { configured: true, kind: 'openai_compatible', model: 'mock-culinary-model' },
            executionAvailable: true,
            purchaseMode: 'simulation',
            freeTaskTypes: taskTypes
                .filter((task) => legacyTaskTypes.has(task.code))
                .map(({ code, label, cost }) => ({ code, label, cost })),
            taskTypes,
            orchestrationRuleVersion: AI_TASK_RULE_VERSION,
            disclaimer:
                'AI может ошибаться. Проверяйте рецепты и советы. AI не заменяет врача или профессионального диетолога.',
        });
    if (path === '/api/v1/ai/balance' && method === 'GET') return success(balance(state, userId));
    if (path === '/api/v1/ai/family-sharing' && method === 'GET') {
        const family = state.family.families.find(
            (candidate) =>
                !candidate.archived &&
                candidate.members.some((member) => member.userId === userId && member.leftAt === null),
        );
        if (!family) return fail(403);
        for (const member of family.members.filter((entry) => entry.leftAt === null))
            ensureAiState(state, member.userId, now);
        return success({
            members: family.members
                .filter((entry) => entry.leftAt === null)
                .map((entry) => ({
                    userId: entry.userId,
                    displayName: state.users.find((user) => user.id === entry.userId)?.name ?? 'Участник',
                    availableToTransfer: state.ai.buckets
                        .filter((bucket) => bucket.userId === entry.userId && bucket.kind === 'subscription')
                        .reduce((sum, bucket) => sum + bucket.available, 0),
                    currentUser: entry.userId === userId,
                })),
            transfers: state.ai.transfers.filter(
                (entry) => entry.familyId === family.id && (entry.donorId === userId || entry.recipientId === userId),
            ),
        });
    }
    if (path === '/api/v1/ai/transfers' && method === 'POST') {
        const family = state.family.families.find(
            (candidate) =>
                !candidate.archived &&
                candidate.members.some((member) => member.userId === userId && member.leftAt === null),
        );
        if (!family) return fail(403);
        const body = contracts['POST /api/v1/ai/transfers'].request.parse(input),
            donor = family.members.find((member) => member.userId === body.donorId && member.leftAt === null),
            recipient = family.members.find((member) => member.userId === userId && member.leftAt === null),
            recipientAvailable = state.ai.buckets
                .filter((entry) => entry.userId === userId && entry.kind === 'subscription')
                .reduce((sum, entry) => sum + entry.available, 0),
            donorAvailable = state.ai.buckets
                .filter((entry) => entry.userId === body.donorId && entry.kind === 'subscription')
                .reduce((sum, entry) => sum + entry.available, 0);
        const result = replay(state, `${userId}:ai-transfer:${body.idempotencyKey}`, body, () => {
            if (
                !donor ||
                !recipient ||
                donor.userId === userId ||
                recipientAvailable > 0 ||
                donorAvailable < body.amount
            )
                return Symbol.for('balance');
            const created = {
                id: crypto.randomUUID(),
                familyId: family.id,
                donorId: donor.userId,
                donorName: state.users.find((user) => user.id === donor.userId)?.name ?? 'Участник',
                recipientId: recipient.userId,
                recipientName: state.users.find((user) => user.id === recipient.userId)?.name ?? 'Участник',
                amount: body.amount,
                status: 'pending' as const,
                expiresAt: family.periodEndsAt,
                version: 1,
            };
            state.ai.transfers.unshift(created);
            return { transfer: created };
        });
        return result === Symbol.for('conflict') || result === Symbol.for('balance') ? fail(409) : success(result);
    }
    const transferDecision = path.match(/^\/api\/v1\/ai\/transfers\/([0-9a-f-]+)\/decision$/i);
    if (transferDecision && method === 'POST') {
        const body = contracts['POST /api/v1/ai/transfers/{id}/decision'].request.parse(input),
            item = state.ai.transfers.find((entry) => entry.id === transferDecision[1] && entry.donorId === userId);
        const result = replay(state, `${userId}:ai-transfer-decision:${body.idempotencyKey}`, body, () => {
            if (!item || item.status !== 'pending' || item.version !== body.expectedVersion)
                return Symbol.for('version');
            if (body.decision === 'accept') {
                const source = state.ai.buckets.find(
                    (entry) =>
                        entry.userId === userId && entry.kind === 'subscription' && entry.available >= item.amount,
                );
                if (!source) return Symbol.for('balance');
                source.balance -= item.amount;
                source.available -= item.amount;
                let target = state.ai.buckets.find(
                    (entry) => entry.userId === item.recipientId && entry.kind === 'transferred',
                );
                if (!target) {
                    target = {
                        userId: item.recipientId,
                        familyId: null,
                        id: crypto.randomUUID(),
                        kind: 'transferred',
                        granted: 0,
                        balance: 0,
                        reserved: 0,
                        available: 0,
                        requiresConfirmation: false,
                        expiresAt: item.expiresAt,
                    };
                    state.ai.buckets.push(target);
                }
                target.granted += item.amount;
                target.balance += item.amount;
                target.available += item.amount;
            }
            item.status = body.decision === 'accept' ? 'accepted' : 'rejected';
            item.version += 1;
            return { transfer: item };
        });
        if (result === Symbol.for('conflict') || result === Symbol.for('balance') || result === Symbol.for('version'))
            return fail(409);
        return success(result);
    }
    if (path === '/api/v1/ai/history' && method === 'GET') {
        const archived = query.get('archived') ?? 'active',
            limit = Number(query.get('limit') ?? 20);
        if (!['active', 'archived', 'all'].includes(archived) || !Number.isInteger(limit) || limit < 1 || limit > 50)
            return fail(400);
        let cursor: z.infer<typeof historyCursorSchema> | null = null;
        const encodedCursor = query.get('cursor');
        if (encodedCursor)
            try {
                const base64 = encodedCursor.replaceAll('-', '+').replaceAll('_', '/');
                cursor = historyCursorSchema.parse(
                    JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))),
                );
            } catch {
                return fail(400);
            }
        if (cursor && cursor.archived !== archived) return fail(400);
        const personalAllowed = state.legal[userId]?.consents.ai_data_access?.enabled === true;
        const filtered = state.ai.history
            .filter(
                (item) =>
                    item.userId === userId &&
                    (personalAllowed ||
                        !state.ai.conversations.some(
                            (conversation) => conversation.taskId === item.id && conversation.usePersonalData,
                        )) &&
                    (archived === 'all' || (archived === 'archived' ? item.archived : !item.archived)),
            )
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
        const after = cursor
            ? filtered.filter(
                  (item) =>
                      item.createdAt < cursor.createdAt || (item.createdAt === cursor.createdAt && item.id < cursor.id),
              )
            : filtered;
        const page = after.slice(0, limit),
            last = page.at(-1),
            nextCursor =
                after.length > limit && last
                    ? btoa(JSON.stringify({ archived, createdAt: last.createdAt, id: last.id }))
                          .replaceAll('+', '-')
                          .replaceAll('/', '_')
                          .replaceAll('=', '')
                    : null;
        const items = page.map(({ userId: _userId, ...value }) => {
            void _userId;
            return historyItem.parse(value);
        });
        return success({ items, total: filtered.length, nextCursor });
    }
    const archiveMatch = path.match(/^\/api\/v1\/ai\/history\/([0-9a-f-]+)\/archive$/i);
    if (archiveMatch && method === 'PUT') {
        const body = contracts['PUT /api/v1/ai/history/{id}/archive'].request.parse(input),
            item = state.ai.history.find((entry) => entry.userId === userId && entry.id === archiveMatch[1]);
        const result = replay(
            state,
            `${userId}:ai-history-archive:${archiveMatch[1]}:${body.idempotencyKey}`,
            body,
            () => {
                if (!item) return Symbol.for('missing');
                if (item.version !== body.expectedVersion) return Symbol.for('version');
                item.archived = body.archived;
                item.version += 1;
                return { item: wireHistoryItem(item) };
            },
        );
        if (result === Symbol.for('conflict') || result === Symbol.for('version')) return fail(409);
        if (result === Symbol.for('missing')) return fail(404);
        return success(result);
    }
    const taskMatch = path.match(/^\/api\/v1\/ai\/tasks\/([0-9a-f-]+)$/i);
    if (taskMatch && method === 'GET') {
        const chat = state.ai.conversations.find(
            (conversation) => conversation.userId === userId && conversation.taskId === taskMatch[1],
        );
        if (chat?.usePersonalData && !state.legal[userId]?.consents.ai_data_access?.enabled)
            return fail(403, 'AI_PROCESSING_CONSENT_REQUIRED');
        const value = detail(state, userId, taskMatch[1]!, now);
        return value ? success(value) : fail(404);
    }
    if (path === '/api/v1/ai/preview' && method === 'POST') {
        const body = contracts['POST /api/v1/ai/preview'].request.parse(input),
            currentBalance = balance(state, userId),
            beforeReserveAvailable = currentBalance.buckets
                .filter((entry) => entry.kind !== 'family_reserve' && entry.kind !== 'purchased')
                .reduce((sum, entry) => sum + entry.available, 0),
            reserveAvailable = currentBalance.buckets
                .filter((entry) => entry.kind === 'family_reserve')
                .reduce((sum, entry) => sum + entry.available, 0),
            available = currentBalance.available,
            task = taskTypes.find((x) => x.code === body.taskType)!,
            cost = task.cost;
        if (available < cost) return fail(409);
        const user = state.users.find((candidate) => candidate.id === userId)!,
            family = state.family.families.find(
                (candidate) =>
                    !candidate.archived &&
                    candidate.members.some((member) => member.userId === userId && member.leftAt === null),
            ),
            personalItems = body.usePersonalData
                ? state.inventory.batches.filter((entry) => entry.userId === userId && entry.batch.archivedAt === null)
                : [],
            context = {
                personalDataUsed: body.usePersonalData,
                sources: [
                    { kind: 'user_prompt' as const, label: 'Текст запроса', itemCount: 1, truncated: false },
                    ...(body.usePersonalData
                        ? [
                              {
                                  kind: 'personal_inventory' as const,
                                  label: 'Личные запасы',
                                  itemCount: Math.min(50, personalItems.length),
                                  truncated: personalItems.length > 50,
                              },
                          ]
                        : []),
                ],
            },
            orchestration = {
                ruleVersion: AI_TASK_RULE_VERSION,
                taskClass: task.taskClass,
                priority: user.plan === 'pro' || family?.plan === 'pro' ? ('pro' as const) : ('normal' as const),
                target: {
                    provider: 'openai' as const,
                    model: 'gpt-6-luna' as const,
                    transport: 'responses' as const,
                    reasoningEffort: 'low' as const,
                },
                tokenBudget: task.tokenBudget,
                context,
                compensation: { providerFailure: 'release_reserved_actions' as const, internalRetryCost: 0 as const },
            };
        const value = preview.parse({
            previewId: crypto.randomUUID(),
            taskType: body.taskType,
            cost,
            prompt: body.prompt,
            balanceBefore: available,
            balanceAfter: available - cost,
            sources: context.sources.map(
                (source) => `${source.label}: ${source.itemCount}${source.truncated ? ', показаны первые 50' : ''}`,
            ),
            expiresAt: new Date(now + 600000).toISOString(),
            providerReady: true,
            familyReserveRequired: Math.min(reserveAvailable, Math.max(0, cost - beforeReserveAvailable)),
            orchestration,
        });
        if (body.usePersonalData && !state.legal[userId]?.consents.ai_data_access?.enabled)
            return fail(403, 'AI_PROCESSING_CONSENT_REQUIRED');
        state.ai.previews.push({ ...value, userId, prompt: body.prompt, usePersonalData: body.usePersonalData });
        return success(value);
    }
    if (path === '/api/v1/ai/run' && method === 'POST') {
        const body = contracts['POST /api/v1/ai/run'].request.parse(input),
            item = state.ai.previews.find((x) => x.userId === userId && x.previewId === body.previewId);
        if (!item || Date.parse(item.expiresAt) <= now) return fail(409);
        if (item.usePersonalData && !state.legal[userId]?.consents.ai_data_access?.enabled)
            return fail(403, 'AI_PROCESSING_CONSENT_REQUIRED');
        if (item.familyReserveRequired > 0 && !body.familyReserveAccepted) return fail(409);
        const result = replay(state, `${userId}:run:${body.idempotencyKey}`, body, () => {
            const family = state.family.families.find(
                (candidate) =>
                    !candidate.archived &&
                    candidate.members.some((member) => member.userId === userId && member.leftAt === null),
            );
            const target = state.ai.buckets.find(
                (x) =>
                    (x.userId === userId ||
                        (body.familyReserveAccepted && x.kind === 'family_reserve' && x.familyId === family?.id)) &&
                    x.available >= item.cost,
            );
            if (!target) return Symbol.for('balance');
            target.balance -= item.cost;
            target.available -= item.cost;
            const created = {
                userId,
                id: crypto.randomUUID(),
                title: item.prompt.slice(0, 80),
                taskType: item.taskType,
                status: 'completed' as const,
                cost: item.cost,
                createdAt: new Date(now).toISOString(),
                result: `Тестовый ответ: ${item.prompt}\n\nЭто локальная симуляция. Реальный AI-провайдер не вызывался.`,
                archived: false,
                version: 1,
            };
            state.ai.history.unshift(created);
            state.ai.conversations.push({
                userId,
                taskId: created.id,
                usePersonalData: item.usePersonalData,
                intervalStartedAt: now,
                clarificationsUsed: 0,
                messages: [
                    { id: crypto.randomUUID(), role: 'user', body: item.prompt, createdAt: created.createdAt },
                    {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        body: created.result,
                        createdAt: new Date(now + 1000).toISOString(),
                    },
                ],
            });
            return { item: wireHistoryItem(created) };
        });
        if (result === Symbol.for('conflict')) return fail(409);
        if (result === Symbol.for('balance')) return fail(409);
        return success(result);
    }
    const messageMatch = path.match(/^\/api\/v1\/ai\/tasks\/([0-9a-f-]+)\/messages$/i);
    if (messageMatch && method === 'POST') {
        const taskId = messageMatch[1]!,
            body = contracts['POST /api/v1/ai/tasks/{id}/messages'].request.parse(input),
            item = state.ai.history.find((entry) => entry.userId === userId && entry.id === taskId),
            chat = state.ai.conversations.find((entry) => entry.userId === userId && entry.taskId === taskId);
        if (!item || !chat) return fail(404);
        if (chat.usePersonalData && !state.legal[userId]?.consents.ai_data_access?.enabled)
            return fail(403, 'AI_PROCESSING_CONSENT_REQUIRED');
        const result = replay(state, `${userId}:ai-message:${taskId}:${body.idempotencyKey}`, body, () => {
            const within = chat.intervalStartedAt + 600000 > now && item.status !== 'refunded';
            if (within && chat.clarificationsUsed >= 2) return Symbol.for('wait');
            if (!within) {
                const family = state.family.families.find(
                    (candidate) =>
                        !candidate.archived &&
                        candidate.members.some((member) => member.userId === userId && member.leftAt === null),
                );
                const currentBalance = balance(state, userId),
                    beforeReserveAvailable = currentBalance.buckets
                        .filter((entry) => entry.kind !== 'family_reserve' && entry.kind !== 'purchased')
                        .reduce((sum, entry) => sum + entry.available, 0),
                    reserveAvailable = currentBalance.buckets
                        .filter((entry) => entry.kind === 'family_reserve')
                        .reduce((sum, entry) => sum + entry.available, 0),
                    familyReserveRequired = Math.min(reserveAvailable, Math.max(0, item.cost - beforeReserveAvailable));
                if (familyReserveRequired > 0 && !body.familyReserveAccepted) return Symbol.for('balance');
                const target = state.ai.buckets.find(
                    (entry) =>
                        (entry.userId === userId ||
                            (body.familyReserveAccepted &&
                                entry.kind === 'family_reserve' &&
                                entry.familyId === family?.id)) &&
                        entry.available >= item.cost,
                );
                if (!target) return Symbol.for('balance');
                target.balance -= item.cost;
                target.available -= item.cost;
                chat.intervalStartedAt = now;
                chat.clarificationsUsed = 0;
            } else chat.clarificationsUsed += 1;
            const answer = `Тестовое уточнение: ${body.message}`;
            chat.messages.push(
                { id: crypto.randomUUID(), role: 'user', body: body.message, createdAt: new Date(now).toISOString() },
                {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    body: answer,
                    createdAt: new Date(now + 1000).toISOString(),
                },
            );
            item.status = 'completed';
            item.result = answer;
            return detail(state, userId, taskId, now);
        });
        if (result === Symbol.for('conflict') || result === Symbol.for('wait') || result === Symbol.for('balance'))
            return fail(409);
        return success(result);
    }
    if (path === '/api/v1/ai/package/purchase' && method === 'POST') {
        const body = contracts['POST /api/v1/ai/package/purchase'].request.parse(input);
        const result = replay(state, `${userId}:purchase:${body.idempotencyKey}`, body, () => {
            const found = state.ai.buckets.find((x) => x.userId === userId && x.kind === 'purchased');
            if (found) {
                found.granted += 40;
                found.balance += 40;
                found.available += 40;
            } else
                state.ai.buckets.push({
                    userId,
                    familyId: null,
                    id: crypto.randomUUID(),
                    kind: 'purchased',
                    granted: 40,
                    balance: 40,
                    reserved: 0,
                    available: 40,
                    requiresConfirmation: false,
                    expiresAt: null,
                });
            return { status: 'simulated' as const, balance: balance(state, userId) };
        });
        return result === Symbol.for('conflict') ? fail(409) : success(result);
    }
    return fail(404);
}
