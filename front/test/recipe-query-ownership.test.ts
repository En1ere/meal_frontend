import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { recipeKeys } from '../src/features/recipes/query-keys.js';
import { catalogState } from '../src/features/recipes/url-state.js';
import { loadRecipeReport, loadRecipeReports } from '../src/features/recipes/reports-api.js';
import {
    loadFamilyRecipe,
    loadFamilyRecipeProducts,
    loadPreparedStockOptions,
    loadPublicCommunity,
    loadPublicRecipeComments,
    loadRecipeCatalog,
    loadRecipeCommunity,
} from '../src/features/recipes/read-api.js';
import { loadCookingReminderPreferences } from '../src/features/recipes/cooking-reminders-api.js';
import {
    loadCookingAttempt,
    loadCookingAttempts,
    loadCookingLocations,
    loadCookingRecipe,
    loadCookingStockOptions,
} from '../src/features/recipes/cooking-read-api.js';
import { ApiError } from '../src/shared/api/client.js';
import {
    loadRecipeDetail,
    loadRecipePersonal,
    loadRecipeStatistics,
    saveRecipeBookmark,
} from '../src/features/recipes/detail-api.js';
import {
    loadRecipeEditorProducts,
    loadRecipeWorkspace,
    saveRecipeWorkspace,
} from '../src/features/recipes/editor-api.js';
import { loadMineRecipes, runMineRecipeCommand } from '../src/features/recipes/mine-api.js';
import { reportRecipeAllergens } from '../src/features/recipes/allergens-api.js';

void test('recipe leaf read keys preserve exact state identity and distinct family/prepared tuples', () => {
    const state = catalogState(new URLSearchParams('q=soup&category=mains&tab=new&page=3'));
    const catalog = recipeKeys.catalog('user-a', state);
    assert.deepEqual(catalog, ['recipes', 'catalog', 'user-a', state]);
    assert.equal(catalog[3], state);
    assert.deepEqual(recipeKeys.catalog(undefined, catalogState(new URLSearchParams())), [
        'recipes',
        'catalog',
        undefined,
        { q: '', category: '', tab: 'for-you', page: 1 },
    ]);
    assert.deepEqual(recipeKeys.familyDetail(undefined, 'recipe-a'), [
        'recipe-workspace',
        undefined,
        'family',
        'recipe-a',
    ]);
    assert.deepEqual(recipeKeys.preparedStockOptions('user-a'), ['cooking', 'user-a', 'stock-options']);
});

void test('public recipe feed and comments preserve exact infinite-query projection tuples', () => {
    assert.deepEqual(recipeKeys.publicCommunity(undefined, '', '', 'newest'), [
        'community',
        undefined,
        '',
        '',
        'newest',
    ]);
    assert.deepEqual(recipeKeys.publicCommunity('pro1', 'soup', 'mains', 'oldest'), [
        'community',
        'pro1',
        'soup',
        'mains',
        'oldest',
    ]);
    assert.deepEqual(recipeKeys.publicComments('recipe-a'), ['public-comments', 'recipe-a']);
});

void test('recipe leaf read adapter preserves exact filters, cursors, paths, projections and signals', async () => {
    const calls: unknown[][] = [];
    const signal = new AbortController().signal;
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            if (args[0] === 'GET /api/v1/recipe-workspace/{id}')
                return Promise.resolve({ data: { recipe: 'family-recipe' } });
            if (args[0] === 'GET /api/v1/products') return Promise.resolve({ data: { items: ['product'] } });
            return Promise.resolve({ data: {} });
        },
    };
    await loadPublicCommunity(
        transport as never,
        { q: 'soup', category: 'mains', sort: 'oldest', author: 'author', cursor: 'next' },
        signal,
    );
    await loadPublicCommunity(
        transport as never,
        { q: '', category: '', sort: 'newest', author: undefined, cursor: null },
        signal,
    );
    await loadPublicRecipeComments(transport as never, 'recipe-a', 'comments-next', signal);
    await loadPreparedStockOptions(transport as never, signal);
    assert.equal(await loadFamilyRecipe(transport as never, 'recipe-a', signal), 'family-recipe');
    assert.deepEqual(await loadFamilyRecipeProducts(transport as never, signal), ['product']);
    assert.deepEqual(calls, [
        [
            'GET /api/v1/community',
            undefined,
            signal,
            undefined,
            { query: { q: 'soup', category: 'mains', sort: 'oldest', limit: '12', author: 'author', cursor: 'next' } },
        ],
        ['GET /api/v1/community', undefined, signal, undefined, { query: { q: '', sort: 'newest', limit: '12' } }],
        [
            'GET /api/v1/community/recipes/{id}/comments',
            undefined,
            signal,
            { id: 'recipe-a' },
            { query: { limit: '20', cursor: 'comments-next' } },
        ],
        ['GET /api/v1/cooking-attempts/stock-options', undefined, signal],
        ['GET /api/v1/recipe-workspace/{id}', undefined, signal, { id: 'recipe-a' }, { query: { scope: 'family' } }],
        ['GET /api/v1/products', undefined, signal, undefined, { query: { limit: '100' } }],
    ]);
    const error = new Error('native read error');
    await assert.rejects(
        loadPreparedStockOptions({ request: () => Promise.reject(error) } as never, signal),
        (actual) => actual === error,
    );
});

void test('catalog, community and reminder readers preserve exact params, projections, signals and native errors', async () => {
    const calls: unknown[][] = [];
    const signal = new AbortController().signal;
    const catalog = { items: ['recipe'], total: 1 };
    const community = { comments: ['comment'] };
    const preferences = { enabled: true, timezone: 'Asia/Yekaterinburg' };
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            if (args[0] === 'GET /api/v1/recipes') return Promise.resolve({ data: catalog });
            if (args[0] === 'GET /api/v1/recipe-workspace/{id}/community') return Promise.resolve({ data: community });
            return Promise.resolve({ data: preferences });
        },
    };

    assert.equal(
        await loadRecipeCatalog(
            transport as never,
            { q: 'soup', category: 'mains', tab: 'inventory', page: 3 },
            signal,
        ),
        catalog,
    );
    assert.equal(
        await loadRecipeCatalog(transport as never, { q: '', category: '', tab: 'new', page: 1 }, signal),
        catalog,
    );
    assert.equal(await loadRecipeCommunity(transport as never, 'recipe-a', signal), community);
    assert.equal(await loadCookingReminderPreferences(transport as never, signal), preferences);
    assert.deepEqual(calls, [
        [
            'GET /api/v1/recipes',
            undefined,
            signal,
            undefined,
            { query: { q: 'soup', category: 'mains', tab: 'inventory', page: '3', limit: '12' } },
        ],
        ['GET /api/v1/recipes', undefined, signal, undefined, { query: { q: '', tab: 'new', page: '1', limit: '12' } }],
        ['GET /api/v1/recipe-workspace/{id}/community', undefined, signal, { id: 'recipe-a' }],
        ['GET /api/v1/cooking-attempts/reminder-preferences', undefined, signal],
    ]);

    const error = new Error('native read error');
    await assert.rejects(
        loadCookingReminderPreferences({ request: () => Promise.reject(error) } as never, signal),
        (actual) => actual === error,
    );
});

void test('cooking reminder keys preserve distinct broad and account preference lifecycles', () => {
    assert.deepEqual(recipeKeys.cookingRoot, ['cooking']);
    assert.deepEqual(recipeKeys.cookingReminderPreferences(undefined), ['cooking', undefined, 'reminder-preferences']);
    assert.deepEqual(recipeKeys.cookingReminderPreferences('user-a'), ['cooking', 'user-a', 'reminder-preferences']);
});

void test('cooking read keys preserve list, attempt and recipe projections', () => {
    assert.deepEqual(recipeKeys.cookingList(null, 'current'), ['cooking', null, 'list', 'current']);
    assert.deepEqual(recipeKeys.cookingList('user-a', 'archive'), ['cooking', 'user-a', 'list', 'archive']);
    assert.deepEqual(recipeKeys.cookingAttempt('user-a', null), ['cooking', 'user-a', null]);
    assert.deepEqual(recipeKeys.cookingAttempt('user-a', 'attempt-a'), ['cooking', 'user-a', 'attempt-a']);
    assert.deepEqual(recipeKeys.cookingRecipe(undefined, 'recipe-a'), ['cooking', undefined, 'recipe', 'recipe-a']);
});

void test('cooking read adapter preserves list/detail/options, signals and 404-only workspace fallback', async () => {
    const calls: unknown[][] = [];
    const signal = new AbortController().signal;
    const values = {
        stocks: { items: ['stock'] },
        locations: { items: ['location'] },
        attempts: { items: ['attempt'] },
        attempt: { id: 'attempt-a' },
        recipe: { id: 'recipe-a', revisionId: 'revision-a', title: 'Public', baseServings: 2 },
    };
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            const route = args[0];
            if (route === 'GET /api/v1/cooking-attempts/stock-options') return Promise.resolve({ data: values.stocks });
            if (route === 'GET /api/v1/inventory-locations') return Promise.resolve({ data: values.locations });
            if (route === 'GET /api/v1/cooking-attempts') return Promise.resolve({ data: values.attempts });
            if (route === 'GET /api/v1/cooking-attempts/{id}') return Promise.resolve({ data: values.attempt });
            return Promise.resolve({ data: { recipe: values.recipe } });
        },
    };

    assert.equal(await loadCookingStockOptions(transport as never, signal), values.stocks);
    assert.equal(await loadCookingLocations(transport as never, signal), values.locations);
    assert.equal(await loadCookingAttempts(transport as never, 'archive', signal), values.attempts);
    assert.equal(await loadCookingAttempt(transport as never, 'attempt-a', signal), values.attempt);
    assert.equal(await loadCookingRecipe(transport as never, 'recipe-a', signal), values.recipe);
    assert.deepEqual(calls, [
        ['GET /api/v1/cooking-attempts/stock-options', undefined, signal],
        ['GET /api/v1/inventory-locations', undefined, signal],
        ['GET /api/v1/cooking-attempts', undefined, signal, undefined, { query: { view: 'archive' } }],
        ['GET /api/v1/cooking-attempts/{id}', undefined, signal, { id: 'attempt-a' }],
        ['GET /api/v1/recipes/{id}', undefined, signal, { id: 'recipe-a' }],
    ]);

    const fallbackCalls: unknown[][] = [];
    const workspaceRecipe = {
        id: 'recipe-b',
        revisionId: 'revision-b',
        document: { title: 'Workspace', baseServings: 4 },
    };
    const fallbackTransport = {
        request: (...args: unknown[]) => {
            fallbackCalls.push(args);
            if (args[0] === 'GET /api/v1/recipes/{id}')
                return Promise.reject(new ApiError(404, 'not_found', 'missing', 'request-a'));
            return Promise.resolve({ data: { recipe: workspaceRecipe } });
        },
    };
    assert.deepEqual(await loadCookingRecipe(fallbackTransport as never, 'recipe-b', signal), {
        id: 'recipe-b',
        revisionId: 'revision-b',
        title: 'Workspace',
        baseServings: 4,
    });
    assert.deepEqual(fallbackCalls, [
        ['GET /api/v1/recipes/{id}', undefined, signal, { id: 'recipe-b' }],
        ['GET /api/v1/recipe-workspace/{id}', undefined, signal, { id: 'recipe-b' }],
    ]);

    const error = new ApiError(503, 'unavailable', 'retry', 'request-b');
    await assert.rejects(
        loadCookingRecipe({ request: () => Promise.reject(error) } as never, 'recipe-c', signal),
        (actual) => actual === error,
    );
});

void test('cooking reads use exact owners without changing offline or fallback transports', async () => {
    const [source, adapter] = await Promise.all([
        readFile('src/features/recipes/cooking.tsx', 'utf8'),
        readFile('src/features/recipes/cooking-read-api.ts', 'utf8'),
    ]);
    assert.match(source, /queryKey: recipeKeys\.cookingList\(owner, view\)/u);
    assert.match(source, /queryKey: recipeKeys\.cookingAttempt\(owner, attemptId\)/u);
    assert.match(source, /queryKey: recipeKeys\.cookingRecipe\(user\.data\?\.id, id\)/u);
    assert.match(source, /refetchInterval: 60000/gu);
    assert.match(source, /loadCookingAttempts\(api!, view, signal\)/u);
    assert.match(source, /loadCookingAttempt\(api!, attemptId!, signal\)/u);
    assert.match(source, /loadCookingRecipe\(api!, id, signal\)/u);
    assert.match(source, /loadCookingStockOptions\(api!, signal\)/u);
    assert.match(source, /loadCookingLocations\(api!, signal\)/u);
    assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.match(adapter, /'GET \/api\/v1\/cooking-attempts'/u);
    assert.match(adapter, /'GET \/api\/v1\/cooking-attempts\/\{id\}'/u);
    assert.match(adapter, /'GET \/api\/v1\/recipes\/\{id\}'/u);
    assert.match(adapter, /'GET \/api\/v1\/recipe-workspace\/\{id\}'/u);
    assert.match(adapter, /error instanceof ApiError\) \|\| error\.status !== 404/u);
    assert.match(source, /readOfflineSnapshotData<Attempt>/u);
    assert.equal(source.match(/invalidateQueries\(\{ queryKey: recipeKeys\.cookingRoot \}\)/gu)?.length, 5);
    assert.match(source, /queryClient\.invalidateQueries\(\{ queryKey: recipeKeys\.personalRoot \}\)/u);
    assert.match(source, /queryClient\.invalidateQueries\(\{ queryKey: recipeKeys\.communityRoot \}\)/u);
    assert.doesNotMatch(source, /queryKey: \[['"](?:cooking|recipe-community)['"]/u);
    assert.doesNotMatch(source, /queryKey: \[['"]recipes['"], ['"]personal['"]/u);
});

void test('recipe community keys preserve scoped data and distinct refresh lifecycles', () => {
    assert.deepEqual(recipeKeys.communityRoot, ['recipe-community']);
    assert.deepEqual(recipeKeys.community(undefined, 'recipe-a'), ['recipe-community', undefined, 'recipe-a']);
    assert.deepEqual(recipeKeys.community('user-a', 'recipe-b'), ['recipe-community', 'user-a', 'recipe-b']);
    assert.deepEqual(recipeKeys.publicDetail('recipe-a'), ['recipes', 'public', 'recipe-a']);
    assert.notDeepEqual(recipeKeys.community('user-a', 'recipe-a'), recipeKeys.publicDetail('recipe-a'));
});

void test('recipe editor keys preserve workspace, offline-new and recovery cache shapes', () => {
    assert.deepEqual(recipeKeys.workspaceRoot, ['recipe-workspace']);
    assert.deepEqual(recipeKeys.workspaceDetail(undefined, 'private', undefined), [
        'recipe-workspace',
        undefined,
        'private',
        undefined,
    ]);
    assert.deepEqual(recipeKeys.workspaceDetail('user-a', 'family', 'recipe-a'), [
        'recipe-workspace',
        'user-a',
        'family',
        'recipe-a',
    ]);
    assert.deepEqual(recipeKeys.workspaceOfflineNew('user-a', 'draft-a'), [
        'recipe-workspace',
        'user-a',
        'new',
        'draft-a',
        'offline',
    ]);
    assert.deepEqual(recipeKeys.offlineDraftState('user-a', 'draft-a'), ['offline-draft-state', 'user-a', 'draft-a']);
});

void test('recipe mine key preserves exact owner, filters and page values', () => {
    assert.deepEqual(recipeKeys.workspaceList(null, 'private', '', 'active', 1), [
        'recipe-workspace',
        null,
        'private',
        '',
        'active',
        1,
    ]);
    assert.deepEqual(recipeKeys.workspaceList('user-a', 'family', 'soup', 'archived', 3), [
        'recipe-workspace',
        'user-a',
        'family',
        'soup',
        'archived',
        3,
    ]);
});

void test('recipe detail keys preserve distinct public, personal and statistics projections', () => {
    assert.deepEqual(recipeKeys.publicDetail('recipe-a'), ['recipes', 'public', 'recipe-a']);
    assert.deepEqual(recipeKeys.personalRoot, ['recipes', 'personal']);
    assert.deepEqual(recipeKeys.personalDetail(undefined, 'recipe-a'), ['recipes', 'personal', undefined, 'recipe-a']);
    assert.deepEqual(recipeKeys.personal('user-a', 'recipe-a', 4), ['recipes', 'personal', 'user-a', 'recipe-a', 4]);
    assert.deepEqual(recipeKeys.statistics('recipe-a', 4), ['recipes', 'statistics', 'recipe-a', 4]);
});

void test('recipe detail adapter preserves exact projections, servings, caller bookmark identity and native errors', async () => {
    const calls: unknown[][] = [];
    const signal = new AbortController().signal;
    const detail = { id: 'recipe-a' };
    const personal = { bookmarked: false };
    const statistics = { sampleSize: 3 };
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            if (args[0] === 'GET /api/v1/recipes/{id}') return Promise.resolve({ data: { recipe: detail } });
            if (args[0] === 'GET /api/v1/recipes/{id}/personal') return Promise.resolve({ data: personal });
            if (args[0] === 'GET /api/v1/recipes/{id}/cooking-statistics') return Promise.resolve({ data: statistics });
            return Promise.resolve({ data: {} });
        },
    };
    const command = { bookmarked: true, idempotencyKey: 'bookmark-key' };

    assert.equal(await loadRecipeDetail(transport as never, 'recipe-a', signal), detail);
    assert.equal(await loadRecipePersonal(transport as never, 'recipe-a', 4, signal), personal);
    assert.equal(await loadRecipeStatistics(transport as never, 'recipe-a', 4, signal), statistics);
    await saveRecipeBookmark(transport as never, 'recipe-a', command, signal);
    assert.deepEqual(calls, [
        ['GET /api/v1/recipes/{id}', undefined, signal, { id: 'recipe-a' }],
        ['GET /api/v1/recipes/{id}/personal', undefined, signal, { id: 'recipe-a' }, { query: { servings: '4' } }],
        [
            'GET /api/v1/recipes/{id}/cooking-statistics',
            undefined,
            signal,
            { id: 'recipe-a' },
            { query: { servings: '4' } },
        ],
        ['POST /api/v1/recipes/{id}/bookmark', command, signal, { id: 'recipe-a' }],
    ]);
    assert.equal(calls[3]?.[1], command);

    const error = new Error('native detail error');
    await assert.rejects(
        loadRecipeDetail({ request: () => Promise.reject(error) } as never, 'recipe-a', signal),
        (actual) => actual === error,
    );
});

void test('recipe detail uses exact owners without changing reads, bookmark or logout semantics', async () => {
    const [source, adapter] = await Promise.all([
        readFile('src/features/recipes/detail.tsx', 'utf8'),
        readFile('src/features/recipes/detail-api.ts', 'utf8'),
    ]);
    assert.match(source, /queryKey: recipeKeys\.publicDetail\(id\)/u);
    assert.match(source, /queryKey: recipeKeys\.personal\(user\.data\?\.id, id, state\.servings\)/u);
    assert.match(source, /queryKey: recipeKeys\.statistics\(id, state\.servings\)/u);
    assert.match(source, /invalidateQueries\(\{ queryKey: recipeKeys\.personalDetail\(user\.data\?\.id, id\) \}\)/u);
    assert.match(source, /removeQueries\(\{ queryKey: recipeKeys\.personalRoot \}\)/u);
    assert.doesNotMatch(source, /queryKey: \[['"]recipes['"]/u);
    assert.match(source, /loadRecipeDetail\(api!, id, signal\)/u);
    assert.match(source, /loadRecipePersonal\(api!, id, state\.servings, signal\)/u);
    assert.match(source, /loadRecipeStatistics\(api!, id, state\.servings, signal\)/u);
    assert.match(source, /saveRecipeBookmark\(api, id, attempt\.current, abort\)/u);
    assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.match(adapter, /'GET \/api\/v1\/recipes\/\{id\}\/personal'/u);
    assert.match(adapter, /query: \{ servings: String\(servings\) \}/u);
    assert.match(adapter, /'POST \/api\/v1\/recipes\/\{id\}\/bookmark'/u);
    assert.match(
        source,
        /attempt\.current \?\?= \{ bookmarked: !personal\.data\.bookmarked, idempotencyKey: crypto\.randomUUID\(\) \}/u,
    );
    assert.match(source, /setUserSession\(runtime, null\)/u);
});

void test('recipe mine uses exact owners without changing pagination, offline or recovery semantics', async () => {
    const [source, adapter] = await Promise.all([
        readFile('src/features/recipes/mine.tsx', 'utf8'),
        readFile('src/features/recipes/mine-api.ts', 'utf8'),
    ]);
    assert.match(source, /queryKey: recipeKeys\.workspaceList\(owner, scope, q, status, page\)/u);
    assert.equal(source.match(/queryKey: recipeKeys\.workspaceRoot/gu)?.length, 2);
    assert.doesNotMatch(source, /queryKey: \[['"]recipe-workspace['"]/u);
    assert.match(source, /refetchType: ['"]none['"]/u);
    assert.match(source, /loadMineRecipes\(api!, \{ q, scope, status, page \}, signal\)/u);
    assert.match(source, /runMineRecipeCommand\(api, \{/u);
    assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.match(adapter, /'GET \/api\/v1\/recipe-workspace'/u);
    assert.match(adapter, /page: String\(input\.page\)/u);
    assert.match(adapter, /limit: ['"]20['"]/u);
    assert.equal(
        adapter.match(
            /transport\.request\('POST \/api\/v1\/recipe-workspace\/\{id\}\/(?:archive|restore|submit|rollback)'/gu,
        )?.length,
        4,
    );
    assert.match(source, /readOfflineSnapshotData<Success<'GET \/api\/v1\/recipe-workspace'>\['data'\]>/u);
    assert.match(source, /normalizeCachedWorkspaceList\(cached\)/u);
    assert.match(
        source,
        /attempt\.current \?\?= \{ id: recipe\.id, command: kind, version: recipe\.version, key: crypto\.randomUUID\(\) \}/u,
    );
    assert.match(source, /page \* 20 < query\.data\.total/u);
});

void test('recipe mine adapter preserves list filters, explicit actions, caller command identity and native errors', async () => {
    const calls: unknown[][] = [];
    const signal = new AbortController().signal;
    const list = { items: [], total: 0 };
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            return Promise.resolve({ data: list });
        },
    };
    const body = { idempotencyKey: 'mine-key', expectedVersion: 7 };

    assert.equal(
        await loadMineRecipes(transport as never, { q: 'soup', scope: 'family', status: 'archived', page: 3 }, signal),
        list,
    );
    for (const action of ['archive', 'restore', 'submit', 'rollback'] as const)
        await runMineRecipeCommand(transport as never, { action, id: 'recipe-a', body }, signal);

    assert.deepEqual(calls, [
        [
            'GET /api/v1/recipe-workspace',
            undefined,
            signal,
            undefined,
            { query: { q: 'soup', scope: 'family', status: 'archived', page: '3', limit: '20' } },
        ],
        ['POST /api/v1/recipe-workspace/{id}/archive', body, signal, { id: 'recipe-a' }],
        ['POST /api/v1/recipe-workspace/{id}/restore', body, signal, { id: 'recipe-a' }],
        ['POST /api/v1/recipe-workspace/{id}/submit', body, signal, { id: 'recipe-a' }],
        ['POST /api/v1/recipe-workspace/{id}/rollback', body, signal, { id: 'recipe-a' }],
    ]);
    assert.equal(calls[1]?.[1], body);

    const error = new Error('native mine error');
    await assert.rejects(
        loadMineRecipes(
            { request: () => Promise.reject(error) } as never,
            { q: '', scope: 'private', status: 'active', page: 1 },
            signal,
        ),
        (actual) => actual === error,
    );
});

void test('recipe allergens adapter preserves prepared report identity, data projection and native errors', async () => {
    const calls: unknown[][] = [];
    const ticket = { ticketId: 'ticket-a', ticketNumber: 'SUP-1' };
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            return Promise.resolve({ data: ticket });
        },
    };
    const command = {
        recipeId: 'recipe-a',
        revisionId: 'revision-a',
        unknownIngredientIds: ['ingredient-a'],
        note: 'Missing data',
        idempotencyKey: 'allergen-key',
    };

    assert.equal(await reportRecipeAllergens(transport as never, command), ticket);
    assert.deepEqual(calls, [['POST /api/v1/allergens/reports', command]]);
    assert.equal(calls[0]?.[1], command);

    const error = new Error('native allergen error');
    await assert.rejects(
        reportRecipeAllergens({ request: () => Promise.reject(error) } as never, command),
        (actual) => actual === error,
    );
});

void test('recipe allergens keeps persistent fingerprint and unknown-outcome UI ownership', async () => {
    const [source, adapter] = await Promise.all([
        readFile('src/features/recipes/allergens.tsx', 'utf8'),
        readFile('src/features/recipes/allergens-api.ts', 'utf8'),
    ]);
    assert.match(source, /const fingerprint = JSON\.stringify\(payload\)/u);
    assert.match(source, /reportAttempt\.current\?\.fingerprint !== fingerprint/u);
    assert.match(source, /idempotencyKey: crypto\.randomUUID\(\)/u);
    assert.match(source, /reportRecipeAllergens\(api, \{/u);
    assert.match(source, /revisionId: recipe\.revisionId/u);
    assert.match(source, /idempotencyKey: reportAttempt\.current\.idempotencyKey/u);
    assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.match(adapter, /'POST \/api\/v1\/allergens\/reports'/u);
    assert.doesNotMatch(adapter, /If-Match|headers/u);
});

void test('recipe editor uses exact owners without changing offline recovery or command semantics', async () => {
    const [source, adapter] = await Promise.all([
        readFile('src/features/recipes/editor.tsx', 'utf8'),
        readFile('src/features/recipes/editor-api.ts', 'utf8'),
    ]);

    assert.match(source, /queryKey: recipeKeys\.workspaceDetail\(owner, scope, id\)/u);
    assert.match(source, /queryKey: recipeKeys\.workspaceOfflineNew\(owner, draftId\)/u);
    assert.match(source, /queryKey: recipeKeys\.offlineDraftState\(owner, draftId\)/u);
    assert.match(source, /invalidateQueries\(\{ queryKey: recipeKeys\.workspaceRoot \}\)/u);
    assert.doesNotMatch(source, /queryKey: \[['"](?:recipe-workspace|offline-draft-state)['"]/u);
    assert.match(
        source,
        /attempt\.current \?\?= \{ key: crypto\.randomUUID\(\), document: structuredClone\(document\) \}/u,
    );
    assert.match(source, /loadRecipeEditorProducts\(api!, search, signal\)/u);
    assert.equal(source.match(/loadRecipeWorkspace\(/gu)?.length, 2);
    assert.match(source, /saveRecipeWorkspace\(/u);
    assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.match(adapter, /'POST \/api\/v1\/recipe-workspace'/u);
    assert.match(adapter, /'PUT \/api\/v1\/recipe-workspace\/\{id\}'/u);
    assert.match(source, /readOfflineSnapshotData<RecipeDocument>/u);
    assert.match(source, /readOfflineDraftState\(owner!, `draft:\$\{draftId\}`\)/u);
    assert.match(source, /refetchInterval: \(query\) => \(query\.state\.data\?\.unresolvedStatus \? 2_000 : false\)/u);
    assert.match(source, /if \(draftState\.data\?\.serverId\) router\.replace/u);
});

void test('recipe editor adapter preserves product/workspace reads and caller-prepared create/update commands', async () => {
    const calls: unknown[][] = [];
    const signal = new AbortController().signal;
    const products = { items: ['product'] };
    const recipe = { id: 'recipe-a', version: 4, document: { title: 'Recipe' } };
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            if (args[0] === 'GET /api/v1/products') return Promise.resolve({ data: products });
            return Promise.resolve({ data: { recipe } });
        },
    };
    const createBody = { document: { title: 'New' }, idempotencyKey: 'create-key', scope: 'private' };
    const updateBody = { document: { title: 'Updated' }, expectedVersion: 4, idempotencyKey: 'update-key' };

    assert.equal(await loadRecipeEditorProducts(transport as never, 'milk', signal), products);
    assert.equal(await loadRecipeWorkspace(transport as never, 'recipe-a', 'family', signal), recipe);
    assert.equal(
        await saveRecipeWorkspace(transport as never, { action: 'create', body: createBody } as never, signal),
        recipe,
    );
    assert.equal(
        await saveRecipeWorkspace(
            transport as never,
            { action: 'update', id: 'recipe-a', body: updateBody } as never,
            signal,
        ),
        recipe,
    );
    assert.deepEqual(calls, [
        ['GET /api/v1/products', undefined, signal, undefined, { query: { q: 'milk', limit: '100' } }],
        ['GET /api/v1/recipe-workspace/{id}', undefined, signal, { id: 'recipe-a' }, { query: { scope: 'family' } }],
        ['POST /api/v1/recipe-workspace', createBody, signal],
        ['PUT /api/v1/recipe-workspace/{id}', updateBody, signal, { id: 'recipe-a' }],
    ]);
    assert.equal(calls[2]?.[1], createBody);
    assert.equal(calls[3]?.[1], updateBody);

    const error = new Error('native editor error');
    await assert.rejects(
        loadRecipeWorkspace({ request: () => Promise.reject(error) } as never, 'recipe-a', 'private', signal),
        (actual) => actual === error,
    );
});

void test('recipe community uses exact owners without changing reads or command refresh breadth', async () => {
    const [source, adapter] = await Promise.all([
        readFile('src/features/recipes/community.tsx', 'utf8'),
        readFile('src/features/recipes/read-api.ts', 'utf8'),
    ]);

    assert.match(source, /queryKey: recipeKeys\.community\(user\.data\?\.id, id\)/u);
    assert.match(source, /invalidateQueries\(\{ queryKey: recipeKeys\.communityRoot \}\)/u);
    assert.match(source, /invalidateQueries\(\{ queryKey: recipeKeys\.publicDetail\(id\) \}\)/u);
    assert.doesNotMatch(source, /queryKey: \[['"](?:recipe-community|recipes['"], ['"]public)['"]/u);
    assert.match(source, /loadRecipeCommunity\(api!, id, signal\)/u);
    assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.match(adapter, /'GET \/api\/v1\/recipe-workspace\/\{id\}\/community'/u);
    assert.match(source, /enabled: !!api && !!user\.data/u);
    assert.match(source, /Promise\.all\(\[/u);
    assert.match(source, /'POST \/api\/v1\/recipe-workspace\/\{id\}\/comments'/u);
    assert.match(source, /'PATCH \/api\/v1\/recipe-workspace\/\{id\}\/comments\/\{commentId\}'/u);
    assert.match(source, /'POST \/api\/v1\/recipe-workspace\/\{id\}\/rating'/u);
    assert.match(source, /'POST \/api\/v1\/recipe-workspace\/\{id\}\/reports'/u);
    assert.match(source, /if \(result\) \{/u);
});

void test('cooking reminders use exact owners without changing preference command semantics', async () => {
    const [source, adapter] = await Promise.all([
        readFile('src/features/recipes/cooking-reminders.tsx', 'utf8'),
        readFile('src/features/recipes/cooking-reminders-api.ts', 'utf8'),
    ]);

    assert.match(source, /queryKey: recipeKeys\.cookingReminderPreferences\(user\.data\?\.id\)/u);
    assert.match(source, /invalidateQueries\(\{ queryKey: recipeKeys\.cookingRoot \}\)/u);
    assert.doesNotMatch(source, /queryKey: \[['"]cooking['"]/u);
    assert.match(source, /loadCookingReminderPreferences\(api!, signal\)/u);
    assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.match(adapter, /'GET \/api\/v1\/cooking-attempts\/reminder-preferences'/u);
    assert.match(source, /enabled: !!api && !!user\.data/u);
    assert.match(source, /'POST \/api\/v1\/cooking-attempts\/reminder-preferences'/u);
    assert.match(
        source,
        /const timezone = useDevice \? deviceTimezone\(\) : \(preferences\.data\?\.timezone \?\? deviceTimezone\(\)\)/u,
    );
    assert.match(source, /enabled,[\s\S]*\.\.\.\(timezone \? \{ timezone \} : \{\}\)/u);
    assert.match(source, /if \(result\) await queryClient\.invalidateQueries/u);
    assert.match(source, /role="switch"/u);
    assert.match(source, /aria-checked=\{preferences\.data\.enabled\}/u);
});

void test('public feed and comments use exact owners without changing pagination or filters', async () => {
    const [source, adapter] = await Promise.all([
        readFile('src/features/recipes/public-community.tsx', 'utf8'),
        readFile('src/features/recipes/read-api.ts', 'utf8'),
    ]);

    assert.match(source, /queryKey: recipeKeys\.publicCommunity\(author, q, category, sort\)/u);
    assert.match(source, /queryKey: recipeKeys\.publicComments\(recipeId\)/u);
    assert.doesNotMatch(source, /queryKey: \[['"](?:community|public-comments)['"]/u);
    assert.equal(source.match(/initialPageParam: null as string \| null/gu)?.length, 2);
    assert.equal(source.match(/getNextPageParam: \(page\) => page\.nextCursor \?\? undefined/gu)?.length, 2);
    assert.match(source, /loadPublicCommunity\(api!, \{ q, category, sort, author, cursor: pageParam \}, signal\)/u);
    assert.match(source, /loadPublicRecipeComments\(api!, recipeId, pageParam, signal\)/u);
    assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.match(adapter, /'GET \/api\/v1\/community'/u);
    assert.match(adapter, /'GET \/api\/v1\/community\/recipes\/\{id\}\/comments'/u);
    assert.match(source, /items\.filter\(\(item, index\) => items\.findIndex/u);
    assert.equal(source.match(/query\.isFetchNextPageError/gu)?.length, 2);
});

void test('recipe leaf readers use exact owners without changing transports, filters or response projections', async () => {
    const [catalog, family, prepared, adapter] = await Promise.all([
        readFile('src/features/recipes/catalog.tsx', 'utf8'),
        readFile('src/features/recipes/family-detail.tsx', 'utf8'),
        readFile('src/features/recipes/prepared.tsx', 'utf8'),
        readFile('src/features/recipes/read-api.ts', 'utf8'),
    ]);

    assert.match(catalog, /queryKey: recipeKeys\.catalog\(session\.data\?\.id, state\)/u);
    assert.doesNotMatch(catalog, /queryKey: \[['"]recipes['"], ['"]catalog['"]/u);
    assert.match(catalog, /const state = catalogState\(new URLSearchParams\(search\)\)/u);
    assert.match(catalog, /loadRecipeCatalog\(api!, state, signal\)/u);
    assert.doesNotMatch(catalog, /\.request\s*\(/u);
    assert.match(adapter, /'GET \/api\/v1\/recipes'/u);
    assert.match(adapter, /q: state\.q/u);
    assert.match(adapter, /\.\.\.\(state\.category \? \{ category: state\.category \} : \{\}\)/u);
    assert.match(adapter, /tab: state\.tab/u);
    assert.match(adapter, /page: String\(state\.page\)/u);
    assert.match(adapter, /limit: ['"]12['"]/u);
    assert.match(catalog, /enabled: !!api && !!session\.data && !personalized/u);

    assert.match(family, /queryKey: recipeKeys\.familyDetail\(session\.data\?\.id, id\)/u);
    assert.doesNotMatch(family, /queryKey: \[['"]recipe-workspace['"]/u);
    assert.match(family, /loadFamilyRecipe\(api!, id, signal\)/u);
    assert.match(family, /loadFamilyRecipeProducts\(api!, signal\)/u);
    assert.doesNotMatch(family, /\.request\s*\(/u);
    assert.match(adapter, /'GET \/api\/v1\/recipe-workspace\/\{id\}'/u);
    assert.match(adapter, /query: \{ scope: ['"]family['"] \}/u);
    assert.match(adapter, /'GET \/api\/v1\/products'/u);
    assert.match(adapter, /query: \{ limit: ['"]100['"] \}/u);
    assert.match(family, /queryKey: productKeys\.familyRecipeCatalog\(session\.data\?\.id\)/u);

    assert.match(prepared, /queryKey: recipeKeys\.preparedStockOptions\(user\.data\?\.id\)/u);
    assert.doesNotMatch(prepared, /queryKey: \[['"]cooking['"]/u);
    assert.match(prepared, /loadPreparedStockOptions\(api!, signal\)/u);
    assert.doesNotMatch(prepared, /\.request\s*\(/u);
    assert.match(adapter, /'GET \/api\/v1\/cooking-attempts\/stock-options'/u);
    assert.match(prepared, /const batch = search\.get\(['"]batch['"]\)/u);
    assert.match(prepared, /!batch \|\| row\.id === batch/u);
    assert.match(prepared, /enabled: !!api && !!user\.data/u);
});

void test('recipe report keys preserve exact account, page and detail tuples', () => {
    assert.deepEqual(recipeKeys.reports(undefined, 1), ['recipe-community', undefined, 'reports', 1]);
    assert.deepEqual(recipeKeys.reports('user-a', 3), ['recipe-community', 'user-a', 'reports', 3]);
    assert.deepEqual(recipeKeys.report(undefined, 'report-a'), ['recipe-report', undefined, 'report-a']);
    assert.deepEqual(recipeKeys.report('user-a', 'report-b'), ['recipe-report', 'user-a', 'report-b']);
    assert.notDeepEqual(recipeKeys.reports('user-a', 1), recipeKeys.report('user-a', '1'));
});

void test('recipe report adapter preserves exact pagination, path, signals, projections and native errors', async () => {
    const calls: unknown[][] = [];
    const signal = new AbortController().signal;
    const list = { items: [{ id: 'report-a' }], total: 1 };
    const detail = { id: 'report-a', status: 'pending' };
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            return Promise.resolve({ data: args[0] === 'GET /api/v1/recipe-workspace/reports' ? list : detail });
        },
    };
    assert.equal(await loadRecipeReports(transport as never, 3, signal), list);
    assert.equal(await loadRecipeReport(transport as never, 'report-a', signal), detail);
    assert.deepEqual(calls, [
        ['GET /api/v1/recipe-workspace/reports', undefined, signal, undefined, { query: { page: '3', limit: '20' } }],
        ['GET /api/v1/recipe-workspace/reports/{id}', undefined, signal, { id: 'report-a' }],
    ]);
    const error = new Error('native report error');
    await assert.rejects(
        loadRecipeReport({ request: () => Promise.reject(error) } as never, 'report-a', signal),
        (actual) => actual === error,
    );
});

void test('recipe report screens use exact owners without changing list and detail transports', async () => {
    const [source, adapter] = await Promise.all([
        readFile('src/features/recipes/reports.tsx', 'utf8'),
        readFile('src/features/recipes/reports-api.ts', 'utf8'),
    ]);

    assert.match(source, /queryKey: recipeKeys\.reports\(user\.data\?\.id, page\)/u);
    assert.match(source, /queryKey: recipeKeys\.report\(user\.data\?\.id, id\)/u);
    assert.doesNotMatch(source, /queryKey: \[['"]recipe-(?:community|report)['"]/u);
    assert.match(source, /const page = Math\.max\(1, Number\(search\.get\(['"]page['"]\)\) \|\| 1\)/u);
    assert.match(source, /loadRecipeReports\(api!, page, signal\)/u);
    assert.match(source, /loadRecipeReport\(api!, id, signal\)/u);
    assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.match(adapter, /'GET \/api\/v1\/recipe-workspace\/reports'/u);
    assert.match(adapter, /query: \{ page: String\(page\), limit: ['"]20['"] \}/u);
    assert.match(adapter, /'GET \/api\/v1\/recipe-workspace\/reports\/\{id\}'/u);
    assert.match(adapter, /undefined, signal, \{ id \}/u);
    assert.equal(source.match(/enabled: !!api && !!user\.data/gu)?.length, 2);
    assert.equal(
        source.match(/<RecipeError error=\{query\.error\} retry=\{\(\) => void query\.refetch\(\)\} \/>/gu)?.length,
        2,
    );
    assert.match(source, /page \* 20 < query\.data\.total/u);
    assert.match(source, /query\.data\.recipeId/u);
});
