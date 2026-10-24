import { recipesHandle, ensureRecipeProducts } from './recipes.js';
import { recipeWorkspaceHandle, workspaceRecipeFixture } from './recipe-workspace.js';
import { handleCookingWorkflow } from './cooking-workflow.js';
import { preservesHandle } from './preserves.js';
import { shoppingReceiptsHandle } from './shopping-receipts.js';
import { mealPlanHandle } from './meal-plan.js';
import { generateSecret, generateURI, verifySync } from 'otplib';
import { HttpResponse } from 'msw';
import { matchContract } from './route-match.js';
import { inventoryHandle } from './inventory.js';
import { productsHandle, canUseProduct } from './products.js';
import { mockDigest } from './account-model.js';
import { accountHandle, completeEmailChanges } from './account-api.js';
import { personalizationHandle, personalizationRow } from './personalization.js';
import { notificationsHandle } from './notifications.js';
import { supportHandle } from './support.js';
import { aiHandle } from './ai.js';
import { aiAppealsHandle } from './ai-appeals.js';
import { familyHandle } from './family.js';
import { subscriptionHandle } from './subscription.js';
import { proOverviewHandle } from './pro-overview.js';
import { diaryHandle } from './diary.js';
import { nutritionHandle } from './nutrition.js';
import { financeHandle } from './finance.js';
import { recommendationsHandle } from './recommendations.js';
import { communityHandle } from './community.js';
import { privacyHandle } from './privacy.js';
import { consentRequiredCode, hasConsent, legalHandle } from './legal.js';
import { newsHandle } from './news.js';
import { exportsHandle } from './exports.js';
import { ownershipHandle } from './ownership.js';
import { searchHandle } from './search.js';
import { publicRecipeFixtures } from './recipe-fixtures.js';
import { allergenReportsHandle } from './allergen-reports.js';
import { publicProgressHandle } from './public-progress.js';
import { accountLifecycleHandle, restoreMockArchivedAccount } from './account-lifecycle.js';
import { moderationHandle } from './moderation.js';
import { contracts, type Principal } from '../shared/api/contracts.generated.js';
import {
    fixturePassword,
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
    408: ['REQUEST_TIMEOUT', 'Обработка заняла слишком много времени'],
    412: ['VERSION_CONFLICT', 'Запись изменена. Сравните с актуальной версией'],
    428: ['VERSION_REQUIRED', 'Укажите версию записи'],
    413: ['PAYLOAD_TOO_LARGE', 'Запрос слишком большой'],
    415: ['UNSUPPORTED_MEDIA_TYPE', 'Неподдерживаемый формат запроса'],
    422: ['UNPROCESSABLE_REQUEST', 'Проверьте выбранные данные и доступное количество'],
    429: ['RATE_LIMITED', 'Слишком много запросов. Попробуйте позже'],
    503: ['UNAVAILABLE', 'Сервис временно недоступен'],
    500: ['INTERNAL_ERROR', 'Внутренняя ошибка сервиса'],
};
const matchRecipePublicWrite = (path: string, method: string) =>
    method === 'POST' && /^\/api\/v1\/recipe-workspace\/[^/]+\/(?:rating|comments)$/.test(path);
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
        const headers = new Headers({
            'x-request-id': requestId,
            'cache-control': 'no-store',
            'content-type': 'application/json',
        });
        const fail = (status: number, customCode?: string) => {
            const [defaultCode, message] = messages[status] ?? messages[500]!;
            const code = customCode ?? defaultCode;
            return new HttpResponse(JSON.stringify({ error: { code, message, details: null }, meta: { requestId } }), {
                status,
                headers,
            });
        };
        const success = (data: unknown) =>
            new HttpResponse(JSON.stringify({ data, meta: { requestId } }), { status: 200, headers });
        const path = new URL(request.url).pathname;
        const customLegal = path.startsWith('/api/v1/mock/legal/');
        const authorMatch = /^\/api\/v1\/authors\/([^/]+)$/.exec(path);
        const matched = matchContract(request.method, path);
        if (!matched && !customLegal) return fail(404);
        const operation = matched ? contracts[matched.key] : null;
        const params = matched?.params ?? {};
        if (operation?.params && !operation.params.safeParse(params).success) return fail(400);
        const cookies = suppliedCookies ?? readCookies(request.headers.get('cookie'));
        if (path.startsWith('/api/v1/inventory/ingest/')) {
            const check = () =>
                this.repository.transaction((state) => {
                    const now = this.now();
                    const session = state.sessions.find(
                        (s) =>
                            s.token === cookies.meal_user &&
                            !s.revoked &&
                            s.principal.context === 'user' &&
                            Date.parse(s.principal.expiresAt) > now &&
                            state.users.some((u) => u.id === s.principal.id && u.active && u.verified),
                    );
                    if (!session) return 401;
                    if (
                        (request.headers.get('origin') ?? browserOrigin) !== this.options.origin ||
                        request.headers.get('sec-fetch-site') === 'cross-site' ||
                        !cookies.meal_csrf ||
                        !state.csrf[cookies.meal_csrf] ||
                        state.csrf[cookies.meal_csrf] !== request.headers.get('x-csrf-token')
                    )
                        return 403;
                    if (state.inventory.blocked.includes(session.principal.id)) return 403;
                    return 200;
                });
            const status = await check();
            if (status !== 200) return fail(status);
            try {
                const { runIngestUpload } = await import('./ingest.js');
                const result = await runIngestUpload(path, await request.formData(), request.signal);
                const current = await check();
                return current === 200 ? success(result) : fail(current);
            } catch (error) {
                if (error instanceof Error && error.name === 'AbortError') throw error;
                return fail(400);
            }
        }
        const bodyText = !['GET', 'HEAD', 'OPTIONS'].includes(request.method) ? await request.text() : '';
        if (new TextEncoder().encode(bodyText).length > (path === '/api/v1/inventory/import/commit' ? 8388608 : 65536))
            return fail(413);
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
                const parsed = operation?.request?.safeParse(body);
                if (parsed && !parsed.success) return fail(400);
                const cookie = (name: string, value: string, expires?: string) => {
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
                    recipeCount: publicRecipeFixtures().filter(
                        (recipe) =>
                            recipe.authorLogin === username &&
                            !state.recipeWorkspace.hidden.includes(recipe.id) &&
                            !state.recipeWorkspace.recipes.some(
                                (row) => row.recipe.id === recipe.id && row.recipe.archived,
                            ),
                    ).length,
                    reputationLabel: null,
                    achievements: null,
                });
                const publicAuthorMatch = /^\/api\/v1\/authors\/([^/]+)(?:\/(?:achievements|reputation))?$/.exec(path);
                if (publicAuthorMatch) {
                    let publicUsername: string;
                    try {
                        publicUsername = decodeURIComponent(publicAuthorMatch[1]!).toLowerCase();
                    } catch {
                        return fail(400);
                    }
                    const publicAuthor = state.users.find((user) => user.login === publicUsername);
                    if (publicAuthor && !hasConsent(state.legal, publicAuthor.id, 'dissemination')) return fail(404);
                }
                const publicProgressResponse = publicProgressHandle({ state, path, success, fail });
                if (publicProgressResponse) return publicProgressResponse;
                if (authorMatch) {
                    let username: string;
                    try {
                        username = decodeURIComponent(authorMatch[1]!);
                    } catch {
                        return fail(400);
                    }
                    if (!username || username.length > 256) return fail(400);
                    const author = state.users.find((user) => user.login === username && user.active && user.verified);
                    return author && hasConsent(state.legal, author.id, 'dissemination')
                        ? success({ profile: publicProfile(author.login) })
                        : fail(404);
                }
                const kind: Kind =
                    path.startsWith('/api/v1/staff/') || path.startsWith('/api/v1/moderator/') ? 'staff' : 'user';
                const cookieName = `meal_${kind}`;
                const allowed = (user: MockUser | undefined, context: Context): user is MockUser =>
                    !!user?.active && user.verified && (context === 'user' || user.role === context);
                const principal = (): Session | undefined =>
                    state.sessions.find(
                        (session) =>
                            session.token === cookies[cookieName] &&
                            !session.revoked &&
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
                            now + (context === 'user' ? 40 : context === 'moderator' ? 14 : 1) * 86400000,
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
                const userId = principal()?.principal.id ?? null;
                const legalReadFailure = state.limits['e2e:legal-settings-read'];
                if (
                    path === '/api/v1/settings/legal-consents' &&
                    request.method === 'GET' &&
                    legalReadFailure &&
                    legalReadFailure.attempts > 0
                ) {
                    legalReadFailure.attempts--;
                    return fail(503);
                }
                const legalResponse = legalHandle({
                    state: state.legal,
                    userId,
                    path,
                    method: request.method,
                    input: parsed?.success ? parsed.data : body,
                    now,
                    success,
                    fail,
                });
                if (legalResponse) return legalResponse;
                if (
                    /^\/api\/v1\/(?:diary|nutrition)(?:\/|$)/.test(path) &&
                    !hasConsent(state.legal, userId, 'special_category')
                )
                    return fail(403, consentRequiredCode('special_category'));
                if (
                    (matchRecipePublicWrite(path, request.method) ||
                        /^\/api\/v1\/recipe-workspace\/[^/]+\/submit$/.test(path)) &&
                    !hasConsent(state.legal, userId, 'dissemination')
                )
                    return fail(403, consentRequiredCode('dissemination'));
                const moderationResponse = moderationHandle({
                    state: state.moderation,
                    principal: principal()?.principal ?? null,
                    path,
                    method: request.method,
                    params,
                    query: new URL(request.url).searchParams,
                    input: parsed?.success ? parsed.data : body,
                    cookies,
                    now,
                    success,
                    fail,
                });
                if (moderationResponse) return moderationResponse;
                if (path.startsWith('/api/v1/meal-plan') || path.startsWith('/api/v1/portions')) {
                    ensureRecipeProducts(state);
                    return (
                        mealPlanHandle({
                            state,
                            userId: principal()?.principal.id ?? null,
                            path,
                            method: request.method,
                            query: new URL(request.url).searchParams,
                            input: parsed?.success ? parsed.data : body,
                            now,
                            success,
                            fail,
                        }) ?? fail(404)
                    );
                }
                if (
                    /^\/api\/v1\/(shopping-lists|receipts|purchases)(?:\/|$)/.test(path) &&
                    !path.endsWith('/recipe-preview')
                ) {
                    ensureRecipeProducts(state);
                    return (
                        shoppingReceiptsHandle({
                            state,
                            userId: principal()?.principal.id ?? null,
                            path,
                            params,
                            method: request.method,
                            query: new URL(request.url).searchParams,
                            input: parsed?.success ? parsed.data : body,
                            now,
                            success,
                            fail,
                        }) ?? fail(404)
                    );
                }
                if (path.startsWith('/api/v1/preserves')) {
                    ensureRecipeProducts(state);
                    return (
                        preservesHandle({
                            state,
                            userId: principal()?.principal.id ?? null,
                            path,
                            params,
                            method: request.method,
                            query: new URL(request.url).searchParams,
                            input: parsed?.success ? parsed.data : body,
                            now,
                            success,
                            fail,
                        }) ?? fail(404)
                    );
                }
                if (
                    path.startsWith('/api/v1/recipe-workspace') ||
                    path === '/api/v1/recipe-policy' ||
                    path.startsWith('/api/v1/cooking-attempts') ||
                    path.startsWith('/api/v1/shopping-lists') ||
                    path.endsWith('/cooking-statistics')
                ) {
                    ensureRecipeProducts(state);
                    const context = {
                        state,
                        userId: principal()?.principal.id ?? null,
                        path,
                        params,
                        method: request.method,
                        query: new URL(request.url).searchParams,
                        input: parsed?.success ? parsed.data : body,
                        now,
                        success,
                        fail,
                    };
                    return (
                        recipeWorkspaceHandle(context) ??
                        handleCookingWorkflow({
                            ...context,
                            resolveRecipe: (id) => workspaceRecipeFixture(state, context.userId ?? '', id),
                        }) ??
                        fail(404)
                    );
                }
                if (path === '/api/v1/recipes' || path.startsWith('/api/v1/recipes/')) {
                    if (path === '/api/v1/recipes' && cookies.meal_user && !principal()) return fail(401);
                    return (
                        recipesHandle({
                            state,
                            userId: principal()?.principal.id ?? null,
                            path,
                            params,
                            method: request.method,
                            query: new URL(request.url).searchParams,
                            input: parsed?.success ? parsed.data : body,
                            now,
                            success,
                            fail,
                        }) ?? fail(404)
                    );
                }
                if (path.startsWith('/api/v1/inventory') || path.startsWith('/api/v1/products')) {
                    const session = principal();
                    if (!session) return fail(401);
                    ensureRecipeProducts(state);
                    const context = {
                        state,
                        userId: session.principal.id,
                        path,
                        method: request.method,
                        params,
                        input: parsed?.success ? parsed.data : body,
                        query: new URL(request.url).searchParams,
                        now,
                        success,
                        fail,
                    };
                    return (
                        productsHandle(context) ??
                        inventoryHandle({
                            ...context,
                            ifMatch: request.headers.get('if-match'),
                            canUseIngredient: (id, scope) =>
                                canUseProduct(state, session.principal.id, id) &&
                                (scope === 'private' ||
                                    state.products.items.some((row) => row.product.id === id && row.authorId === null)),
                        }) ??
                        fail(404)
                    );
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
                const accountLifecycleResponse = accountLifecycleHandle({
                    state,
                    userId: principal()?.principal.id ?? null,
                    path,
                    method: request.method,
                    input: parsed?.success ? parsed.data : body,
                    now,
                    passwordHash: secretInputs.password,
                    fixtureHash,
                    success,
                    fail,
                });
                if (accountLifecycleResponse) return accountLifecycleResponse;
                const ownershipResponse = ownershipHandle({
                    state,
                    userId: principal()?.principal.id ?? null,
                    path,
                    params,
                    method: request.method,
                    input: parsed?.success ? parsed.data : body,
                    now,
                    success,
                    fail,
                });
                if (ownershipResponse) return ownershipResponse;
                const exportsResponse = exportsHandle({
                    state,
                    userId: principal()?.principal.id ?? null,
                    path,
                    params,
                    method: request.method,
                    query: new URL(request.url).searchParams,
                    input: parsed?.success ? parsed.data : body,
                    now,
                    success,
                    fail,
                });
                if (exportsResponse) return exportsResponse;
                const newsResponse = newsHandle({
                    state,
                    userId: principal()?.principal.id ?? null,
                    path,
                    params,
                    method: request.method,
                    query: new URL(request.url).searchParams,
                    input: parsed?.success ? parsed.data : body,
                    now,
                    success,
                    fail,
                });
                if (newsResponse) return newsResponse;
                const searchResponse = searchHandle({
                    state,
                    userId: principal()?.principal.id ?? null,
                    path,
                    method: request.method,
                    query: new URL(request.url).searchParams,
                    success,
                    fail,
                });
                if (searchResponse) return searchResponse;
                const privacyResponse = privacyHandle({
                    state,
                    userId: principal()?.principal.id ?? null,
                    path,
                    method: request.method,
                    input: parsed?.success ? parsed.data : body,
                    now,
                    success,
                    fail,
                });
                if (privacyResponse) return privacyResponse;
                const communityResponse = communityHandle({
                    state,
                    userId: principal()?.principal.id ?? null,
                    path,
                    params,
                    method: request.method,
                    query: new URL(request.url).searchParams,
                    success,
                    fail,
                });
                if (communityResponse) return communityResponse;
                const recommendationsResponse = recommendationsHandle({
                    state,
                    userId: principal()?.principal.id ?? null,
                    path,
                    params,
                    method: request.method,
                    query: new URL(request.url).searchParams,
                    input: parsed?.success ? parsed.data : body,
                    now,
                    success,
                    fail,
                });
                if (recommendationsResponse) return recommendationsResponse;
                const allergenReportResponse = allergenReportsHandle({
                    state,
                    userId: principal()?.principal.id ?? null,
                    path,
                    method: request.method,
                    input: parsed?.success ? parsed.data : body,
                    now,
                    success,
                    fail,
                });
                if (allergenReportResponse) return allergenReportResponse;
                const personalizationResponse = personalizationHandle({
                    state,
                    userId: principal()?.principal.id ?? null,
                    path,
                    method: request.method,
                    input: parsed?.success ? parsed.data : body,
                    now,
                    success,
                    fail,
                });
                if (personalizationResponse) return personalizationResponse;
                const familyResponse = familyHandle({
                    state,
                    userId: principal()?.principal.id ?? null,
                    path,
                    params,
                    method: request.method,
                    query: new URL(request.url).searchParams,
                    input: parsed?.success ? parsed.data : body,
                    now,
                    success,
                    fail,
                });
                if (familyResponse) return familyResponse;
                const subscriptionResponse = subscriptionHandle({
                    state,
                    userId: principal()?.principal.id ?? null,
                    path,
                    method: request.method,
                    input: parsed?.success ? parsed.data : body,
                    now,
                    success,
                    fail,
                });
                if (subscriptionResponse) return subscriptionResponse;
                const proOverviewResponse = proOverviewHandle({
                    state,
                    userId: principal()?.principal.id ?? null,
                    path,
                    method: request.method,
                    now,
                    success,
                    fail,
                });
                if (proOverviewResponse) return proOverviewResponse;
                const diaryResponse = diaryHandle({
                    state,
                    userId: principal()?.principal.id ?? null,
                    path,
                    params,
                    method: request.method,
                    query: new URL(request.url).searchParams,
                    input: parsed?.success ? parsed.data : body,
                    ifMatch: request.headers.get('if-match'),
                    now,
                    success,
                    fail,
                });
                if (diaryResponse) return diaryResponse;
                const nutritionResponse = nutritionHandle({
                    state,
                    userId: principal()?.principal.id ?? null,
                    path,
                    method: request.method,
                    query: new URL(request.url).searchParams,
                    input: parsed?.success ? parsed.data : body,
                    ifMatch: request.headers.get('if-match'),
                    now,
                    success,
                    fail,
                });
                if (nutritionResponse) return nutritionResponse;
                const financeResponse = financeHandle({
                    state,
                    userId: principal()?.principal.id ?? null,
                    path,
                    params,
                    method: request.method,
                    query: new URL(request.url).searchParams,
                    input: parsed?.success ? parsed.data : body,
                    ifMatch: request.headers.get('if-match'),
                    now,
                    success,
                    fail,
                });
                if (financeResponse) return financeResponse;
                const notificationsResponse = notificationsHandle({
                    state,
                    userId: principal()?.principal.id ?? null,
                    path,
                    params,
                    method: request.method,
                    query: new URL(request.url).searchParams,
                    input: parsed?.success ? parsed.data : body,
                    now,
                    success,
                    fail,
                });
                if (notificationsResponse) return notificationsResponse;
                const supportResponse = supportHandle({
                    state,
                    userId: principal()?.principal.id ?? null,
                    path,
                    params,
                    method: request.method,
                    query: new URL(request.url).searchParams,
                    input: parsed?.success ? parsed.data : body,
                    now,
                    success,
                    fail,
                });
                if (supportResponse) return supportResponse;
                const aiAppealsResponse = aiAppealsHandle({
                    state,
                    userId: principal()?.principal.id ?? null,
                    path,
                    method: request.method,
                    input: parsed?.success ? parsed.data : body,
                    now,
                    success,
                    fail,
                });
                if (aiAppealsResponse) return aiAppealsResponse;
                const aiResponse = aiHandle({
                    state,
                    userId: principal()?.principal.id ?? null,
                    path,
                    params,
                    method: request.method,
                    query: new URL(request.url).searchParams,
                    input: parsed?.success ? parsed.data : body,
                    now,
                    success,
                    fail,
                });
                if (aiResponse) return aiResponse;
                if (path.endsWith('/login')) {
                    const input =
                        kind === 'user'
                            ? contracts['POST /api/v1/auth/login'].request.parse(body)
                            : contracts['POST /api/v1/staff/auth/login'].request.parse(body);
                    const email = input.email.trim().toLowerCase();
                    const byEmail = bump(state, `email:${email}`, now, this.options.rateLimit ?? 10);
                    const byIp = bump(state, 'ip:mock-browser', now, this.options.rateLimit ?? 10);
                    if (!byEmail || !byIp) return fail(429);
                    const context =
                        kind === 'staff'
                            ? contracts['POST /api/v1/staff/auth/login'].request.parse(body).context
                            : 'user';
                    const user = state.users.find((user) => user.email === email);
                    if (
                        !allowed(user, context) ||
                        secretInputs.password !== (state.account.passwords[user.id] ?? fixtureHash)
                    )
                        return fail(401);
                    if (context === 'user') {
                        restoreMockArchivedAccount(state, user.id);
                        return success({ user: issue(user, context) });
                    }
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
                    return success({ user: issue(user, challenge.context), recoveryCodes });
                }
                if (path.endsWith('/logout')) {
                    const session = state.sessions.find(
                        (s) =>
                            s.token === cookies[cookieName] &&
                            (s.principal.context === 'user' ? 'user' : 'staff') === kind,
                    );
                    if (session) session.revoked = true;
                    cookie(cookieName, '', '1970-01-01T00:00:00Z');
                    return success({ loggedOut: true });
                }
                const current = principal();
                if (!current) return fail(401);
                if (path === '/api/v1/profile') {
                    const user = state.users.find((entry) => entry.id === current.principal.id)!;
                    const settings = personalizationRow(state, user.id);
                    if (request.method === 'PUT') {
                        const input = contracts['PUT /api/v1/profile'].request.parse(body);
                        if (input.expectedVersion !== settings.profileVersion) return fail(412);
                        user.name = input.displayName ?? user.login;
                        settings.timezone = input.timezone;
                        settings.locale = input.locale;
                        settings.theme = input.theme;
                        settings.profileVersion++;
                        settings.settingsVersion++;
                    }
                    return success({
                        profile: {
                            id: user.id,
                            username: user.login,
                            displayName: user.name,
                            email: user.email,
                            emailVerified: user.verified,
                            timezone: settings.timezone,
                            locale: settings.locale,
                            theme: settings.theme,
                            version: settings.profileVersion,
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
