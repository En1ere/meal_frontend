import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
    applyAccountDeletionAction,
    archiveAccount,
    loadAccountDeletionPreview,
    loadAccountLifecycle,
    loadAccountLifecycleExports,
    requestAccountDeletion,
} from '../src/features/account-lifecycle/api.js';
import { accountLifecycleKeys } from '../src/features/account-lifecycle/query-keys.js';

void test('account lifecycle keys preserve exact root, scoped lifecycle and deletion preview tuples', () => {
    assert.deepEqual(accountLifecycleKeys.root, ['account-lifecycle']);
    assert.deepEqual(accountLifecycleKeys.lifecycle(undefined), ['account-lifecycle', undefined]);
    assert.deepEqual(accountLifecycleKeys.lifecycle('user-a'), ['account-lifecycle', 'user-a']);
    assert.deepEqual(accountLifecycleKeys.deletionPreview(undefined), ['account-deletion-preview', undefined]);
    assert.deepEqual(accountLifecycleKeys.deletionPreview('user-a'), ['account-deletion-preview', 'user-a']);
});

void test('account lifecycle adapter preserves reads, prepared commands, action dispatch and native errors', async () => {
    const calls: unknown[][] = [];
    const lifecycle = { archived: false, deletion: null };
    const preview = { canRequest: true, canFinalize: false, blockers: [] };
    const exportsPage = { items: [] };
    const command = { status: 'accepted' };
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            if (args[0] === 'GET /api/v1/account/lifecycle') return Promise.resolve({ data: lifecycle });
            if (args[0] === 'GET /api/v1/account/deletion/preview') return Promise.resolve({ data: preview });
            if (args[0] === 'GET /api/v1/exports') return Promise.resolve({ data: exportsPage });
            return Promise.resolve({ data: command });
        },
    };
    const signal = new AbortController().signal;
    const reauthToken = 'caller-owned-token';
    const archiveKey = '00000000-0000-4000-8000-000000000001';
    const requestKey = '00000000-0000-4000-8000-000000000002';

    assert.equal(await loadAccountLifecycle(transport as never, signal), lifecycle);
    assert.equal(await loadAccountDeletionPreview(transport as never, signal), preview);
    assert.equal(await loadAccountLifecycleExports(transport as never, signal), exportsPage);
    assert.equal(await archiveAccount(transport as never, { reauthToken, idempotencyKey: archiveKey }), command);
    assert.equal(
        await requestAccountDeletion(transport as never, {
            reauthToken,
            idempotencyKey: requestKey,
            acknowledgement: true,
        }),
        command,
    );
    assert.equal(
        await applyAccountDeletionAction(transport as never, 'cancel', { reauthToken, expectedVersion: 4 }),
        command,
    );
    assert.equal(
        await applyAccountDeletionAction(transport as never, 'finalize', { reauthToken, expectedVersion: 5 }),
        command,
    );

    assert.deepEqual(calls, [
        ['GET /api/v1/account/lifecycle', undefined, signal],
        ['GET /api/v1/account/deletion/preview', undefined, signal],
        ['GET /api/v1/exports', undefined, signal, undefined, { query: { limit: '20' } }],
        ['POST /api/v1/account/archive', { reauthToken, idempotencyKey: archiveKey }],
        ['POST /api/v1/account/deletion', { reauthToken, idempotencyKey: requestKey, acknowledgement: true }],
        ['POST /api/v1/account/deletion/cancel', { reauthToken, expectedVersion: 4 }],
        ['POST /api/v1/account/deletion/finalize', { reauthToken, expectedVersion: 5 }],
    ]);

    const error = new Error('transport failed');
    await assert.rejects(
        loadAccountLifecycle({ request: () => Promise.reject(error) } as never),
        (actual) => actual === error,
    );
});

void test('account lifecycle owns keys and transport without moving UI orchestration', async () => {
    const [source, adapter] = await Promise.all([
        readFile('src/features/account-lifecycle/lifecycle-page.tsx', 'utf8'),
        readFile('src/features/account-lifecycle/api.ts', 'utf8'),
    ]);

    assert.match(source, /queryKey: accountLifecycleKeys\.lifecycle\(session\.data\?\.id\)/u);
    assert.match(source, /queryKey: accountLifecycleKeys\.deletionPreview\(session\.data\?\.id\)/u);
    assert.match(
        source,
        /invalidateQueries\(\{ queryKey: accountLifecycleKeys\.lifecycle\(session\.data\?\.id\) \}\)/u,
    );
    assert.doesNotMatch(source, /queryKey: \[['"]account-(?:lifecycle|deletion-preview)['"]/u);
    assert.match(source, /queryKey: exportKeys\.lifecycle\(session\.data\?\.id\)/u);
    assert.match(source, /from ['"]\.\.\/\.\.\/entities\/export\/model\.js['"]/u);
    assert.doesNotMatch(source, /queryKey: \[['"]exports['"]/u);

    for (const operation of [
        'GET /api/v1/account/lifecycle',
        'GET /api/v1/account/deletion/preview',
        'GET /api/v1/exports',
        'POST /api/v1/account/archive',
        'POST /api/v1/account/deletion',
        'POST /api/v1/account/deletion/cancel',
        'POST /api/v1/account/deletion/finalize',
    ])
        assert.match(adapter, new RegExp(`['"]${operation.replaceAll('/', '\\/')}['"]`, 'u'));

    assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.match(source, /loadAccountLifecycle\(runtime\.api!, signal\)/u);
    assert.match(source, /loadAccountDeletionPreview\(runtime\.api!, signal\)/u);
    assert.match(source, /loadAccountLifecycleExports\(runtime\.api!, signal\)/u);
    assert.match(source, /archiveAccount\(runtime\.api!,/u);
    assert.match(source, /requestAccountDeletion\(runtime\.api!,/u);
    assert.match(source, /applyAccountDeletionAction\(runtime\.api!, kind,/u);
    assert.doesNotMatch(adapter, /crypto\.randomUUID/u);
    assert.match(source, /idempotency\.current\.archive \?\?= crypto\.randomUUID\(\)/u);
    assert.match(source, /idempotency\.current\.request \?\?= crypto\.randomUUID\(\)/u);
    assert.match(source, /Date\.parse\(reauth\.expiresAt\) <= Date\.now\(\)/u);
    assert.match(source, /Date\.parse\(latestExport\.expiresAt\) <= Date\.now\(\)/u);
    assert.match(source, /window\.setTimeout/u);
    assert.match(source, /expectedVersion: currentDeletion\.version/u);
    assert.match(
        source,
        /await Promise\.all\(\[lifecycle\.refetch\(\), readiness\.refetch\(\), exportsQuery\.refetch\(\)\]\)/u,
    );
    assert.match(
        source,
        /if \(result\.kind === 'finalize' && 'status' in result\.data && result\.data\.status === 'finalized'\)/u,
    );
    assert.match(source, /Состояние изменилось/u);
    assert.match(source, /Исход операции не подтверждён/u);
    assert.match(source, /runtime\.broadcast\(\)/u);
    assert.match(source, /window\.location\.replace/u);
});
