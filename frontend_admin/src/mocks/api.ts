import { generateSecret, generateURI, verifySync } from 'otplib';
import { HttpResponse } from 'msw';
import { mockDigest } from './account-model.js';
import { accountHandle, completeEmailChanges } from './account-api.js';
import { adminHandle } from './admin-api.js';
import { recipePolicyHandle } from './recipe-policy.js';
import { supportHandle } from './support-workspace.js';
import { notificationCenterHandle } from './notification-center.js';
import { matchContract } from './route-match.js';
import { newsWorkspaceCommand, NewsMockError } from './news-workspace.js';
import { governanceHandle, applyScheduledGovernanceEffects } from './governance.js';
import { operationsWorkspaceCommand, OperationsMockError } from './operations-workspace.js';
import { contentWorkspaceCommand, ContentMockError } from './content-workspace.js';
import type { ContentCommand } from '../features/content/contracts.js';
import { billingHandle, effectiveMockPlan } from './billing-workspace.js';
import { reviewWorkspaceCommand, ReviewMockError } from './review-workspace.js';
import { freeAiHandle } from './free-ai.js';
import type { ReviewCommand } from '../features/review/contracts.js';
import { adminUnlocked, adminCriticalUntil, adminVerifyCode } from './admin-auth.js';
import { contracts, type Principal } from '../shared/api/contracts.generated.js';
import { allergensHandle } from './allergens.js';
import { releaseCommandSchema } from '../features/releases/contracts.js';
import { releaseWorkspaceCommand, ReleaseMockError } from './release-workspace.js';
import { releaseApi } from './release-api.js';
import { accountDeletionReviewHandle } from './account-deletion-review.js';
import {
    fixturePassword,
    fixtureUserIds,
    type MockState,
    type MockUser,
    type Repository,
    type Kind,
    type Context,
    type Session,
} from './model.js';

const messages: Record<number, [string, string]> = {
    400: ['INVALID_REQUEST', 'Некорректный запрос'],
    401: ['UNAUTHORIZED', 'Требуется вход или проверка данных'],
    403: ['FORBIDDEN', 'Доступ запрещён'],
    404: ['NOT_FOUND', 'Ресурс не найден'],
    409: ['CONFLICT', 'Состояние изменилось. Обновите данные'],
    412: ['PRECONDITION_FAILED', 'Запись изменилась. Обновите данные'],
    413: ['PAYLOAD_TOO_LARGE', 'Запрос слишком большой'],
    415: ['UNSUPPORTED_MEDIA_TYPE', 'Неподдерживаемый формат запроса'],
    429: ['RATE_LIMITED', 'Слишком много запросов. Попробуйте позже'],
    503: ['UNAVAILABLE', 'Сервис временно недоступен'],
    500: ['INTERNAL_ERROR', 'Внутренняя ошибка сервиса'],
};
const token = () =>
    btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replaceAll('=', '');
const recoveryCode = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) => n.toString(16).padStart(2, '0')).join('');
function readCookies(header: string | null): Record<string, string> {
    return Object.fromEntries(
        (header ?? '')
            .split(';')
            .map((entry) => entry.trim().split(/=(.*)/s))
            .filter((pair): pair is [string, string] => pair.length >= 2 && !!pair[0] && pair[1] !== undefined),
    );
}
function bump(state: MockState, key: string, now: number, max: number) {
    const old = state.limits[key];
    const current = !old || old.started < now - 60000 ? { started: now, attempts: 0 } : old;
    current.attempts = Math.min(current.attempts + 1, 1000000);
    state.limits[key] = current;
    return current.attempts <= max;
}
export interface MockOptions {
    origin: string;
    adminOnly?: boolean;
    now?: () => number;
    ready?: () => boolean;
    rateLimit?: number;
}

export class MockApi {
    private readonly fixtureHash = mockDigest(fixturePassword);
    private readonly now: () => number;
    private readonly ready: () => boolean;
    constructor(
        private readonly repository: Repository,
        private readonly options: MockOptions,
    ) {
        this.now = options.now ?? Date.now;
        this.ready = options.ready ?? (() => true);
        if (new URL(options.origin).origin !== options.origin) throw new Error('Mock origin must be an exact origin');
    }
    async handle(
        request: Request,
        suppliedCookies?: Record<string, string>,
        browserOrigin?: string,
    ): Promise<Response> {
        const requestId = crypto.randomUUID();
        let scenarioMode = 'normal';
        const headers = new Headers({
            'x-request-id': requestId,
            'cache-control': 'no-store',
            'content-type': 'application/json',
        });
        const fail = (status: number, customCode?: string) => {
            const [defaultCode, defaultMessage] = messages[status] ?? messages[500]!;
            const code = customCode ?? defaultCode;
            const message =
                code === 'ADMIN_CONFIRMATION_REQUIRED'
                    ? 'Подтвердите критичное действие кодом'
                    : code === 'ADMIN_LOCKED'
                      ? 'Подтвердите вход кодом'
                      : defaultMessage;
            return new HttpResponse(JSON.stringify({ error: { code, message, details: null }, meta: { requestId } }), {
                status,
                headers,
            });
        };
        const success = (data: unknown) => {
            if (scenarioMode === 'empty' && data && typeof data === 'object') {
                data = Object.fromEntries(
                    Object.entries(data).map(([key, value]) => [
                        key,
                        ['items', 'messages', 'attachments', 'cards', 'history'].includes(key) && Array.isArray(value)
                            ? []
                            : value,
                    ]),
                );
            }
            return new HttpResponse(JSON.stringify({ data, meta: { requestId } }), { status: 200, headers });
        };
        const wirePath = new URL(request.url).pathname;
        const isAdminAuth = wirePath.startsWith('/api/v1/admin/auth/');
        const isAdminDomain = wirePath.startsWith('/api/v1/admin/') && !isAdminAuth;
        if (
            (isAdminAuth || isAdminDomain) &&
            request.headers.get('origin') &&
            request.headers.get('origin') !== this.options.origin
        )
            return fail(403);
        if (this.options.adminOnly && !isAdminAuth && !isAdminDomain) return fail(404);
        const path = isAdminAuth
            ? wirePath.replace('/api/v1/admin/auth/', '/api/v1/staff/auth/').replace('/staff/auth/csrf', '/auth/csrf')
            : wirePath;
        if (
            this.options.adminOnly &&
            !isAdminDomain &&
            ![
                'GET /api/v1/auth/csrf',
                'POST /api/v1/staff/auth/login',
                'POST /api/v1/staff/auth/mfa/verify',
                'GET /api/v1/staff/auth/me',
                'GET /api/v1/staff/auth/sessions',
                'POST /api/v1/staff/auth/sessions/revoke-others',
                'POST /api/v1/staff/auth/logout',
                'GET /api/v1/staff/auth/status',
                'POST /api/v1/staff/auth/unlock',
                'POST /api/v1/staff/auth/critical-confirm',
            ].includes(`${request.method} ${path}`)
        )
            return fail(404);
        const authorMatch = /^\/api\/v1\/authors\/([^/]+)$/.exec(path);
        const releaseWorkspaceRoute = wirePath === '/api/v1/admin/content-releases/workspace';
        const releaseCanonicalRoute =
            wirePath === '/api/v1/admin/content-releases' || wirePath.startsWith('/api/v1/admin/content-releases/');
        const matched = matchContract(request.method, wirePath);
        if (!matched && !releaseWorkspaceRoute && !releaseCanonicalRoute) return fail(404);
        const operation = matched
            ? contracts[matched.key]
            : {
                  request: releaseWorkspaceRoute && request.method === 'POST' ? releaseCommandSchema : undefined,
                  params: undefined,
              };
        const cookies = { ...(suppliedCookies ?? readCookies(request.headers.get('cookie'))) };
        if (isAdminAuth || isAdminDomain) {
            cookies.meal_staff = cookies.meal_admin ?? '';
            cookies.meal_csrf = cookies.meal_admin_csrf ?? '';
            delete cookies.meal_user;
        }
        const bodyText = !['GET', 'HEAD', 'OPTIONS'].includes(request.method) ? await request.text() : '';
        if (new TextEncoder().encode(bodyText).length > 65536) return fail(413);
        let body: unknown;
        if (bodyText) {
            if (!request.headers.get('content-type')?.startsWith('application/json')) return fail(415);
            try {
                body = JSON.parse(bodyText);
            } catch {
                return fail(400);
            }
        }
        if (
            body &&
            typeof body === 'object' &&
            !Array.isArray(body) &&
            path !== '/api/v1/auth/login' &&
            !path.startsWith('/api/v1/staff/')
        ) {
            const normalized: Record<string, unknown> = { ...body };
            for (const name of ['email', 'username', 'displayName']) {
                const value = normalized[name];
                if (typeof value === 'string')
                    normalized[name] = name === 'displayName' ? value.trim() : value.trim().toLowerCase();
            }
            body = normalized;
        }
        const secretInputs: Record<string, string> = {};
        if (body && typeof body === 'object' && !Array.isArray(body)) {
            for (const name of ['password', 'currentPassword', 'newPassword', 'pin']) {
                const value: unknown = Reflect.get(body, name);
                if (typeof value === 'string') secretInputs[name] = await mockDigest(value);
            }
        }
        const fixtureHash = await this.fixtureHash;
        try {
            return await this.repository.transaction((state) => {
                const now = this.now();
                // Single-browser model of the edge limit; no claim to emulate actual proxy/client IPs.
                if (!bump(state, 'edge', now, 200)) return fail(429);
                if (path === '/health/live') return success({ status: 'ok' });
                if (path === '/health/ready') return this.ready() ? success({ status: 'ok' }) : fail(503);
                if (
                    !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
                    ((request.headers.get('origin') ?? browserOrigin) !== this.options.origin ||
                        request.headers.get('sec-fetch-site') === 'cross-site' ||
                        !cookies.meal_csrf ||
                        !/^[A-Za-z0-9_-]{43}$/.test(cookies.meal_csrf) ||
                        !Object.hasOwn(state.csrf, cookies.meal_csrf) ||
                        !state.csrf[cookies.meal_csrf] ||
                        state.csrf[cookies.meal_csrf] !== request.headers.get('x-csrf-token'))
                )
                    return fail(403);
                const parsed = operation.request?.safeParse(body);
                if (parsed && !parsed.success) return fail(400);
                const cookie = (name: string, value: string, expires?: string) => {
                    if (isAdminAuth || isAdminDomain) {
                        if (name === 'meal_staff') name = 'meal_admin';
                        if (name === 'meal_csrf') name = 'meal_admin_csrf';
                    }
                    // MSW browser cookies are a simulation: JS cannot issue real HttpOnly cookies.
                    headers.append(
                        'set-cookie',
                        `${name}=${value}; Path=/; SameSite=Lax${expires ? `; Expires=${new Date(expires).toUTCString()}` : ''}`,
                    );
                };
                if (path === '/api/v1/auth/csrf') {
                    let nonce = cookies.meal_csrf;
                    if (!nonce || !/^[A-Za-z0-9_-]{43}$/.test(nonce) || !Object.hasOwn(state.csrf, nonce)) {
                        nonce = token();
                        state.csrf[nonce] = token();
                        cookie('meal_csrf', nonce);
                    }
                    return success({ token: state.csrf[nonce] });
                }
                if (!this.ready()) return fail(503);
                completeEmailChanges(state, now);
                const publicProfile = (username: string) => ({
                    username,
                    avatarUrl: null,
                    recipeCount: null,
                    reputationLabel: null,
                    achievements: null,
                });
                if (authorMatch) {
                    let username: string;
                    try {
                        username = decodeURIComponent(authorMatch[1]!);
                    } catch {
                        return fail(400);
                    }
                    if (!username || username.length > 256) return fail(400);
                    const author = state.users.find((user) => user.login === username && user.active && user.verified);
                    return author ? success({ profile: publicProfile(author.login) }) : fail(404);
                }
                const kind: Kind = path.startsWith('/api/v1/staff/') || isAdminDomain ? 'staff' : 'user';
                const cookieName = `meal_${kind}`;
                const allowed = (user: MockUser | undefined, context: Context): user is MockUser =>
                    !!user?.active &&
                    user.verified &&
                    (!this.options.adminOnly || context === 'admin') &&
                    (context === 'user' || user.role === context);
                const principal = (): Session | undefined =>
                    state.sessions.find(
                        (session) =>
                            session.token === cookies[cookieName] &&
                            !session.revoked &&
                            (!(isAdminAuth || isAdminDomain) || session.adminUnlocks !== undefined) &&
                            Date.parse(session.principal.expiresAt) > now &&
                            (session.principal.context === 'user' ? 'user' : 'staff') === kind &&
                            allowed(
                                state.users.find((u) => u.id === session.principal.id),
                                session.principal.context,
                            ) &&
                            (kind === 'user' ||
                                state.factors.some(
                                    (f) => f.userId === session.principal.id && f.verified && !f.revoked,
                                )),
                    );
                const issue = (user: MockUser, context: Context) => {
                    const principal: Principal = {
                        id: user.id,
                        displayName: user.name,
                        context,
                        sessionId: crypto.randomUUID(),
                        expiresAt: new Date(
                            now +
                                (context === 'user' ? 40 : context === 'moderator' ? 14 : isAdminAuth ? 7 : 1) *
                                    86400000,
                        ).toISOString(),
                    };
                    const bearer = token();
                    state.sessions.push({
                        token: bearer,
                        principal,
                        authenticatedAt: new Date(now).toISOString(),
                        revoked: false,
                    });
                    cookie(cookieName, bearer, principal.expiresAt);
                    return principal;
                };
                const unlock = (session: Session) => {
                    const proof = token();
                    (session.adminUnlocks ??= []).push(proof);
                    return proof;
                };
                if (
                    isAdminAuth &&
                    [
                        '/api/v1/staff/auth/status',
                        '/api/v1/staff/auth/unlock',
                        '/api/v1/staff/auth/critical-confirm',
                    ].includes(path)
                ) {
                    const current = principal();
                    if (!current || current.principal.context !== 'admin') return fail(401);
                    const unlocked = adminUnlocked(current, request.headers.get('x-admin-unlock'));
                    if (path.endsWith('/status'))
                        return success({
                            status: unlocked ? 'unlocked' : 'locked',
                            user: current.principal,
                            criticalUntil: unlocked ? adminCriticalUntil(current, now) : null,
                        });
                    if (path.endsWith('/critical-confirm') && !unlocked) return fail(403, 'ADMIN_LOCKED');
                    const input = contracts['POST /api/v1/admin/auth/unlock'].request.parse(body);
                    if (!adminVerifyCode(state, current, input, now)) return fail(401);
                    if (path.endsWith('/unlock'))
                        return success({
                            user: current.principal,
                            unlockToken: unlock(current),
                            criticalUntil: adminCriticalUntil(current, now),
                        });
                    current.criticalConfirmedUntil = new Date(
                        Math.min(now + 1800000, Date.parse(current.principal.expiresAt)),
                    ).toISOString();
                    return success({ criticalUntil: current.criticalConfirmedUntil });
                }
                if (
                    isAdminDomain ||
                    (isAdminAuth &&
                        [
                            '/api/v1/staff/auth/me',
                            '/api/v1/staff/auth/sessions',
                            '/api/v1/staff/auth/sessions/revoke-others',
                        ].includes(path))
                ) {
                    const current = principal();
                    if (!current) return fail(401);
                    if (!adminUnlocked(current, request.headers.get('x-admin-unlock')))
                        return fail(403, 'ADMIN_LOCKED');
                }
                if (isAdminDomain) {
                    const session = principal();
                    if (!session || session.principal.context !== 'admin') return fail(401);
                    applyScheduledGovernanceEffects(state, now);
                    scenarioMode = String(
                        state.admin.tables.__scenario?.find((row) => row.id === 'mode')?.mode ?? 'normal',
                    );
                    if (scenarioMode === 'error') return fail(503);
                    if (
                        scenarioMode === 'conflict' &&
                        !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
                        !/(search|inspect|preview|compare)$/.test(wirePath)
                    )
                        return fail(409);
                    const deletionReview = accountDeletionReviewHandle({
                        state,
                        path: wirePath,
                        method: request.method,
                        body: parsed?.success ? parsed.data : body,
                        actor: session.principal,
                        critical: !!adminCriticalUntil(session, now),
                        now,
                        requestId,
                        success,
                        fail,
                    });
                    if (deletionReview) return deletionReview;
                    const params = matched?.params;
                    if (operation.params && !operation.params.safeParse(params).success) return fail(400);
                    if (releaseCanonicalRoute) {
                        try {
                            const result = releaseApi(
                                state.releaseWorkspace,
                                wirePath,
                                request.method,
                                parsed?.success ? parsed.data : body,
                                { critical: !!adminCriticalUntil(session, now), now },
                            );
                            return result ? success(result) : fail(404);
                        } catch (error) {
                            if (error instanceof ReleaseMockError) return fail(error.status);
                            throw error;
                        }
                    }
                    if (releaseWorkspaceRoute) {
                        if (request.method === 'GET') return success(structuredClone(state.releaseWorkspace));
                        try {
                            return success(
                                releaseWorkspaceCommand(state.releaseWorkspace, parsed?.success ? parsed.data : body, {
                                    critical: !!adminCriticalUntil(session, now),
                                    now,
                                }),
                            );
                        } catch (error) {
                            if (error instanceof ReleaseMockError) return fail(error.status);
                            throw error;
                        }
                    }
                    if (wirePath === '/api/v1/admin/settings/recipe-policy')
                        return recipePolicyHandle({
                            state,
                            method: request.method,
                            body,
                            actor: session.principal,
                            critical: !!adminCriticalUntil(session, now),
                            now,
                            requestId,
                            success,
                            fail,
                        });
                    if (wirePath.startsWith('/api/v1/admin/review-workspace/')) {
                        const command =
                            request.method === 'GET'
                                ? { action: 'load' }
                                : { action: wirePath.split('/').at(-1), data: body };
                        try {
                            return success(
                                reviewWorkspaceCommand(
                                    state.admin,
                                    params!.section as 'legal-requests' | 'rollback',
                                    params!.id!,
                                    command as ReviewCommand,
                                    {
                                        actorId: session.principal.id,
                                        critical: !!adminCriticalUntil(session, now),
                                        now,
                                    },
                                ),
                            );
                        } catch (error) {
                            if (error instanceof ReviewMockError) return fail(error.status);
                            throw error;
                        }
                    }
                    if (wirePath.startsWith('/api/v1/admin/operations-workspace/')) {
                        if (
                            !body ||
                            typeof body !== 'object' ||
                            !('action' in body) ||
                            body.action !== wirePath.split('/').at(-1)
                        )
                            return fail(400);
                        try {
                            return success(
                                operationsWorkspaceCommand(state.admin, body, {
                                    actorId: session.principal.id,
                                    critical: !!adminCriticalUntil(session, now),
                                    now,
                                }),
                            );
                        } catch (error) {
                            if (error instanceof OperationsMockError) return fail(error.status);
                            throw error;
                        }
                    }
                    if (wirePath.startsWith('/api/v1/admin/content-workspace/')) {
                        const command =
                            request.method === 'GET'
                                ? { action: 'load' }
                                : { action: wirePath.split('/').at(-1), data: body };
                        try {
                            return success(
                                contentWorkspaceCommand(
                                    state.admin,
                                    params!.section as 'queues' | 'catalog',
                                    params!.id!,
                                    command as ContentCommand,
                                    {
                                        actorId: session.principal.id,
                                        critical: !!adminCriticalUntil(session, now),
                                        now,
                                    },
                                ),
                            );
                        } catch (error) {
                            if (error instanceof ContentMockError) return fail(error.status);
                            throw error;
                        }
                    }
                    const governanceResult = governanceHandle({
                        state,
                        path: wirePath,
                        method: request.method,
                        body: parsed?.success ? parsed.data : {},
                        actor: session.principal,
                        now,
                        requestId,
                        success,
                        fail,
                    });
                    if (governanceResult) return governanceResult;
                    const billingResult = billingHandle({
                        state,
                        path: wirePath,
                        method: request.method,
                        body: parsed?.success ? parsed.data : {},
                        actor: session.principal,
                        now,
                        requestId,
                        success,
                        fail,
                    });
                    if (billingResult) return billingResult;
                    if (
                        wirePath === '/api/v1/admin/news-workspace' ||
                        wirePath.startsWith('/api/v1/admin/news-workspace/')
                    ) {
                        if (
                            !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
                            (!body ||
                                typeof body !== 'object' ||
                                !('action' in body) ||
                                body.action !== wirePath.split('/').at(-1))
                        )
                            return fail(400);
                        try {
                            return success(
                                newsWorkspaceCommand(
                                    state.admin,
                                    request.method === 'GET' ? { action: 'list' } : body,
                                    {
                                        actorId: session.principal.id,
                                        critical: !!adminCriticalUntil(session, now),
                                        now,
                                        recipients: state.users
                                            .filter((user) => user.active)
                                            .map((user, index) => ({
                                                id: user.id,
                                                role:
                                                    user.role === 'admin' || user.role === 'moderator'
                                                        ? user.role
                                                        : ('user' as const),
                                                plan: effectiveMockPlan(state, user.id, now),
                                                gender:
                                                    index % 3 === 0
                                                        ? ('unknown' as const)
                                                        : index % 3 === 1
                                                          ? ('female' as const)
                                                          : ('male' as const),
                                                family: ['pro1', 'user1'].includes(user.login),
                                                registeredAt: '2026-09-01T00:00:00.000Z',
                                                activeAt: '2026-09-28T08:00:00.000Z',
                                                allowedChannels: ['in_app'],
                                            })),
                                    },
                                ),
                            );
                        } catch (error) {
                            if (error instanceof NewsMockError) return fail(error.status);
                            throw error;
                        }
                    }
                    if (
                        wirePath === '/api/v1/admin/notification-center' ||
                        wirePath.startsWith('/api/v1/admin/notification-center/')
                    )
                        return notificationCenterHandle({
                            state: state.notificationCenter,
                            userId: session.principal.id,
                            verifiedEmail:
                                state.users.find((user) => user.id === session.principal.id && user.verified)?.email ??
                                null,
                            path: wirePath,
                            method: request.method,
                            body: parsed?.success ? parsed.data : {},
                            now,
                            success,
                            fail,
                        });
                    const freeAiResult = freeAiHandle({
                        state,
                        path: wirePath,
                        method: request.method,
                        body: parsed?.success ? parsed.data : body,
                        critical: !!adminCriticalUntil(session, now),
                        now,
                        success,
                        fail,
                    });
                    if (freeAiResult) return freeAiResult;
                    const supportResult = supportHandle({
                        state,
                        path: wirePath,
                        method: request.method,
                        body: parsed?.success ? parsed.data : {},
                        actor: session.principal,
                        now,
                        requestId,
                        success,
                        fail,
                    });
                    if (supportResult) return supportResult;
                    const allergensResult = allergensHandle({
                        state,
                        path: wirePath,
                        params: params ?? {},
                        method: request.method,
                        query: new URL(request.url).searchParams,
                        input: parsed?.success ? parsed.data : body,
                        success,
                        fail,
                    });
                    if (allergensResult) return allergensResult;
                    return adminHandle({
                        state,
                        path: wirePath,
                        method: request.method,
                        body: parsed?.success ? parsed.data : {},
                        actor: session.principal,
                        requestId,
                        now,
                        success,
                        fail,
                    });
                }
                const accountResponse = accountHandle({
                    state,
                    path,
                    input: parsed?.success ? parsed.data : {},
                    now,
                    cookies,
                    hashes: secretInputs,
                    fixtureHash,
                    rateLimit: this.options.rateLimit ?? 10,
                    current: principal,
                    issue,
                    cookie,
                    success,
                    fail,
                });
                if (accountResponse) return accountResponse;
                if (path.endsWith('/login')) {
                    const input = isAdminAuth
                        ? contracts['POST /api/v1/admin/auth/login'].request.parse(body)
                        : kind === 'user'
                          ? contracts['POST /api/v1/auth/login'].request.parse(body)
                          : contracts['POST /api/v1/staff/auth/login'].request.parse(body);
                    const identity = ('login' in input ? input.login : input.email).trim().toLowerCase();
                    const email = isAdminAuth
                        ? (state.users.find((user) => user.login.toLowerCase() === identity)?.email ?? identity)
                        : identity;
                    const byEmail = bump(state, `email:${email}`, now, this.options.rateLimit ?? 10);
                    const byIp = bump(state, 'ip:mock-browser', now, this.options.rateLimit ?? 10);
                    if (!byEmail || !byIp) return fail(429);
                    const context = isAdminAuth
                        ? 'admin'
                        : kind === 'staff'
                          ? contracts['POST /api/v1/staff/auth/login'].request.parse(body).context
                          : 'user';
                    const user = state.users.find((user) => user.email === email);
                    if (
                        !allowed(user, context) ||
                        secretInputs.password !== (state.account.passwords[user.id] ?? fixtureHash)
                    )
                        return fail(401);
                    if (context === 'user') return success({ user: issue(user, context) });
                    let factor = state.factors.find((f) => f.userId === user.id && f.verified && !f.revoked);
                    let enrollment: { secret: string; uri: string } | null = null;
                    if (!factor) {
                        state.account.enrollments
                            .filter((e) => e.userId === user.id)
                            .forEach((e) => {
                                e.used = true;
                            });
                        state.factors
                            .filter((f) => f.userId === user.id && !f.verified)
                            .forEach((f) => {
                                f.revoked = true;
                            });
                        factor = {
                            id: crypto.randomUUID(),
                            userId: user.id,
                            secret: generateSecret(),
                            verified: false,
                            revoked: false,
                            lastStep: -1,
                            recoveryCodes: [],
                        };
                        state.factors.push(factor);
                        enrollment = {
                            secret: factor.secret,
                            uri: generateURI({
                                secret: factor.secret,
                                issuer: 'Meal Planner',
                                label: email,
                                digits: 6,
                                period: 30,
                            }),
                        };
                    }
                    state.challenges
                        .filter((c) => c.userId === user.id && !c.used)
                        .forEach((c) => {
                            c.revoked = true;
                        });
                    const challenge = token();
                    state.challenges.push({
                        token: challenge,
                        userId: user.id,
                        context,
                        factorId: factor.id,
                        expires: now + 600000,
                        attempts: 0,
                        used: false,
                        revoked: false,
                        ...(isAdminAuth ? { adminPortal: true } : {}),
                    });
                    return success({
                        status: 'mfa_required',
                        challenge,
                        expiresAt: new Date(now + 600000).toISOString(),
                        enrollment,
                    });
                }
                if (path.endsWith('/mfa/verify')) {
                    const input = contracts['POST /api/v1/staff/auth/mfa/verify'].request.parse(body);
                    const challenge = state.challenges.find(
                        (c) =>
                            c.token === input.challenge && !c.revoked && !c.used && c.expires > now && c.attempts < 5,
                    );
                    if (!challenge) return fail(401);
                    if (isAdminAuth !== (challenge.adminPortal === true)) return fail(401);
                    if (isAdminAuth && challenge.context !== 'admin') return fail(401);
                    const user = state.users.find((u) => u.id === challenge.userId);
                    const factor = state.factors.find((f) => f.id === challenge.factorId && !f.revoked);
                    if (!factor || !allowed(user, challenge.context)) return fail(401);
                    const enrolling = !factor.verified;
                    let accepted = false;
                    if (input.method === 'totp' && /^\d{6}$/.test(input.code)) {
                        const checked = verifySync({
                            strategy: 'totp',
                            secret: factor.secret,
                            token: input.code,
                            digits: 6,
                            period: 30,
                            epoch: Math.floor(now / 1000),
                            epochTolerance: 30,
                        });
                        if (checked.valid && 'timeStep' in checked && checked.timeStep > factor.lastStep) {
                            factor.lastStep = checked.timeStep;
                            factor.verified = true;
                            accepted = true;
                        }
                    } else if (input.method === 'recovery' && factor.verified) {
                        const index = factor.recoveryCodes.indexOf(input.code);
                        if (index >= 0) {
                            factor.recoveryCodes.splice(index, 1);
                            accepted = true;
                        }
                    }
                    challenge.attempts++;
                    if (!accepted) return fail(401); // Persist attempts, do not throw/rollback.
                    challenge.used = true;
                    const recoveryCodes = enrolling ? Array.from({ length: 10 }, recoveryCode) : [];
                    if (enrolling) factor.recoveryCodes = [...recoveryCodes];
                    const signedIn = issue(user, challenge.context);
                    const current = state.sessions.find(
                        (session) => session.principal.sessionId === signedIn.sessionId,
                    )!;
                    return success({
                        user: signedIn,
                        recoveryCodes,
                        ...(isAdminAuth ? { unlockToken: unlock(current) } : {}),
                    });
                }
                if (path.endsWith('/logout')) {
                    const session = state.sessions.find(
                        (s) =>
                            s.token === cookies[cookieName] &&
                            (s.principal.context === 'user' ? 'user' : 'staff') === kind,
                    );
                    if (session) {
                        session.revoked = true;
                        session.adminUnlocks = [];
                        delete session.criticalConfirmedUntil;
                    }
                    cookie(cookieName, '', '1970-01-01T00:00:00Z');
                    return success({ loggedOut: true });
                }
                const current = principal();
                if (!current) return fail(401);
                if (path === '/api/v1/profile') {
                    const user = state.users.find((entry) => entry.id === current.principal.id)!;
                    return success({
                        profile: {
                            id: user.id,
                            username: user.login,
                            displayName: user.name,
                            email: user.email,
                            emailVerified: user.verified,
                            timezone: fixtureUserIds.has(user.id) ? 'Europe/Moscow' : null,
                            locale: fixtureUserIds.has(user.id) ? 'ru' : null,
                            theme: null,
                            public: publicProfile(user.login),
                        },
                    });
                }
                if (path.endsWith('/me')) return success({ user: current.principal });
                const others = state.sessions.filter(
                    (s) =>
                        s.principal.id === current.principal.id &&
                        s.principal.context === current.principal.context &&
                        !s.revoked,
                );
                if (path.endsWith('/revoke-others')) {
                    const revoked = others.filter((s) => s.principal.sessionId !== current.principal.sessionId);
                    revoked.forEach((s) => {
                        s.revoked = true;
                    });
                    return success({ revokedCount: revoked.length });
                }
                if (!path.endsWith('/sessions')) return fail(404);
                return success({
                    sessions: others
                        .filter((s) => Date.parse(s.principal.expiresAt) > now)
                        .sort((a, b) => b.authenticatedAt.localeCompare(a.authenticatedAt))
                        .map((s) => ({
                            id: s.principal.sessionId,
                            context: s.principal.context,
                            authenticatedAt: s.authenticatedAt,
                            expiresAt: s.principal.expiresAt,
                            current: s.principal.sessionId === current.principal.sessionId,
                        })),
                });
            });
        } catch {
            return fail(500);
        }
    }
}
