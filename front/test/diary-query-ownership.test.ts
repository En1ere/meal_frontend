import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
    archiveDiaryEntry,
    createDiaryEntry,
    decideDiaryPortion,
    loadDiaryDay,
    loadDiarySources,
    updateDiaryEntry,
} from '../src/features/diary/api.js';
import { diaryKeys } from '../src/features/diary/query-keys.js';

void test('diary keys preserve exact broad, account/day and source-search tuples', () => {
    assert.deepEqual(diaryKeys.root, ['diary']);
    assert.deepEqual(diaryKeys.day(undefined, '2026-11-05'), ['diary', undefined, '2026-11-05']);
    assert.deepEqual(diaryKeys.day('user-a', '2026-11-06'), ['diary', 'user-a', '2026-11-06']);
    assert.deepEqual(diaryKeys.sources('ingredient', ''), ['diary-sources', 'ingredient', '']);
    assert.deepEqual(diaryKeys.sources('inventory_batch', 'рис'), ['diary-sources', 'inventory_batch', 'рис']);
});

void test('diary adapter preserves reads, command envelopes, optimistic versions and fresh idempotency', async () => {
    const calls: unknown[][] = [];
    const day = { items: [], proposals: [] };
    const sources = [{ id: 'source-a' }];
    const commandEnvelope = { data: { version: 2 } };
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            const route = args[0];
            if (route === 'GET /api/v1/diary') return Promise.resolve({ data: day });
            if (route === 'GET /api/v1/diary/sources') return Promise.resolve({ data: { items: sources } });
            return Promise.resolve(commandEnvelope);
        },
    };
    const signal = new AbortController().signal;

    assert.equal(await loadDiaryDay(transport as never, '2026-11-06', signal), day);
    assert.equal(await loadDiarySources(transport as never, 'ingredient', 'рис', signal), sources);
    assert.equal(
        await createDiaryEntry(transport as never, {
            eatenAt: '2026-11-06T08:00:00.000Z',
            meal: 'breakfast',
            note: null,
            components: [],
        }),
        commandEnvelope,
    );
    assert.equal(
        await createDiaryEntry(transport as never, {
            eatenAt: '2026-11-06T08:00:00.000Z',
            meal: 'breakfast',
            note: null,
            components: [],
        }),
        commandEnvelope,
    );
    assert.equal(
        await archiveDiaryEntry(transport as never, 'entry-a', { archived: true, expectedVersion: 3 }),
        commandEnvelope,
    );
    assert.equal(
        await updateDiaryEntry(transport as never, 'entry-a', {
            eatenAt: '2026-11-06T09:00:00.000Z',
            meal: 'snack',
            note: 'updated',
            expectedVersion: 4,
        }),
        commandEnvelope,
    );
    assert.equal(
        await decideDiaryPortion(transport as never, 'portion-a', {
            decision: 'confirmed',
            expectedVersion: 5,
        }),
        commandEnvelope,
    );

    assert.deepEqual(calls[0], ['GET /api/v1/diary', undefined, signal, undefined, { query: { date: '2026-11-06' } }]);
    assert.deepEqual(calls[1], [
        'GET /api/v1/diary/sources',
        undefined,
        signal,
        undefined,
        { query: { type: 'ingredient', q: 'рис', limit: '20' } },
    ]);
    const firstCreate = calls[2]?.[1] as { idempotencyKey: string };
    const secondCreate = calls[3]?.[1] as { idempotencyKey: string };
    assert.notEqual(firstCreate.idempotencyKey, secondCreate.idempotencyKey);
    const archive = calls[4]?.[1] as { idempotencyKey: string };
    assert.deepEqual(calls[4], [
        'POST /api/v1/diary/{id}/archive',
        { archived: true, expectedVersion: 3, idempotencyKey: archive.idempotencyKey },
        undefined,
        { id: 'entry-a' },
        { ifMatch: 3 },
    ]);
    const update = calls[5]?.[1] as { idempotencyKey: string };
    assert.deepEqual(calls[5], [
        'PUT /api/v1/diary/{id}',
        {
            eatenAt: '2026-11-06T09:00:00.000Z',
            meal: 'snack',
            note: 'updated',
            expectedVersion: 4,
            idempotencyKey: update.idempotencyKey,
        },
        undefined,
        { id: 'entry-a' },
        { ifMatch: 4 },
    ]);
    const decision = calls[6]?.[1] as { idempotencyKey: string };
    assert.deepEqual(calls[6], [
        'POST /api/v1/diary/portions/{id}/decision',
        { decision: 'confirmed', expectedVersion: 5, idempotencyKey: decision.idempotencyKey },
        undefined,
        { id: 'portion-a' },
        { ifMatch: 5 },
    ]);

    const error = new Error('transport failed');
    await assert.rejects(
        loadDiaryDay({ request: () => Promise.reject(error) } as never, '2026-11-06'),
        (actual) => actual === error,
    );
});

void test('diary uses its private owner without changing CRUD, portions or invalidation fan-out', async () => {
    const [source, adapter] = await Promise.all([
        readFile('src/features/diary/diary-page.tsx', 'utf8'),
        readFile('src/features/diary/api.ts', 'utf8'),
    ]);

    assert.match(source, /queryKey: diaryKeys\.day\(session\.data\?\.id, date\)/u);
    assert.match(source, /queryKey: diaryKeys\.sources\(sourceType, search\)/u);
    assert.match(source, /invalidateQueries\(\{ queryKey: diaryKeys\.root \}\)/u);
    assert.match(source, /invalidateQueries\(\{ queryKey: proOverviewKeys\.root \}\)/u);
    assert.match(source, /invalidateQueries\(\{ queryKey: inventoryKeys\.root \}\)/u);
    assert.doesNotMatch(source, /queryKey: \[['"]diary/u);

    for (const operation of [
        'GET /api/v1/diary',
        'GET /api/v1/diary/sources',
        'POST /api/v1/diary',
        'POST /api/v1/diary/{id}/archive',
        'PUT /api/v1/diary/{id}',
        'POST /api/v1/diary/portions/{id}/decision',
    ])
        assert.ok(
            adapter.includes(`'${operation}'`) || adapter.includes(`"${operation}"`),
            `${operation} is preserved`,
        );

    assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.match(source, /loadDiaryDay\(api!, date, signal\)/u);
    assert.match(source, /loadDiarySources\(api!, sourceType, search, signal\)/u);
    assert.match(source, /createDiaryEntry\(api!,/u);
    assert.match(source, /archiveDiaryEntry\(api!, entry\.id,/u);
    assert.match(source, /updateDiaryEntry\(api!, entry\.id,/u);
    assert.match(source, /decideDiaryPortion\(api!, proposal\.id,/u);
    assert.match(adapter, /query: \{ date \}/u);
    assert.match(adapter, /query: \{ type, q: query, limit: ['"]20['"] \}/u);
    assert.match(source, /enabled: !!api && !!session\.data && healthConsent\.enabled/u);
    assert.match(source, /enabled: !!api && composer && sourceType !== ['"]manual['"]/u);
    assert.match(source, /expectedVersion: entry\.version/u);
    assert.match(source, /expectedVersion: proposal\.version/u);
    assert.match(source, /decision: ['"]confirmed['"] \| ['"]refused['"] \| ['"]cancelled['"]/u);
    assert.equal(adapter.match(/idempotencyKey: crypto\.randomUUID\(\)/gu)?.length, 4);
    assert.match(adapter, /\{ ifMatch: command\.expectedVersion \}/u);
    assert.match(source, /setComposer\(false\)/u);
    assert.match(source, /setEditing\(null\)/u);
    assert.match(source, /showModal\(\)/u);
    assert.match(source, /Изменения не сохранены/u);
});
