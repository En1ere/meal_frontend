import assert from 'node:assert/strict';
import test from 'node:test';
import { familyKeys } from '../src/entities/family/model.js';

void test('family entity preserves canonical prefix and account-scoped query keys', () => {
    assert.deepEqual(familyKeys.all, ['family']);
    assert.deepEqual(familyKeys.context(undefined), ['family', undefined]);
    assert.deepEqual(familyKeys.context('user-a'), ['family', 'user-a']);
});
