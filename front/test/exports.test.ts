import assert from 'node:assert/strict';
import test from 'node:test';
import { contracts } from '../src/shared/api/contracts.generated.js';
import { exportsHandle } from '../src/mocks/exports.js';
import { createSeed } from '../src/mocks/model.js';

const now = Date.parse('2026-10-09T12:00:00.000Z');

function setup() {
    const state = createSeed();
    const userId = state.users.find((user) => user.login === 'pro1')!.id;
    const send = async (method: string, path: string, input?: unknown) => {
        const response = exportsHandle({
            state,
            userId,
            path,
            params: path.includes('/download-content') ? { id: path.split('/').at(-2)! } : {},
            method,
            query: new URLSearchParams(),
            input,
            now,
            success: (data) => Response.json(data),
            fail: (status, code = 'FAILED') => Response.json({ code }, { status }),
        })!;
        return { response, body: (await response.json()) as unknown };
    };
    return { state, userId, send };
}

void test('active Pro receives a versioned all-data export manifest in each supported format', async () => {
    const { send } = setup();
    const result = await send('POST', '/api/v1/exports/preview', {
        scope: 'private',
        domain: 'all_pro_data',
        format: 'pdf',
        startsOn: '2026-09-01',
        endsOn: '2026-10-31',
    });
    assert.equal(result.response.status, 200);
    const preview = contracts['POST /api/v1/exports/preview'].success.shape.data.parse(result.body);
    assert.equal(preview.canCreate, true);
    assert.equal(preview.manifest?.schemaVersion, '2026-10-09');
    assert.equal(preview.manifest?.selection.format, 'pdf');
    assert.equal(preview.manifest?.sections.length, 8);
    assert.equal(preview.manifest?.proAccess?.modeAtPreview, 'active');
    assert.equal(preview.manifest?.proAccess?.dataThrough, '2026-10-09');
});

void test('former Pro cannot create a new Pro export but retains its ready history', async () => {
    const { state, userId, send } = setup();
    const active = await send('POST', '/api/v1/exports/preview', {
        scope: 'private',
        domain: 'diary',
        format: 'csv',
        startsOn: null,
        endsOn: null,
    });
    const manifest = contracts['POST /api/v1/exports/preview'].success.shape.data.parse(active.body).manifest!;
    state.exports.jobs.push({
        userId,
        content: '',
        job: contracts['POST /api/v1/exports'].success.shape.data.shape.job.parse({
            id: '90000000-0000-4000-8000-000000000001',
            manifest,
            requestedAt: '2026-10-09T11:59:59.000Z',
            status: 'ready',
            completedAt: '2026-10-09T11:59:59.500Z',
            expiresAt: '2026-10-10T11:59:59.500Z',
            failureCode: null,
        }),
    });
    state.users.find((user) => user.id === userId)!.plan = 'free';
    Object.assign(
        state.subscription.records.find((record) => record.userId === userId)!,
        {
            plan: 'free',
            source: 'personal',
            endsAt: '2026-10-08T12:00:00.000Z',
        },
    );
    state.subscription.trialHistory.push(userId);

    const blocked = await send('POST', '/api/v1/exports/preview', {
        scope: 'private',
        domain: 'nutrition',
        format: 'json',
        startsOn: null,
        endsOn: null,
    });
    const preview = contracts['POST /api/v1/exports/preview'].success.shape.data.parse(blocked.body);
    assert.equal(preview.canCreate, false);
    assert.equal(preview.manifest, null);
    assert.equal(preview.blockers[0]?.code, 'active_pro_required');

    const history = await send('GET', '/api/v1/exports');
    const list = contracts['GET /api/v1/exports'].success.shape.data.parse(history.body);
    assert.equal(list.items.length, 1);
    assert.equal(list.items[0]?.status, 'ready');
    assert.equal(list.items[0]?.manifest.selection.domain, 'diary');
});
