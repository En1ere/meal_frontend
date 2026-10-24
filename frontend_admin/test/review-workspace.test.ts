import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAdminState } from '../src/mocks/admin-model.js';
import { reviewWorkspaceCommand, ReviewMockError } from '../src/mocks/review-workspace.js';
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const context = { actorId: crypto.randomUUID(), critical: true, now: Date.now() };
void test('export preview exposes blockers while archive preparation fails closed without storage', () => {
    const state = createAdminState();
    const preview = reviewWorkspaceCommand(
        state,
        'legal-requests',
        id(12),
        { action: 'preview', data: { version: 1 } },
        context,
    );
    assert.equal(preview.identityVerified, false);
    assert.ok(preview.dependencies.some((item) => item.label === 'Политика хранения' && item.state === 'blocked'));
    assert.throws(
        () =>
            reviewWorkspaceCommand(
                state,
                'legal-requests',
                id(12),
                {
                    action: 'prepare-export',
                    data: {
                        version: 1,
                        previewKey: preview.previewKey!,
                        reason: 'Запрос пользователя',
                        idempotencyKey: crypto.randomUUID(),
                    },
                },
                context,
            ),
        (error) => error instanceof ReviewMockError && error.status === 503,
    );
});
void test('verified applicant preview does not create a synthetic export archive', () => {
    const state = createAdminState();
    const preview = reviewWorkspaceCommand(
        state,
        'legal-requests',
        id(112),
        { action: 'preview', data: { version: 1 } },
        context,
    );
    assert.throws(
        () =>
            reviewWorkspaceCommand(
                state,
                'legal-requests',
                id(112),
                {
                    action: 'prepare-export',
                    data: {
                        version: 1,
                        previewKey: preview.previewKey!,
                        reason: 'Запрос пользователя',
                        idempotencyKey: crypto.randomUUID(),
                    },
                },
                context,
            ),
        (error) => error instanceof ReviewMockError && error.status === 503,
    );
    assert.equal(state.tables.review_export_files?.length ?? 0, 0);
    assert.equal(state.tables.review_commands?.length ?? 0, 0);
    assert.equal(state.tables.review_workspaces?.length ?? 0, 0);
});
void test('rollback applies ready only preserving late foreign edits, audit and retry idempotency', () => {
    const state = createAdminState();
    const preview = reviewWorkspaceCommand(
        state,
        'rollback',
        id(11),
        { action: 'preview', data: { version: 1 } },
        context,
    );
    assert.equal(preview.items.filter((item) => item.state === 'ready').length, 3);
    assert.equal(preview.items.filter((item) => item.state === 'conflict').length, 1);
    assert.equal(preview.items.filter((item) => item.state === 'blocked').length, 1);
    const command = {
        action: 'apply-rollback' as const,
        data: {
            version: 1,
            previewKey: preview.previewKey!,
            reason: 'Ошибочное решение',
            idempotencyKey: crypto.randomUUID(),
        },
    };
    const conflict = preview.items.find((item) => item.state === 'conflict')!;
    const conflictBefore = structuredClone(
        state.tables.review_rollback_targets?.find((target) => target.id === conflict.targetId),
    );
    const result = reviewWorkspaceCommand(state, 'rollback', id(11), command, context);
    assert.equal(result.status, 'partial');
    assert.equal(result.items[0]?.state, 'applied');
    assert.deepEqual(
        state.tables.review_rollback_targets?.find((target) => target.id === conflict.targetId),
        conflictBefore,
    );
    assert.deepEqual(reviewWorkspaceCommand(state, 'rollback', id(11), command, context), result);
    assert.equal(state.tables.review_applied_items?.length, 3);
});
void test('rollback cannot use stale preview or bypass critical confirmation', () => {
    const state = createAdminState();
    const preview = reviewWorkspaceCommand(
        state,
        'rollback',
        id(11),
        { action: 'preview', data: { version: 1 } },
        context,
    );
    const command = {
        action: 'apply-rollback' as const,
        data: {
            version: 1,
            previewKey: preview.previewKey!,
            reason: 'Ошибка модерации',
            idempotencyKey: crypto.randomUUID(),
        },
    };
    assert.throws(
        () => reviewWorkspaceCommand(state, 'rollback', id(11), command, { ...context, critical: false }),
        (error) => error instanceof ReviewMockError && error.status === 403,
    );
    state.tables.review_rollback_targets![0]!.version = 3;
    assert.throws(
        () => reviewWorkspaceCommand(state, 'rollback', id(11), command, context),
        (error) => error instanceof ReviewMockError && error.status === 409,
    );
});
