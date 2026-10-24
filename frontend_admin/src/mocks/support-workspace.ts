import { seedSupportWorkspace } from './support-fixtures.js';
import { contracts, type Principal } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';
import type { AdminRow } from './admin-model.js';
type Context = {
    requestId?: string;
    state: MockState;
    path: string;
    method: string;
    body: unknown;
    actor: Principal;
    now: number;
    success: (data: unknown) => Response;
    fail: (status: number) => Response;
};
export function supportHandle(c: Context): Response | null {
    const match = /^\/api\/v1\/admin\/support\/([0-9a-f-]{36})\/(workspace|manage)$/i.exec(c.path);
    const create = c.path === '/api/v1/admin/support/create';
    if (!match && !create) return null;
    if (c.actor.context !== 'admin') return c.fail(403);
    const tables = c.state.admin.tables;
    const tickets = (tables.support_tickets ??= []);
    const messages = (tables.support_messages ??= []);
    const revisions = (tables.support_message_revisions ??= []);
    const attachments = (tables.support_attachments ??= []);
    const ticket = match ? tickets.find((t) => t.id === match[1]) : undefined;
    if (match && !ticket) return c.fail(404);
    const staff = c.state.users.filter((u) => u.active && (u.role === 'admin' || u.role === 'moderator'));
    if (match?.[2] === 'workspace') {
        if (c.method !== 'GET') return c.fail(404);
        seedSupportWorkspace(c.state, String(ticket!.id));
        return c.success({
            version: String(ticket!.version),
            assigneeId: ticket!.assignee_id ?? null,
            staff: staff.map((u) => ({ id: u.id, label: u.login })),
            messages: messages
                .filter((m) => m.ticket_id === ticket!.id)
                .map((m) => ({
                    id: m.id,
                    body: m.body,
                    authorId: m.author_id,
                    internal: m.internal === true,
                    edited: revisions.some((r) => r.message_id === m.id),
                    canEdit: m.author_id === c.actor.id,
                    revisions: revisions
                        .filter((r) => r.message_id === m.id)
                        .map((r) => ({ body: r.body, createdAt: r.created_at })),
                })),
            attachments: attachments
                .filter((a) => a.ticket_id === ticket!.id)
                .map((a) => ({
                    id: a.id,
                    messageId: a.message_id,
                    name: a.name,
                    type: a.type,
                    size: a.size,
                    duration: a.duration,
                    status: a.status,
                    reason: a.reason ?? null,
                })),
        });
    }
    if (c.method !== 'POST') return c.fail(404);
    const parsed = create
        ? contracts['POST /api/v1/admin/support/create'].request.safeParse(c.body)
        : contracts['POST /api/v1/admin/support/{id}/manage'].request.safeParse(c.body);
    if (!parsed.success) return c.fail(400);
    const input = parsed.data;
    if ('action' in input && (input.action === 'attach' || input.action === 'hide')) return c.fail(503);
    const key = `support-workspace:${c.actor.id}:${input.idempotencyKey}`;
    const digest = JSON.stringify([c.path, input]);
    const previous = c.state.admin.commands[key];
    if (previous) return previous.digest === digest ? c.success(previous.result) : c.fail(409);
    const stamp = new Date(c.now).toISOString();
    const row = (data: AdminRow): AdminRow => ({ id: crypto.randomUUID(), created_at: stamp, version: '1', ...data });
    let changed: AdminRow;
    if ('requesterId' in input) {
        if (!c.state.users.some((u) => u.id === input.requesterId)) return c.fail(404);
        changed = row({
            requester_id: input.requesterId,
            subject: input.subject,
            category: 'technical',
            status: 'waiting_for_user',
            assignee_id: c.actor.id,
            closed_at: null,
            public_number: String(1000 + tickets.length + 1),
        });
        tickets.push(changed);
        messages.push(row({ ticket_id: changed.id!, author_id: c.actor.id, body: input.body, internal: false }));
    } else {
        changed = ticket!;
        if (String(changed.version) !== input.version) return c.fail(409);
        const target = messages.find((m) => m.id === input.targetId && m.ticket_id === changed.id);
        if (input.action === 'assign') {
            if (input.targetId && !staff.some((u) => u.id === input.targetId)) return c.fail(400);
            changed.assignee_id = input.targetId;
        } else if (input.action === 'note') {
            if (!input.text) return c.fail(400);
            messages.push(row({ ticket_id: changed.id!, author_id: c.actor.id, body: input.text, internal: true }));
        } else if (input.action === 'edit') {
            if (!target) return c.fail(404);
            if (target.author_id !== c.actor.id) return c.fail(403);
            if (!input.text) return c.fail(400);
            revisions.push(row({ message_id: target.id!, body: target.body!, author_id: c.actor.id }));
            target.body = input.text;
        }
        changed.version = String(BigInt(String(changed.version)) + 1n);
    }
    const result = { ticketId: String(changed.id), version: String(changed.version) };
    c.state.admin.commands[key] = { digest, result };
    (tables.audit_events ??= []).push(
        row({
            action: `admin.support.${'action' in input ? input.action : 'create'}`,
            target_id: changed.id!,
            actor_id: c.actor.id,
            reason: 'action' in input && input.action === 'hide' ? input.text : null,
            recorded_at: stamp,
            request_id: c.requestId ?? crypto.randomUUID(),
            effective_at: stamp,
        }),
    );
    return c.success(result);
}
