import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
    loadNutritionAnalytics,
    loadNutritionSettings,
    saveNutritionProfile,
    saveNutritionTarget,
} from '../src/features/nutrition/api.js';
import { nutritionKeys } from '../src/features/nutrition/query-keys.js';

void test('nutrition keys preserve exact settings and analytics root and scoped tuples', () => {
    assert.deepEqual(nutritionKeys.settingsRoot, ['nutrition-settings']);
    assert.deepEqual(nutritionKeys.settings(undefined), ['nutrition-settings', undefined]);
    assert.deepEqual(nutritionKeys.settings('user-a'), ['nutrition-settings', 'user-a']);
    assert.deepEqual(nutritionKeys.analyticsRoot, ['nutrition-analytics']);
    assert.deepEqual(nutritionKeys.analytics(undefined, '2026-11-01', '2026-11-05'), [
        'nutrition-analytics',
        undefined,
        '2026-11-01',
        '2026-11-05',
    ]);
    assert.deepEqual(nutritionKeys.analytics('user-a', '2026-10-01', '2026-10-31'), [
        'nutrition-analytics',
        'user-a',
        '2026-10-01',
        '2026-10-31',
    ]);
});

void test('nutrition adapter preserves read projections, signals, queries, command envelopes and concurrency', async () => {
    const calls: unknown[][] = [];
    const settings = { profile: null, currentTarget: null, history: [] };
    const analytics = { days: [] };
    const profileEnvelope = { data: { profile: { version: 1 } } };
    const targetEnvelope = { data: { target: { version: 2 } } };
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            const route = args[0];
            if (route === 'GET /api/v1/nutrition/settings') return Promise.resolve({ data: settings });
            if (route === 'GET /api/v1/nutrition/analytics') return Promise.resolve({ data: analytics });
            if (route === 'PUT /api/v1/nutrition/profile') return Promise.resolve(profileEnvelope);
            return Promise.resolve(targetEnvelope);
        },
    };
    const signal = new AbortController().signal;

    assert.equal(await loadNutritionSettings(transport as never, signal), settings);
    assert.equal(await loadNutritionAnalytics(transport as never, '2026-11-01', '2026-11-05', signal), analytics);
    assert.equal(
        await saveNutritionProfile(transport as never, { goal: 'maintain', expectedVersion: null }),
        profileEnvelope,
    );
    assert.equal(
        await saveNutritionProfile(transport as never, { goal: 'custom', expectedVersion: 3 }),
        profileEnvelope,
    );
    assert.equal(
        await saveNutritionTarget(transport as never, {
            effectiveFrom: '2026-11-06',
            energyKcal: '2100',
            proteinG: null,
            fatG: '70',
            carbohydrateG: '250',
            fiberG: null,
            expectedProfileVersion: 3,
        }),
        targetEnvelope,
    );

    assert.deepEqual(calls[0], ['GET /api/v1/nutrition/settings', undefined, signal]);
    assert.deepEqual(calls[1], [
        'GET /api/v1/nutrition/analytics',
        undefined,
        signal,
        undefined,
        { query: { from: '2026-11-01', to: '2026-11-05' } },
    ]);
    const firstProfileBody = calls[2]?.[1] as { idempotencyKey: string };
    const secondProfileBody = calls[3]?.[1] as { idempotencyKey: string };
    assert.deepEqual(calls[2], [
        'PUT /api/v1/nutrition/profile',
        { goal: 'maintain', expectedVersion: null, idempotencyKey: firstProfileBody.idempotencyKey },
        undefined,
        undefined,
        undefined,
    ]);
    assert.deepEqual(calls[3], [
        'PUT /api/v1/nutrition/profile',
        { goal: 'custom', expectedVersion: 3, idempotencyKey: secondProfileBody.idempotencyKey },
        undefined,
        undefined,
        { ifMatch: 3 },
    ]);
    assert.notEqual(firstProfileBody.idempotencyKey, secondProfileBody.idempotencyKey);
    const targetBody = calls[4]?.[1] as { idempotencyKey: string };
    assert.deepEqual(calls[4], [
        'POST /api/v1/nutrition/targets',
        {
            effectiveFrom: '2026-11-06',
            energyKcal: '2100',
            proteinG: null,
            fatG: '70',
            carbohydrateG: '250',
            fiberG: null,
            expectedProfileVersion: 3,
            idempotencyKey: targetBody.idempotencyKey,
        },
        undefined,
        undefined,
        { ifMatch: 3 },
    ]);

    const error = new Error('transport failed');
    await assert.rejects(
        loadNutritionSettings({ request: () => Promise.reject(error) } as never),
        (actual) => actual === error,
    );
});

void test('nutrition uses private key and transport owners without changing consent, drafts or recovery', async () => {
    const [source, adapter] = await Promise.all([
        readFile('src/features/nutrition/nutrition-analytics-page.tsx', 'utf8'),
        readFile('src/features/nutrition/api.ts', 'utf8'),
    ]);

    assert.match(source, /queryKey: nutritionKeys\.settings\(session\.data\?\.id\)/u);
    assert.match(source, /queryKey: nutritionKeys\.analytics\(session\.data\?\.id, from, to\)/u);
    assert.match(source, /invalidateQueries\(\{ queryKey: nutritionKeys\.settingsRoot \}\)/u);
    assert.match(source, /invalidateQueries\(\{ queryKey: nutritionKeys\.analyticsRoot \}\)/u);
    assert.match(source, /invalidateQueries\(\{ queryKey: proOverviewKeys\.root \}\)/u);
    assert.doesNotMatch(source, /queryKey: \[['"]nutrition-(?:settings|analytics)['"]/u);

    assert.match(source, /useConsent\(['"]special_category['"]\)/u);
    assert.match(source, /enabled: !!api && !!session\.data && healthConsent\.enabled/u);
    assert.match(source, /enabled: !!api && !!session\.data && healthConsent\.enabled && from <= to/u);
    assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.match(source, /loadNutritionSettings\(api!, signal\)/u);
    assert.match(source, /loadNutritionAnalytics\(api!, from, to, signal\)/u);
    assert.match(source, /saveNutritionProfile\(api!,/u);
    assert.match(source, /saveNutritionTarget\(api!,/u);
    for (const route of [
        'GET /api/v1/nutrition/settings',
        'GET /api/v1/nutrition/analytics',
        'PUT /api/v1/nutrition/profile',
        'POST /api/v1/nutrition/targets',
    ])
        assert.ok(adapter.includes(`'${route}'`) || adapter.includes(`"${route}"`), `${route} is preserved`);
    assert.match(adapter, /query: \{ from, to \}/u);
    assert.match(source, /expectedVersion: settings\.data\?\.profile\?\.version \?\? null/u);
    assert.match(source, /expectedProfileVersion: profile\.version/u);
    assert.match(source, /if \(!profile\) throw new Error\(['"]Сначала сохраните профиль питания['"]\)/u);
    assert.match(adapter, /command\.expectedVersion === null \? undefined : \{ ifMatch: command\.expectedVersion \}/u);
    assert.match(adapter, /\{ ifMatch: command\.expectedProfileVersion \}/u);
    assert.equal(adapter.match(/idempotencyKey: crypto\.randomUUID\(\)/gu)?.length, 2);
    assert.match(source, /Сохранённые данные не изменились/u);
    assert.match(source, /История только для чтения/u);
});
