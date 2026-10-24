import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    matchesNewsAudience,
    newsWorkspaceCommand,
    NewsMockError,
    type NewsRecipient,
} from '../src/mocks/news-workspace.js';
import { type NewsContent, newsContentSchema } from '../src/features/news/contracts.js';
import type { AdminState } from '../src/mocks/admin-model.js';

const content: NewsContent = {
    title: 'Обновление',
    pages: [{ blocks: [{ kind: 'text', text: 'Новости сервиса' }] }],
    sources: [],
    category: 'service',
    channels: ['in_app'],
    audience: {
        plans: [],
        genders: [],
        families: [],
        registeredFrom: null,
        registeredTo: null,
        activeFrom: null,
        activeTo: null,
    },
};
const recipient: NewsRecipient = {
    plan: 'pro',
    gender: 'unknown',
    family: true,
    registeredAt: null,
    activeAt: null,
    allowedChannels: ['in_app'],
};
void test('news audience OR within filters, AND across; unknown dates and channel consent excluded', () => {
    const value = structuredClone(content);
    value.audience.plans = ['plus', 'pro'];
    value.audience.genders = ['unknown'];
    assert.equal(matchesNewsAudience(value, recipient), true);
    assert.equal(matchesNewsAudience(value, { ...recipient, gender: 'female' }), false);
    assert.equal(matchesNewsAudience(value, { ...recipient, allowedChannels: [] }), false);
    value.audience.activeFrom = '2026-01-01T00:00:00.000Z';
    assert.equal(matchesNewsAudience(value, recipient), false);
});
void test('news commands reject stale versions, preserve published history and idempotent launch', () => {
    const state: AdminState = { tables: {}, commands: {} };
    const context = { actorId: crypto.randomUUID(), critical: true, now: Date.now(), recipients: [recipient] };
    const id = crypto.randomUUID();
    newsWorkspaceCommand(
        state,
        { action: 'save', id, version: 0, content, idempotencyKey: crypto.randomUUID() },
        context,
    );
    const launch = { action: 'launch', id, version: 1, scheduledAt: null, idempotencyKey: crypto.randomUUID() };
    assert.throws(
        () => newsWorkspaceCommand(state, launch, { ...context, critical: false }),
        (e) => e instanceof NewsMockError && e.status === 403,
    );
    const first = newsWorkspaceCommand(state, launch, context);
    assert.deepEqual(newsWorkspaceCommand(state, launch, context), first);
    assert.equal(first.items[0]?.status, 'published');
    assert.throws(
        () =>
            newsWorkspaceCommand(
                state,
                { action: 'save', id, version: 1, content, idempotencyKey: crypto.randomUUID() },
                context,
            ),
        (e) => e instanceof NewsMockError && e.status === 409,
    );
    const edited = newsWorkspaceCommand(
        state,
        {
            action: 'save',
            id,
            version: 2,
            content: { ...content, title: 'Исправлено' },
            idempotencyKey: crypto.randomUUID(),
        },
        context,
    );
    assert.equal(edited.items[0]?.status, 'published');
    assert.equal(edited.items[0]?.history[0]?.content.title, 'Обновление');
});
void test('only unsent scheduled campaign can be cancelled; unsafe links rejected', () => {
    const state: AdminState = { tables: {}, commands: {} };
    const now = Date.now();
    const context = { actorId: crypto.randomUUID(), critical: true, now, recipients: [] };
    const id = crypto.randomUUID();
    newsWorkspaceCommand(
        state,
        { action: 'save', id, version: 0, content, idempotencyKey: crypto.randomUUID() },
        context,
    );
    newsWorkspaceCommand(
        state,
        {
            action: 'launch',
            id,
            version: 1,
            scheduledAt: new Date(now + 60000).toISOString(),
            idempotencyKey: crypto.randomUUID(),
        },
        context,
    );
    assert.throws(
        () =>
            newsWorkspaceCommand(
                state,
                { action: 'cancel', id, version: 2, idempotencyKey: crypto.randomUUID() },
                { ...context, now: now + 61000 },
            ),
        NewsMockError,
    );
    assert.equal(
        newsWorkspaceCommand(state, { action: 'cancel', id, version: 2, idempotencyKey: crypto.randomUUID() }, context)
            .items[0]?.status,
        'cancelled',
    );
    assert.equal(
        newsContentSchema.safeParse({
            ...content,
            pages: [{ blocks: [{ kind: 'link', text: 'bad', url: 'javascript:alert(1)' }] }],
        }).success,
        false,
    );
});
