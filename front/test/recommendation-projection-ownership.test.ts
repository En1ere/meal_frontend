import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { recommendationKeys } from '../src/entities/recommendation/query-keys.js';
import { loadAuthorRecommendations, loadRecipeRecommendations } from '../src/entities/recommendation/api.js';

void test('recommendation projection keys preserve exact account, scope, type and limit tuples', () => {
    assert.deepEqual(recommendationKeys.recipe(undefined, 'personal', 3), [
        'recommendations',
        'recipe',
        undefined,
        'personal',
        3,
    ]);
    assert.deepEqual(recommendationKeys.recipe('user-a', 'family', 3), [
        'recommendations',
        'recipe',
        'user-a',
        'family',
        3,
    ]);
    assert.deepEqual(recommendationKeys.recipe('user-a', 'private', 12), [
        'recommendations',
        'recipe',
        'user-a',
        'private',
        12,
    ]);
    assert.deepEqual(recommendationKeys.author(undefined, 3), ['recommendations', 'author', undefined, 3]);
    assert.deepEqual(recommendationKeys.author('user-a', 6), ['recommendations', 'author', 'user-a', 6]);
});

void test('recommendation read adapter preserves exact projections, signals, discriminants and native errors', async () => {
    const calls: unknown[][] = [];
    const signal = new AbortController().signal;
    const recipe = { type: 'recipe', recommendationId: 'recipe-a' };
    const author = { type: 'author', recommendationId: 'author-a' };
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            return Promise.resolve({ data: { items: [recipe, author] } });
        },
    };

    assert.deepEqual(await loadRecipeRecommendations(transport as never, signal), [recipe]);
    assert.deepEqual(await loadAuthorRecommendations(transport as never, signal), [author]);
    assert.deepEqual(calls, [
        [
            'GET /api/v1/recommendations',
            undefined,
            signal,
            undefined,
            { query: { type: 'recipe', scope: 'private', surface: 'recipes', limit: '12' } },
        ],
        [
            'GET /api/v1/recommendations',
            undefined,
            signal,
            undefined,
            { query: { type: 'author', scope: 'private', surface: 'authors', limit: '3' } },
        ],
    ]);

    const error = new Error('native recommendation error');
    await assert.rejects(
        loadRecipeRecommendations({ request: () => Promise.reject(error) } as never, signal),
        (actual) => actual === error,
    );
});

void test('home and catalog consume projection owners without changing requests or recommendation actions', async () => {
    const [home, homeAdapter, catalog, entity, entityAdapter] = await Promise.all([
        readFile('src/features/auth/user-home.tsx', 'utf8'),
        readFile('src/features/auth/home/api.ts', 'utf8'),
        readFile('src/features/recipes/catalog.tsx', 'utf8'),
        readFile('src/entities/recommendation/client.tsx', 'utf8'),
        readFile('src/entities/recommendation/api.ts', 'utf8'),
    ]);

    assert.match(home, /queryKey: recommendationKeys\.recipe\(session\.data\?\.id, scope, 3\)/u);
    assert.match(home, /loadAuthHomeRecipeRecommendations\(api!, scope, signal\)/u);
    assert.match(homeAdapter, /scope: scope === ['"]family['"] \? ['"]family['"] : ['"]private['"]/u);
    assert.match(homeAdapter, /surface: ['"]home['"]/u);
    assert.match(homeAdapter, /limit: ['"]3['"]/u);

    assert.match(catalog, /queryKey: recommendationKeys\.recipe\(session\.data\?\.id, ['"]private['"], 12\)/u);
    assert.match(catalog, /queryKey: recommendationKeys\.author\(session\.data\?\.id, 3\)/u);
    assert.match(catalog, /loadRecipeRecommendations\(api!, signal\)/u);
    assert.match(catalog, /loadAuthorRecommendations\(api!, signal\)/u);
    assert.doesNotMatch(catalog, /\.request\s*\(/u);
    assert.match(
        entityAdapter,
        /query: \{ type: ['"]recipe['"], scope: ['"]private['"], surface: ['"]recipes['"], limit: ['"]12['"] \}/u,
    );
    assert.match(
        entityAdapter,
        /query: \{ type: ['"]author['"], scope: ['"]private['"], surface: ['"]authors['"], limit: ['"]3['"] \}/u,
    );

    for (const source of [home, catalog]) assert.doesNotMatch(source, /queryKey: \[['"]recommendations['"]/u);
    assert.doesNotMatch(home, /\.request\s*\(/u);
    assert.match(homeAdapter, /['"]GET \/api\/v1\/recommendations['"]/u);
    assert.match(homeAdapter, /undefined,\s*signal,\s*undefined,/u);
    assert.match(entityAdapter, /['"]GET \/api\/v1\/recommendations['"]/u);
    assert.match(entityAdapter, /undefined,\s*signal,\s*undefined,/u);
    assert.match(home, /useRecommendationActions\(item, ['"]home['"], position\)/u);
    assert.match(catalog, /useRecommendationActions\(item, ['"]recipes['"], position\)/u);
    assert.match(catalog, /useRecommendationActions\(item, ['"]authors['"], position\)/u);
    assert.match(entity, /const impressions = new Set<string>\(\)/u);
    assert.match(entity, /setAuthorFollowing\(api, username, next\)/u);
    assert.match(entity, /recordRecommendationEvent\(api, \{ \.\.\.base, event \}\)/u);
    assert.doesNotMatch(entity, /\.request\s*\(/u);
});
