import { verifySync } from 'otplib';
import { z } from 'zod';
import { contracts } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';

const deletionSchema = contracts['POST /api/v1/account/deletion'].success.shape.data;
const mockDeletionSchema = deletionSchema;
type LifecycleBlocker = z.infer<typeof deletionSchema>['blockers'][number];

export const accountLifecycleStateSchema = z.object({
    accounts: z.record(
        z.string(),
        z.object({
            archived: z.boolean(),
            deletion: mockDeletionSchema.nullable(),
        }),
    ),
    reauth: z.array(
        z.object({
            token: z.string(),
            userId: z.uuid(),
            purpose: z.enum(['export', 'account_lifecycle']),
            expiresAt: z.number(),
            used: z.boolean(),
        }),
    ),
    replay: z.record(z.string(), z.object({ input: z.string(), result: z.unknown() })),
    riskHeld: z.array(z.uuid()),
});

export type AccountLifecycleState = z.infer<typeof accountLifecycleStateSchema>;
export const createAccountLifecycleState = (): AccountLifecycleState => ({
    accounts: {},
    reauth: [],
    replay: {},
    riskHeld: ['10000000-0000-4000-8000-000000000008'],
});

const token = () =>
    btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replaceAll('=', '');

function account(state: MockState, userId: string) {
    return (state.accountLifecycle.accounts[userId] ??= { archived: false, deletion: null });
}

function currentBlockers(state: MockState, userId: string, policyConfigured = false) {
    const blockers: LifecycleBlocker[] = [];
    const family = state.family.families.find(
        (item) => !item.archived && item.members.some((member) => member.userId === userId && member.leftAt === null),
    );
    if (family?.ownerId === userId)
        blockers.push({
            code: 'family_owner',
            message: 'Передайте владение семьёй другому участнику.',
            blocksFinalization: true,
        });
    const subscription = state.subscription.records.find((item) => item.userId === userId);
    const user = state.users.find((item) => item.id === userId);
    if ((subscription && subscription.plan !== 'free') || (!subscription && user?.plan !== 'free'))
        blockers.push({
            code: 'active_subscription',
            message: 'Сначала завершите активную личную подписку.',
            blocksFinalization: true,
        });
    if (!policyConfigured)
        blockers.push({
            code: 'retention_policy_unconfigured',
            message: 'Юридический срок хранения ещё не опубликован.',
            blocksFinalization: true,
        });
    return blockers;
}

function hasReadyExport(state: MockState, userId: string, now: number) {
    return state.exports.jobs.some(
        ({ userId: ownerId, job }) =>
            ownerId === userId && job.status === 'ready' && !!job.expiresAt && Date.parse(job.expiresAt) > now,
    );
}

function verifyFactor(
    state: MockState,
    userId: string,
    factor: { method: 'totp' | 'recovery'; code: string } | null,
    now: number,
) {
    const stored = state.factors.find((item) => item.userId === userId && item.verified && !item.revoked);
    if (!stored) return factor === null;
    if (!factor) return false;
    if (factor.method === 'recovery') {
        const index = stored.recoveryCodes.indexOf(factor.code);
        if (index < 0) return false;
        stored.recoveryCodes.splice(index, 1);
        return true;
    }
    if (!/^\d{6}$/.test(factor.code)) return false;
    const checked = verifySync({
        strategy: 'totp',
        secret: stored.secret,
        token: factor.code,
        digits: 6,
        period: 30,
        epoch: Math.floor(now / 1000),
        epochTolerance: 30,
    });
    if (!checked.valid || !('timeStep' in checked) || checked.timeStep <= stored.lastStep) return false;
    stored.lastStep = checked.timeStep;
    return true;
}

export function consumeCriticalReauth(
    state: MockState,
    userId: string,
    value: string,
    purpose: 'export' | 'account_lifecycle',
    now: number,
) {
    const row = state.accountLifecycle.reauth.find(
        (item) =>
            item.token === value &&
            item.userId === userId &&
            item.purpose === purpose &&
            !item.used &&
            item.expiresAt > now,
    );
    if (!row) return false;
    row.used = true;
    return true;
}

export function restoreMockArchivedAccount(state: MockState, userId: string) {
    const value = state.accountLifecycle.accounts[userId];
    if (value?.archived) value.archived = false;
}

export function accountLifecycleHandle(c: {
    state: MockState;
    userId: string | null;
    path: string;
    method: string;
    input: unknown;
    now: number;
    passwordHash: string | undefined;
    fixtureHash: string;
    success: (data: unknown) => Response;
    fail: (status: number, code?: string) => Response;
}): Response | null {
    const { state, userId, path, method, input, now, passwordHash, fixtureHash, success, fail } = c;
    if (!path.startsWith('/api/v1/account/')) return null;
    if (!userId) return fail(401);
    const value = account(state, userId);
    if (path === '/api/v1/account/critical-reauth' && method === 'POST') {
        const parsed = contracts['POST /api/v1/account/critical-reauth'].request.safeParse(input);
        if (!parsed.success) return fail(400);
        if (state.accountLifecycle.riskHeld.includes(userId)) return fail(403, 'RISK_HELD');
        if (passwordHash !== (state.account.passwords[userId] ?? fixtureHash)) return fail(401, 'REAUTH_FAILED');
        if (!verifyFactor(state, userId, parsed.data.factor, now)) return fail(401, 'REAUTH_FAILED');
        const reauthToken = token();
        const expiresAt = now + 10 * 60_000;
        state.accountLifecycle.reauth.push({
            token: reauthToken,
            userId,
            purpose: parsed.data.purpose,
            expiresAt,
            used: false,
        });
        return success({ reauthToken, purpose: parsed.data.purpose, expiresAt: new Date(expiresAt).toISOString() });
    }
    if (path === '/api/v1/account/lifecycle' && method === 'GET')
        return success({ archived: value.archived, deletion: value.deletion });
    if (path === '/api/v1/account/deletion/preview' && method === 'GET') {
        const blockers = currentBlockers(state, userId);
        return success({
            canRequest: true,
            canFinalize: blockers.every((item) => !item.blocksFinalization),
            blockers,
            policyVersion: null,
            finalizationNotBefore: null,
        });
    }
    if (path === '/api/v1/account/archive' && method === 'POST') {
        const parsed = contracts['POST /api/v1/account/archive'].request.safeParse(input);
        if (!parsed.success) return fail(400);
        const key = `${userId}:archive:${parsed.data.idempotencyKey}`;
        const signature = JSON.stringify(parsed.data);
        const replay = state.accountLifecycle.replay[key];
        if (replay) return replay.input === signature ? success(replay.result) : fail(409);
        if (!consumeCriticalReauth(state, userId, parsed.data.reauthToken, 'account_lifecycle', now))
            return fail(401, 'REAUTH_EXPIRED');
        value.archived = true;
        state.sessions.filter((item) => item.principal.id === userId).forEach((item) => (item.revoked = true));
        const result = { archived: true as const };
        state.accountLifecycle.replay[key] = { input: signature, result };
        return success(result);
    }
    if (path === '/api/v1/account/deletion' && method === 'POST') {
        const parsed = contracts['POST /api/v1/account/deletion'].request.safeParse(input);
        if (!parsed.success) return fail(400);
        const key = `${userId}:deletion:${parsed.data.idempotencyKey}`;
        const signature = JSON.stringify(parsed.data);
        const replay = state.accountLifecycle.replay[key];
        if (replay) return replay.input === signature ? success(replay.result) : fail(409);
        if (!consumeCriticalReauth(state, userId, parsed.data.reauthToken, 'account_lifecycle', now))
            return fail(401, 'REAUTH_EXPIRED');
        const blockers = currentBlockers(state, userId);
        const deletion = mockDeletionSchema.parse({
            id: crypto.randomUUID(),
            status: blockers.some((item) => item.code === 'family_owner' || item.code === 'active_subscription')
                ? 'blocked'
                : 'requested',
            requestedAt: new Date(now).toISOString(),
            cancelUntil: null,
            finalizationNotBefore: null,
            cancelledAt: null,
            finalizedAt: null,
            policyVersion: null,
            blockers,
            version: 1,
        });
        value.deletion = deletion;
        state.accountLifecycle.replay[key] = { input: signature, result: deletion };
        return success(deletion);
    }
    if (path === '/api/v1/account/deletion/cancel' && method === 'POST') {
        const parsed = contracts['POST /api/v1/account/deletion/cancel'].request.safeParse(input);
        if (!parsed.success) return fail(400);
        if (!value.deletion || value.deletion.version !== parsed.data.expectedVersion) return fail(412);
        if (!consumeCriticalReauth(state, userId, parsed.data.reauthToken, 'account_lifecycle', now))
            return fail(401, 'REAUTH_EXPIRED');
        if (['cancelled', 'finalized', 'rejected'].includes(value.deletion.status)) return fail(409);
        value.deletion = mockDeletionSchema.parse({
            ...value.deletion,
            status: 'cancelled',
            cancelledAt: new Date(now).toISOString(),
            version: value.deletion.version + 1,
        });
        return success(value.deletion);
    }
    if (path === '/api/v1/account/deletion/finalize' && method === 'POST') {
        const parsed = contracts['POST /api/v1/account/deletion/finalize'].request.safeParse(input);
        if (!parsed.success) return fail(400);
        if (!value.deletion || value.deletion.version !== parsed.data.expectedVersion) return fail(412);
        if (!consumeCriticalReauth(state, userId, parsed.data.reauthToken, 'account_lifecycle', now))
            return fail(401, 'REAUTH_EXPIRED');
        const blockers = currentBlockers(state, userId, value.deletion.policyVersion !== null);
        if (!value.deletion.finalizationNotBefore)
            blockers.push({
                code: 'admin_approval_required',
                message: 'Требуется отдельное административное подтверждение.',
                blocksFinalization: true,
            });
        else if (Date.parse(value.deletion.finalizationNotBefore) > now)
            blockers.push({
                code: 'retention_wait',
                message: 'Защитный срок отмены ещё не завершён.',
                blocksFinalization: true,
            });
        if (!hasReadyExport(state, userId, now))
            blockers.push({
                code: 'export_not_ready',
                message: 'Перед окончательным удалением подготовьте новый экспорт данных.',
                blocksFinalization: true,
            });
        if (blockers.some((item) => item.blocksFinalization)) {
            value.deletion = mockDeletionSchema.parse({
                ...value.deletion,
                status: 'blocked',
                blockers,
                version: value.deletion.version + 1,
            });
            return success(value.deletion);
        }
        value.deletion = mockDeletionSchema.parse({
            ...value.deletion,
            status: 'finalized',
            finalizedAt: new Date(now).toISOString(),
            blockers,
            version: value.deletion.version + 1,
        });
        state.sessions.filter((item) => item.principal.id === userId).forEach((item) => (item.revoked = true));
        const user = state.users.find((item) => item.id === userId);
        if (user) user.active = false;
        return success(value.deletion);
    }
    return null;
}
