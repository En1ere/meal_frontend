import assert from 'node:assert/strict';
import test from 'node:test';
import { keepExactAttempt } from '../src/features/family/exact-attempt.js';

void test('family create retry keeps the original payload and idempotency key when the draft changes', () => {
    const first = keepExactAttempt(null, { name: 'Первоначальная семья' }, () => 'create-key');
    const retry = keepExactAttempt(first, { name: 'Изменённое название' }, () => 'different-key');

    assert.equal(retry, first);
    assert.deepEqual(retry.body, { name: 'Первоначальная семья', idempotencyKey: 'create-key' });
});

void test('family leave retry keeps expected version, mode and successor together with its key', () => {
    const first = keepExactAttempt<{
        expectedVersion: number;
        selection: 'automatic' | 'manual';
        successorMembershipId: string | null;
    }>(
        null,
        {
            expectedVersion: 7,
            selection: 'manual' as const,
            successorMembershipId: 'member-a',
        },
        () => 'leave-key',
    );
    const retry = keepExactAttempt(
        first,
        {
            expectedVersion: 8,
            selection: 'automatic' as const,
            successorMembershipId: null,
        },
        () => 'different-key',
    );

    assert.equal(retry, first);
    assert.deepEqual(retry.body, {
        expectedVersion: 7,
        selection: 'manual',
        successorMembershipId: 'member-a',
        idempotencyKey: 'leave-key',
    });
});

void test('a reconciled known failure can start a new family intent with a new key', () => {
    const next = keepExactAttempt(null, { name: 'Новая семья' }, () => 'new-key');
    assert.deepEqual(next.body, { name: 'Новая семья', idempotencyKey: 'new-key' });
});
