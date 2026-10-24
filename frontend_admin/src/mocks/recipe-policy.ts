import { contracts } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';
import type { Principal } from '../shared/api/contracts.generated.js';
export function recipePolicyHandle(c: {
    state: MockState;
    method: string;
    body: unknown;
    actor: Principal;
    critical: boolean;
    now: number;
    requestId: string;
    success: (data: unknown) => Response;
    fail: (status: number, code?: string) => Response;
}) {
    const policy = c.state.admin.tables.__recipe_policy?.[0] ?? {
        version: 1,
        submissionDailyLimit: 10,
        commentHourlyLimit: 30,
        reportDailyLimit: 10,
    };
    const before = contracts['GET /api/v1/admin/settings/recipe-policy'].success.shape.data.parse(policy);
    if (c.method === 'GET') return c.success(before);
    if (!c.critical) return c.fail(403, 'ADMIN_CONFIRMATION_REQUIRED');
    const parsed = contracts['PUT /api/v1/admin/settings/recipe-policy'].request.safeParse(c.body);
    if (!parsed.success) return c.fail(400);
    if (parsed.data.expectedVersion !== before.version) return c.fail(409);
    const after = {
        version: before.version + 1,
        submissionDailyLimit: parsed.data.submissionDailyLimit,
        commentHourlyLimit: parsed.data.commentHourlyLimit,
        reportDailyLimit: parsed.data.reportDailyLimit,
    };
    c.state.admin.tables.__recipe_policy = [after];
    (c.state.admin.tables.audit_events ??= []).push({
        id: crypto.randomUUID(),
        action: 'admin.recipe_policy.updated',
        target_type: 'recipe_policy',
        target_id: '71000000-0000-4000-8000-000000000001',
        actor_id: c.actor.id,
        request_id: c.requestId,
        before_redacted: JSON.stringify(before),
        after_redacted: JSON.stringify(after),
        effective_at: new Date(c.now).toISOString(),
        recorded_at: new Date(c.now).toISOString(),
        version: '1',
    });
    return c.success(after);
}
