import { z } from 'zod';
import fixture from '../../contracts/dev-users.json' with { type: 'json' };
import type { Success } from '../shared/api/contracts.generated.js';
import { relatedFixtures } from './admin-related-fixtures.js';

export type AdminSection = Success<'POST /api/v1/admin/{section}/search'>['data']['section'];
export type AdminRecord = Success<'GET /api/v1/admin/{section}/{id}'>['data']['item'];
export const adminRowSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));
export type AdminRow = z.infer<typeof adminRowSchema>;
export const adminStateSchema = z.strictObject({
    tables: z.record(z.string(), z.array(adminRowSchema)),
    commands: z.record(z.string(), z.strictObject({ digest: z.string(), result: adminRowSchema })),
});
export type AdminState = z.infer<typeof adminStateSchema>;
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const date = '2026-09-28T08:00:00.000Z';

// Database-shaped read projections, not complete SQL seeds. No provider payloads or live telemetry.
export function createAdminState(): AdminState {
    const row = (n: number, data: AdminRow): AdminRow => ({ id: id(n), created_at: date, version: '1', ...data });
    const related = relatedFixtures();
    return {
        commands: {},
        tables: {
            ...related,
            staff_role_assignments: fixture.users
                .filter((user) => user.role)
                .map((user, index) =>
                    row(20 + index, {
                        user_id: user.id,
                        role: user.role,
                        assigned_at: date,
                        revoked_at: null,
                        assigned_by: fixture.users[0]!.id,
                    }),
                ),
            payment_attempts: [
                row(22, {
                    provider: 'development',
                    external_id: null,
                    status: 'pending',
                    amount_minor: '29900',
                    idempotency_key: 'development-payment-attempt',
                    order_id: id(4),
                }),
            ],
            moderation_cases: [
                row(1, {
                    kind: 'recipe',
                    status: 'pending',
                    submitted_at: date,
                    queue_priority: 10,
                    recipe_revision_id: id(45),
                    catalog_proposal_revision_id: null,
                    comment_id: null,
                    asset_id: null,
                }),
            ],
            sanctions: [
                row(2, {
                    scope: 'comments',
                    starts_at: date,
                    ends_at: null,
                    revoked_at: null,
                    reason: 'Тестовый пример ограничения',
                    user_id: fixture.users[6]!.id,
                }),
            ],
            subscriptions: [
                row(3, {
                    status: 'active',
                    billing_anchor: date,
                    billing_timezone: 'Europe/Moscow',
                    auto_renew: false,
                    owner_id: fixture.users[2]!.id,
                }),
            ],
            billing_orders: [
                row(4, {
                    status: 'pending',
                    amount_minor: '29900',
                    currency: 'RUB',
                    accepted_at: null,
                    payer_id: fixture.users[2]!.id,
                    recipient_id: fixture.users[2]!.id,
                }),
            ],
            support_tickets: [
                row(5, {
                    subject: 'Не отображается семейный план',
                    public_number: '1001',
                    category: 'technical',
                    status: 'waiting_for_support',
                    closed_at: null,
                    requester_id: fixture.users[6]!.id,
                    assignee_id: null,
                }),
                row(6, {
                    subject: 'Вопрос о подписке',
                    public_number: '1002',
                    category: 'billing',
                    status: 'closed',
                    closed_at: date,
                    requester_id: fixture.users[2]!.id,
                    assignee_id: null,
                }),
            ],
            support_messages: [],
            brand_products: [
                row(7, {
                    name: 'Молоко пастеризованное 2,5%',
                    status: 'active',
                    package_quantity: '1',
                    package_unit_id: id(23),
                    variant_id: id(43),
                    brand_id: null,
                }),
            ],
            announcements: [
                row(8, {
                    kind: 'news',
                    status: 'draft',
                    revision: 1,
                    publish_at: null,
                    author_id: fixture.users[0]!.id,
                }),
            ],
            audit_events: [
                row(9, {
                    action: 'development.fixture',
                    target_type: 'support_tickets',
                    target_id: id(5),
                    recorded_at: date,
                    effective_at: date,
                    request_id: id(10),
                    actor_id: null,
                }),
            ],
            compensation_requests: [
                row(11, {
                    mode: 'preview',
                    status: 'draft',
                    reason: 'Тестовый предварительный просмотр',
                    applied_at: null,
                    requested_by: fixture.users[0]!.id,
                }),
            ],
            legal_requests: [
                row(12, {
                    kind: 'export',
                    status: 'pending',
                    approved_at: null,
                    executed_at: null,
                    user_id: fixture.users[6]!.id,
                    handled_by: null,
                }),
            ],
            background_jobs: [row(13, { kind: 'recipe_import', status: 'failed', run_at: date, lease_until: null })],
            admin_error_events: [
                {
                    id: id(14),
                    version: '1',
                    occurred_at: date,
                    code: 'IMPORT_TIMEOUT',
                    severity: 'warning',
                    source: 'worker',
                    environment: 'development',
                    app_version: '0.0.5',
                    message: 'Тестовый импорт превысил время ожидания',
                    stack_summary: 'ImportWorker.run',
                    request_id: id(10),
                    job_id: id(13),
                },
            ],
            admin_metric_events: [
                {
                    id: id(15),
                    version: '1',
                    occurred_at: date,
                    event_name: 'api.request.duration',
                    metric_value: '124',
                    unit: 'milliseconds',
                    environment: 'development',
                    app_version: '0.0.5',
                    plan_code: null,
                    feature_flag: null,
                },
            ],
            ai_buckets: [
                ...(related.ai_buckets ?? []),
                ...fixture.users
                    .filter((user) => user.plan === 'free')
                    .map((user, index) =>
                        row(80 + index, {
                            user_id: user.id,
                            kind: 'trial',
                            granted: 10,
                            balance_projection: 7,
                            reserved_projection: index % 2,
                            expires_at: '2026-12-31T23:59:59.000Z',
                        }),
                    ),
            ],
            ai_operations: fixture.users
                .filter((user) => user.plan === 'free')
                .map((user, index) =>
                    row(90 + index, {
                        user_id: user.id,
                        task_id: id(100 + index),
                        status: 'completed',
                        cost: 1,
                    }),
                ),
        },
    };
}
