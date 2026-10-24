import { z } from 'zod';
import { contracts, type Principal } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';
import { adminSources } from './admin-sources.js';
import type { AdminRow, AdminRecord, AdminSection } from './admin-model.js';
import { relatedCollections, relatedPage } from './admin-related.js';

type Context = {
    state: MockState;
    path: string;
    method: string;
    body: unknown;
    actor: Principal;
    now: number;
    requestId?: string;
    success: (data: unknown) => Response;
    fail: (status: number) => Response;
};
const uuid = z.uuid();
function project(section: Exclude<AdminSection, 'overview'>, row: AdminRow, now: number): AdminRecord {
    const source = adminSources[section];
    const value = (key: string) => (row[key] == null ? null : String(row[key]));
    let status = source.status ? value(source.status) : null;
    if (section === 'sanctions')
        status = row.revoked_at
            ? 'revoked'
            : Date.parse(String(row.starts_at)) > now
              ? 'scheduled'
              : row.ends_at && Date.parse(String(row.ends_at)) <= now
                ? 'expired'
                : 'active';
    return {
        id: String(row.id),
        title: value(source.title) ?? String(row.id),
        status,
        updatedAt: null,
        version: String(row.version ?? '1'),
        fields: [
            { key: 'createdAt', label: 'Создано', value: value('created_at') },
            ...source.fields.map(([key, label]) => ({ key, label, value: value(key) })),
        ],
        related: (source.related ?? []).flatMap(([key, label, target]) =>
            row[key] ? [{ label, section: target, id: String(row[key]) }] : [],
        ),
        actions: [
            {
                key: 'change',
                label: 'Изменить',
                enabled: false,
                reason: 'Изменение доступно только через согласованную доменную команду с проверкой последствий.',
            },
        ],
    };
}
export function adminHandle(c: Context): Response {
    const { state, path, method, actor, now, fail } = c;
    const success = (data: unknown) => {
        const parts = path.split('/');
        const section = parts[4]!;
        const related = parts[6] === 'related';
        const support = section === 'support' && parts.length > 6 && !related;
        const preferences = section === 'notification-preferences';
        const detail = !support && !preferences && method === 'GET';
        const action = related
            ? 'admin.detail.read'
            : preferences
              ? method === 'POST'
                  ? 'admin.notifications.updated'
                  : 'admin.notifications.read'
              : support
                ? parts[6] === 'messages'
                    ? 'admin.support.messages.read'
                    : `admin.support.${parts[6]}`
                : detail
                  ? 'admin.detail.read'
                  : 'admin.search.read';
        (state.admin.tables.audit_events ??= []).push({
            id: crypto.randomUUID(),
            action,
            target_type: support || preferences ? 'admin_action' : section,
            target_id: support || detail || related ? parts[5]! : actor.id,
            actor_id: actor.id,
            scope_id: null,
            effective_at: new Date(now).toISOString(),
            recorded_at: new Date(now).toISOString(),
            request_id: c.requestId ?? crypto.randomUUID(),
            reason: null,
            before_redacted: null,
            after_redacted: null,
            created_at: new Date(now).toISOString(),
            version: '1',
        });
        return c.success(data);
    };
    const relatedMatch = /^\/api\/v1\/admin\/([^/]+)\/([0-9a-f-]{36})\/related\/([^/]+)\/search$/i.exec(path);
    if (relatedMatch) {
        if (method !== 'POST') return fail(404);
        const section = contracts['POST /api/v1/admin/{section}/search'].params.shape.section.safeParse(
            relatedMatch[1],
        );
        if (!section.success || !uuid.safeParse(relatedMatch[2]).success) return fail(400);
        const input = contracts['POST /api/v1/admin/{section}/{id}/related/{collection}/search'].request.safeParse(
            c.body,
        );
        if (!input.success) return fail(400);
        const result = relatedPage(state, section.data, relatedMatch[2]!, relatedMatch[3]!, input.data, actor);
        return result.status === 200 ? success(result.data) : fail(result.status);
    }
    if (path === '/api/v1/admin/notification-preferences') {
        const user = state.users.find((u) => u.id === actor.id)!;
        const preferences = {
            browser: false,
            mobilePush: false,
            email: false,
            ...state.notificationPreferences[user.id],
        };
        const verifiedEmail = user.verified && z.email().safeParse(user.email).success ? user.email : null;
        if (method === 'POST') {
            const change = contracts['POST /api/v1/admin/notification-preferences'].request.parse(c.body);
            if (change.channel === 'email' && change.enabled && !verifiedEmail) return fail(409);
            preferences[change.channel] = change.enabled;
            state.notificationPreferences[user.id] = preferences;
        }
        return success({ preferences, verifiedEmail });
    }
    const commandMatch = /^\/api\/v1\/admin\/support\/([0-9a-f-]{36})\/(reply|reopen|messages\/search)$/i.exec(path);
    if (commandMatch) {
        const ticketId = commandMatch[1]!;
        if (!uuid.safeParse(ticketId).success) return fail(400);
        const ticket = state.admin.tables.support_tickets?.find((t) => t.id === ticketId);
        if (!ticket) return fail(404);
        if (commandMatch[2] === 'messages/search') {
            const input = contracts['POST /api/v1/admin/support/{id}/messages/search'].request.parse(c.body);
            const binding = JSON.stringify([ticketId, actor.id, actor.sessionId]);
            let cursor: { id: string; createdAt: string } | undefined;
            if (input.cursor) {
                try {
                    cursor = z
                        .strictObject({ id: uuid, createdAt: z.iso.datetime(), binding: z.literal(binding) })
                        .parse(JSON.parse(atob(input.cursor.replaceAll('-', '+').replaceAll('_', '/'))));
                } catch {
                    return fail(400);
                }
            }
            const rows = (state.admin.tables.support_messages ?? [])
                .filter(
                    (r) =>
                        r.ticket_id === ticketId &&
                        r.internal === false &&
                        (!cursor ||
                            String(r.created_at) < cursor.createdAt ||
                            (r.created_at === cursor.createdAt && String(r.id) < cursor.id)),
                )
                .sort(
                    (a, b) =>
                        String(b.created_at).localeCompare(String(a.created_at)) ||
                        String(b.id).localeCompare(String(a.id)),
                );
            const limit = input.limit ?? 25;
            const page = rows.slice(0, limit);
            return success({
                items: page.map((r) => ({
                    id: r.id,
                    body: r.body,
                    authorId: r.author_id,
                    createdAt: r.created_at,
                    internal: false,
                })),
                nextCursor:
                    rows.length > limit
                        ? btoa(JSON.stringify({ id: page.at(-1)!.id, createdAt: page.at(-1)!.created_at, binding }))
                              .replaceAll('+', '-')
                              .replaceAll('/', '_')
                              .replaceAll('=', '')
                        : null,
            });
        }
        const kind = commandMatch[2] === 'reply' ? 'reply' : 'reopen';
        const input = contracts[
            kind === 'reply' ? 'POST /api/v1/admin/support/{id}/reply' : 'POST /api/v1/admin/support/{id}/reopen'
        ].request.parse(c.body);
        const body = 'body' in input && typeof input.body === 'string' ? input.body.trim() : null;
        if (kind === 'reply' && !body) return fail(400);
        const key = `${actor.id}:${kind}:${ticketId}:${input.idempotencyKey}`;
        const digest = JSON.stringify([ticketId, kind, input.version, body]);
        const prior = state.admin.commands[key];
        if (prior) return prior.digest === digest ? success(prior.result) : fail(409);
        if (
            ticket.version !== input.version ||
            (kind === 'reopen'
                ? ticket.status !== 'closed'
                : !['open', 'waiting_for_user', 'waiting_for_support'].includes(String(ticket.status)))
        )
            return fail(409);
        const messageId = kind === 'reply' ? crypto.randomUUID() : null;
        if (messageId)
            (state.admin.tables.support_messages ??= []).push({
                id: messageId,
                ticket_id: ticketId,
                author_id: actor.id,
                created_at: new Date(now).toISOString(),
                body,
                internal: false,
                version: '1',
            });
        ticket.status = kind === 'reply' ? 'waiting_for_user' : 'waiting_for_support';
        if (kind === 'reply') ticket.assignee_id = actor.id;
        ticket.closed_at = null;
        ticket.version = String(BigInt(String(ticket.version)) + 1n);
        const result = {
            ticketId,
            version: ticket.version,
            status: ticket.status,
            assigneeId: ticket.assignee_id ?? null,
            messageId,
        };
        (state.admin.tables.support_events ??= []).push({
            id: crypto.randomUUID(),
            ticket_id: ticketId,
            actor_id: actor.id,
            kind,
            reason: null,
            recorded_at: new Date(now).toISOString(),
            created_at: new Date(now).toISOString(),
            version: '1',
        });
        state.admin.commands[key] = { digest, result };
        return success(result);
    }
    const match = /^\/api\/v1\/admin\/([^/]+)\/(search|[0-9a-f-]{36})$/i.exec(path);
    if (!match) return fail(404);
    const sectionResult = contracts['POST /api/v1/admin/{section}/search'].params.shape.section.safeParse(match[1]);
    if (!sectionResult.success) return fail(400);
    const section = sectionResult.data;
    const search = match[2] === 'search';
    if ((search && method !== 'POST') || (!search && method !== 'GET')) return fail(404);
    if (section === 'overview') {
        if (!search) return fail(404);
        const count = (table: string, key: string, value: string) =>
            (state.admin.tables[table] ?? []).filter((row) => row[key] === value).length;
        const sources = [
            [
                'Требуют внимания',
                [
                    [
                        'support_waiting',
                        'Ожидают ответа поддержки',
                        count('support_tickets', 'status', 'waiting_for_support'),
                    ],
                    ['moderation_pending', 'Ожидают проверки', count('moderation_cases', 'status', 'pending')],
                ],
            ],
            [
                'Назначено мне',
                [
                    [
                        'assigned_support',
                        'Мои обращения, включая завершённые',
                        count('support_tickets', 'assignee_id', actor.id),
                    ],
                    [
                        'assigned_moderation',
                        'Мои проверки, включая завершённые',
                        count('moderation_cases', 'assigned_to', actor.id),
                    ],
                ],
            ],
            [
                'Система',
                [
                    ['jobs_failed', 'Задачи с ошибкой', count('background_jobs', 'status', 'failed')],
                    ['jobs_running', 'Задачи выполняются', count('background_jobs', 'status', 'running')],
                ],
            ],
            [
                'Платежи',
                [
                    ['orders_pending', 'Заказы в ожидании', count('billing_orders', 'status', 'pending')],
                    ['attempts_failed', 'Неудачные попытки оплаты', count('payment_attempts', 'status', 'failed')],
                ],
            ],
        ] as const;
        return success({
            section,
            availability: 'available',
            reason: 'Счётчики рассчитаны по сохранённым данным. Назначения включают завершённые записи.',
            items: sources.map(([title, fields], index) => ({
                id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
                title,
                status: null,
                updatedAt: null,
                version: '1',
                fields: fields.map(([key, label, value]) => ({ key, label, value: String(value) })),
                related: [],
                actions: [],
            })),
            nextCursor: null,
        });
    }
    const source = adminSources[section];
    const rows: AdminRow[] =
        source.table === 'users'
            ? state.users.map((u) => ({
                  id: u.id,
                  login: u.login,
                  display_name: u.name,
                  status: u.active ? 'active' : 'blocked',
                  email_verified_at: u.verified ? '2026-09-28T08:00:00.000Z' : null,
                  version: '1',
                  created_at: '2026-09-28T08:00:00.000Z',
              }))
            : (state.admin.tables[source.table] ?? []);
    if (!search) {
        if (!uuid.safeParse(match[2]).success) return fail(400);
        const row = rows.find((r) => r.id === match[2]);
        if (!row) return fail(404);
        const item = project(section, row, now);
        if (section === 'news') item.fields.push({ key: 'pageCount', label: 'Количество страниц', value: null });
        if (section === 'access') {
            const roles = (state.admin.tables.staff_role_assignments ?? []).filter((role) => role.user_id === row.id);
            item.fields.push(
                {
                    key: 'activeStaffRoles',
                    label: 'Действующие служебные роли',
                    value:
                        [...new Set(roles.filter((role) => !role.revoked_at).map((role) => String(role.role)))]
                            .sort()
                            .join(', ') || 'Нет действующих ролей',
                },
                {
                    key: 'revokedStaffRoleCount',
                    label: 'Отозванных назначений ролей',
                    value: String(roles.filter((role) => role.revoked_at).length),
                },
            );
        }
        if (section === 'payments') {
            const attempts = (state.admin.tables.payment_attempts ?? [])
                .filter((attempt) => attempt.order_id === row.id)
                .sort(
                    (a, b) =>
                        String(b.created_at).localeCompare(String(a.created_at)) ||
                        String(b.id).localeCompare(String(a.id)),
                );
            item.fields.push(
                { key: 'paymentAttemptCount', label: 'Попыток оплаты', value: String(attempts.length) },
                {
                    key: 'latestPaymentStatus',
                    label: 'Статус последней попытки',
                    value: attempts[0]?.status == null ? null : String(attempts[0].status),
                },
                {
                    key: 'latestPaymentAt',
                    label: 'Последняя попытка',
                    value: attempts[0]?.created_at == null ? null : String(attempts[0].created_at),
                },
            );
        }
        return success({ section, item, collections: relatedCollections(section) });
    }
    const input = contracts['POST /api/v1/admin/{section}/search'].request.parse(c.body);
    const queue = 'queue' in input ? input.queue : undefined;
    if (queue && section !== 'queues') return fail(400);
    const query = input.query?.trim();
    if (source.requiresQuery && !query)
        return success({
            section,
            availability: 'requires_query',
            reason: 'Введите точный ID или логин пользователя; для подписки — ID подписки или владельца.',
            items: [],
            nextCursor: null,
        });
    if (input.status && !source.status) return fail(400);
    if (
        query &&
        (section === 'users' || section === 'access') &&
        !uuid.safeParse(query).success &&
        !/^[A-Za-z0-9_]{3,30}$/.test(query)
    )
        return fail(400);
    if (query && section === 'subscriptions' && !uuid.safeParse(query).success) return fail(400);
    const binding = JSON.stringify([
        section,
        queue ?? '',
        query ?? '',
        input.status ?? '',
        input.limit ?? 25,
        actor.id,
        actor.sessionId,
    ]);
    let after = '';
    if (input.cursor) {
        try {
            const decoded: unknown = JSON.parse(atob(input.cursor.replaceAll('-', '+').replaceAll('_', '/')));
            after = z.strictObject({ id: uuid, binding: z.literal(binding) }).parse(decoded).id;
        } catch {
            return fail(400);
        }
    }
    const filtered = rows
        .filter(
            (r) =>
                String(r.id) > after &&
                (!queue || r.kind === 'recipe') &&
                (!input.status || r[source.status!] === input.status) &&
                (!query ||
                    (section === 'users' || section === 'access'
                        ? r.id === query || String(r.login).toLowerCase() === query.toLowerCase()
                        : section === 'subscriptions'
                          ? r.id === query || r.owner_id === query
                          : uuid.safeParse(query).success
                            ? r.id === query
                            : String(r[source.title]).toLowerCase().includes(query.toLowerCase()))),
        )
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const page = filtered.slice(0, input.limit ?? 25);
    const cursor =
        filtered.length > page.length
            ? btoa(JSON.stringify({ id: page.at(-1)!.id, binding }))
                  .replaceAll('+', '-')
                  .replaceAll('/', '_')
                  .replaceAll('=', '')
            : null;
    return success({
        section,
        availability: 'available',
        reason: source.note ?? null,
        items: page.map((r) => project(section, r, now)),
        nextCursor: cursor,
    });
}
