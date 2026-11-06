import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
    editFamilyChatMessage,
    hideFamilyChatMessage,
    loadFamilyChat,
    markFamilyChatRead,
    pinFamilyChatMessage,
    reactToFamilyChatMessage,
    removeFamilyChatMessage,
    saveFamilyChatDraft,
    sendFamilyChatMessage,
} from '../src/features/family-chat/api.js';
import { familyChatKeys } from '../src/features/family-chat/query-keys.js';

void test('family chat keys preserve exact broad and account/search tuples', () => {
    assert.deepEqual(familyChatKeys.root, ['family-chat']);
    assert.deepEqual(familyChatKeys.list(undefined, ''), ['family-chat', undefined, '']);
    assert.deepEqual(familyChatKeys.list('user-a', 'ужин'), ['family-chat', 'user-a', 'ужин']);
});

void test('family chat adapter preserves pagination, caller commands, params, envelopes and native errors', async () => {
    const calls: unknown[][] = [];
    const envelope = { data: { version: 7 } };
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            return Promise.resolve(envelope);
        },
    };
    const signal = new AbortController().signal;
    const command = { idempotencyKey: 'caller-key' } as never;

    assert.equal(await loadFamilyChat(transport as never, 'ужин', null, signal), envelope.data);
    assert.equal(await loadFamilyChat(transport as never, 'ужин', 'before-a', signal), envelope.data);
    assert.equal(await markFamilyChatRead(transport as never, command), envelope);
    assert.equal(await sendFamilyChatMessage(transport as never, command), envelope);
    assert.equal(await editFamilyChatMessage(transport as never, 'message-a', command), envelope);
    assert.equal(await saveFamilyChatDraft(transport as never, command), envelope);
    assert.equal(await reactToFamilyChatMessage(transport as never, 'message-a', command), envelope);
    assert.equal(await pinFamilyChatMessage(transport as never, 'message-a', command), envelope);
    assert.equal(await hideFamilyChatMessage(transport as never, 'message-a', command), envelope);
    assert.equal(await removeFamilyChatMessage(transport as never, 'message-a', command), envelope);

    assert.deepEqual(calls, [
        ['GET /api/v1/family/chat', undefined, signal, undefined, { query: { q: 'ужин' } }],
        ['GET /api/v1/family/chat', undefined, signal, undefined, { query: { q: 'ужин', before: 'before-a' } }],
        ['POST /api/v1/family/chat/read', command],
        ['POST /api/v1/family/chat/messages', command],
        ['PUT /api/v1/family/chat/messages/{id}', command, undefined, { id: 'message-a' }],
        ['PUT /api/v1/family/chat/draft', command],
        ['POST /api/v1/family/chat/messages/{id}/reaction', command, undefined, { id: 'message-a' }],
        ['POST /api/v1/family/chat/messages/{id}/pin', command, undefined, { id: 'message-a' }],
        ['POST /api/v1/family/chat/messages/{id}/hide', command, undefined, { id: 'message-a' }],
        ['POST /api/v1/family/chat/messages/{id}/remove', command, undefined, { id: 'message-a' }],
    ]);

    const error = new Error('transport failed');
    await assert.rejects(
        loadFamilyChat({ request: () => Promise.reject(error) } as never, '', null),
        (actual) => actual === error,
    );
});

void test('family chat uses private key and transport owners without moving UI orchestration', async () => {
    const [source, adapter] = await Promise.all([
        readFile('src/features/family-chat/family-chat-page.tsx', 'utf8'),
        readFile('src/features/family-chat/api.ts', 'utf8'),
    ]);

    assert.match(source, /queryKey: familyChatKeys\.list\(user\.data\?\.id, q\)/u);
    assert.match(source, /invalidateQueries\(\{ queryKey: familyChatKeys\.root \}\)/u);
    assert.doesNotMatch(source, /queryKey: \[['"]family-chat['"]/u);

    for (const operation of [
        'GET /api/v1/family/chat',
        'POST /api/v1/family/chat/read',
        'PUT /api/v1/family/chat/messages/{id}',
        'POST /api/v1/family/chat/messages',
        'PUT /api/v1/family/chat/draft',
        'POST /api/v1/family/chat/messages/{id}/reaction',
        'POST /api/v1/family/chat/messages/{id}/pin',
        'POST /api/v1/family/chat/messages/{id}/hide',
        'POST /api/v1/family/chat/messages/{id}/remove',
    ])
        assert.ok(
            adapter.includes(`'${operation}'`) || adapter.includes(`"${operation}"`),
            `${operation} is preserved`,
        );

    assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.match(source, /loadFamilyChat\(api!, q, pageParam, signal\)/u);
    assert.match(adapter, /query: \{ q: query, \.\.\.\(before \? \{ before \} : \{\}\) \}/u);
    assert.match(source, /getNextPageParam: \(lastPage\) => lastPage\.nextBefore \?\? undefined/u);
    assert.match(source, /retry: false/u);
    assert.match(source, /expectedVersion: editing\.version/u);
    assert.match(source, /expectedVersion: draftVersion/u);
    assert.match(source, /expectedVersion: message\.version/u);
    assert.match(source, /idempotencyKey: crypto\.randomUUID\(\)/u);
    assert.doesNotMatch(adapter, /crypto\.randomUUID/u);
    assert.match(source, /readKeys = useRef\(new Map/u);
    assert.match(source, /idempotencyKey: state\.key/u);
    assert.match(source, /for \(let attempt = 0; attempt < 2; attempt\+\+\)/u);
    assert.match(source, /replyToId: reply\?\.id \?\? null/u);
    assert.match(source, /meal-planner-family-chat-draft:/u);
    assert.match(source, /sessionStorage\.removeItem\(localDraftKey\)/u);
    assert.match(source, /Введённый текст сохранён на экране/u);
});
