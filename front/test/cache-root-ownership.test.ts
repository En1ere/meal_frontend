import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { offlineQueryRoots } from '../src/entities/offline/query-keys.js';
import { recipeQueryRoots } from '../src/entities/recipe/query-keys.js';
import { shoppingQueryRoots } from '../src/entities/shopping/query-keys.js';
import { recipeKeys } from '../src/features/recipes/query-keys.js';

const ordered = (source: string, markers: string[]) => {
    let cursor = -1;
    for (const marker of markers) {
        const index = source.indexOf(marker, cursor + 1);
        assert.ok(index > cursor, `${marker} must follow the previous invalidation`);
        cursor = index;
    }
};

void test('cross-context roots preserve exact tuples and recipe aliases', () => {
    assert.deepEqual(shoppingQueryRoots, {
        root: ['shopping'],
        receiptsRoot: ['receipts'],
        purchasesRoot: ['purchases'],
    });
    assert.deepEqual(recipeQueryRoots, { cookingRoot: ['cooking'], workspaceRoot: ['recipe-workspace'] });
    assert.deepEqual(offlineQueryRoots.draftStateRoot, ['offline-draft-state']);
    assert.equal(recipeKeys.cookingRoot, recipeQueryRoots.cookingRoot);
    assert.equal(recipeKeys.workspaceRoot, recipeQueryRoots.workspaceRoot);
});

void test('shopping command keeps success fan-out and 401 removal order explicit', async () => {
    const source = await readFile('src/features/shopping/use-command.ts', 'utf8');
    ordered(source, [
        'queryKey: shoppingQueryRoots.root',
        'queryKey: shoppingQueryRoots.receiptsRoot',
        'queryKey: shoppingQueryRoots.purchasesRoot',
        'queryKey: inventoryKeys.root',
        'queryKey: inventoryKeys.historyRoot',
        'api.invalidate()',
        'setUserSession(runtime, null)',
        'removeQueries({ queryKey: shoppingQueryRoots.root })',
        'removeQueries({ queryKey: shoppingQueryRoots.receiptsRoot })',
        'removeQueries({ queryKey: shoppingQueryRoots.purchasesRoot })',
    ]);
    assert.match(source, /if \(abort\.aborted\) return;[\s\S]*frozen\.current = null;[\s\S]*await Promise\.all\(\[/u);
    assert.doesNotMatch(source, /\.map\(\(key\)|queryKey: \[key\]/u);
});

void test('preserve command keeps success-only fan-out order explicit', async () => {
    const source = await readFile('src/features/preserves/use-command.ts', 'utf8');
    ordered(source, [
        'queryKey: preserveKeys.root',
        'queryKey: recipeQueryRoots.cookingRoot',
        'queryKey: inventoryKeys.root',
        'queryKey: inventoryKeys.historyRoot',
        'queryKey: recipeQueryRoots.workspaceRoot',
    ]);
    assert.match(source, /if \(abort\.aborted\) return;[\s\S]*frozen\.current = null;[\s\S]*await Promise\.all\(\[/u);
    assert.doesNotMatch(source, /\.map\(\(key\)|queryKey: \[key\]/u);
});

void test('offline sync keeps active guard and complete fan-out order explicit', async () => {
    const source = await readFile('src/features/offline/sync-coordinator.tsx', 'utf8');
    ordered(source, [
        'await syncOfflineQueue(api, owner)',
        'if (!active) return',
        'queryKey: shoppingQueryRoots.root',
        'queryKey: shoppingQueryRoots.receiptsRoot',
        'queryKey: shoppingQueryRoots.purchasesRoot',
        'queryKey: inventoryKeys.root',
        'queryKey: recipeQueryRoots.workspaceRoot',
        'queryKey: recipeQueryRoots.cookingRoot',
        'queryKey: offlineQueryRoots.draftStateRoot',
    ]);
    assert.doesNotMatch(source, /\.map\(\(key\)|queryKey: \[key\]/u);
});
