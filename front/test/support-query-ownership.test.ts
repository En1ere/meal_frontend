import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
    changeSupportTicketState,
    createSupportTicket,
    editSupportMessage,
    loadSupportList,
    loadSupportMeta,
    loadSupportTicket,
    replyToSupportTicket,
} from '../src/features/support/api.js';
import { supportKeys } from '../src/features/support/query-keys.js';

void test('support keys preserve exact root, account, filtered-list, meta and detail tuples', () => {
    assert.deepEqual(supportKeys.root, ['support']);
    assert.deepEqual(supportKeys.forAccount(undefined), ['support', undefined]);
    assert.deepEqual(supportKeys.forAccount('user-a'), ['support', 'user-a']);
    assert.deepEqual(supportKeys.list(undefined, 'all', 'active'), ['support', undefined, 'all', 'active']);
    assert.deepEqual(supportKeys.list('user-a', 'billing', 'closed'), ['support', 'user-a', 'billing', 'closed']);
    assert.deepEqual(supportKeys.meta, ['support-meta']);
    assert.deepEqual(supportKeys.detail(undefined, 'ticket-a'), ['support-detail', undefined, 'ticket-a']);
    assert.deepEqual(supportKeys.detail('user-a', 'ticket-b'), ['support-detail', 'user-a', 'ticket-b']);
});

void test('support adapter preserves filters, signals, params, prepared commands, projections and native errors', async () => {
    const calls: unknown[][] = [];
    const envelope = { data: { ticket: { id: 'ticket-a' } } };
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            return Promise.resolve(envelope);
        },
    };
    const signal = new AbortController().signal;
    const command = { idempotencyKey: 'caller-key', expectedVersion: 7 } as never;

    assert.equal(
        await loadSupportList(transport as never, { category: 'billing', status: 'active' }, signal),
        envelope.data,
    );
    assert.equal(await loadSupportMeta(transport as never, signal), envelope.data);
    assert.equal(await createSupportTicket(transport as never, command), envelope.data);
    assert.equal(await loadSupportTicket(transport as never, 'ticket-a', signal), envelope.data);
    assert.equal(await replyToSupportTicket(transport as never, 'ticket-a', command), envelope.data);
    assert.equal(await changeSupportTicketState(transport as never, 'close', 'ticket-a', command), envelope.data);
    assert.equal(await changeSupportTicketState(transport as never, 'reopen', 'ticket-a', command), envelope.data);
    assert.equal(await editSupportMessage(transport as never, 'ticket-a', 'message-a', command), envelope.data);

    assert.deepEqual(calls, [
        ['GET /api/v1/support', undefined, signal, undefined, { query: { category: 'billing', status: 'active' } }],
        ['GET /api/v1/support/meta', undefined, signal],
        ['POST /api/v1/support', command],
        ['GET /api/v1/support/{id}', undefined, signal, { id: 'ticket-a' }],
        ['POST /api/v1/support/{id}/reply', command, undefined, { id: 'ticket-a' }],
        ['POST /api/v1/support/{id}/close', command, undefined, { id: 'ticket-a' }],
        ['POST /api/v1/support/{id}/reopen', command, undefined, { id: 'ticket-a' }],
        [
            'PATCH /api/v1/support/{id}/messages/{messageId}',
            command,
            undefined,
            { id: 'ticket-a', messageId: 'message-a' },
        ],
    ]);

    const error = new Error('transport failed');
    await assert.rejects(
        loadSupportMeta({ request: () => Promise.reject(error) } as never),
        (actual) => actual === error,
    );
});

void test('support uses its private owners without changing commands, drafts or cache writes', async () => {
    const [source, adapter] = await Promise.all([
        readFile('src/features/support/support.tsx', 'utf8'),
        readFile('src/features/support/api.ts', 'utf8'),
    ]);

    assert.match(source, /queryKey: supportKeys\.list\(session\.data\?\.id, category, status\)/u);
    assert.equal(source.match(/queryKey: supportKeys\.meta/gu)?.length, 2);
    assert.match(source, /const key = supportKeys\.detail\(session\.data\?\.id, id\)/u);
    assert.match(source, /queryClient\.setQueryData\(key, value\)/u);
    assert.match(source, /invalidateQueries\(\{ queryKey: supportKeys\.forAccount\(session\.data\?\.id\) \}\)/u);
    assert.doesNotMatch(source, /queryKey: \[['"]support/u);
    assert.doesNotMatch(source, /\[['"]support-detail['"], session\.data\?\.id, id\]/u);

    const operations = [
        'GET /api/v1/support',
        'GET /api/v1/support/meta',
        'POST /api/v1/support',
        'GET /api/v1/support/{id}',
        'POST /api/v1/support/{id}/reply',
        'POST /api/v1/support/{id}/close',
        'POST /api/v1/support/{id}/reopen',
        'PATCH /api/v1/support/{id}/messages/{messageId}',
    ];
    for (const operation of operations)
        assert.ok(
            adapter.includes(`'${operation}'`) || adapter.includes(`"${operation}"`),
            `${operation} is preserved`,
        );

    assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.doesNotMatch(adapter, /crypto\.randomUUID/u);
    assert.match(source, /loadSupportList\(api!, \{ category, status \}, signal\)/u);
    assert.equal(source.match(/loadSupportMeta\(api!/gu)?.length, 2);
    assert.match(source, /loadSupportTicket\(api!, id, signal\)/u);
    assert.match(source, /changeSupportTicketState\(api!, kind, id,/u);

    assert.match(source, /const signature = JSON\.stringify\(input\)/u);
    assert.match(source, /idempotency\.current\?\.signature !== signature/u);
    assert.match(source, /idempotency\.current = \{ signature, key: crypto\.randomUUID\(\) \}/u);
    assert.match(source, /idempotencyKey: idempotency\.current\.key/u);
    assert.match(source, /expectedVersion: query\.data!\.ticket\.version/u);
    assert.match(source, /messageVersion: message\.version/u);
    assert.match(source, /idempotencyKey: crypto\.randomUUID\(\)/u);
    assert.match(source, /setReply\(['"]['"]\)/u);
    assert.match(source, /setAttached\(\[\]\)/u);
    assert.match(source, /setEditing\(null\)/u);
    assert.match(source, /router\.replace\(`\/support\/\$\{value\.ticket\.id\}`\)/u);
});
