import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSeed } from '../src/mocks/model.js';
import { mealPlanHandle } from '../src/mocks/meal-plan.js';
import { publicRecipeFixtures } from '../src/mocks/recipe-fixtures.js';

const owner = '10000000-0000-4000-8000-000000000005';
const member = '10000000-0000-4000-8000-000000000006';
const freeUser = '10000000-0000-4000-8000-000000000007';
const proUser = '10000000-0000-4000-8000-000000000003';
const start = Date.parse('2026-10-01T10:00:00.000Z');

async function call(
    state: ReturnType<typeof createSeed>,
    userId: string,
    path: string,
    method: string,
    input?: unknown,
    query = '',
    now = start,
) {
    const response = mealPlanHandle({
        state,
        userId,
        path,
        method,
        query: new URLSearchParams(query),
        input,
        now,
        success: (data) => Response.json(data),
        fail: (status) => Response.json({}, { status }),
    })!;
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

await test('family members see one shared range plan with per-member portions', async () => {
    const state = createSeed();
    const query = 'scope=family&view=range&date=2026-09-28&endDate=2026-10-11&timezone=Europe%2FMoscow';
    const first = await call(state, owner, '/api/v1/meal-plan', 'GET', undefined, query);
    const second = await call(state, member, '/api/v1/meal-plan', 'GET', undefined, query);
    assert.equal(first.status, 200);
    assert.deepEqual(first.body, second.body);
    const entries = first.body.entries as Array<{ assignments: unknown[] }>;
    assert.equal(entries[0]?.assignments.length, 2);
});

await test('calendar returns the selected month only for Pro', async () => {
    const state = createSeed();
    const query = 'scope=private&view=calendar&date=2026-10-18&timezone=Europe%2FMoscow';
    const pro = await call(state, proUser, '/api/v1/meal-plan', 'GET', undefined, query);
    assert.equal(pro.status, 200);
    assert.equal(pro.body.startsOn, '2026-10-01');
    assert.equal(pro.body.endsOn, '2026-10-31');
    assert.equal(pro.body.view, 'calendar');
    assert.equal((await call(state, owner, '/api/v1/meal-plan', 'GET', undefined, query)).status, 403);
    assert.equal((await call(state, freeUser, '/api/v1/meal-plan', 'GET', undefined, query)).status, 403);
});

await test('Pro optimization ranks complete nutrition deterministically and rotates candidates', async () => {
    const state = createSeed();
    const recipes = publicRecipeFixtures();
    const selection = {
        scope: 'private' as const,
        view: 'range' as const,
        date: '2026-10-12',
        endDate: '2026-10-25',
        timezone: 'Europe/Moscow',
    };
    const current = await call(
        state,
        proUser,
        '/api/v1/meal-plan',
        'GET',
        undefined,
        'scope=private&view=range&date=2026-10-12&endDate=2026-10-25&timezone=Europe%2FMoscow',
    );
    const preview = await call(state, proUser, '/api/v1/meal-plan/automation-preview', 'POST', {
        version: current.body.version,
        selection,
        rule: {
            recipeId: recipes[1]!.id,
            revisionId: recipes[1]!.revisionId,
            alternatives: [{ recipeId: recipes[0]!.id, revisionId: recipes[0]!.revisionId }],
            optimization: {
                priorities: ['nutrition', 'expiry', 'budget'],
                maxBudgetMinor: 100000,
                targetMealSharePercent: 33,
            },
            meal: 'dinner',
            weekdays: [1, 4],
            portions: 2,
            conflictPolicy: 'skip-existing',
        },
    });
    assert.equal(preview.status, 200);
    const optimization = preview.body.optimization as {
        candidates: Array<{ recipeId: string; rank: number }>;
        warnings: string[];
    };
    assert.equal(optimization.candidates[0]?.recipeId, recipes[0]!.id);
    assert.equal(optimization.candidates[0]?.rank, 1);
    assert.ok(optimization.warnings.includes('missing_prices'));
    const proposed = preview.body.proposedEntries as Array<{ recipe: { id: string } }>;
    assert.deepEqual(
        proposed.slice(0, 4).map((entry) => entry.recipe.id),
        [recipes[0]!.id, recipes[1]!.id, recipes[0]!.id, recipes[1]!.id],
    );
});

await test('prepared portion is debited on assignment, auto-confirms after 24h and can be cancelled by recipient', async () => {
    const state = createSeed();
    const initial = await call(state, owner, '/api/v1/portions', 'GET', undefined, 'scope=family');
    const source = (initial.body.prepared as Array<{ batchId: string; quantity: string; version: number }>)[0]!;
    const assigned = await call(state, owner, '/api/v1/portions/assign', 'POST', {
        scope: 'family',
        batchId: source.batchId,
        recipientUserId: member,
        quantity: '1',
        expectedBatchVersion: source.version,
        idempotencyKey: '90000000-0000-4000-8000-000000000090',
    });
    assert.equal(assigned.status, 200);
    assert.equal((assigned.body.prepared as Array<{ quantity: string }>)[0]?.quantity, '3');
    const due = await call(state, member, '/api/v1/portions', 'GET', undefined, 'scope=family', start + 86400001);
    const proposal = (due.body.proposals as Array<{ id: string; state: string; version: number }>)[0]!;
    assert.equal(proposal.state, 'auto_confirmed');
    const cancelled = await call(
        state,
        member,
        `/api/v1/portions/${proposal.id}/decision`,
        'POST',
        {
            scope: 'family',
            decision: 'cancelled',
            expectedVersion: proposal.version,
            idempotencyKey: '90000000-0000-4000-8000-000000000091',
        },
        '',
        start + 86400001,
    );
    assert.equal(cancelled.status, 200);
    assert.equal((cancelled.body.prepared as Array<{ quantity: string }>)[0]?.quantity, '3');
    assert.equal((cancelled.body.proposals as Array<{ state: string }>)[0]?.state, 'cancelled');
    assert.equal(
        state.diary.entries.filter((row) => row.userId === member).length,
        0,
        'Plus portion lifecycle must not create Pro diary history',
    );
});

await test('Plus preview uses real calendar dates and automation commit is idempotent', async () => {
    const state = createSeed();
    const selection = {
        scope: 'private' as const,
        view: 'range' as const,
        date: '2026-01-01',
        endDate: '2026-12-31',
        timezone: 'Europe/Moscow',
    };
    const current = await call(
        state,
        owner,
        '/api/v1/meal-plan',
        'GET',
        undefined,
        'scope=private&view=range&date=2026-01-01&endDate=2026-12-31&timezone=Europe%2FMoscow',
    );
    assert.equal(current.status, 200);
    const recipe = publicRecipeFixtures()[0]!;
    const request = {
        version: current.body.version as number,
        selection,
        rule: {
            recipeId: recipe.id,
            revisionId: recipe.revisionId,
            meal: 'breakfast' as const,
            weekdays: [4],
            portions: 2,
            conflictPolicy: 'skip-existing' as const,
        },
    };
    const preview = await call(state, owner, '/api/v1/meal-plan/automation-preview', 'POST', request);
    assert.equal(preview.status, 200);
    assert.equal(preview.body.occurrences, 53);
    assert.deepEqual(preview.body.conflicts, []);
    const commit = {
        ...request,
        previewToken: preview.body.previewToken,
        idempotencyKey: '90000000-0000-4000-8000-000000000092',
    };
    const first = await call(state, owner, '/api/v1/meal-plan/automation-commit', 'POST', commit);
    const replay = await call(state, owner, '/api/v1/meal-plan/automation-commit', 'POST', commit);
    assert.equal(first.status, 200);
    assert.deepEqual(replay.body, first.body);
    assert.equal((first.body.entries as unknown[]).length, 55);

    const conflictPreview = await call(state, owner, '/api/v1/meal-plan/automation-preview', 'POST', {
        version: first.body.version,
        selection: {
            ...selection,
            date: '2026-09-28',
            endDate: '2026-10-11',
        },
        rule: {
            ...request.rule,
            meal: 'dinner',
            weekdays: [1],
        },
    });
    assert.equal(conflictPreview.status, 200);
    assert.equal(conflictPreview.body.occurrences, 1);
    assert.deepEqual(
        (conflictPreview.body.conflicts as Array<{ date: string; locked: boolean }>).map(({ date, locked }) => ({
            date,
            locked,
        })),
        [{ date: '2026-09-28', locked: true }],
    );
});

await test('Free cannot use long-range planning, automation or smart shopping', async () => {
    const state = createSeed();
    const rangeQuery = 'scope=private&view=range&date=2026-01-01&endDate=2026-12-31&timezone=Europe%2FMoscow';
    assert.equal((await call(state, freeUser, '/api/v1/meal-plan', 'GET', undefined, rangeQuery)).status, 403);

    const weekQuery = 'scope=private&view=week&date=2026-09-28&timezone=Europe%2FMoscow';
    const current = await call(state, freeUser, '/api/v1/meal-plan', 'GET', undefined, weekQuery);
    assert.equal(current.status, 200);
    const selection = {
        scope: 'private' as const,
        view: 'week' as const,
        date: '2026-09-28',
        timezone: 'Europe/Moscow',
    };
    const shopping = await call(state, freeUser, '/api/v1/meal-plan/shopping-preview', 'POST', {
        version: current.body.version,
        selection,
    });
    assert.equal(shopping.status, 403);

    const recipe = publicRecipeFixtures()[0]!;
    const automation = await call(state, freeUser, '/api/v1/meal-plan/automation-preview', 'POST', {
        version: current.body.version,
        selection: { ...selection, view: 'range', endDate: '2026-10-11' },
        rule: {
            recipeId: recipe.id,
            revisionId: recipe.revisionId,
            meal: 'breakfast',
            weekdays: [1],
            portions: 1,
            conflictPolicy: 'skip-existing',
        },
    });
    assert.equal(automation.status, 403);
});
