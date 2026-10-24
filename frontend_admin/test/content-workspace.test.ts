import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAdminState } from '../src/mocks/admin-model.js';
import { contentWorkspaceCommand, ContentMockError } from '../src/mocks/content-workspace.js';
import type { ContentCompare, ContentResult } from '../src/features/content/contracts.js';
const context = { actorId: crypto.randomUUID(), critical: true, now: Date.now() };
const id = '10000000-0000-4000-8000-000000000007';
const queueId = '10000000-0000-4000-8000-000000000001';
function comparison(view: ContentResult): ContentCompare {
    const left = view.cards[0]!;
    const right = view.cards[1]!;
    return {
        leftId: left.id,
        rightId: right.id,
        leftVersion: left.version,
        rightVersion: right.version,
        canonicalId: left.id,
        choices: { name: 'left' },
    };
}
void test('moderation rejects pending revision without removing approved public version; reason and optimistic version required', () => {
    const state = createAdminState();
    const view = contentWorkspaceCommand(state, 'queues', queueId, { action: 'load' }, context);
    assert.ok(view.pending);
    view.current = { ...structuredClone(view.pending), fields: { title: 'Ранее одобренная версия' } };
    state.tables.content_workspaces = [{ id: queueId, section: 'queues', payload: JSON.stringify(view) }];
    assert.throws(
        () =>
            contentWorkspaceCommand(
                state,
                'queues',
                queueId,
                {
                    action: 'moderate',
                    data: { action: 'reject', version: 1, reason: '', idempotencyKey: crypto.randomUUID() },
                },
                context,
            ),
        ContentMockError,
    );
    const result = contentWorkspaceCommand(
        state,
        'queues',
        queueId,
        {
            action: 'moderate',
            data: { action: 'reject', version: 1, reason: 'Уточните состав', idempotencyKey: crypto.randomUUID() },
        },
        { ...context, critical: false },
    );
    assert.equal(result.current?.fields.title, 'Ранее одобренная версия');
    assert.equal(result.pending, null);
    assert.equal(result.history[0]?.reason, 'Уточните состав');
});
void test('merge preserves variants, source IDs and historical tables; retries are idempotent', () => {
    const state = createAdminState();
    const historic = JSON.stringify(state.tables.recipe_ingredients);
    const view = contentWorkspaceCommand(state, 'catalog', id, { action: 'load' }, context);
    const data = comparison(view);
    const preview = contentWorkspaceCommand(state, 'catalog', id, { action: 'compare', data }, context).comparison!;
    const command = {
        action: 'merge' as const,
        data: { ...data, previewKey: preview.previewKey, reason: 'Один товар', idempotencyKey: crypto.randomUUID() },
    };
    const result = contentWorkspaceCommand(state, 'catalog', id, command, context);
    assert.deepEqual(contentWorkspaceCommand(state, 'catalog', id, command, context), result);
    assert.equal(result.cards[1]?.aliasOf, id);
    assert.equal(result.cards[0]?.variants.length, 2);
    assert.equal(JSON.stringify(state.tables.recipe_ingredients), historic);
});
void test('merge requires critical confirmation, all conflicts and exact preview', () => {
    const state = createAdminState();
    const view = contentWorkspaceCommand(state, 'catalog', id, { action: 'load' }, context);
    const data = comparison(view);
    const preview = contentWorkspaceCommand(state, 'catalog', id, { action: 'compare', data }, context).comparison!;
    const command = {
        action: 'merge' as const,
        data: { ...data, previewKey: preview.previewKey, reason: 'Проверено', idempotencyKey: crypto.randomUUID() },
    };
    assert.throws(
        () => contentWorkspaceCommand(state, 'catalog', id, command, { ...context, critical: false }),
        (e) => e instanceof ContentMockError && e.status === 403,
    );
    assert.throws(
        () =>
            contentWorkspaceCommand(
                state,
                'catalog',
                id,
                { ...command, data: { ...command.data, choices: {} } },
                context,
            ),
        ContentMockError,
    );
    assert.throws(
        () =>
            contentWorkspaceCommand(
                state,
                'catalog',
                id,
                { ...command, data: { ...command.data, previewKey: 'stale' } },
                context,
            ),
        ContentMockError,
    );
});
void test('not-duplicate suppresses pair for same comparison revisions; composition differences block merge', () => {
    const state = createAdminState();
    const view = contentWorkspaceCommand(state, 'catalog', id, { action: 'load' }, context);
    const data = comparison(view);
    contentWorkspaceCommand(
        state,
        'catalog',
        id,
        {
            action: 'not-duplicate',
            data: {
                leftId: data.leftId,
                rightId: data.rightId,
                leftVersion: 1,
                rightVersion: 1,
                reason: 'Другой состав',
                idempotencyKey: crypto.randomUUID(),
            },
        },
        context,
    );
    assert.throws(
        () => contentWorkspaceCommand(state, 'catalog', id, { action: 'compare', data }, context),
        ContentMockError,
    );
    const row = state.tables.content_catalog_cards![1]!;
    const changed = view.cards[1]!;
    changed.version++;
    changed.fields.composition = 'Молоко и сахар';
    row.payload = JSON.stringify(changed);
    const updated = { ...data, rightVersion: 2 };
    const preview = contentWorkspaceCommand(
        state,
        'catalog',
        id,
        { action: 'compare', data: updated },
        context,
    ).comparison!;
    assert.match(preview.blockedReason!, /Составы/);
});
