import { contracts, type Principal } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';
import type { AdminRow } from './admin-model.js';
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
export function governanceHandle(c: Context): Response | null {
    const match = /^\/api\/v1\/admin\/governance\/(users|sanctions|access)\/([0-9a-f-]{36})$/i.exec(c.path);
    if (!match) return null;
    if (c.actor.context !== 'admin') return c.fail(403);
    const { state, now } = c;
    const tables = state.admin.tables;
    const section = match[1]!;
    const id = match[2]!;
    const sanctions = (tables.sanctions ??= []);
    const roles = (tables.staff_role_assignments ??= []);
    const row =
        section === 'sanctions'
            ? sanctions.find((r) => r.id === id)
            : section === 'access'
              ? (roles.find((r) => r.id === id) ??
                roles.find((r) => r.user_id === id && !r.revoked_at) ??
                roles.find((r) => r.user_id === id))
              : state.users.find((u) => u.id === id);
    if (!row) return c.fail(404);
    const userId = section === 'users' ? id : String('user_id' in row ? row.user_id : '');
    const user = state.users.find((u) => u.id === userId);
    if (!user) return c.fail(404);
    const roleRow = roles.find((r) => r.user_id === userId && !r.revoked_at);
    const soleAdmin = user.role === 'admin' && state.users.filter((u) => u.role === 'admin' && u.active).length === 1;
    const userVersions = (tables.admin_user_versions ??= []);
    let versionRow = userVersions.find((r) => r.id === userId);
    if (!versionRow) {
        versionRow = { id: userId, version: '1' };
        userVersions.push(versionRow);
    }
    const target = section === 'users' ? versionRow : (row as AdminRow);
    const ownedPlus = (tables.subscriptions ?? []).find(
        (subscription) =>
            subscription.owner_id === userId &&
            subscription.status === 'active' &&
            (tables.family_coverages ?? []).some((item) => item.subscription_id === subscription.id),
    );
    const coverage = ownedPlus
        ? ((tables.family_coverages ?? []).find(
              (item) => item.subscription_id === ownedPlus.id && item.selected_at && !item.ends_at,
          ) ?? (tables.family_coverages ?? []).find((item) => item.subscription_id === ownedPlus.id))
        : undefined;
    const family = coverage ? (tables.families ?? []).find((item) => item.id === coverage.family_id) : undefined;
    const candidates = family
        ? (tables.family_memberships ?? [])
              .filter(
                  (membership) =>
                      membership.family_id === family.id && membership.user_id !== userId && !membership.left_at,
              )
              .flatMap((membership) => {
                  const candidate = state.users.find((item) => item.id === membership.user_id);
                  return candidate
                      ? [{ userId: candidate.id, displayName: candidate.name, login: candidate.login }]
                      : [];
              })
        : [];
    const status =
        section === 'sanctions'
            ? target.revoked_at
                ? 'revoked'
                : Date.parse(String(target.starts_at)) > now
                  ? 'scheduled'
                  : target.ends_at && Date.parse(String(target.ends_at)) <= now
                    ? 'expired'
                    : 'active'
            : (user.role ?? 'user');
    if (c.method === 'GET')
        return c.success({
            id,
            version: String(target.version ?? '1'),
            userId,
            name: user.name,
            role: user.role,
            soleAdmin,
            scope: section === 'sanctions' ? String(target.scope) : null,
            endsAt: section === 'sanctions' && target.ends_at ? String(target.ends_at) : null,
            status,
            appeals:
                section === 'sanctions'
                    ? (tables.appeals ?? [])
                          .filter((a) => a.sanction_id === id)
                          .map((a) => ({
                              id: String(a.id),
                              version: String(a.version ?? '1'),
                              body: String(a.body),
                              status: String(a.status),
                              response: a.response == null ? null : String(a.response),
                              submittedAt: String(a.submitted_at),
                              resolvedAt: a.resolved_at == null ? null : String(a.resolved_at),
                          }))
                    : [],
            history: (tables.admin_governance_history ?? [])
                .filter((h) => h.user_id === userId)
                .map((h) => ({ action: String(h.action), reason: String(h.reason), at: String(h.created_at) })),
            familySubscription:
                ownedPlus && family
                    ? {
                          subscriptionId: String(ownedPlus.id),
                          familyId: String(family.id),
                          familyName: String(family.name),
                          candidates,
                      }
                    : null,
        });
    if (c.method !== 'POST') return c.fail(404);
    const session = state.sessions.find((s) => s.principal.sessionId === c.actor.sessionId && !s.revoked);
    if (!session?.criticalConfirmedUntil || Date.parse(session.criticalConfirmedUntil) <= now) return c.fail(403);
    const parsed = contracts['POST /api/v1/admin/governance/{section}/{id}'].request.safeParse(c.body);
    if (!parsed.success) return c.fail(400);
    const input = parsed.data;
    const key = `governance:${c.actor.id}:${input.idempotencyKey}`;
    const digest = JSON.stringify([c.path, input]);
    const previous = state.admin.commands[key];
    if (previous) return previous.digest === digest ? c.success(previous.result) : c.fail(409);
    if (String(target.version ?? '1') !== input.version) return c.fail(409);
    const stamp = new Date(now).toISOString();
    let resultId = id;
    if (input.action === 'ban') {
        if (section !== 'users' || !input.category) return c.fail(400);
        if (soleAdmin) return c.fail(409);
        const starts = input.startsAt ?? stamp;
        if (input.endsAt && Date.parse(input.endsAt) <= Math.max(Date.parse(starts), now)) return c.fail(400);
        resultId = crypto.randomUUID();
        sanctions.push({
            id: resultId,
            user_id: userId,
            scope: input.scope,
            category: input.category,
            reason: input.reason,
            private_note: input.privateNote,
            starts_at: starts,
            ends_at: input.endsAt,
            revoked_at: null,
            created_at: stamp,
            version: '1',
        });
        if (input.scope === 'account' && Date.parse(starts) <= now) {
            for (const sub of tables.subscriptions ?? []) if (sub.owner_id === userId) sub.auto_renew = false;
            if (input.subscriptionDisposition === 'transfer') {
                if (
                    !ownedPlus ||
                    !family ||
                    !candidates.some((candidate) => candidate.userId === input.subscriptionRecipientUserId)
                )
                    return c.fail(409);
                ownedPlus.owner_id = input.subscriptionRecipientUserId;
                ownedPlus.version = String(BigInt(String(ownedPlus.version ?? '1')) + 1n);
            }
            if (family)
                for (const membership of (tables.family_memberships ?? []).filter(
                    (item) => item.family_id === family.id && !item.left_at,
                ))
                    (tables.notifications ??= []).push({
                        id: crypto.randomUUID(),
                        category: 'family',
                        priority: 'important',
                        payload_minimized: JSON.stringify({
                            type: 'family-subscription-owner-banned',
                            familyId: family.id,
                            transferred: input.subscriptionDisposition === 'transfer',
                        }),
                        dedup_key: `family-ban:${resultId}:${membership.user_id}`,
                        available_at: stamp,
                        read_at: null,
                        fullscreen_seen_at: null,
                        user_id: String(membership.user_id),
                        created_at: stamp,
                        version: '1',
                    });
            sanctions.at(-1)!.activation_effect_at = stamp;
        }
    } else if (input.action === 'revoke' || input.action === 'extend') {
        if (section !== 'sanctions' || status === 'revoked' || status === 'expired') return c.fail(409);
        if (input.action === 'revoke') target.revoked_at = stamp;
        else {
            if (target.ends_at === null) return c.fail(409);
            if (input.endsAt && Date.parse(input.endsAt) <= Math.max(Date.parse(String(target.ends_at)), now))
                return c.fail(400);
            target.ends_at = input.endsAt;
        }
    } else if (input.action === 'acceptAppeal' || input.action === 'rejectAppeal') {
        if (section !== 'sanctions' || !input.appealId || !input.appealVersion) return c.fail(400);
        const appeal = (tables.appeals ?? []).find((a) => a.id === input.appealId && a.sanction_id === id);
        if (!appeal) return c.fail(404);
        if (appeal.status !== 'pending' || String(appeal.version ?? '1') !== input.appealVersion) return c.fail(409);
        appeal.status = input.action === 'acceptAppeal' ? 'accepted' : 'rejected';
        appeal.response = input.reason;
        appeal.resolved_at = stamp;
        appeal.resolved_by = c.actor.id;
        appeal.version = String(BigInt(String(appeal.version ?? '1')) + 1n);
        if (input.action === 'acceptAppeal' && !target.revoked_at) target.revoked_at = stamp;
    } else if (input.action === 'grantModerator') {
        if (section !== 'users' || user.role === 'admin') return c.fail(409);
        user.role = 'moderator';
        if (roleRow) {
            roleRow.role = 'moderator';
            roleRow.allow_temporary_ban = input.allowTemporaryBan;
            roleRow.version = String(BigInt(String(roleRow.version ?? '1')) + 1n);
        } else
            roles.push({
                id: crypto.randomUUID(),
                user_id: userId,
                role: 'moderator',
                allow_temporary_ban: input.allowTemporaryBan,
                assigned_by: c.actor.id,
                assigned_at: stamp,
                revoked_at: null,
                created_at: stamp,
                version: '1',
            });
        for (const s of state.sessions)
            if (s.principal.id === userId && s.principal.context !== 'user') s.revoked = true;
    } else {
        if (section !== 'access' || soleAdmin) return c.fail(409);
        if (target.revoked_at) return c.fail(409);
        target.revoked_at = stamp;
        user.role = null;
        for (const s of state.sessions)
            if (s.principal.id === userId && s.principal.context !== 'user') s.revoked = true;
    }
    target.version = String(BigInt(String(target.version ?? '1')) + 1n);
    if (target !== versionRow) versionRow.version = String(BigInt(String(versionRow.version)) + 1n);
    (tables.admin_governance_history ??= []).push({
        id: crypto.randomUUID(),
        user_id: userId,
        action: input.action,
        reason: input.reason,
        created_at: stamp,
    });
    (tables.audit_events ??= []).push({
        id: crypto.randomUUID(),
        action: `admin.${input.action}`,
        target_id: resultId,
        actor_id: c.actor.id,
        reason: input.reason,
        request_id: c.requestId ?? crypto.randomUUID(),
        recorded_at: stamp,
        effective_at: stamp,
        created_at: stamp,
        version: '1',
    });
    const result = { id: resultId, version: String(target.version) };
    state.admin.commands[key] = { digest, result };
    return c.success(result);
}

// Idempotent mock activation effects; no delivery or live database work.
export function applyScheduledGovernanceEffects(state: MockState, now: number) {
    for (const sanction of state.admin.tables.sanctions ?? []) {
        if (
            sanction.scope !== 'account' ||
            sanction.revoked_at ||
            sanction.activation_effect_at ||
            Date.parse(String(sanction.starts_at)) > now ||
            (sanction.ends_at && Date.parse(String(sanction.ends_at)) <= now)
        )
            continue;
        for (const subscription of state.admin.tables.subscriptions ?? [])
            if (subscription.owner_id === sanction.user_id) subscription.auto_renew = false;
        sanction.activation_effect_at = new Date(now).toISOString();
    }
}
