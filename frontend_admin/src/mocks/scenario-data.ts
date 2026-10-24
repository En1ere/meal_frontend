import type { AdminState, AdminRow } from './admin-model.js';

const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = '2026-09-28T08:00:00.000Z';
// Synthetic records only. Existing authored records are never overwritten on startup.
export function enrichAdminFixtures(state: AdminState): void {
    if (state.tables.fixture_revision?.some((row) => row.id === 'expanded-v1')) return;
    const add = (table: string, n: number, source: AdminRow, changes: AdminRow) => {
        const rows = (state.tables[table] ??= []);
        if (!rows.some((row) => row.id === id(n)))
            rows.push({ ...source, id: id(n), created_at: at, version: '1', ...changes });
    };
    const first = (table: string): AdminRow => state.tables[table]?.[0] ?? {};
    for (const [index, status] of ['queued', 'running', 'succeeded', 'cancelled'].entries())
        add('background_jobs', 10 + index, first('background_jobs'), {
            kind: 'recipe_import',
            status,
            run_at: at,
            lease_until: status === 'running' ? '2099-01-01T00:00:00Z' : null,
        });
    add('background_jobs', 15, first('background_jobs'), { kind: 'payment_reconciliation', status: 'failed' });
    for (const [index, status] of ['open', 'waiting_for_user'].entries())
        add('support_tickets', 20 + index, first('support_tickets'), {
            status,
            subject: index ? 'Как исправить рецепт?' : 'Скринкаст ошибки загрузки',
            public_number: String(1010 + index),
            assignee_id: null,
        });
    for (const [index, status] of ['succeeded', 'failed'].entries()) {
        add('billing_orders', 30 + index, first('billing_orders'), {
            status: status === 'succeeded' ? 'paid' : status,
            amount_minor: index ? '59900' : '29900',
        });
        add('payment_attempts', 40 + index, first('payment_attempts'), {
            status,
            order_id: id(30 + index),
            external_id: `mock-payment-${index}`,
            idempotency_key: `fixture-payment-${index}`,
        });
    }
    add(
        'payment_refunds',
        50,
        {},
        {
            attempt_id: id(40),
            requested_by: first('staff_role_assignments').user_id ?? null,
            status: 'succeeded',
            amount_minor: '9900',
            reason: 'Тест частичной компенсации',
            provider_ref: 'mock-refund',
        },
    );
    add('sanctions', 60, first('sanctions'), {
        starts_at: '2099-01-01T00:00:00Z',
        ends_at: null,
        reason: 'Пример запланированного ограничения',
    });
    add('sanctions', 61, first('sanctions'), {
        starts_at: '2025-01-01T00:00:00Z',
        ends_at: '2025-01-02T00:00:00Z',
        reason: 'Завершённое ограничение',
    });
    add('sanctions', 62, first('sanctions'), { revoked_at: at, reason: 'Ограничение отменено после апелляции' });
    add('legal_requests', 70, first('legal_requests'), {
        kind: 'account_deletion',
        status: 'blocked',
        approved_at: null,
        executed_at: null,
    });
    add('legal_requests', 71, first('legal_requests'), {
        kind: 'export',
        status: 'completed',
        approved_at: at,
        executed_at: at,
    });
    add('compensation_requests', 80, first('compensation_requests'), {
        status: 'partial',
        reason: 'Пример: поздняя правка требует ручного решения',
        applied_at: at,
    });
    add('admin_error_events', 90, first('admin_error_events'), {
        code: 'PROVIDER_UNAVAILABLE',
        severity: 'error',
        message: 'Тестовый провайдер недоступен',
        source: 'api',
        job_id: null,
    });
    add('admin_metric_events', 91, first('admin_metric_events'), {
        event_name: 'recipe.published',
        metric_value: '1',
        unit: 'count',
        plan_code: 'pro',
    });
    add('admin_metric_events', 92, first('admin_metric_events'), {
        event_name: 'api.request.duration',
        metric_value: '0',
        unit: 'milliseconds',
        plan_code: 'free',
    });
    const ownerId = String(first('subscriptions').owner_id ?? first('users').id ?? id(100));
    const familyId = id(100);
    const membershipId = id(101);
    add(
        'families',
        100,
        {},
        {
            name: 'Дом Plus',
            status: 'active',
            archived_at: null,
            owner_membership_id: membershipId,
        },
    );
    add(
        'family_memberships',
        101,
        {},
        {
            family_id: familyId,
            user_id: ownerId,
            role: 'owner',
            joined_at: at,
            left_at: null,
            stable_order: '1',
        },
    );
    add(
        'family_coverages',
        102,
        {},
        {
            family_id: familyId,
            subscription_id: first('subscriptions').id ?? null,
            reason: 'selected',
            starts_at: at,
            ends_at: '2027-01-01T00:00:00.000Z',
            selected_at: at,
        },
    );
    state.tables.fixture_revision = [{ id: 'expanded-v1' }];
}
