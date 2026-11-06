import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
    applyModerationQueueAction,
    decideModerationItem,
    loadModerationItem,
    loadModerationOverview,
    loadModerationQueue,
    loadModerationSupport,
    reopenModerationSupport,
    replyToModerationSupport,
} from '../src/features/moderation/api.js';
import { moderationKeys } from '../src/features/moderation/query-keys.js';

void test('moderation keys preserve exact roots, queue filters, item and support tuples', () => {
    const filters = { status: 'pending', assignment: 'mine', priority: 'high' };
    assert.deepEqual(moderationKeys.root, ['moderator']);
    assert.deepEqual(moderationKeys.overview, ['moderator', 'overview']);
    assert.deepEqual(moderationKeys.queueRoot('recipes'), ['moderator', 'queue', 'recipes']);
    assert.deepEqual(moderationKeys.queue('recipes', filters), ['moderator', 'queue', 'recipes', filters]);
    assert.equal(moderationKeys.queue('recipes', filters)[3], filters);
    assert.deepEqual(moderationKeys.item('item-a'), ['moderator', 'item', 'item-a']);
    assert.deepEqual(moderationKeys.support('ticket-a'), ['moderator', 'support', 'ticket-a']);
});

void test('moderation adapter preserves reads, pagination, prepared commands, dispatch and native errors', async () => {
    const calls: unknown[][] = [];
    const data = { marker: 'data' };
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            return Promise.resolve({ data });
        },
    };
    const signal = new AbortController().signal;
    const filters = { status: 'pending', assignment: 'mine', priority: 'high' };
    const queueCommand = { version: 2, idempotencyKey: 'queue-key' } as never;
    const decisionCommand = {
        action: 'approve',
        category: 'quality',
        reason: 'accepted',
        version: 3,
        idempotencyKey: 'decision-key',
    } as never;
    const replyCommand = { message: 'reply', version: 4, idempotencyKey: 'reply-key' } as never;
    const reopenCommand = { version: 5, idempotencyKey: 'reopen-key' } as never;

    assert.equal(await loadModerationOverview(transport as never, signal), data);
    assert.equal(await loadModerationQueue(transport as never, 'recipes', filters, null, signal), data);
    assert.equal(await loadModerationQueue(transport as never, 'recipes', filters, 'cursor-a', signal), data);
    assert.equal(await applyModerationQueueAction(transport as never, 'claim', 'item-a', queueCommand), data);
    assert.equal(await applyModerationQueueAction(transport as never, 'skip', 'item-a', queueCommand), data);
    assert.equal(await loadModerationItem(transport as never, 'item-a', signal), data);
    assert.equal(await decideModerationItem(transport as never, 'item-a', decisionCommand), data);
    assert.equal(await loadModerationSupport(transport as never, 'ticket-a', signal), data);
    assert.equal(await replyToModerationSupport(transport as never, 'ticket-a', replyCommand), data);
    assert.equal(await reopenModerationSupport(transport as never, 'ticket-a', reopenCommand), data);

    assert.deepEqual(calls, [
        ['GET /api/v1/moderator/overview', undefined, signal],
        ['GET /api/v1/moderator/queues/{queue}', undefined, signal, { queue: 'recipes' }, { query: filters }],
        [
            'GET /api/v1/moderator/queues/{queue}',
            undefined,
            signal,
            { queue: 'recipes' },
            { query: { ...filters, cursor: 'cursor-a' } },
        ],
        ['POST /api/v1/moderator/items/{id}/claim', queueCommand, undefined, { id: 'item-a' }],
        ['POST /api/v1/moderator/items/{id}/skip', queueCommand, undefined, { id: 'item-a' }],
        ['GET /api/v1/moderator/items/{id}', undefined, signal, { id: 'item-a' }],
        ['POST /api/v1/moderator/items/{id}/decision', decisionCommand, undefined, { id: 'item-a' }],
        ['GET /api/v1/moderator/support/{id}', undefined, signal, { id: 'ticket-a' }],
        ['POST /api/v1/moderator/support/{id}/reply', replyCommand, undefined, { id: 'ticket-a' }],
        ['POST /api/v1/moderator/support/{id}/reopen', reopenCommand, undefined, { id: 'ticket-a' }],
    ]);

    const error = new Error('transport failed');
    await assert.rejects(
        loadModerationOverview({ request: () => Promise.reject(error) } as never),
        (actual) => actual === error,
    );
});

void test('moderation consumers use private key and transport owners without moving recovery', async () => {
    const [overview, queue, item, support, adapter] = await Promise.all([
        readFile('src/features/moderation/overview-route.tsx', 'utf8'),
        readFile('src/features/moderation/queue-route.tsx', 'utf8'),
        readFile('src/features/moderation/item-route.tsx', 'utf8'),
        readFile('src/features/moderation/support-route.tsx', 'utf8'),
        readFile('src/features/moderation/api.ts', 'utf8'),
    ]);

    assert.match(overview, /queryKey: moderationKeys\.overview/u);
    assert.match(queue, /queryKey: moderationKeys\.queue\(queue, filters\)/u);
    assert.match(queue, /invalidateQueries\(\{ queryKey: moderationKeys\.root \}\)/u);
    assert.match(queue, /invalidateQueries\(\{ queryKey: moderationKeys\.queueRoot\(queue\) \}\)/u);
    assert.match(item, /queryKey: moderationKeys\.item\(id\)/u);
    assert.match(item, /invalidateQueries\(\{ queryKey: moderationKeys\.root \}\)/u);
    assert.match(support, /queryKey: moderationKeys\.support\(id\)/u);
    assert.equal(support.match(/invalidateQueries\(\{ queryKey: moderationKeys\.support\(id\) \}\)/gu)?.length, 2);
    for (const source of [overview, queue, item, support])
        assert.doesNotMatch(source, /queryKey: \[['"]moderator['"]/u);

    for (const source of [overview, queue, item, support]) assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.match(queue, /loadModerationQueue\(api!, queue, filters, pageParam, signal\)/u);
    assert.match(adapter, /query: \{ \.\.\.filters, \.\.\.\(cursor \? \{ cursor \} : \{\}\) \}/u);
    assert.match(queue, /getNextPageParam: \(lastPage\) => lastPage\.nextCursor \?\? undefined/u);
    assert.match(adapter, /'POST \/api\/v1\/moderator\/items\/\{id\}\/claim'/u);
    assert.match(adapter, /'POST \/api\/v1\/moderator\/items\/\{id\}\/skip'/u);
    assert.match(queue, /\{ version, idempotencyKey: crypto\.randomUUID\(\) \}/u);
    assert.match(adapter, /'POST \/api\/v1\/moderator\/items\/\{id\}\/decision'/u);
    assert.match(item, /version: query\.data!\.version/u);
    assert.match(item, /idempotencyKey: crypto\.randomUUID\(\)/u);
    for (const source of [queue, item]) {
        assert.match(source, /error instanceof ApiError && error\.status === 401/u);
        assert.match(source, /invalidateQueries\(\{ queryKey: sessionQueryKey\('moderator'\) \}\)/u);
    }
    assert.match(adapter, /'POST \/api\/v1\/moderator\/support\/\{id\}\/reply'/u);
    assert.match(support, /message: draft/u);
    assert.match(support, /version: query\.data!\.version/u);
    assert.equal(support.match(/idempotencyKey: crypto\.randomUUID\(\)/gu)?.length, 2);
    assert.match(adapter, /'POST \/api\/v1\/moderator\/support\/\{id\}\/reopen'/u);
    assert.doesNotMatch(adapter, /crypto\.randomUUID/u);
    assert.match(queue, /router\.replace/u);
    assert.match(support, /setDraft\(['"]['"]\)/u);
});
