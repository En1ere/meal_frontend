import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
    loadAuthorFollowState,
    loadFollowingPage,
    recordRecommendationEvent,
    setAuthorFollowing,
} from '../src/entities/recommendation/api.js';
import { recommendationKeys } from '../src/entities/recommendation/query-keys.js';

const page = { items: [], nextCursor: null } as const;
const followState = { following: true } as const;

interface RecordedRequest {
    route: string;
    body: unknown;
    signal: AbortSignal | undefined;
    params: unknown;
    options: unknown;
}

function transportFixture() {
    const requests: RecordedRequest[] = [];
    const request = (route: string, body?: unknown, signal?: AbortSignal, params?: unknown, options?: unknown) => {
        requests.push({ route, body, signal, params, options });
        return Promise.resolve({ data: route === 'GET /api/v1/authors/{username}/follow' ? followState : page });
    };
    return { requests, transport: { request } };
}

void test('recommendation command adapters preserve exact bodies, params, projection and fresh idempotency', async () => {
    const requests: RecordedRequest[] = [];
    const transport = {
        request: (route: string, body?: unknown, signal?: AbortSignal, params?: unknown, options?: unknown) => {
            requests.push({ route, body, signal, params, options });
            return Promise.resolve({ data: route.startsWith('PUT ') ? followState : { accepted: true } });
        },
    };
    const event = {
        event: 'impression' as const,
        recommendationId: '00000000-0000-0000-0000-000000000001',
        entityType: 'recipe' as const,
        entityId: 'recipe-a',
        algorithm: 'personalized-v1' as const,
        surface: 'home' as const,
        position: 0,
        reasonCodes: ['inventory_match' as const],
    };

    assert.equal(await recordRecommendationEvent(transport as never, event), undefined);
    assert.equal(await recordRecommendationEvent(transport as never, event), undefined);
    assert.equal(await setAuthorFollowing(transport as never, 'author-a', true), followState);
    assert.equal(await setAuthorFollowing(transport as never, 'author-a', false), followState);

    const firstEventBody = requests[0]?.body as typeof event & { idempotencyKey: string };
    const secondEventBody = requests[1]?.body as typeof event & { idempotencyKey: string };
    const firstFollowBody = requests[2]?.body as { following: boolean; idempotencyKey: string };
    const secondFollowBody = requests[3]?.body as { following: boolean; idempotencyKey: string };
    assert.deepEqual(firstEventBody, { ...event, idempotencyKey: firstEventBody.idempotencyKey });
    assert.deepEqual(secondEventBody, { ...event, idempotencyKey: secondEventBody.idempotencyKey });
    assert.notEqual(firstEventBody.idempotencyKey, secondEventBody.idempotencyKey);
    assert.deepEqual(requests[2], {
        route: 'PUT /api/v1/authors/{username}/follow',
        body: { following: true, idempotencyKey: firstFollowBody.idempotencyKey },
        signal: undefined,
        params: { username: 'author-a' },
        options: undefined,
    });
    assert.deepEqual(requests[3], {
        route: 'PUT /api/v1/authors/{username}/follow',
        body: { following: false, idempotencyKey: secondFollowBody.idempotencyKey },
        signal: undefined,
        params: { username: 'author-a' },
        options: undefined,
    });
    assert.notEqual(firstFollowBody.idempotencyKey, secondFollowBody.idempotencyKey);

    const error = new Error('transport failed');
    await assert.rejects(
        setAuthorFollowing({ request: () => Promise.reject(error) } as never, 'author-a', true),
        (actual) => actual === error,
    );
});

void test('recommendation owner preserves exact following root and account-scoped tuples', () => {
    assert.deepEqual(recommendationKeys.followingRoot, ['profile-following']);
    assert.deepEqual(recommendationKeys.following(undefined), ['profile-following', undefined]);
    assert.deepEqual(recommendationKeys.following('user-a'), ['profile-following', 'user-a']);
    assert.deepEqual(recommendationKeys.authorFollow(undefined, 'author-a'), ['author-follow', undefined, 'author-a']);
    assert.deepEqual(recommendationKeys.authorFollow('user-a', 'author-a'), ['author-follow', 'user-a', 'author-a']);
});

void test('following adapter preserves cursor omission, cursor presence, signal and exact data', async () => {
    const { requests, transport } = transportFixture();
    const controller = new AbortController();
    assert.equal(await loadFollowingPage(transport, null, controller.signal), page);
    assert.equal(await loadFollowingPage(transport, 'cursor-2', controller.signal), page);
    assert.equal(await loadAuthorFollowState(transport, 'author-a', controller.signal), followState);
    assert.deepEqual(requests, [
        {
            route: 'GET /api/v1/profile/following',
            body: undefined,
            signal: controller.signal,
            params: undefined,
            options: { query: { limit: '20' } },
        },
        {
            route: 'GET /api/v1/profile/following',
            body: undefined,
            signal: controller.signal,
            params: undefined,
            options: { query: { limit: '20', cursor: 'cursor-2' } },
        },
        {
            route: 'GET /api/v1/authors/{username}/follow',
            body: undefined,
            signal: controller.signal,
            params: { username: 'author-a' },
            options: undefined,
        },
    ]);
});

void test('community list and follow command consume the canonical owner without changing mutation semantics', async () => {
    const [following, recommendation, adapter] = await Promise.all([
        readFile('src/features/community/following.tsx', 'utf8'),
        readFile('src/entities/recommendation/client.tsx', 'utf8'),
        readFile('src/entities/recommendation/api.ts', 'utf8'),
    ]);
    assert.doesNotMatch(following, /\.request\s*\(/u);
    assert.match(following, /recommendationKeys\.following\(session\.data\?\.id\)/u);
    assert.match(following, /loadFollowingPage\(api!, pageParam, signal\)/u);
    assert.match(recommendation, /queryKey: recommendationKeys\.followingRoot/u);
    assert.match(recommendation, /const key = recommendationKeys\.authorFollow\(session\.data\?\.id, username\)/u);
    assert.match(recommendation, /loadAuthorFollowState\(api!, username, signal\)/u);
    assert.doesNotMatch(recommendation, /api!\.request\('GET \/api\/v1\/authors\/\{username\}\/follow'/u);
    assert.match(recommendation, /setAuthorFollowing\(api, username, next\)/u);
    assert.match(recommendation, /recordRecommendationEvent\(api, \{ \.\.\.base, event \}\)/u);
    assert.doesNotMatch(recommendation, /\.request\s*\(/u);
    assert.match(recommendation, /queryClient\.setQueryData\(key, result\)/u);
    assert.match(recommendation, /invalidateQueries\(\{ queryKey: recommendationKeys\.followingRoot \}\)/u);
    assert.match(recommendation, /send\(['"]impression['"]\)\.catch\(\(\) => impressions\.delete\(key\)\)/u);
    assert.match(recommendation, /open: \(\) => void send\(['"]open['"]\)\.catch\(\(\) => undefined\)/u);
    assert.match(adapter, /'POST \/api\/v1\/recommendations\/events'/u);
    assert.match(adapter, /'PUT \/api\/v1\/authors\/\{username\}\/follow'/u);
    assert.equal(adapter.match(/idempotencyKey: crypto\.randomUUID\(\)/gu)?.length, 2);
});
