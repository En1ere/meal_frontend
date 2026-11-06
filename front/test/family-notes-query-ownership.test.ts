import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
    archiveFamilyNote,
    createFamilyNote,
    loadFamilyNote,
    loadFamilyNoteHistory,
    loadFamilyNotes,
    toggleFamilyNoteItem,
    updateFamilyNote,
} from '../src/features/family-notes/api.js';
import { familyNotesKeys } from '../src/features/family-notes/query-keys.js';

void test('family notes keys preserve exact broad, account, filtered list, note and history tuples', () => {
    assert.deepEqual(familyNotesKeys.root, ['family-notes']);
    assert.deepEqual(familyNotesKeys.forAccount(undefined), ['family-notes', undefined]);
    assert.deepEqual(familyNotesKeys.forAccount('user-a'), ['family-notes', 'user-a']);
    assert.deepEqual(familyNotesKeys.list(undefined, 'active', ''), ['family-notes', undefined, 'active', '']);
    assert.deepEqual(familyNotesKeys.list('user-a', 'archived', 'поездка'), [
        'family-notes',
        'user-a',
        'archived',
        'поездка',
    ]);
    assert.deepEqual(familyNotesKeys.note('note-a', undefined), ['family-note', 'note-a', undefined]);
    assert.deepEqual(familyNotesKeys.history('note-a', 'user-a'), ['family-note-history', 'note-a', 'user-a']);
});

void test('family notes adapter preserves reads, caller commands, params, envelopes and native errors', async () => {
    const calls: unknown[][] = [];
    const note = { id: 'note-a' };
    const list = [note];
    const history = [{ version: 1 }];
    const envelope = { data: note };
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            if (args[0] === 'GET /api/v1/family/notes') return Promise.resolve({ data: { items: list } });
            if (args[0] === 'GET /api/v1/family/notes/{id}/history')
                return Promise.resolve({ data: { items: history } });
            if (args[0] === 'GET /api/v1/family/notes/{id}') return Promise.resolve({ data: note });
            return Promise.resolve(envelope);
        },
    };
    const signal = new AbortController().signal;
    const firstKey = '00000000-0000-4000-8000-000000000001';
    const secondKey = '00000000-0000-4000-8000-000000000002';
    const thirdKey = '00000000-0000-4000-8000-000000000003';
    const fourthKey = '00000000-0000-4000-8000-000000000004';

    assert.equal(await loadFamilyNotes(transport as never, 'archived', 'поиск', signal), list);
    assert.equal(await loadFamilyNote(transport as never, 'note-a', signal), note);
    assert.equal(await loadFamilyNoteHistory(transport as never, 'note-a', signal), history);
    assert.equal(
        await toggleFamilyNoteItem(transport as never, 'note-a', 'item-a', {
            expectedNoteVersion: 2,
            expectedItemVersion: 3,
            checked: true,
            idempotencyKey: firstKey,
        }),
        envelope,
    );
    assert.equal(
        await archiveFamilyNote(transport as never, 'note-a', {
            expectedVersion: 4,
            archived: true,
            idempotencyKey: secondKey,
        }),
        envelope,
    );
    assert.equal(
        await createFamilyNote(transport as never, {
            kind: 'note',
            title: 'Заметка',
            body: 'Текст',
            items: [],
            idempotencyKey: thirdKey,
        }),
        envelope,
    );
    assert.equal(
        await updateFamilyNote(transport as never, 'note-a', {
            kind: 'checklist',
            title: 'Список',
            body: '',
            items: [{ text: 'Пункт' }],
            expectedVersion: 5,
            idempotencyKey: fourthKey,
        }),
        envelope,
    );

    assert.deepEqual(calls, [
        ['GET /api/v1/family/notes', undefined, signal, undefined, { query: { tab: 'archived', q: 'поиск' } }],
        ['GET /api/v1/family/notes/{id}', undefined, signal, { id: 'note-a' }],
        ['GET /api/v1/family/notes/{id}/history', undefined, signal, { id: 'note-a' }],
        [
            'POST /api/v1/family/notes/{id}/items/{itemId}/toggle',
            { expectedNoteVersion: 2, expectedItemVersion: 3, checked: true, idempotencyKey: firstKey },
            undefined,
            { id: 'note-a', itemId: 'item-a' },
        ],
        [
            'POST /api/v1/family/notes/{id}/archive',
            { expectedVersion: 4, archived: true, idempotencyKey: secondKey },
            undefined,
            { id: 'note-a' },
        ],
        [
            'POST /api/v1/family/notes',
            { kind: 'note', title: 'Заметка', body: 'Текст', items: [], idempotencyKey: thirdKey },
        ],
        [
            'PUT /api/v1/family/notes/{id}',
            {
                kind: 'checklist',
                title: 'Список',
                body: '',
                items: [{ text: 'Пункт' }],
                expectedVersion: 5,
                idempotencyKey: fourthKey,
            },
            undefined,
            { id: 'note-a' },
        ],
    ]);

    const error = new Error('transport failed');
    await assert.rejects(
        loadFamilyNote({ request: () => Promise.reject(error) } as never, 'note-a'),
        (actual) => actual === error,
    );
});

void test('family notes consumers use private key and transport owners without moving UI orchestration', async () => {
    const [list, editor, detail, adapter] = await Promise.all([
        readFile('src/features/family-notes/notes-page.tsx', 'utf8'),
        readFile('src/features/family-notes/note-editor.tsx', 'utf8'),
        readFile('src/features/family-notes/note-detail.tsx', 'utf8'),
        readFile('src/features/family-notes/api.ts', 'utf8'),
    ]);

    assert.match(list, /queryKey: familyNotesKeys\.list\(user\.data\?\.id, tab, q\)/u);
    assert.match(editor, /queryKey: familyNotesKeys\.note\(id, user\.data\?\.id\)/u);
    assert.match(detail, /queryKey: familyNotesKeys\.note\(id, user\.data\?\.id\)/u);
    assert.match(detail, /queryKey: familyNotesKeys\.history\(id, user\.data\?\.id\)/u);
    assert.match(detail, /invalidateQueries\(\{ queryKey: familyNotesKeys\.forAccount\(user\.data\?\.id\) \}\)/u);
    for (const source of [list, editor, detail]) assert.doesNotMatch(source, /queryKey: \[['"]family-note/u);

    for (const source of [list, editor, detail]) assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.match(list, /loadFamilyNotes\(api!, tab, q, signal\)/u);
    assert.match(adapter, /query: \{ tab, q: query \}/u);
    assert.match(adapter, /'POST \/api\/v1\/family\/notes'/u);
    assert.match(adapter, /'PUT \/api\/v1\/family\/notes\/\{id\}'/u);
    assert.doesNotMatch(adapter, /crypto\.randomUUID/u);
    assert.match(editor, /expectedVersion: source!\.version/u);
    assert.match(editor, /idempotencyKey: crypto\.randomUUID\(\)/u);
    assert.match(
        editor,
        /setError\(reason instanceof ApiError \? reason\.message : 'Не удалось сохранить заметку\.'\)/u,
    );
    assert.match(adapter, /'POST \/api\/v1\/family\/notes\/\{id\}\/items\/\{itemId\}\/toggle'/u);
    assert.match(detail, /expectedNoteVersion: note\.data\.version/u);
    assert.match(detail, /expectedItemVersion: item\.version/u);
    assert.match(adapter, /'POST \/api\/v1\/family\/notes\/\{id\}\/archive'/u);
    assert.match(detail, /expectedVersion: note\.data\.version/u);
    assert.match(detail, /idempotencyKey: crypto\.randomUUID\(\)/u);
    assert.match(detail, /await refresh\(\)/u);
    assert.match(detail, /reason instanceof ApiError/u);
    assert.match(editor, /router\.push\(`\/family\/notes\/\$\{result\.data\.id\}`\)/u);
});
