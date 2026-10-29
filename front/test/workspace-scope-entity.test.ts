import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWorkspaceScopeStore } from '../src/entities/workspace-scope/model.js';

await test('workspace scope initializes once per user and resets between accounts', () => {
    const store = createWorkspaceScopeStore();
    assert.deepEqual(
        { scope: store.getState().scope, initializedFor: store.getState().initializedFor },
        { scope: 'personal', initializedFor: null },
    );

    store.getState().initializeScope('user-a', true);
    assert.deepEqual(
        { scope: store.getState().scope, initializedFor: store.getState().initializedFor },
        { scope: 'family', initializedFor: 'user-a' },
    );

    store.getState().initializeScope('user-a', false);
    assert.equal(store.getState().scope, 'family');

    store.getState().setScope('personal');
    assert.deepEqual(
        { scope: store.getState().scope, initializedFor: store.getState().initializedFor },
        { scope: 'personal', initializedFor: 'user-a' },
    );

    store.getState().initializeScope('user-b', false);
    assert.deepEqual(
        { scope: store.getState().scope, initializedFor: store.getState().initializedFor },
        { scope: 'personal', initializedFor: 'user-b' },
    );

    store.getState().setScopeFor('user-b', 'family');
    assert.equal(store.getState().scope, 'family');

    store.getState().reset();
    assert.deepEqual(
        { scope: store.getState().scope, initializedFor: store.getState().initializedFor },
        { scope: 'personal', initializedFor: null },
    );
});
