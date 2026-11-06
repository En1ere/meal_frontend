import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
    assignMealPlanPortion,
    commitMealPlanAutomation,
    commitMealPlanChange,
    commitMealPlanShopping,
    decideMealPlanPortion,
    loadMealPlan,
    loadMealPlanEntitlements,
    loadMealPlanFamily,
    loadMealPlanPortions,
    loadMealPlanRecipes,
    previewMealPlanAutomation,
    previewMealPlanChange,
    previewMealPlanShopping,
} from '../src/features/meal-plan/api.js';

void test('meal-plan adapter preserves selection identity, reads, prepared commands and native errors', async () => {
    const calls: unknown[][] = [];
    const data = { items: ['recipe'], previewToken: 'preview-a', listId: 'list-a' };
    const envelope = { data };
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            return Promise.resolve(envelope);
        },
    };
    const signal = new AbortController().signal;
    const selection = {
        scope: 'family',
        view: 'range',
        date: '2026-11-06',
        endDate: '2026-11-19',
        timezone: 'Asia/Yekaterinburg',
    } as const;
    const command = { idempotencyKey: 'caller-key', version: 7, selection } as never;

    assert.equal(await loadMealPlanRecipes(transport as never, signal), data.items);
    assert.equal(await loadMealPlanEntitlements(transport as never, signal), data);
    assert.equal(await loadMealPlanFamily(transport as never, signal), data);
    assert.equal(await loadMealPlan(transport as never, selection, signal), data);
    assert.equal(await loadMealPlanPortions(transport as never, 'family', signal), data);
    assert.equal(await previewMealPlanChange(transport as never, command), data);
    assert.equal(await commitMealPlanChange(transport as never, command), envelope);
    assert.equal(await previewMealPlanShopping(transport as never, command), data);
    assert.equal(await commitMealPlanShopping(transport as never, command), data);
    assert.equal(await assignMealPlanPortion(transport as never, command), envelope);
    assert.equal(await decideMealPlanPortion(transport as never, 'portion-a', command), envelope);
    assert.equal(await previewMealPlanAutomation(transport as never, command), data);
    assert.equal(await commitMealPlanAutomation(transport as never, command), envelope);

    assert.deepEqual(calls, [
        [
            'GET /api/v1/recipes',
            undefined,
            signal,
            undefined,
            { query: { q: '', tab: 'new', page: '1', limit: '100' } },
        ],
        ['GET /api/v1/entitlements', undefined, signal],
        ['GET /api/v1/family', undefined, signal],
        ['GET /api/v1/meal-plan', undefined, signal, undefined, { query: selection }],
        ['GET /api/v1/portions', undefined, signal, undefined, { query: { scope: 'family' } }],
        ['POST /api/v1/meal-plan/change-preview', command],
        ['POST /api/v1/meal-plan/change-commit', command],
        ['POST /api/v1/meal-plan/shopping-preview', command],
        ['POST /api/v1/meal-plan/shopping-commit', command],
        ['POST /api/v1/portions/assign', command],
        ['POST /api/v1/portions/{id}/decision', command, undefined, { id: 'portion-a' }],
        ['POST /api/v1/meal-plan/automation-preview', command],
        ['POST /api/v1/meal-plan/automation-commit', command],
    ]);
    assert.equal((calls[3]?.[4] as { query: unknown }).query, selection);

    const error = new Error('transport failed');
    await assert.rejects(
        loadMealPlanFamily({ request: () => Promise.reject(error) } as never),
        (actual) => actual === error,
    );
});

void test('meal-plan screens use the private adapter while UI retains planning orchestration', async () => {
    const [page, automation, adapter] = await Promise.all([
        readFile('src/features/meal-plan/page.tsx', 'utf8'),
        readFile('src/features/meal-plan/automation.tsx', 'utf8'),
        readFile('src/features/meal-plan/api.ts', 'utf8'),
    ]);
    for (const source of [page, automation]) assert.doesNotMatch(source, /\.request\s*\(/u);

    assert.match(page, /loadMealPlan\(api!, selection, signal\)/u);
    assert.match(page, /loadMealPlanPortions\(api!, scope, signal\)/u);
    assert.match(page, /previewMealPlanChange\(api, \{/u);
    assert.match(page, /commitMealPlanChange\(api, \{/u);
    assert.match(page, /previewMealPlanShopping\(api, \{/u);
    assert.match(page, /commitMealPlanShopping\(api, \{/u);
    assert.match(page, /assignMealPlanPortion\(api, \{/u);
    assert.match(page, /decideMealPlanPortion\(api, id, \{/u);
    assert.match(automation, /previewMealPlanAutomation\(api, \{/u);
    assert.match(automation, /commitMealPlanAutomation\(api, \{/u);

    assert.match(page, /const selection = useMemo\(/u);
    assert.match(page, /idempotencyKey: crypto\.randomUUID\(\)/u);
    assert.match(automation, /idempotencyKey: crypto\.randomUUID\(\)/u);
    assert.match(page, /queryClient\.invalidateQueries\(\{ queryKey: mealPlanKeys\.forAccount/u);
    assert.match(page, /router\.push/u);
    assert.match(page, /await portions\.refetch\(\)/u);
    assert.match(automation, /setFrozenRule\(rule\)/u);
    assert.match(automation, /await onCommitted\(\)/u);
    assert.match(adapter, /query: selection/u);
});
