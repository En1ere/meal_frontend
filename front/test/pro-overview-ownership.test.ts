import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadProOverview } from '../src/entities/pro-overview/api.js';
import { proOverviewKeys } from '../src/entities/pro-overview/query-keys.js';

const overview = { access: { mode: 'active' }, diaryCount: 1, expenseCount: 2 } as const;

void test('pro overview owner preserves exact root and account-scoped tuples', () => {
    assert.deepEqual(proOverviewKeys.root, ['pro-overview']);
    assert.deepEqual(proOverviewKeys.overview(undefined), ['pro-overview', undefined]);
    assert.deepEqual(proOverviewKeys.overview('user-a'), ['pro-overview', 'user-a']);
});

void test('pro overview read adapter preserves route, signal and exact data', async () => {
    const requests: Array<{ route: string; body: unknown; signal: AbortSignal | undefined }> = [];
    const transport = {
        request: (route: string, body?: unknown, signal?: AbortSignal) => {
            requests.push({ route, body, signal });
            return Promise.resolve({ data: overview });
        },
    };
    const controller = new AbortController();
    assert.equal(await loadProOverview(transport, controller.signal), overview);
    assert.deepEqual(requests, [
        {
            route: 'GET /api/v1/pro/overview',
            body: undefined,
            signal: controller.signal,
        },
    ]);
});

void test('pro screen uses the entity owner without a direct transport call', async () => {
    const source = await readFile('src/features/pro/pro-overview-page.tsx', 'utf8');
    assert.match(source, /queryKey: proOverviewKeys\.overview\(session\.data\?\.id\)/u);
    assert.match(source, /loadProOverview\(api!, signal\)/u);
    assert.doesNotMatch(source, /\.request\(['"]GET \/api\/v1\/pro\/overview/u);
});

void test('mutation owners only replace the broad invalidation expression', async () => {
    const [diary, diaryAdapter, finance, financeAdapter, nutrition, nutritionAdapter] = await Promise.all([
        readFile('src/features/diary/diary-page.tsx', 'utf8'),
        readFile('src/features/diary/api.ts', 'utf8'),
        readFile('src/features/finance/expenses-route.tsx', 'utf8'),
        readFile('src/features/finance/api.ts', 'utf8'),
        readFile('src/features/nutrition/nutrition-analytics-page.tsx', 'utf8'),
        readFile('src/features/nutrition/api.ts', 'utf8'),
    ]);
    for (const source of [diary, finance, nutrition]) {
        assert.equal(source.match(/cache\.invalidateQueries\(\{ queryKey: proOverviewKeys\.root \}\)/gu)?.length, 1);
        assert.doesNotMatch(source, /queryKey: \[['"]pro-overview['"]\]/u);
    }

    assert.match(diary, /createDiaryEntry\(api!,/u);
    assert.match(diaryAdapter, /'POST \/api\/v1\/diary'/u);
    assert.match(diaryAdapter, /idempotencyKey: crypto\.randomUUID\(\)/u);
    assert.match(diary, /queryKey: diaryKeys\.root/u);
    assert.match(diary, /queryKey: inventoryKeys\.root/u);

    assert.match(finance, /createFinanceExpense\(api!,/u);
    assert.match(financeAdapter, /'POST \/api\/v1\/finance\/expenses'/u);
    assert.match(finance, /financeConsent: true/u);
    assert.match(finance, /idempotencyKey: crypto\.randomUUID\(\)/u);
    assert.match(finance, /setOpen\(false\)/u);

    assert.match(nutrition, /saveNutritionProfile\(api!,/u);
    assert.match(nutrition, /expectedVersion: settings\.data\?\.profile\?\.version \?\? null/u);
    assert.match(nutritionAdapter, /'PUT \/api\/v1\/nutrition\/profile'/u);
    assert.match(nutritionAdapter, /idempotencyKey: crypto\.randomUUID\(\)/u);
    assert.match(nutrition, /queryKey: nutritionKeys\.settingsRoot/u);
    assert.match(nutrition, /queryKey: nutritionKeys\.analyticsRoot/u);
});
