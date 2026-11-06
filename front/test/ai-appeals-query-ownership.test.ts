import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createAiAppeal, loadAiAppeal, loadAiAppeals, replyAiAppeal } from '../src/features/ai-appeals/api.js';
import { aiAppealKeys } from '../src/features/ai-appeals/query-keys.js';

void test('AI appeal keys preserve exact list prefix and account/detail tuples', () => {
    assert.deepEqual(aiAppealKeys.root, ['ai-appeals']);
    assert.deepEqual(aiAppealKeys.list(undefined), ['ai-appeals', undefined]);
    assert.deepEqual(aiAppealKeys.list('user-a'), ['ai-appeals', 'user-a']);
    assert.deepEqual(aiAppealKeys.detail(undefined, 'appeal-a'), ['ai-appeal', undefined, 'appeal-a']);
    assert.deepEqual(aiAppealKeys.detail('user-a', 'appeal-b'), ['ai-appeal', 'user-a', 'appeal-b']);
});

void test('AI appeal adapter preserves reads, command bodies, params, projections and fresh idempotency', async () => {
    const calls: unknown[][] = [];
    const list = { restriction: null, items: [] };
    const detail = { appeal: { id: 'appeal-a' } };
    const created = { appeal: { id: 'appeal-b' } };
    const reply = { message: { id: 'message-a' } };
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            const route = args[0];
            const data =
                route === 'GET /api/v1/ai/appeals'
                    ? list
                    : route === 'GET /api/v1/ai/appeals/{id}'
                      ? detail
                      : route === 'POST /api/v1/ai/appeals'
                        ? created
                        : reply;
            return Promise.resolve({ data });
        },
    };
    const signal = new AbortController().signal;

    assert.equal(await loadAiAppeals(transport as never, signal), list);
    assert.equal(await loadAiAppeal(transport as never, 'appeal-a', signal), detail);
    assert.equal(await createAiAppeal(transport as never, { sanctionId: 'sanction-a', body: 'reason' }), created);
    assert.equal(await createAiAppeal(transport as never, { sanctionId: 'sanction-a', body: 'reason' }), created);
    assert.equal(
        await replyAiAppeal(transport as never, 'ticket-a', {
            body: 'reply',
            attachments: [],
            expectedVersion: 3,
        }),
        reply,
    );
    assert.deepEqual(calls[0], ['GET /api/v1/ai/appeals', undefined, signal]);
    assert.deepEqual(calls[1], ['GET /api/v1/ai/appeals/{id}', undefined, signal, { id: 'appeal-a' }]);
    const firstCreate = calls[2]?.[1] as { idempotencyKey: string };
    const secondCreate = calls[3]?.[1] as { idempotencyKey: string };
    assert.deepEqual(firstCreate, {
        sanctionId: 'sanction-a',
        body: 'reason',
        idempotencyKey: firstCreate.idempotencyKey,
    });
    assert.notEqual(firstCreate.idempotencyKey, secondCreate.idempotencyKey);
    const replyBody = calls[4]?.[1] as { idempotencyKey: string };
    assert.deepEqual(calls[4], [
        'POST /api/v1/support/{id}/reply',
        { body: 'reply', attachments: [], expectedVersion: 3, idempotencyKey: replyBody.idempotencyKey },
        undefined,
        { id: 'ticket-a' },
    ]);

    const error = new Error('transport failed');
    await assert.rejects(
        loadAiAppeals({ request: () => Promise.reject(error) } as never),
        (actual) => actual === error,
    );
});

void test('AI appeals uses its private owner without changing create, detail or support reply commands', async () => {
    const [source, adapter] = await Promise.all([
        readFile('src/features/ai-appeals/ai-appeals.tsx', 'utf8'),
        readFile('src/features/ai-appeals/api.ts', 'utf8'),
    ]);

    assert.match(source, /queryKey: aiAppealKeys\.list\(session\.data\?\.id\)/u);
    assert.match(source, /invalidateQueries\(\{ queryKey: aiAppealKeys\.list\(session\.data\?\.id\) \}\)/u);
    assert.match(source, /const key = aiAppealKeys\.detail\(session\.data\?\.id, id\)/u);
    assert.match(source, /queryKey: key/u);
    assert.match(source, /invalidateQueries\(\{ queryKey: key \}\)/u);
    assert.doesNotMatch(source, /\[['"]ai-appeals['"], session\.data\?\.id\]/u);
    assert.doesNotMatch(source, /\[['"]ai-appeal['"], session\.data\?\.id, id\]/u);

    for (const route of [
        'GET /api/v1/ai/appeals',
        'POST /api/v1/ai/appeals',
        'GET /api/v1/ai/appeals/{id}',
        'POST /api/v1/support/{id}/reply',
    ])
        assert.ok(adapter.includes(`'${route}'`) || adapter.includes(`"${route}"`), `${route} is preserved`);
    assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.match(source, /loadAiAppeals\(api!, signal\)/u);
    assert.match(source, /loadAiAppeal\(api!, id, signal\)/u);
    assert.match(source, /createAiAppeal\(api!,/u);
    assert.match(source, /replyAiAppeal\(api!, query\.data!\.appeal\.ticket\.id,/u);
    assert.match(source, /sanctionId: query\.data!\.restriction!\.id/u);
    assert.match(source, /sanctionId: query\.data!\.restriction!\.id,\s*body,/u);
    assert.match(source, /body: reply,\s*attachments: \[\],\s*expectedVersion: query\.data!\.appeal\.ticket\.version/u);
    assert.match(source, /setReply\(['"]['"]\)/u);
    assert.match(source, /router\.push\(`\/ai\/appeals\/\$\{value\.appeal\.id\}`\)/u);
    assert.equal(adapter.match(/idempotencyKey: crypto\.randomUUID\(\)/gu)?.length, 2);
});
