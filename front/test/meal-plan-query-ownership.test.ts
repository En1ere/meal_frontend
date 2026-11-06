import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { mealPlanKeys as publicMealPlanKeys } from '../src/entities/meal-plan/model.js';
import { mealPlanKeys } from '../src/entities/meal-plan/query-keys.js';

void test('meal-plan entity preserves exact distinct tuples and selection identity', () => {
    const selection = { scope: 'private', view: 'week', date: '2026-11-05', timezone: 'Asia/Yekaterinburg' };
    const planKey = mealPlanKeys.plan('user-a', selection);

    assert.equal(publicMealPlanKeys, mealPlanKeys);
    assert.deepEqual(mealPlanKeys.root, ['meal-plan']);
    assert.deepEqual(mealPlanKeys.forAccount(undefined), ['meal-plan', undefined]);
    assert.deepEqual(mealPlanKeys.forAccount('user-a'), ['meal-plan', 'user-a']);
    assert.deepEqual(mealPlanKeys.automationRecipes('user-a'), ['meal-plan', 'automation-recipes', 'user-a']);
    assert.deepEqual(mealPlanKeys.pageRecipes('user-a'), ['meal-plan', 'recipes', 'user-a']);
    assert.deepEqual(mealPlanKeys.portions('private', undefined), ['portions', 'private', undefined]);
    assert.deepEqual(mealPlanKeys.portions('family', 'user-a'), ['portions', 'family', 'user-a']);
    assert.deepEqual(planKey, ['meal-plan', 'user-a', selection]);
    assert.equal(planKey[2], selection);
    assert.notDeepEqual(mealPlanKeys.automationRecipes('user-a'), mealPlanKeys.pageRecipes('user-a'));
});

void test('meal-plan and subscription consumers use exact owners without changing commands', async () => {
    const [automation, page, adapter, subscription] = await Promise.all([
        readFile('src/features/meal-plan/automation.tsx', 'utf8'),
        readFile('src/features/meal-plan/page.tsx', 'utf8'),
        readFile('src/features/meal-plan/api.ts', 'utf8'),
        readFile('src/features/subscription/subscription-page.tsx', 'utf8'),
    ]);
    const sources = [automation, page, subscription];

    assert.equal(sources.flatMap((source) => source.match(/mealPlanKeys\./gu) ?? []).length, 7);
    for (const source of sources) assert.doesNotMatch(source, /\[['"]meal-plan['"]/u);

    assert.match(automation, /queryKey: mealPlanKeys\.automationRecipes\(user\.data\?\.id\)/u);
    assert.match(automation, /loadMealPlanRecipes\(api!, signal\)/u);
    assert.match(adapter, /'GET \/api\/v1\/recipes'/u);
    assert.match(adapter, /query: \{ q: ['"]['"], tab: ['"]new['"], page: ['"]1['"], limit: ['"]100['"] \}/u);
    assert.match(automation, /previewMealPlanAutomation\(api, \{/u);
    assert.match(automation, /commitMealPlanAutomation\(api, \{/u);
    assert.match(adapter, /'POST \/api\/v1\/meal-plan\/automation-preview'/u);
    assert.match(adapter, /'POST \/api\/v1\/meal-plan\/automation-commit'/u);
    assert.match(automation, /idempotencyKey: crypto\.randomUUID\(\)/u);

    assert.match(page, /queryKey: mealPlanKeys\.pageRecipes\(user\.data\?\.id\)/u);
    assert.match(page, /queryKey: familyKeys\.planContext\(user\.data\?\.id\)/u);
    assert.match(page, /queryKey: mealPlanKeys\.portions\(scope, user\.data\?\.id\)/u);
    assert.match(page, /loadMealPlanFamily\(api!, signal\)/u);
    assert.match(page, /loadMealPlanPortions\(api!, scope, signal\)/u);
    assert.match(adapter, /'GET \/api\/v1\/family'/u);
    assert.match(adapter, /'GET \/api\/v1\/portions'/u);
    assert.match(adapter, /query: \{ scope \}/u);
    assert.match(page, /assignMealPlanPortion\(api, \{/u);
    assert.match(page, /decideMealPlanPortion\(api, id, \{/u);
    assert.match(adapter, /'POST \/api\/v1\/portions\/assign'/u);
    assert.match(adapter, /'POST \/api\/v1\/portions\/\{id\}\/decision'/u);
    assert.match(page, /queryKey: mealPlanKeys\.plan\(user\.data\?\.id, selection\)/u);
    assert.equal(page.match(/queryKey: mealPlanKeys\.forAccount\(user\.data\?\.id\)/gu)?.length, 2);
    assert.match(page, /loadMealPlan\(api!, selection, signal\)/u);
    assert.match(adapter, /'GET \/api\/v1\/meal-plan'/u);
    assert.match(adapter, /query: selection/u);
    assert.match(page, /previewMealPlanChange\(api, \{/u);
    assert.match(page, /commitMealPlanChange\(api, \{/u);
    assert.match(page, /previewMealPlanShopping\(api, \{/u);
    assert.match(page, /commitMealPlanShopping\(api, \{/u);
    assert.match(adapter, /'POST \/api\/v1\/meal-plan\/change-preview'/u);
    assert.match(adapter, /'POST \/api\/v1\/meal-plan\/change-commit'/u);
    assert.match(adapter, /'POST \/api\/v1\/meal-plan\/shopping-preview'/u);
    assert.match(adapter, /'POST \/api\/v1\/meal-plan\/shopping-commit'/u);

    assert.match(subscription, /queryKey: mealPlanKeys\.root/u);
    assert.match(subscription, /queryKey: aiBalanceKeys\.forAccount\(session\.data\?\.id\)/u);
    assert.match(subscription, /queryKey: familyKeys\.context\(session\.data\?\.id\)/u);
    assert.match(subscription, /expectedVersion: version/u);
    assert.match(subscription, /idempotencyKey: commitKey\.current/u);
});
