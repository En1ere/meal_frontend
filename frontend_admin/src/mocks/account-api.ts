import { generateSecret, generateURI, verifySync } from 'otplib';
import type { MockState, MockUser, Factor, Session } from './model.js';
import type { Principal } from '../shared/api/contracts.generated.js';

type Purpose = MockState['account']['tokens'][number]['purpose'];
const randomToken = () =>
    btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replaceAll('=', '');
const recoveryCodes = () =>
    Array.from({ length: 10 }, () =>
        Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) => n.toString(16).padStart(2, '0')).join(''),
    );
const day = 86400000;
const text = (input: Record<string, unknown>, name: string) => (typeof input[name] === 'string' ? input[name] : '');
const normalizedEmail = (input: Record<string, unknown>) => text(input, 'email').trim().toLowerCase();
export interface AccountContext {
    state: MockState;
    path: string;
    input: Record<string, unknown>;
    now: number;
    cookies: Record<string, string>;
    hashes: Record<string, string>;
    fixtureHash: string;
    rateLimit: number;
    current: () => Session | undefined;
    issue: (user: MockUser, context: 'user') => Principal;
    cookie: (name: string, value: string, expires?: string) => void;
    success: (data: unknown) => Response;
    fail: (status: number) => Response;
}
export function revokeAccount(state: MockState, userId: string) {
    state.sessions
        .filter((s) => s.principal.id === userId)
        .forEach((s) => {
            s.revoked = true;
        });
    state.account.pins
        .filter((p) => p.userId === userId)
        .forEach((p) => {
            p.revoked = true;
        });
    state.challenges
        .filter((c) => c.userId === userId)
        .forEach((c) => {
            c.revoked = true;
        });
    state.account.enrollments
        .filter((e) => e.userId === userId)
        .forEach((e) => {
            e.used = true;
        });
}
export function completeEmailChanges(state: MockState, now: number) {
    for (const change of state.account.changes) {
        if (!change.confirmed && now - change.createdAt >= day) change.cancelled = true;
        if (!change.confirmed || change.cancelled || change.completed || change.executeAfter > now) continue;
        const user = state.users.find((u) => u.id === change.userId && u.active);
        if (
            !user ||
            user.email !== change.oldEmail ||
            state.users.some((u) => u.id !== user.id && u.email === change.email)
        ) {
            change.cancelled = true;
            continue;
        }
        user.email = change.email;
        user.verified = true;
        change.completed = true;
        revokeAccount(state, user.id);
        state.account.tokens
            .filter((t) => t.userId === user.id)
            .forEach((t) => {
                t.used = true;
            });
    }
}
function consumeFactor(factor: Factor, code: string, method: string, now: number): boolean {
    if (method === 'recovery') {
        const index = factor.recoveryCodes.indexOf(code);
        if (index < 0) return false;
        factor.recoveryCodes.splice(index, 1);
        return true;
    }
    if (method !== 'totp' || !/^\d{6}$/.test(code)) return false;
    const check = verifySync({
        strategy: 'totp',
        secret: factor.secret,
        token: code,
        digits: 6,
        period: 30,
        epoch: Math.floor(now / 1000),
        epochTolerance: 30,
    });
    if (!check.valid || !('timeStep' in check) || check.timeStep <= factor.lastStep) return false;
    factor.lastStep = check.timeStep;
    return true;
}
export function accountHandle(ctx: AccountContext): Response | undefined {
    const { state, path, input, now, cookies, hashes, fixtureHash, current, issue, cookie, success, fail } = ctx;
    const account = state.account;
    const passwordMatches = (user: MockUser, key = 'password') =>
        hashes[key] === (account.passwords[user.id] ?? fixtureHash);
    const factorFor = (id: string) => state.factors.find((f) => f.userId === id && f.verified && !f.revoked);
    const sendAllowed = (email: string) => {
        // The browser model has one simulated source IP, shared across tabs.
        let allowed = true;
        const keys = [
            [`email:${email}`, 900000, 5],
            ['ip:mock-browser', 900000, 5],
            [`cooldown:${email}`, 60000, 1],
        ] as const;
        for (const [key, window, max] of keys) {
            const old = account.sends[key];
            const item = old && now - old.start < window ? old : { start: now, count: 0, last: 0 };
            item.count++;
            item.last = now;
            account.sends[key] = item;
            if (item.count > max) allowed = false;
        }
        return allowed;
    };
    const limited = (key: string) => {
        const old = state.limits[key];
        const item = old && now - old.started < 60000 ? old : { started: now, attempts: 0 };
        item.attempts++;
        state.limits[key] = item;
        return item.attempts <= ctx.rateLimit;
    };
    const message = (userId: string, email: string, purpose: Purpose, ttl: number, changeId: string | null = null) => {
        account.tokens
            .filter((t) => t.userId === userId && t.purpose === purpose && !t.used)
            .forEach((t) => {
                t.used = true;
            });
        const token = randomToken();
        const expires = now + ttl;
        account.tokens.push({ token, userId, purpose, expires, used: false, changeId });
        account.mail.push({
            id: crypto.randomUUID(),
            email,
            kind: purpose,
            token,
            createdAt: new Date(now).toISOString(),
            expiresAt: new Date(expires).toISOString(),
        });
    };
    const take = (purpose: Purpose) =>
        account.tokens.find(
            (t) => t.token === text(input, 'token') && t.purpose === purpose && !t.used && t.expires > now,
        );
    const accepted = () => success({ accepted: true });
    const clearAccountCookies = () => {
        for (const name of ['meal_user', 'meal_staff', 'meal_device']) cookie(name, '', '1970-01-01T00:00:00Z');
    };
    if (path === '/api/v1/dev/mailbox')
        return success({
            messages: account.mail
                .filter((m) => m.email === normalizedEmail(input))
                .slice(-20)
                .reverse()
                .map(({ id, kind, token, createdAt, expiresAt }) => ({ id, kind, token, createdAt, expiresAt })),
        });
    if (path === '/api/v1/auth/register') {
        const email = normalizedEmail(input);
        const username = text(input, 'username').trim().toLowerCase();
        if (!sendAllowed(email)) return fail(429);
        if (state.users.some((u) => u.email === email)) return accepted();
        if (account.changes.some((c) => c.email === email && !c.completed && !c.cancelled)) return accepted();
        if (state.users.some((u) => u.login.toLowerCase() === username)) return fail(409);
        const user: MockUser = {
            id: crypto.randomUUID(),
            login: username,
            name: text(input, 'displayName').trim(),
            email,
            role: null,
            plan: 'free',
            active: true,
            verified: false,
        };
        state.users.push(user);
        account.passwords[user.id] = hashes.password!;
        message(user.id, email, 'verify', day);
        return accepted();
    }
    if (path === '/api/v1/auth/email/resend' || path === '/api/v1/auth/password/recovery') {
        const email = normalizedEmail(input);
        if (!sendAllowed(email)) return fail(429);
        const user = state.users.find((u) => u.email === email && u.active);
        const reset = path.endsWith('/recovery');
        if (user && (reset ? user.verified : !user.verified))
            message(user.id, email, reset ? 'reset' : 'verify', reset ? 1800000 : day);
        return accepted();
    }
    if (path === '/api/v1/auth/email/verify') {
        const found = take('verify');
        const user = state.users.find((u) => u.id === found?.userId && u.active);
        if (!found) return fail(400);
        if (!user) return fail(401);
        found.used = true;
        user.verified = true;
        return success({ verified: true });
    }
    if (path === '/api/v1/auth/password/reset/check') {
        const found = take('reset');
        if (!found) return fail(400);
        return state.users.some((u) => u.id === found.userId && u.active && u.verified)
            ? success({ valid: true })
            : fail(401);
    }
    if (path === '/api/v1/auth/password/reset') {
        const byToken = limited(`reset:${text(input, 'token')}`),
            byIp = limited('ip:mock-browser');
        if (!byToken || !byIp) return fail(429);
        const found = take('reset');
        const user = state.users.find((u) => u.id === found?.userId && u.active && u.verified);
        if (!found) return fail(400);
        if (!user) return fail(401);
        found.used = true;
        account.passwords[user.id] = hashes.password!;
        revokeAccount(state, user.id);
        account.tokens
            .filter((t) => t.userId === user.id)
            .forEach((t) => {
                t.used = true;
            });
        account.changes
            .filter((c) => c.userId === user.id && !c.completed)
            .forEach((c) => {
                c.cancelled = true;
            });
        clearAccountCookies();
        return success({ changed: true });
    }
    if (path === '/api/v1/auth/email/change/confirm' || path === '/api/v1/auth/email/change/cancel') {
        const cancel = path.endsWith('/cancel');
        const found = take(cancel ? 'email-cancel' : 'email-confirm');
        const change = account.changes.find((c) => c.id === found?.changeId && !c.cancelled && !c.completed);
        if (!found || !change) return fail(400);
        if (!state.users.some((u) => u.id === found.userId && u.active && u.verified)) return fail(401);
        found.used = true;
        if (cancel) {
            change.cancelled = true;
            account.tokens
                .filter((t) => t.changeId === change.id)
                .forEach((t) => {
                    t.used = true;
                });
            return success({ cancelled: true });
        }
        if (state.users.some((u) => u.id !== change.userId && u.email === change.email)) return fail(409);
        change.confirmed = true;
        change.executeAfter = now + day;
        return success({ confirmed: true, effectiveAt: new Date(change.executeAfter).toISOString() });
    }
    if (path === '/api/v1/auth/totp/login') {
        const email = normalizedEmail(input);
        const byEmail = limited(`email:${email}`);
        const byIp = limited('ip:mock-browser');
        if (!byEmail || !byIp) return fail(429);
        const user = state.users.find((u) => u.email === email && u.active && u.verified);
        const factor = user ? factorFor(user.id) : undefined;
        if (!user || !factor || !consumeFactor(factor, text(input, 'code'), 'totp', now)) return fail(401);
        return success({ user: issue(user, 'user') });
    }
    if (path === '/api/v1/auth/pin/login') {
        const byDevice = limited(`device:${cookies.meal_device ?? ''}`),
            byIp = limited('ip:mock-browser');
        if (!byDevice || !byIp) return fail(429);
        const pin = account.pins.find((p) => p.token === cookies.meal_device && !p.revoked);
        const user = state.users.find((u) => u.id === pin?.userId && u.active && u.verified);
        if (!pin || !user) return fail(401);
        if (pin.hash !== hashes.pin) {
            pin.attempts++;
            if (pin.attempts >= 5) {
                pin.revoked = true;
            }
            return fail(401);
        }
        pin.attempts = 0;
        return success({ user: issue(user, 'user') });
    }
    const protectedPaths = [
        '/api/v1/auth/security',
        '/api/v1/auth/password/change',
        '/api/v1/auth/email/change',
        '/api/v1/auth/pin/setup',
        '/api/v1/auth/pin/revoke',
        '/api/v1/auth/authenticator/setup',
        '/api/v1/auth/authenticator/confirm',
        '/api/v1/auth/authenticator/recovery-codes',
    ];
    if (!protectedPaths.includes(path)) return undefined;
    const session = current();
    const user = state.users.find((u) => u.id === session?.principal.id);
    if (!user || !session) return fail(401);
    if (path === '/api/v1/auth/security') {
        const pending = account.changes.find((c) => c.userId === user.id && !c.cancelled && !c.completed);
        return success({
            authenticatorEnabled: !!factorFor(user.id),
            pinEnabled: account.pins.some((p) => p.userId === user.id && p.token === cookies.meal_device && !p.revoked),
            pendingEmail: pending
                ? {
                      email: pending.email,
                      confirmed: pending.confirmed,
                      effectiveAt: pending.confirmed ? new Date(pending.executeAfter).toISOString() : null,
                  }
                : null,
        });
    }
    if (path === '/api/v1/auth/pin/revoke') {
        account.pins
            .filter((p) => p.userId === user.id && p.token === cookies.meal_device)
            .forEach((p) => {
                p.revoked = true;
            });
        cookie('meal_device', '', '1970-01-01T00:00:00Z');
        return success({ revoked: true });
    }
    if (path === '/api/v1/auth/authenticator/confirm') {
        const enrollment = account.enrollments.find(
            (e) =>
                e.token === text(input, 'challenge') &&
                e.userId === user.id &&
                e.sessionId === session.principal.sessionId &&
                !e.used &&
                e.expires > now &&
                e.attempts < 5,
        );
        if (!enrollment) return fail(401);
        enrollment.attempts++;
        const check = verifySync({
            strategy: 'totp',
            secret: enrollment.secret,
            token: text(input, 'code'),
            digits: 6,
            period: 30,
            epoch: Math.floor(now / 1000),
            epochTolerance: 30,
        });
        if (!check.valid || !('timeStep' in check)) return fail(401);
        const previous = factorFor(user.id);
        if ((previous?.id ?? null) !== enrollment.factorId) return fail(401);
        enrollment.used = true;
        state.factors
            .filter((f) => f.userId === user.id)
            .forEach((f) => {
                f.revoked = true;
            });
        state.challenges
            .filter((c) => c.userId === user.id)
            .forEach((c) => {
                c.revoked = true;
            });
        state.sessions
            .filter((s) => s.principal.id === user.id && s.principal.context !== 'user')
            .forEach((s) => {
                s.revoked = true;
            });
        const codes = recoveryCodes();
        state.factors.push({
            id: crypto.randomUUID(),
            userId: user.id,
            secret: enrollment.secret,
            verified: true,
            revoked: false,
            lastStep: check.timeStep,
            recoveryCodes: [...codes],
        });
        return success({ enabled: true, recoveryCodes: codes });
    }
    if (path !== '/api/v1/auth/email/change') {
        const bySession = limited(`session:${cookies.meal_user ?? ''}`),
            byIp = limited('ip:mock-browser');
        if (!bySession || !byIp) return fail(429);
    }
    if (path === '/api/v1/auth/email/change' && !sendAllowed(normalizedEmail(input))) return fail(429);
    if (!passwordMatches(user, path === '/api/v1/auth/password/change' ? 'currentPassword' : 'password'))
        return fail(401);
    if (path === '/api/v1/auth/password/change') {
        account.passwords[user.id] = hashes.password!;
        revokeAccount(state, user.id);
        account.tokens
            .filter((t) => t.userId === user.id)
            .forEach((t) => {
                t.used = true;
            });
        account.changes
            .filter((c) => c.userId === user.id && !c.completed)
            .forEach((c) => {
                c.cancelled = true;
            });
        clearAccountCookies();
        return success({ changed: true });
    }
    if (path === '/api/v1/auth/pin/setup') {
        account.pins
            .filter((p) => p.token === cookies.meal_device)
            .forEach((p) => {
                p.revoked = true;
            });
        const token = randomToken();
        account.pins.push({ token, userId: user.id, hash: hashes.pin!, attempts: 0, revoked: false });
        cookie('meal_device', token, '9999-12-31T23:59:59Z');
        return success({ enabled: true });
    }
    if (path === '/api/v1/auth/email/change') {
        const email = normalizedEmail(input);
        if (email === user.email) return fail(400);
        if (state.users.some((u) => u.email === email)) return fail(409);
        if (account.changes.some((c) => c.email === email && c.userId !== user.id && !c.cancelled && !c.completed))
            return fail(409);
        account.changes
            .filter((c) => c.userId === user.id && !c.completed)
            .forEach((c) => {
                c.cancelled = true;
            });
        const id = crypto.randomUUID();
        account.changes.push({
            id,
            userId: user.id,
            oldEmail: user.email,
            email,
            executeAfter: 0,
            createdAt: now,
            confirmed: false,
            cancelled: false,
            completed: false,
        });
        message(user.id, email, 'email-confirm', day, id);
        message(user.id, user.email, 'email-cancel', 2 * day, id);
        return accepted();
    }
    const factor = factorFor(user.id);
    const proof = input.proof && typeof input.proof === 'object' ? (input.proof as Record<string, unknown>) : {};
    if (factor && !consumeFactor(factor, text(proof, 'code'), text(proof, 'method'), now)) return fail(401);
    if (path === '/api/v1/auth/authenticator/recovery-codes') {
        if (!factor) return fail(401);
        const codes = recoveryCodes();
        factor.recoveryCodes = [...codes];
        return success({ recoveryCodes: codes });
    }
    account.enrollments
        .filter((e) => e.userId === user.id)
        .forEach((e) => {
            e.used = true;
        });
    state.factors
        .filter((f) => f.userId === user.id && !f.verified)
        .forEach((f) => {
            f.revoked = true;
        });
    const secret = generateSecret(),
        challenge = randomToken();
    account.enrollments.push({
        token: challenge,
        userId: user.id,
        secret,
        expires: now + 600000,
        attempts: 0,
        used: false,
        factorId: factor?.id ?? null,
        sessionId: session.principal.sessionId,
    });
    return success({
        challenge,
        expiresAt: new Date(now + 600000).toISOString(),
        enrollment: {
            secret,
            uri: generateURI({ secret, issuer: 'Meal Planner', label: user.email, digits: 6, period: 30 }),
        },
    });
}
