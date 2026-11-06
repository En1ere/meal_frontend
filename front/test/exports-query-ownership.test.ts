import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { exportKeys as publicExportKeys } from '../src/entities/export/model.js';
import { exportKeys } from '../src/entities/export/query-keys.js';
import { createExport, downloadExport, loadExportHistory, previewExport } from '../src/features/exports/api.js';

void test('export entity preserves exact roots, projections and public identity', () => {
    assert.equal(publicExportKeys, exportKeys);
    assert.deepEqual(exportKeys.root, ['exports']);
    assert.deepEqual(exportKeys.forAccount(undefined), ['exports', undefined]);
    assert.deepEqual(exportKeys.forAccount('user-a'), ['exports', 'user-a']);
    assert.deepEqual(exportKeys.lifecycle(undefined), ['exports', undefined, 'lifecycle']);
    assert.deepEqual(exportKeys.lifecycle('user-a'), ['exports', 'user-a', 'lifecycle']);
});

void test('exports adapter preserves pagination, signals, params, projections and caller-owned idempotency', async () => {
    const calls: unknown[][] = [];
    const history = { items: [], nextCursor: null };
    const file = { content: 'payload', mediaType: 'application/json', fileName: 'export.json' };
    const preview = { previewId: 'preview-a', blockers: [], canCreate: true };
    const job = { id: 'job-a' };
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            const route = args[0];
            const data =
                route === 'GET /api/v1/exports'
                    ? history
                    : route === 'GET /api/v1/exports/{id}/download-content'
                      ? file
                      : route === 'POST /api/v1/exports/preview'
                        ? preview
                        : { job };
            return Promise.resolve({ data });
        },
    };
    const signal = new AbortController().signal;

    assert.equal(await loadExportHistory(transport as never, null, signal), history);
    assert.equal(await loadExportHistory(transport as never, 'cursor-a', signal), history);
    assert.equal(await downloadExport(transport as never, 'job-a'), file);
    assert.equal(
        await previewExport(transport as never, {
            scope: 'private',
            domain: 'nutrition',
            format: 'json',
            startsOn: null,
            endsOn: '2026-11-06',
        }),
        preview,
    );
    const command = { previewId: 'preview-a', idempotencyKey: 'persistent-key', reauthToken: 'reauth-a' };
    assert.equal(await createExport(transport as never, command), job);

    assert.deepEqual(calls[0], ['GET /api/v1/exports', undefined, signal, undefined, { query: { limit: '20' } }]);
    assert.deepEqual(calls[1], [
        'GET /api/v1/exports',
        undefined,
        signal,
        undefined,
        { query: { limit: '20', cursor: 'cursor-a' } },
    ]);
    assert.deepEqual(calls[2], ['GET /api/v1/exports/{id}/download-content', undefined, undefined, { id: 'job-a' }]);
    assert.deepEqual(calls[3], [
        'POST /api/v1/exports/preview',
        {
            scope: 'private',
            domain: 'nutrition',
            format: 'json',
            startsOn: null,
            endsOn: '2026-11-06',
        },
    ]);
    assert.deepEqual(calls[4], ['POST /api/v1/exports', command]);

    const error = new Error('transport failed');
    await assert.rejects(
        loadExportHistory({ request: () => Promise.reject(error) } as never, null),
        (actual) => actual === error,
    );
});

void test('exports consumes the canonical entity without changing protected export workflow', async () => {
    const [source, adapter] = await Promise.all([
        readFile('src/features/exports/exports-page.tsx', 'utf8'),
        readFile('src/features/exports/api.ts', 'utf8'),
    ]);

    assert.match(source, /queryKey: exportKeys\.forAccount\(session\.data\?\.id\)/u);
    assert.match(source, /invalidateQueries\(\{ queryKey: exportKeys\.forAccount\(session\.data\?\.id\) \}\)/u);
    assert.match(source, /from ['"]\.\.\/\.\.\/entities\/export\/model\.js['"]/u);
    assert.doesNotMatch(source, /features\/exports\/query-keys/u);
    assert.doesNotMatch(source, /queryKey: \[['"]exports['"], session\.data\?\.id\]/u);

    for (const route of [
        'POST /api/v1/exports/preview',
        'POST /api/v1/exports',
        'GET /api/v1/exports',
        'GET /api/v1/exports/{id}/download-content',
    ])
        assert.ok(adapter.includes(`'${route}'`) || adapter.includes(`"${route}"`), `${route} is preserved`);
    assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.match(source, /queryFn: \(\{ pageParam, signal \}\) => loadExportHistory\(api!, pageParam, signal\)/u);
    assert.match(source, /mutationFn: \(\) => downloadExport\(api!, job\.id\)/u);
    assert.match(source, /previewExport\(api!,/u);
    assert.match(source, /return createExport\(api!,/u);
    assert.match(source, /refetchInterval: \(query\) =>/u);
    assert.match(source, /\? 1000\s*: false/u);
    assert.match(source, /idempotencyKey\.current \?\?= crypto\.randomUUID\(\)/u);
    assert.match(source, /idempotencyKey: idempotencyKey\.current/u);
    assert.match(source, /idempotencyKey\.current = null/u);
    assert.match(source, /new Blob\(\[file\.content\], \{ type: file\.mediaType \}\)/u);
    assert.match(source, /URL\.createObjectURL/u);
    assert.match(source, /URL\.revokeObjectURL/u);
    assert.match(source, /purpose="export"/u);
});
