import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    adminReleaseDraftKey,
    clearAdminPrivateStorage,
    removeLegacyAdminPrivateStorage,
} from '../src/shared/storage/private-cache.js';

void test('private release cache is cleared on auth reset and legacy cleanup is fail-safe', () => {
    const removed: string[] = [];
    const storage = { removeItem: (key: string) => void removed.push(key) };
    clearAdminPrivateStorage(storage);
    removeLegacyAdminPrivateStorage(storage);
    assert.deepEqual(removed, [adminReleaseDraftKey, 'meal-admin-release-pending-v1']);
    const unavailable = {
        removeItem: () => {
            throw new Error('unavailable');
        },
    };
    assert.doesNotThrow(() => clearAdminPrivateStorage(unavailable));
    assert.doesNotThrow(() => removeLegacyAdminPrivateStorage(unavailable));
});
