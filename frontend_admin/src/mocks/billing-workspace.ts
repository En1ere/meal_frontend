import type { AdminRow } from './admin-model.js';
import { z } from 'zod';
import { contracts, type Principal } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';
const period = z.object({
    id: z.string(),
    source: z.enum(['paid', 'gift']),
    startsAt: z.string(),
    endsAt: z.string(),
    revoked: z.boolean(),
});
const ledgerSchema = z.object({
    version: z.string(),
    ownerId: z.string(),
    plan: z.string(),
    frozenAt: z.number().nullable(),
    quota: z.number().int().min(0),
    refreshAt: z.string().nullable(),
    periods: z.array(period),
    history: z.array(z.object({ action: z.string(), reason: z.string(), at: z.string() })),
});
type Ledger = z.infer<typeof ledgerSchema>;
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
export function seedBillingFixtures(state: MockState) {
    const orders = (state.admin.tables.billing_orders ??= []);
    if (orders.some((r) => r.fixture_kind === 'billing')) return;
    const sub = state.admin.tables.subscriptions?.[0];
    const owner = state.users.find((u) => u.id === sub?.owner_id);
    if (!sub || !owner) return;
    for (const [i, status] of ['period', 'period-2', 'package'].entries())
        orders.push({
            id: `71000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
            fixture_kind: 'billing',
            status: 'paid',
            amount_minor: '29900',
            currency: 'RUB',
            payer_id: owner.id,
            recipient_id: owner.id,
            subscription_id: String(sub.id),
            target_kind: status === 'package' ? 'package' : 'period',
            target_id: status === 'package' ? '72000000-0000-4000-8000-000000000001' : null,
            package_remaining: status === 'package' ? 27 : null,
            returned_minor: '0',
            reserved_minor: '0',
            created_at: new Date().toISOString(),
            version: '1',
        });
}
function nextBillingMonth(now: number): number {
    const local = new Date(now + 3 * 3600000);
    const day = local.getUTCDate();
    local.setUTCDate(1);
    local.setUTCMonth(local.getUTCMonth() + 1);
    const last = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate();
    local.setUTCDate(Math.min(day, last));
    return local.getTime() - 3 * 3600000;
}
function ledger(state: MockState, ownerId: string, now: number): Ledger {
    const rows = (state.admin.tables.admin_billing_ledgers ??= []);
    const existing = rows.find((r) => r.id === ownerId);
    if (existing) return ledgerSchema.parse(JSON.parse(String(existing.payload)));
    const user = state.users.find((u) => u.id === ownerId)!;
    const paid = user.plan === 'pro' || user.plan === 'plus';
    const result: Ledger = {
        version: '1',
        ownerId,
        plan: user.plan,
        frozenAt: null,
        quota: paid ? (user.plan === 'pro' ? 120 : 40) : 0,
        refreshAt: paid ? new Date(nextBillingMonth(now)).toISOString() : null,
        periods: paid
            ? [
                  {
                      id: crypto.randomUUID(),
                      source: 'paid',
                      startsAt: new Date(now - 86400000).toISOString(),
                      endsAt: new Date(nextBillingMonth(now)).toISOString(),
                      revoked: false,
                  },
              ]
            : [],
        history: [],
    };
    rows.push({ id: ownerId, payload: JSON.stringify(result) });
    return result;
}
function save(state: MockState, data: Ledger) {
    const row = state.admin.tables.admin_billing_ledgers!.find((r) => r.id === data.ownerId)!;
    row.payload = JSON.stringify(data);
}
export function billingHandle(c: Context): Response | null {
    const match = /^\/api\/v1\/admin\/billing\/(users|subscriptions|payments)\/([0-9a-f-]{36})$/i.exec(c.path);
    if (!match) return null;
    if (c.actor.context !== 'admin') return c.fail(403);
    const section = match[1]!;
    const id = match[2]!;
    const tables = c.state.admin.tables;
    const row =
        section === 'users'
            ? c.state.users.find((u) => u.id === id)
            : (tables[section === 'payments' ? 'billing_orders' : 'subscriptions'] ?? []).find((r) => r.id === id);
    if (!row) return c.fail(404);
    const linkedSubscription =
        section === 'payments' && 'subscription_id' in row
            ? tables.subscriptions?.find((s) => s.id === row.subscription_id)
            : undefined;
    const ownerId =
        section === 'users'
            ? id
            : String(
                  linkedSubscription?.owner_id ??
                      ('owner_id' in row ? row.owner_id : 'recipient_id' in row ? row.recipient_id : ''),
              );
    if (!c.state.users.some((u) => u.id === ownerId)) return c.fail(404);
    const data = ledger(c.state, ownerId, c.now);
    const payment = section === 'payments' ? (row as AdminRow) : null;
    if (payment && !payment.target_id)
        payment.target_id = data.periods.find((p) => p.source === 'paid')?.id ?? crypto.randomUUID();
    const targetId = payment ? String(payment.target_id) : null;
    const effectiveAt = data.frozenAt ?? c.now;
    const active = data.periods.some(
        (p) => !p.revoked && Date.parse(p.startsAt) <= effectiveAt && Date.parse(p.endsAt) > effectiveAt,
    );
    if (c.method === 'GET')
        return c.success({
            id,
            version: data.version,
            ownerId,
            payerId: payment ? String(payment.payer_id) : null,
            plan: active ? data.plan : 'free',
            status: !active ? 'inactive' : data.frozenAt === null ? 'active' : 'frozen',
            frozen: data.frozenAt !== null,
            quota: data.quota,
            refreshAt: data.refreshAt,
            periods: data.periods,
            payment: payment
                ? {
                      paidMinor: String(payment.amount_minor ?? '0'),
                      returnedMinor: String(payment.returned_minor ?? '0'),
                      reservedMinor: String(payment.reserved_minor ?? '0'),
                      currency: 'RUB',
                      status: String(payment.status),
                      targetId,
                      targetKind: payment.target_kind === 'package' ? 'package' : 'period',
                      packageRemaining:
                          payment.target_kind === 'package' ? Number(payment.package_remaining ?? 0) : null,
                  }
                : null,
            history: data.history,
            notice: 'Тестовый ledger: периоды и квоты демонстрационные. Реальные платежи, семейные уведомления и PostgreSQL не подключены.',
        });
    if (c.method !== 'POST') return c.fail(404);
    const session = c.state.sessions.find((s) => s.principal.sessionId === c.actor.sessionId && !s.revoked);
    if (!session?.criticalConfirmedUntil || Date.parse(session.criticalConfirmedUntil) <= c.now) return c.fail(403);
    const parsed = contracts['POST /api/v1/admin/billing/{section}/{id}'].request.safeParse(c.body);
    if (!parsed.success) return c.fail(400);
    const input = parsed.data;
    if (input.action === 'refund') return c.fail(503);
    const key = `billing:${c.actor.id}:${input.idempotencyKey}`;
    const digest = JSON.stringify([c.path, input]);
    const previous = c.state.admin.commands[key];
    if (previous) return previous.digest === digest ? c.success(previous.result) : c.fail(409);
    if (data.version !== input.version) return c.fail(409);
    const stamp = new Date(c.now).toISOString();
    if (input.action === 'grant' || input.action === 'extend') {
        if (section === 'payments' || !input.until || Date.parse(input.until) <= c.now || data.frozenAt !== null)
            return c.fail(409);
        const end = Math.max(c.now, ...data.periods.filter((p) => !p.revoked).map((p) => Date.parse(p.endsAt)));
        if (input.action === 'grant' && (section !== 'users' || end > c.now)) return c.fail(409);
        if (input.action === 'extend' && end <= c.now) return c.fail(409);
        if (Date.parse(input.until) <= end) return c.fail(400);
        data.periods.push({
            id: crypto.randomUUID(),
            source: 'gift',
            startsAt: new Date(end).toISOString(),
            endsAt: input.until,
            revoked: false,
        });
        if (input.action === 'grant') {
            data.plan = input.plan;
            data.quota = input.plan === 'pro' ? 120 : 40;
            data.refreshAt = new Date(Math.min(Date.parse(input.until), nextBillingMonth(c.now))).toISOString();
        }
    } else if (input.action === 'revokeGift') {
        if (section === 'payments') return c.fail(400);
        const p = data.periods.find((p) => p.id === input.targetId);
        if (!p || p.source !== 'gift' || p.revoked) return c.fail(409);
        p.revoked = true;
    } else if (input.action === 'freeze') {
        if (
            section === 'payments' ||
            data.frozenAt !== null ||
            !data.periods.some((p) => !p.revoked && Date.parse(p.endsAt) > c.now)
        )
            return c.fail(409);
        data.frozenAt = c.now;
    } else if (input.action === 'unfreeze') {
        if (section === 'payments' || data.frozenAt === null) return c.fail(409);
        const delta = c.now - data.frozenAt;
        for (const p of data.periods) {
            if (!p.revoked && Date.parse(p.endsAt) > data.frozenAt) {
                p.endsAt = new Date(Date.parse(p.endsAt) + delta).toISOString();
                if (Date.parse(p.startsAt) > data.frozenAt)
                    p.startsAt = new Date(Date.parse(p.startsAt) + delta).toISOString();
            }
        }
        if (data.refreshAt) data.refreshAt = new Date(Date.parse(data.refreshAt) + delta).toISOString();
        data.frozenAt = null;
    }
    data.version = String(BigInt(data.version) + 1n);
    data.history.push({ action: input.action, reason: input.reason, at: stamp });
    save(c.state, data);
    (tables.audit_events ??= []).push({
        id: crypto.randomUUID(),
        action: `admin.billing.${input.action}`,
        target_id: id,
        actor_id: c.actor.id,
        reason: input.reason,
        request_id: c.requestId ?? crypto.randomUUID(),
        created_at: stamp,
        recorded_at: stamp,
        effective_at: stamp,
        version: '1',
    });
    const result = { id, version: data.version, status: 'succeeded' };
    c.state.admin.commands[key] = { digest, result };
    return c.success(result);
}

export function effectiveMockPlan(state: MockState, userId: string, now: number): 'free' | 'plus' | 'pro' {
    const own = (id: string): 'free' | 'plus' | 'pro' => {
        const row = state.admin.tables.admin_billing_ledgers?.find((item) => item.id === id);
        if (!row) {
            const plan = state.users.find((user) => user.id === id)?.plan;
            return plan === 'pro' || plan === 'plus' ? plan : 'free';
        }
        const value = ledgerSchema.parse(JSON.parse(String(row.payload)));
        if (
            value.frozenAt !== null ||
            !value.periods.some(
                (period) => !period.revoked && Date.parse(period.startsAt) <= now && Date.parse(period.endsAt) > now,
            )
        )
            return 'free';
        return value.plan === 'pro' || value.plan === 'plus' ? value.plan : 'free';
    };
    const personal = own(userId);
    // Explicit development family fixture: pro1 shares with user1, not a general membership rule.
    const familyOwner = state.users.find((user) => user.login === 'pro1');
    const familyMember = state.users.find((user) => user.login === 'user1');
    return userId === familyMember?.id && familyOwner && own(familyOwner.id) === 'pro' ? 'pro' : personal;
}
