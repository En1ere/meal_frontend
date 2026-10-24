import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockNotificationSettings } from '../src/mocks/notification-settings.js';
import { MemoryRepository } from '../src/mocks/repository.js';
import { createSeed, mockStateSchema } from '../src/mocks/model.js';
import type { Principal } from '../src/shared/api/contracts.generated.js';

async function setup() {
    const repository = new MemoryRepository();
    const now = Date.now();
    const user = createSeed().users.find((entry) => entry.role === 'admin')!;
    const principal: Principal = {
        id: user.id,
        context: 'admin',
        sessionId: crypto.randomUUID(),
        displayName: user.name,
        expiresAt: new Date(now + 86400000).toISOString(),
    };
    await repository.transaction((state) => {
        state.sessions.push({
            token: 'test-only-session',
            principal,
            revoked: false,
            authenticatedAt: new Date(now).toISOString(),
        });
        state.factors.push({
            id: crypto.randomUUID(),
            userId: user.id,
            secret: 'test-only-factor',
            verified: true,
            revoked: false,
            lastStep: -1,
            recoveryCodes: [],
        });
    });
    const adapter = new MockNotificationSettings(
        repository,
        () => Promise.resolve(principal),
        () => now,
    );
    return { repository, adapter, principal, signal: new AbortController().signal };
}

await test('all channels default off; old mock snapshots acquire defaults without losing sessions', async () => {
    const { adapter, repository, signal } = await setup();
    const value = await adapter.read(signal);
    assert.deepEqual(value.preferences, { browser: false, mobilePush: false, email: false });
    assert.equal(value.verifiedEmail, 'admin@meal-planner.test');
    await repository.transaction((state) => {
        const old: Record<string, unknown> = { ...structuredClone(state) };
        delete old.notificationPreferences;
        const upgraded = mockStateSchema.parse(old);
        assert.deepEqual(upgraded.notificationPreferences, {});
        assert.equal(upgraded.sessions.length, 1);
    });
});

await test('concurrent channel edits merge atomically and survive a new adapter', async () => {
    const { adapter, repository, principal, signal } = await setup();
    await Promise.all([
        adapter.update({ channel: 'browser', enabled: true }, signal),
        adapter.update({ channel: 'email', enabled: true }, signal),
        adapter.update({ channel: 'mobilePush', enabled: true }, signal),
    ]);
    const other = new MockNotificationSettings(repository, () => Promise.resolve(principal));
    assert.deepEqual((await other.read(signal)).preferences, { browser: true, mobilePush: true, email: true });
    await other.update({ channel: 'mobilePush', enabled: false }, signal);
    assert.deepEqual((await adapter.read(signal)).preferences, { browser: true, mobilePush: false, email: true });
    await assert.rejects(adapter.update({ channel: 'unknown', enabled: true }, signal));
    await assert.rejects(adapter.update({ channel: 'email', enabled: 'yes' }, signal));
});

await test('revocation, wrong context, expired session and missing MFA block reads and writes', async () => {
    for (const condition of ['session', 'role', 'expired', 'factor', 'context', 'verified'] as const) {
        const { adapter, repository, principal, signal } = await setup();
        await repository.transaction((state) => {
            if (condition === 'session') state.sessions[0]!.revoked = true;
            if (condition === 'role') state.users.find((user) => user.id === principal.id)!.role = 'moderator';
            if (condition === 'expired') state.sessions[0]!.principal.expiresAt = new Date(0).toISOString();
            if (condition === 'factor') state.factors[0]!.revoked = true;
            if (condition === 'context') state.sessions[0]!.principal.context = 'user';
            if (condition === 'verified') state.users.find((user) => user.id === principal.id)!.verified = false;
        });
        await assert.rejects(adapter.read(signal), /отозван/);
        await assert.rejects(adapter.update({ channel: 'email', enabled: true }, signal), /отозван/);
        await repository.transaction((state) => assert.deepEqual(state.notificationPreferences, {}));
    }
});

await test('abort or revocation during authentication cannot commit preferences', async () => {
    for (const abort of [true, false]) {
        const { repository, principal } = await setup();
        const controller = new AbortController();
        const adapter = new MockNotificationSettings(repository, async () => {
            if (abort) controller.abort();
            else
                await repository.transaction((state) => {
                    state.sessions[0]!.revoked = true;
                });
            return principal;
        });
        await assert.rejects(adapter.update({ channel: 'browser', enabled: true }, controller.signal));
        await repository.transaction((state) => assert.deepEqual(state.notificationPreferences, {}));
    }
});

await test('missing valid email has an explicit fallback and cannot enable mail', async () => {
    const { repository, principal, adapter, signal } = await setup();
    await repository.transaction((state) => {
        state.users.find((user) => user.id === principal.id)!.email = '';
    });
    assert.equal((await adapter.read(signal)).verifiedEmail, null);
    await assert.rejects(adapter.update({ channel: 'email', enabled: true }, signal), /подтверждённый/);
    assert.equal((await adapter.update({ channel: 'browser', enabled: true }, signal)).preferences.browser, true);
});
