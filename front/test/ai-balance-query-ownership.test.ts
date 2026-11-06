import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { aiBalanceKeys as publicAiBalanceKeys } from '../src/entities/ai-balance/model.js';
import { aiBalanceKeys } from '../src/entities/ai-balance/query-keys.js';
import { aiKeys } from '../src/entities/ai/index.js';

void test('AI balance entity preserves the exact account-scoped tuple and public identity', () => {
    assert.equal(publicAiBalanceKeys, aiBalanceKeys);
    assert.deepEqual(aiBalanceKeys.forAccount(undefined), ['ai-balance', undefined]);
    assert.deepEqual(aiBalanceKeys.forAccount('user-a'), ['ai-balance', 'user-a']);
});

void test('AI cache projections are account scoped and distinct', () => {
    assert.deepEqual(aiKeys.capabilities(undefined), ['ai-capabilities', undefined]);
    assert.deepEqual(aiKeys.capabilities('user-a'), ['ai-capabilities', 'user-a']);
    assert.deepEqual(aiKeys.familySharing('user-a'), ['ai-family-sharing', 'user-a']);
    assert.deepEqual(aiKeys.conversation('user-a', 'task-b'), ['ai-conversation', 'user-a', 'task-b']);
    assert.deepEqual(aiKeys.historyRoot('user-a'), ['ai-history', 'user-a']);
    assert.deepEqual(aiKeys.history('user-a', 'archived'), ['ai-history', 'user-a', 'archived']);
    assert.notDeepEqual(aiKeys.familySharing('user-a'), aiBalanceKeys.forAccount('user-a'));
    assert.notDeepEqual(aiKeys.conversation('user-a', 'task-b'), aiKeys.historyRoot('user-a'));
});

void test('AI screens consume one entity transport owner and preserve stable command identity', async () => {
    const [balance, conversation, overview, history, transport, subscription, stableKey] = await Promise.all([
        readFile('src/features/ai/balance-route.tsx', 'utf8'),
        readFile('src/features/ai/conversation-route.tsx', 'utf8'),
        readFile('src/features/ai/overview-route.tsx', 'utf8'),
        readFile('src/features/ai/history-route.tsx', 'utf8'),
        readFile('src/entities/ai/api.ts', 'utf8'),
        readFile('src/features/subscription/subscription-page.tsx', 'utf8'),
        readFile('src/features/ai/use-stable-command-key.ts', 'utf8'),
    ]);
    for (const source of [balance, conversation, overview, history]) {
        assert.doesNotMatch(source, /api!?\.request/u);
        assert.match(source, /from ['"]\.\.\/\.\.\/entities\/ai\/index\.js['"]/u);
    }
    assert.equal(transport.match(/transport\.request\(/gu)?.length, 13);
    assert.match(transport, /GET \/api\/v1\/ai\/capabilities/u);
    assert.match(transport, /POST \/api\/v1\/ai\/operations/u);
    assert.match(transport, /GET \/api\/v1\/ai\/operations\/\{id\}/u);
    assert.match(transport, /POST \/api\/v1\/ai\/tasks\/\{id\}\/operations/u);
    assert.doesNotMatch(transport, /POST \/api\/v1\/ai\/run/u);
    assert.doesNotMatch(transport, /POST \/api\/v1\/ai\/tasks\/\{id\}\/messages/u);
    assert.match(transport, /PUT \/api\/v1\/ai\/history\/\{id\}\/archive/u);
    assert.doesNotMatch(transport, /crypto\.randomUUID/u);
    assert.match(stableKey, /fingerprint/u);
    assert.match(stableKey, /crypto\.randomUUID/u);

    assert.match(overview, /queryKey: aiKeys\.capabilities\(session\.data\?\.id\)/u);
    assert.match(overview, /runCommand\.forIntent\(intent\)/u);
    assert.match(overview, /previewId: preview!\.previewId/u);
    assert.match(overview, /router\.push\(`\/ai\/\$\{operation\.data\.item\.taskId\}`\)/u);
    assert.match(conversation, /continuationCommand\.forIntent\(intent\)/u);
    assert.match(conversation, /loadAiOperation\(api!, operationId!, signal\)/u);
    assert.match(conversation, /operation\.data\?\.item\.state !== 'succeeded'/u);
    assert.match(history, /archiveCommand\.forIntent\(intent\)/u);
    assert.match(balance, /purchaseCommand\.forIntent/u);
    assert.match(balance, /transferCommand\.forIntent/u);
    assert.match(balance, /decisionCommand\.forIntent/u);
    assert.match(balance, /acceptedAmountMinor: 19900/u);

    assert.equal(
        [balance, conversation, overview, subscription].flatMap(
            (source) => source.match(/aiBalanceKeys\.forAccount\(session\.data\?\.id\)/gu) ?? [],
        ).length,
        9,
    );
    assert.match(subscription, /queryClient\.setQueryData\(key, value\)/u);
});

void test('AI history keeps pagination, archive version and cache invalidation semantics', async () => {
    const [source, transport] = await Promise.all([
        readFile('src/features/ai/history-route.tsx', 'utf8'),
        readFile('src/entities/ai/api.ts', 'utf8'),
    ]);
    assert.match(source, /queryKey: aiKeys\.history\(session\.data\?\.id, archived\)/u);
    assert.match(source, /queryKey: aiKeys\.historyRoot\(session\.data\?\.id\)/u);
    assert.match(source, /queryKey: aiKeys\.conversation\(session\.data\?\.id, value\.item\.id\)/u);
    assert.match(source, /getNextPageParam: \(lastPage\) => lastPage\.nextCursor \?\? undefined/u);
    assert.match(source, /archived: !item\.archived/u);
    assert.match(source, /expectedVersion: item\.version/u);
    assert.match(transport, /archived, limit: ['"]20['"]/u);
    assert.match(transport, /\.\.\.\(cursor \? \{ cursor \} : \{\}\)/u);
    assert.doesNotMatch(source, /'DELETE \/api\/v1\/ai\/history/u);
});
