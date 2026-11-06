import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
    loadOwnProfile,
    loadPublicAchievements,
    loadPublicProfile,
    loadPublicReputation,
    updateOwnProfile,
} from '../src/entities/profile/api.js';
import { profileKeys } from '../src/entities/profile/query-keys.js';

const ownProfile = { username: 'user-a' } as const;
const publicProfile = { username: 'author-a', avatarUrl: null, recipeCount: 3 } as const;
const achievements = { items: [], filters: [] } as const;
const reputation = { score: 10, rank: { code: 'newcomer', title: 'Новичок', minimumScore: 0 }, ranks: [] } as const;

interface RecordedRequest {
    route: string;
    body: unknown;
    signal: AbortSignal | undefined;
    params: unknown;
}

function transportFixture() {
    const requests: RecordedRequest[] = [];
    const request = (route: string, body?: unknown, signal?: AbortSignal, params?: unknown) => {
        requests.push({ route, body, signal, params });
        if (route === 'GET /api/v1/profile') return Promise.resolve({ data: { profile: ownProfile } });
        if (route === 'GET /api/v1/authors/{username}') return Promise.resolve({ data: { profile: publicProfile } });
        if (route === 'GET /api/v1/authors/{username}/achievements') return Promise.resolve({ data: achievements });
        if (route === 'PUT /api/v1/profile') return Promise.resolve({ data: { profile: ownProfile } });
        return Promise.resolve({ data: reputation });
    };
    return { requests, transport: { request } };
}

void test('profile keys preserve exact own and public projection tuples', () => {
    assert.deepEqual(profileKeys.own(undefined), ['profile', 'own', undefined]);
    assert.deepEqual(profileKeys.own('user-a'), ['profile', 'own', 'user-a']);
    assert.deepEqual(profileKeys.public('author-a'), ['profile', 'public', 'author-a']);
    assert.deepEqual(profileKeys.publicAchievements('author-a'), ['profile', 'public', 'author-a', 'achievements']);
    assert.deepEqual(profileKeys.publicReputation('author-a'), ['profile', 'public', 'author-a', 'reputation']);
});

void test('profile read adapter preserves every endpoint, signal, params and exact data projection', async () => {
    const { requests, transport } = transportFixture();
    const controller = new AbortController();
    assert.equal(await loadOwnProfile(transport, controller.signal), ownProfile);
    assert.equal(await loadPublicProfile(transport, 'author-a', controller.signal), publicProfile);
    assert.equal(await loadPublicAchievements(transport, 'author-a', controller.signal), achievements);
    assert.equal(await loadPublicReputation(transport, 'author-b', controller.signal), reputation);
    assert.deepEqual(requests, [
        {
            route: 'GET /api/v1/profile',
            body: undefined,
            signal: controller.signal,
            params: undefined,
        },
        {
            route: 'GET /api/v1/authors/{username}',
            body: undefined,
            signal: controller.signal,
            params: { username: 'author-a' },
        },
        {
            route: 'GET /api/v1/authors/{username}/achievements',
            body: undefined,
            signal: controller.signal,
            params: { username: 'author-a' },
        },
        {
            route: 'GET /api/v1/authors/{username}/reputation',
            body: undefined,
            signal: controller.signal,
            params: { username: 'author-b' },
        },
    ]);
});

void test('profile update adapter preserves the body and creates a fresh idempotency key per invocation', async () => {
    const { requests, transport } = transportFixture();
    const command = {
        displayName: 'Новое имя',
        timezone: 'Asia/Yekaterinburg',
        locale: 'ru' as const,
        theme: 'nature-dark',
        expectedVersion: 4,
    };
    assert.equal(await updateOwnProfile(transport, command), ownProfile);
    assert.equal(await updateOwnProfile(transport, command), ownProfile);
    const bodies = requests.map(({ body }) => body as Record<string, unknown>);
    const withoutIdempotency = bodies.map((body) => {
        const commandBody = { ...body };
        delete commandBody.idempotencyKey;
        return commandBody;
    });
    assert.deepEqual(withoutIdempotency, [command, command]);
    const keys = bodies.map(({ idempotencyKey }) => idempotencyKey);
    assert.equal(new Set(keys).size, 2);
    for (const key of keys) assert.match(String(key), /^[0-9a-f-]{36}$/u);

    const transportError = new Error('transport failed');
    await assert.rejects(
        () => updateOwnProfile({ request: () => Promise.reject(transportError) } as never, command),
        (error) => error === transportError,
    );
});

void test('profile pages migrate reads and cache ownership while preserving the feature-owned update command', async () => {
    const source = await readFile('src/features/profiles/profile-pages.tsx', 'utf8');
    assert.doesNotMatch(source, /api\.request\(['"]GET \/api\/v1\/(?:profile|authors)/u);
    assert.match(source, /queryKey: profileKeys\.own\(session\.data\?\.id\)/u);
    assert.match(source, /queryKey: profileKeys\.public\(username\)/u);
    assert.match(source, /queryClient\.setQueryData\(profileKeys\.own\(session\.data\?\.id\), value\)/u);
    assert.match(source, /loadOwnProfile\(api, signal\)/u);
    assert.match(source, /loadPublicProfile\(api, username, signal\)/u);

    assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.match(source, /updateOwnProfile\(api!, \{/u);
    assert.match(source, /expectedVersion: profile\.version/u);
    assert.doesNotMatch(source, /idempotencyKey/u);
    assert.match(source, /onSaved\(value\);\s*setTheme\(theme\);/u);
    assert.match(source, /onError: onRefresh/u);
    assert.match(source, /setUserSession\(runtime,/u);
    assert.match(source, /displayName: value\.displayName \?\? value\.username/u);
});

void test('auth and recommendation consumers share the canonical own-profile read owner', async () => {
    const [accountSecurity, recommendation] = await Promise.all([
        readFile('src/features/auth/account-security.tsx', 'utf8'),
        readFile('src/entities/recommendation/client.tsx', 'utf8'),
    ]);
    for (const source of [accountSecurity, recommendation]) {
        assert.match(source, /profileKeys\.own\(session\.data\?\.id\)/u);
        assert.doesNotMatch(source, /\.request\(['"]GET \/api\/v1\/profile/u);
    }
    assert.match(accountSecurity, /loadOwnProfile\(runtime\.api!, signal\)/u);
    assert.match(recommendation, /loadOwnProfile\(api!, signal\)/u);
});

void test('achievements consumes the explicit profile client entrypoint without direct transport calls', async () => {
    const source = await readFile('src/features/achievements/public-progress.tsx', 'utf8');
    assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.doesNotMatch(source, /['"]GET \/api\/v1\/(?:profile|authors)/u);
    assert.match(source, /profileKeys\.own\(session\.data\?\.id\)/u);
    assert.match(source, /profileKeys\.publicAchievements\(username\)/u);
    assert.equal(source.match(/profileKeys\.publicReputation\(username\)/gu)?.length, 2);
    assert.match(source, /loadOwnProfile\(api!, signal\)/u);
    assert.match(source, /loadPublicAchievements\(api!, username, signal\)/u);
    assert.equal(source.match(/loadPublicReputation\(api!, username, signal\)/gu)?.length, 2);
});
