import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aiHandle } from '../src/mocks/ai.js';
import { createSeed } from '../src/mocks/model.js';
import { mockLegalManifest } from '../src/mocks/legal.js';

function setup() {
    const state = createSeed();
    const userId = state.users[0]!.id;
    let now = Date.parse('2026-09-30T10:00:00.000Z');
    const send = async (method: string, path: string, input?: unknown, actor: string | null = userId) => {
        const response = aiHandle({
            state,
            userId: actor,
            path,
            params: {},
            method,
            input,
            now,
            success: (data) => Response.json(data),
            fail: (status) => Response.json({}, { status }),
        });
        assert.ok(response);
        return { status: response.status, data: (await response.json()) as unknown };
    };
    return { state, userId, send, advance: (milliseconds: number) => (now += milliseconds) };
}

void test('AI mock preserves the two-free-clarification rule and charges the next ten-minute interval once', async () => {
    const { state, userId, send, advance } = setup();
    state.legal[userId] = {
        consents: {
            ai_data_access: {
                enabled: true,
                changedAt: '2026-09-30T09:00:00.000Z',
                revision: 1,
                document: mockLegalManifest.documents.find((item) => item.kind === 'ai_data_access')!.document,
            },
            special_category: { enabled: false, changedAt: null, revision: 0, document: null },
            dissemination: { enabled: false, changedAt: null, revision: 0, document: null },
            marketing: { enabled: false, changedAt: null, revision: 0, document: null },
        },
        history: [],
        replay: {},
    };
    const preview = await send('POST', '/api/v1/ai/preview', {
        taskType: 'culinary_question',
        prompt: 'Как приготовить суп?',
        usePersonalData: true,
        agreementAccepted: true,
    });
    assert.equal(preview.status, 200);
    const run = await send('POST', '/api/v1/ai/run', {
        previewId: (preview.data as { previewId: string }).previewId,
        idempotencyKey: crypto.randomUUID(),
        familyReserveAccepted: false,
    });
    assert.equal(run.status, 200);
    const taskId = (run.data as { item: { id: string } }).item.id;
    const path = `/api/v1/ai/tasks/${taskId}/messages`;
    const initialBalance = state.ai.buckets.find((item) => item.userId === userId)!.available;

    for (const message of ['А без картофеля?', 'А сколько соли?']) {
        const response = await send('POST', path, {
            message,
            idempotencyKey: crypto.randomUUID(),
            familyReserveAccepted: false,
        });
        assert.equal(response.status, 200);
    }
    assert.equal(state.ai.buckets.find((item) => item.userId === userId)!.available, initialBalance);
    assert.equal(
        (
            await send('POST', path, {
                message: 'Третье уточнение',
                idempotencyKey: crypto.randomUUID(),
                familyReserveAccepted: false,
            })
        ).status,
        409,
    );

    advance(600_000);
    const key = crypto.randomUUID();
    assert.equal(
        (await send('POST', path, { message: 'Продолжим', idempotencyKey: key, familyReserveAccepted: false })).status,
        200,
    );
    assert.equal(state.ai.buckets.find((item) => item.userId === userId)!.available, initialBalance - 1);
    const messageCount = state.ai.conversations.find((item) => item.taskId === taskId)!.messages.length;
    assert.equal(
        (await send('POST', path, { message: 'Продолжим', idempotencyKey: key, familyReserveAccepted: false })).status,
        200,
    );
    assert.equal(state.ai.buckets.find((item) => item.userId === userId)!.available, initialBalance - 1);
    assert.equal(state.ai.conversations.find((item) => item.taskId === taskId)!.messages.length, messageCount);
});

void test('AI conversations are private and a new interval fails without balance', async () => {
    const { state, userId, send, advance } = setup();
    const seeded = await send('GET', '/api/v1/ai/history');
    const taskId = (seeded.data as { items: Array<{ id: string }> }).items[0]!.id;
    const foreign = state.users.find((item) => item.id !== userId)!.id;
    assert.equal((await send('GET', `/api/v1/ai/tasks/${taskId}`, undefined, foreign)).status, 404);
    for (const bucket of state.ai.buckets.filter((item) => item.userId === userId)) {
        bucket.balance = 0;
        bucket.available = 0;
    }
    advance(2 * 86_400_000);
    assert.equal(
        (
            await send('POST', `/api/v1/ai/tasks/${taskId}/messages`, {
                message: 'Ещё вопрос',
                idempotencyKey: crypto.randomUUID(),
                familyReserveAccepted: false,
            })
        ).status,
        409,
    );
});

void test('AI personal context requires legal consent while an ordinary prompt remains available', async () => {
    const { send } = setup();
    const ordinary = await send('POST', '/api/v1/ai/preview', {
        taskType: 'culinary_question',
        prompt: 'Как приготовить суп?',
        usePersonalData: false,
        agreementAccepted: true,
    });
    assert.equal(ordinary.status, 200);
    const personal = await send('POST', '/api/v1/ai/preview', {
        taskType: 'culinary_question',
        prompt: 'Что приготовить из моих запасов?',
        usePersonalData: true,
        agreementAccepted: true,
    });
    assert.equal(personal.status, 403);
});

void test('AI run rechecks consent after preview and does not debit on revocation', async () => {
    const { state, userId, send } = setup();
    state.legal[userId] = {
        consents: {
            ai_data_access: {
                enabled: true,
                changedAt: '2026-09-30T09:00:00.000Z',
                revision: 1,
                document: mockLegalManifest.documents.find((item) => item.kind === 'ai_data_access')!.document,
            },
            special_category: { enabled: false, changedAt: null, revision: 0, document: null },
            dissemination: { enabled: false, changedAt: null, revision: 0, document: null },
            marketing: { enabled: false, changedAt: null, revision: 0, document: null },
        },
        history: [],
        replay: {},
    };
    const preview = await send('POST', '/api/v1/ai/preview', {
        taskType: 'culinary_question',
        prompt: 'Что приготовить из моих запасов?',
        usePersonalData: true,
        agreementAccepted: true,
    });
    assert.equal(preview.status, 200);
    const before = state.ai.buckets.filter((item) => item.userId === userId).map((item) => item.available);
    const historyBefore = state.ai.history.filter((item) => item.userId === userId).length;
    state.legal[userId].consents.ai_data_access.enabled = false;

    const run = await send('POST', '/api/v1/ai/run', {
        previewId: (preview.data as { previewId: string }).previewId,
        idempotencyKey: crypto.randomUUID(),
        familyReserveAccepted: false,
    });
    assert.equal(run.status, 403);
    assert.deepEqual(
        state.ai.buckets.filter((item) => item.userId === userId).map((item) => item.available),
        before,
    );
    assert.equal(state.ai.history.filter((item) => item.userId === userId).length, historyBefore);
});

void test('AI mock exposes the versioned task catalog and Pro orchestration preview', async () => {
    const { state, userId, send } = setup();
    state.users.find((user) => user.id === userId)!.plan = 'pro';
    const capabilities = await send('GET', '/api/v1/ai/capabilities');
    assert.equal(capabilities.status, 200);
    const catalog = capabilities.data as {
        orchestrationRuleVersion: string;
        taskTypes: Array<{ code: string; cost: number; taskClass: string }>;
    };
    assert.equal(catalog.orchestrationRuleVersion, 'ai-task-policy-v2');
    assert.equal(catalog.taskTypes.length, 18);
    assert.deepEqual(
        catalog.taskTypes.find((task) => task.code === 'document_analysis'),
        {
            code: 'document_analysis',
            label: 'Анализ документа',
            taskClass: 'heavy',
            cost: 5,
            tokenBudget: { maxInputTokens: 64000, maxOutputTokens: 10000 },
        },
    );

    const response = await send('POST', '/api/v1/ai/preview', {
        taskType: 'meal_plan_generation',
        prompt: 'Составь план питания на неделю',
        usePersonalData: false,
        agreementAccepted: true,
    });
    assert.equal(response.status, 200);
    const orchestration = (response.data as { orchestration: Record<string, unknown> }).orchestration;
    assert.deepEqual(orchestration, {
        ruleVersion: 'ai-task-policy-v2',
        taskClass: 'heavy',
        priority: 'pro',
        target: { provider: 'openai', model: 'gpt-6-luna', transport: 'responses', reasoningEffort: 'low' },
        tokenBudget: { maxInputTokens: 48000, maxOutputTokens: 7000 },
        context: {
            personalDataUsed: false,
            sources: [{ kind: 'user_prompt', label: 'Текст запроса', itemCount: 1, truncated: false }],
        },
        compensation: { providerFailure: 'release_reserved_actions', internalRetryCost: 0 },
    });
});

void test('Plus monthly allowance is split equally across active family accounts', async () => {
    const state = createSeed();
    const plusUsers = state.users.filter((user) => user.plan === 'plus');
    assert.equal(plusUsers.length, 2);
    for (const user of plusUsers) {
        const response = aiHandle({
            state,
            userId: user.id,
            path: '/api/v1/ai/balance',
            params: {},
            method: 'GET',
            input: undefined,
            now: Date.parse('2026-10-01T10:00:00.000Z'),
            success: (data) => Response.json(data),
            fail: (status) => Response.json({}, { status }),
        })!;
        const balance = (await response.json()) as {
            buckets: Array<{ kind: string; granted: number; available: number; expiresAt: string | null }>;
        };
        assert.deepEqual(
            balance.buckets.map(({ kind, granted }) => ({ kind, granted })),
            [{ kind: 'subscription', granted: 20 }],
        );
        assert.equal(balance.buckets[0]!.available, 12);
        assert.equal(balance.buckets[0]!.expiresAt, '2027-01-01T00:00:00.000Z');
    }
});
