import { contracts } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';

type Success = (data: unknown) => Response;
type Fail = (status: number, code?: string) => Response;

export function freeAiHandle(context: {
    state: MockState;
    path: string;
    method: string;
    body: unknown;
    critical: boolean;
    now: number;
    success: Success;
    fail: Fail;
}): Response | null {
    const match = /^\/api\/v1\/admin\/free-ai\/users\/([0-9a-f-]+)(?:\/grants)?$/.exec(context.path);
    if (!match) return null;
    const user = context.state.users.find((entry) => entry.id === match[1]);
    if (!user) return context.fail(404);
    const view = () => {
        const buckets = (context.state.admin.tables.ai_buckets ?? []).filter((row) => row.user_id === user.id);
        const projected = buckets.map((row) => {
            const balance = Number(row.balance_projection ?? 0);
            const reserved = Number(row.reserved_projection ?? 0);
            return {
                id: String(row.id),
                kind: String(row.kind) as 'subscription' | 'transferred' | 'family_reserve' | 'purchased' | 'trial',
                granted: Number(row.granted ?? 0),
                balance,
                reserved,
                available: Math.max(0, balance - reserved),
                requiresConfirmation: Boolean(row.requires_confirmation ?? false),
                expiresAt: typeof row.expires_at === 'string' ? row.expires_at : null,
            };
        });
        const total = projected.reduce((sum, bucket) => sum + bucket.balance, 0);
        const reserved = projected.reduce((sum, bucket) => sum + bucket.reserved, 0);
        return contracts['GET /api/v1/admin/free-ai/users/{id}'].success.shape.data.parse({
            user: {
                id: user.id,
                login: user.login,
                displayName: user.name,
                status: user.active ? 'active' : 'blocked',
                version: String(context.state.version),
            },
            buckets: projected,
            total,
            reserved,
            available: Math.max(0, total - reserved),
            recentOperations: (context.state.admin.tables.ai_operations ?? [])
                .filter((row) => row.user_id === user.id)
                .slice(-30)
                .reverse()
                .map((row) => ({
                    id: String(row.id),
                    taskId: String(row.task_id),
                    status: String(row.status),
                    cost: Number(row.cost ?? 0),
                    createdAt: String(row.created_at),
                })),
        });
    };
    if (context.method === 'GET' && !context.path.endsWith('/grants')) return context.success(view());
    if (context.method !== 'POST' || !context.path.endsWith('/grants')) return context.fail(404);
    const parsed = contracts['POST /api/v1/admin/free-ai/users/{id}/grants'].request.safeParse(context.body);
    if (!parsed.success) return context.fail(400);
    if (!context.critical) return context.fail(403, 'ADMIN_CONFIRMATION_REQUIRED');
    if (!user.active) return context.fail(409);
    if (parsed.data.expectedUserVersion !== String(context.state.version)) return context.fail(409);
    if (parsed.data.expiresAt && Date.parse(parsed.data.expiresAt) <= context.now) return context.fail(409);
    const commandKey = `free-ai:${user.id}:${parsed.data.idempotencyKey}`;
    const digest = JSON.stringify(parsed.data);
    const previous = context.state.admin.commands[commandKey];
    if (previous) {
        if (previous.digest !== digest) return context.fail(409);
        return context.success(previous.result);
    }
    const bucketId = crypto.randomUUID();
    const result = {
        bucketId,
        granted: parsed.data.actions,
        balance: parsed.data.actions,
        expiresAt: parsed.data.expiresAt,
    };
    (context.state.admin.tables.ai_buckets ??= []).unshift({
        id: bucketId,
        user_id: user.id,
        kind: 'trial',
        granted: parsed.data.actions,
        balance_projection: parsed.data.actions,
        reserved_projection: 0,
        requires_confirmation: false,
        expires_at: parsed.data.expiresAt,
        created_at: new Date(context.now).toISOString(),
        version: '1',
    });
    (context.state.admin.tables.audit_events ??= []).push({
        id: crypto.randomUUID(),
        action: 'admin.free-ai.granted',
        target_type: 'user',
        target_id: user.id,
        actor_id: null,
        reason: parsed.data.reason,
        recorded_at: new Date(context.now).toISOString(),
        effective_at: new Date(context.now).toISOString(),
        request_id: crypto.randomUUID(),
        version: '1',
    });
    context.state.admin.commands[commandKey] = { digest, result };
    return context.success(result);
}
