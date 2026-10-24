import { contracts, type Principal } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';

type Context = {
    state: MockState;
    path: string;
    method: string;
    body: unknown;
    actor: Principal;
    critical: boolean;
    now: number;
    requestId: string;
    success: (data: unknown) => Response;
    fail: (status: number, code?: string) => Response;
};

export function accountDeletionReviewHandle(context: Context): Response | null {
    const match = /^\/api\/v1\/admin\/account-deletions\/([0-9a-f-]{36})\/review$/i.exec(context.path);
    if (!match) return null;
    if (context.method !== 'POST') return context.fail(404);
    if (!context.critical) return context.fail(403, 'ADMIN_CONFIRMATION_REQUIRED');
    const input = contracts['POST /api/v1/admin/account-deletions/{id}/review'].request.safeParse(context.body);
    if (!input.success) return context.fail(400);
    const row = context.state.admin.tables.legal_requests?.find((item) => item.id === match[1]);
    if (!row || !['account_deletion', 'deletion'].includes(String(row.kind))) return context.fail(404);
    if (Number(row.version ?? 1) !== input.data.expectedVersion) return context.fail(412);
    if (!['requested', 'retention_wait', 'blocked', 'pending'].includes(String(row.status))) return context.fail(409);
    const at = new Date(context.now).toISOString();
    row.status = input.data.decision === 'approve' ? 'retention_wait' : 'rejected';
    row.approved_at = input.data.decision === 'approve' ? at : null;
    row.handled_by = context.actor.id;
    row.version = String(Number(row.version ?? 1) + 1);
    (context.state.admin.tables.legal_request_steps ??= []).push({
        id: crypto.randomUUID(),
        request_id: String(row.id),
        kind: 'admin_review',
        status: input.data.decision,
        evidence: JSON.stringify({ reason: input.data.reason }),
        completed_at: at,
        approved_by: context.actor.id,
        created_at: at,
        version: '1',
    });
    (context.state.admin.tables.audit_events ??= []).push({
        id: crypto.randomUUID(),
        action: input.data.decision === 'approve' ? 'account.deletion.approved' : 'account.deletion.rejected',
        target_type: 'legal_requests',
        target_id: String(row.id),
        actor_id: context.actor.id,
        scope_id: null,
        effective_at: at,
        recorded_at: at,
        request_id: context.requestId,
        reason: input.data.reason,
        before_redacted: null,
        after_redacted: null,
        created_at: at,
        version: '1',
    });
    return context.success({
        id: String(row.id),
        status: row.status,
        requestedAt: String(row.requested_at ?? row.created_at ?? at),
        cancelUntil: row.cancel_until ? String(row.cancel_until) : null,
        finalizationNotBefore: row.finalization_not_before ? String(row.finalization_not_before) : null,
        cancelledAt: row.cancelled_at ? String(row.cancelled_at) : null,
        finalizedAt: row.executed_at ? String(row.executed_at) : null,
        policyVersion: row.policy_version ? String(row.policy_version) : null,
        blockers: Array.isArray(row.blocker_snapshot) ? row.blocker_snapshot : [],
        version: Number(row.version),
    });
}
