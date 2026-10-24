import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAdminState } from '../src/mocks/admin-model.js';
import { OperationsMockError, operationsWorkspaceCommand } from '../src/mocks/operations-workspace.js';
const context = { actorId: 'a', critical: false, now: Date.parse('2026-09-28T10:00:00Z') };
const body = (id: string) => ({
    section: 'operations',
    id,
    action: 'execute',
    operation: 'retry',
    reason: 'Повтор после исправления',
    ignoreUntil: null,
    expectedVersion: '1',
    idempotencyKey: crypto.randomUUID(),
});
void test('safe import retry is idempotent, audited once and rejects stale competing writes', () => {
    const state = createAdminState();
    const job = state.tables.background_jobs![0]!;
    const input = body(String(job.id));
    assert.equal(operationsWorkspaceCommand(state, input, context).status, 'queued');
    const auditCount = state.tables.audit_events!.length;
    assert.equal(operationsWorkspaceCommand(state, input, context).status, 'queued');
    assert.equal(state.tables.audit_events!.length, auditCount);
    assert.throws(
        () =>
            operationsWorkspaceCommand(
                state,
                { ...input, idempotencyKey: crypto.randomUUID(), operation: 'cancel' },
                context,
            ),
        (error: unknown) => error instanceof OperationsMockError && error.status === 409,
    );
});
void test('running and unknown financial jobs cannot be cancelled or retried by status alone', () => {
    const state = createAdminState();
    const job = state.tables.background_jobs![0]!;
    job.status = 'running';
    assert.throws(
        () => operationsWorkspaceCommand(state, { ...body(String(job.id)), operation: 'cancel' }, context),
        OperationsMockError,
    );
    job.status = 'failed';
    job.kind = 'payment_unknown';
    assert.throws(
        () => operationsWorkspaceCommand(state, body(String(job.id)), { ...context, critical: true }),
        OperationsMockError,
    );
    assert.equal(job.version, '1');
});
void test('incident ignore preserves immutable source, requires reason and future expiry', () => {
    const state = createAdminState();
    const event = state.tables.admin_error_events![0]!;
    const original = structuredClone(event);
    const input = {
        ...body(String(event.id)),
        section: 'errors',
        operation: 'ignored',
        ignoreUntil: '2026-09-28T11:00:00.000Z',
    };
    assert.throws(() => operationsWorkspaceCommand(state, { ...input, reason: '' }, context), OperationsMockError);
    assert.throws(
        () => operationsWorkspaceCommand(state, { ...input, ignoreUntil: '2026-09-28T09:00:00.000Z' }, context),
        OperationsMockError,
    );
    assert.equal(operationsWorkspaceCommand(state, input, context).status, 'ignored');
    assert.deepEqual(event, original);
    assert.equal(state.tables.admin_incident_states![0]!.ignored_until, input.ignoreUntil);
    assert.equal(
        operationsWorkspaceCommand(
            state,
            { ...input, action: 'inspect' },
            { ...context, now: Date.parse('2026-09-28T12:00:00Z') },
        ).status,
        'new',
    );
});
void test('preview has no effects and pending safe import can be cancelled', () => {
    const state = createAdminState();
    const job = state.tables.background_jobs![0]!;
    job.status = 'pending';
    const input = { ...body(String(job.id)), operation: 'cancel' };
    const before = structuredClone(state);
    assert.ok(operationsWorkspaceCommand(state, { ...input, action: 'preview' }, context).preview);
    assert.deepEqual(state, before);
    assert.equal(operationsWorkspaceCommand(state, input, context).status, 'cancelled');
});
