import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { authHomeKeys } from '../src/features/auth/home/query-keys.js';
import { loadAuthHome, loadAuthHomeRecipeRecommendations } from '../src/features/auth/home/api.js';

void test('auth home key preserves exact anonymous and account-scoped tuples', () => {
    assert.deepEqual(authHomeKeys.home(undefined), ['home', undefined]);
    assert.deepEqual(authHomeKeys.home('user-a'), ['home', 'user-a']);
});

void test('auth home adapter preserves signals, scope conversion, recipe projection and native errors', async () => {
    const calls: unknown[][] = [];
    const recipe = { type: 'recipe', recommendationId: 'recipe-a' };
    const author = { type: 'author', recommendationId: 'author-a' };
    const home = { marker: 'home' };
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            return Promise.resolve({ data: args[0] === 'GET /api/v1/home' ? home : { items: [recipe, author] } });
        },
    };
    const signal = new AbortController().signal;

    assert.equal(await loadAuthHome(transport as never, signal), home);
    assert.deepEqual(await loadAuthHomeRecipeRecommendations(transport as never, 'personal', signal), [recipe]);
    assert.deepEqual(await loadAuthHomeRecipeRecommendations(transport as never, 'family', signal), [recipe]);
    assert.deepEqual(calls, [
        ['GET /api/v1/home', undefined, signal],
        [
            'GET /api/v1/recommendations',
            undefined,
            signal,
            undefined,
            { query: { type: 'recipe', scope: 'private', surface: 'home', limit: '3' } },
        ],
        [
            'GET /api/v1/recommendations',
            undefined,
            signal,
            undefined,
            { query: { type: 'recipe', scope: 'family', surface: 'home', limit: '3' } },
        ],
    ]);

    const error = new Error('transport failed');
    await assert.rejects(loadAuthHome({ request: () => Promise.reject(error) } as never), (actual) => actual === error);
});

void test('user home uses its private owner without changing transport or recommendation projection', async () => {
    const [source, adapter] = await Promise.all([
        readFile('src/features/auth/user-home.tsx', 'utf8'),
        readFile('src/features/auth/home/api.ts', 'utf8'),
    ]);

    assert.match(source, /queryKey: authHomeKeys\.home\(session\.data\?\.id\)/u);
    assert.doesNotMatch(source, /queryKey: \[['"]home['"]/u);
    assert.match(source, /enabled: !!api && !!session\.data/u);
    assert.match(source, /loadAuthHome\(api!, signal\)/u);
    assert.doesNotMatch(source, /\.request\s*\(/u);

    assert.match(source, /queryKey: recommendationKeys\.recipe\(session\.data\?\.id, scope, 3\)/u);
    assert.doesNotMatch(source, /queryKey: \[['"]recommendations['"]/u);
    assert.match(source, /loadAuthHomeRecipeRecommendations\(api!, scope, signal\)/u);
    assert.match(adapter, /scope: scope === ['"]family['"] \? ['"]family['"] : ['"]private['"]/u);
    assert.match(adapter, /surface: ['"]home['"]/u);
    assert.match(adapter, /limit: ['"]3['"]/u);
    assert.match(adapter, /item\.type === ['"]recipe['"]/u);
    assert.match(source, /Персональная подборка временно недоступна/u);
});
