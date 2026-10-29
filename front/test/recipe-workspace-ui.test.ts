import test from 'node:test';
import assert from 'node:assert/strict';
import {
    canSubmitCurrentRevision,
    emptyDocument,
    moveRow,
    publicationState,
    submissionProblems,
    type WorkspaceRecipe,
} from '../src/features/recipes/workspace-state.js';
import {
    readRecipeCache,
    storeRecipeCache,
    clearRecipeCache,
    recipeCacheKey,
} from '../src/entities/recipe-cache/model.js';
import { publicRecipeFixtures } from '../src/mocks/recipe-fixtures.js';
void test('draft minimum is enforced only on submit; reorder preserves ingredient identity', () => {
    const draft = emptyDocument();
    assert.equal(submissionProblems(draft).length, 3);
    assert.deepEqual(moveRow(['a', 'b', 'c'], 1, -1), ['b', 'a', 'c']);
    assert.deepEqual(moveRow(['a', 'b'], 0, -1), ['a', 'b']);
    draft.title = 'Soup';
    draft.ingredients = [
        {
            ingredientId: '10000000-0000-4000-8000-000000000001',
            variantId: null,
            productId: null,
            sourceRecipeId: null,
            quantity: null,
            unit: null,
            optional: false,
        },
    ];
    draft.steps = [{ text: 'Cook', durationSeconds: null, temperature: null }];
    assert.deepEqual(submissionProblems(draft), []);
});
void test('offline read cache keeps two recipes, scopes by user, expires and clears', () => {
    const data = new Map<string, string>();
    const storage = {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => {
            data.set(key, value);
        },
        removeItem: (key: string) => {
            data.delete(key);
        },
    };
    const recipes = publicRecipeFixtures();
    for (const recipe of recipes.slice(0, 3)) storeRecipeCache(storage, 'user-one', recipe);
    assert.equal(readRecipeCache(storage, 'user-one').length, 2);
    assert.equal(readRecipeCache(storage, 'other').length, 0);
    storeRecipeCache(storage, 'user-one', recipes[0]!, new Date(Date.now() - 31 * 86400000).toISOString());
    assert.equal(readRecipeCache(storage, 'user-one').length, 1);
    clearRecipeCache(storage);
    assert.equal(data.has(recipeCacheKey), false);
    data.set(recipeCacheKey, 'bad-json');
    assert.deepEqual(readRecipeCache(storage, 'user-one'), []);
});

void test('public link follows publication axis while review can describe a newer rejected revision', () => {
    const fixture = publicRecipeFixtures()[0]!;
    const currentRevisionId = crypto.randomUUID();
    const recipe = {
        id: fixture.id,
        revisionId: currentRevisionId,
        review: { revisionId: currentRevisionId, status: 'rejected', publicReason: 'Уточните способ приготовления' },
        publication: { revisionId: fixture.revisionId, publishedAt: fixture.publishedAt },
    } as WorkspaceRecipe;
    assert.deepEqual(publicationState(recipe), {
        label: 'Опубликована предыдущая редакция; текущая редакция остаётся приватной',
        publicHref: `/recipes/${fixture.id}`,
        mismatch: true,
    });
    assert.equal(publicationState({ ...recipe, publication: null }).publicHref, null);
    assert.equal(canSubmitCurrentRevision(recipe), false);
    assert.equal(canSubmitCurrentRevision({ ...recipe, revisionId: crypto.randomUUID() }), true);
});
