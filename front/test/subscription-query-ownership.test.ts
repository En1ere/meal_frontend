import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
    activateSubscriptionTrial,
    commitSubscriptionChange,
    consentToSubscriptionCombination,
    loadSubscription,
    previewSubscriptionCombination,
    previewSubscriptionDowngrade,
    previewSubscriptionPlan,
    previewSubscriptionRenewal,
} from '../src/features/subscription/api.js';
import { subscriptionKeys } from '../src/features/subscription/query-keys.js';

void test('subscription settings key preserves the exact account-scoped tuple', () => {
    assert.deepEqual(subscriptionKeys.settings(undefined), ['subscription-settings', undefined]);
    assert.deepEqual(subscriptionKeys.settings('user-a'), ['subscription-settings', 'user-a']);
    assert.notDeepEqual(subscriptionKeys.settings('user-a'), subscriptionKeys.settings('user-b'));
});

void test('subscription adapter preserves prepared commands, explicit dispatch, projections and native errors', async () => {
    const calls: unknown[][] = [];
    const envelope = { data: { version: 7 } };
    const transport = {
        request: (...args: unknown[]) => {
            calls.push(args);
            return Promise.resolve(envelope);
        },
    };
    const signal = new AbortController().signal;
    const command = { expectedVersion: 6, idempotencyKey: 'caller-key' } as never;

    assert.equal(await loadSubscription(transport as never, signal), envelope.data);
    assert.equal(await activateSubscriptionTrial(transport as never, command), envelope.data);
    assert.equal(await previewSubscriptionPlan(transport as never, command), envelope.data);
    assert.equal(await previewSubscriptionDowngrade(transport as never, command), envelope.data);
    assert.equal(await previewSubscriptionRenewal(transport as never, command), envelope.data);
    assert.equal(await previewSubscriptionCombination(transport as never, command), envelope.data);
    assert.equal(await commitSubscriptionChange(transport as never, 'plan', command), envelope.data);
    assert.equal(await commitSubscriptionChange(transport as never, 'renewal', command), envelope.data);
    assert.equal(await commitSubscriptionChange(transport as never, 'downgrade', command), envelope.data);
    assert.equal(await consentToSubscriptionCombination(transport as never, command), envelope.data);

    assert.deepEqual(calls, [
        ['GET /api/v1/settings/subscription', undefined, signal],
        ['POST /api/v1/settings/subscription/trial/activate', command],
        ['POST /api/v1/settings/subscription/plan/preview', command],
        ['POST /api/v1/settings/subscription/downgrade/preview', command],
        ['POST /api/v1/settings/subscription/renewal/preview', command],
        ['POST /api/v1/settings/subscription/combination/preview', command],
        ['POST /api/v1/settings/subscription/plan/commit', command],
        ['POST /api/v1/settings/subscription/renewal/commit', command],
        ['POST /api/v1/settings/subscription/downgrade/commit', command],
        ['POST /api/v1/settings/subscription/combination/consent', command],
    ]);

    const error = new Error('transport failed');
    await assert.rejects(
        loadSubscription({ request: () => Promise.reject(error) } as never),
        (actual) => actual === error,
    );
});

void test('subscription uses one private owner without changing cache writes or commands', async () => {
    const [source, adapter] = await Promise.all([
        readFile('src/features/subscription/subscription-page.tsx', 'utf8'),
        readFile('src/features/subscription/api.ts', 'utf8'),
    ]);

    assert.equal(source.match(/subscriptionKeys\.settings\(/gu)?.length, 1);
    assert.doesNotMatch(source, /\[['"]subscription-settings['"]/u);
    assert.match(source, /const key = subscriptionKeys\.settings\(session\.data\?\.id\)/u);
    assert.match(source, /queryKey: key/u);
    assert.match(source, /queryClient\.setQueryData\(key, value\)/u);
    for (const operation of [
        'GET /api/v1/settings/subscription',
        'POST /api/v1/settings/subscription/trial/activate',
        'POST /api/v1/settings/subscription/plan/preview',
        'POST /api/v1/settings/subscription/downgrade/preview',
        'POST /api/v1/settings/subscription/renewal/preview',
        'POST /api/v1/settings/subscription/combination/preview',
        'POST /api/v1/settings/subscription/plan/commit',
        'POST /api/v1/settings/subscription/renewal/commit',
        'POST /api/v1/settings/subscription/downgrade/commit',
        'POST /api/v1/settings/subscription/combination/consent',
    ])
        assert.ok(
            adapter.includes(`'${operation}'`) || adapter.includes(`"${operation}"`),
            `${operation} is preserved`,
        );
    assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.doesNotMatch(adapter, /crypto\.randomUUID/u);
    assert.match(source, /trialKey = useRef\(crypto\.randomUUID\(\)\)/u);
    assert.match(source, /commitKey = useRef\(crypto\.randomUUID\(\)\)/u);
    assert.match(source, /idempotencyKey: trialKey\.current/u);
    assert.match(source, /idempotencyKey: commitKey\.current/u);
    assert.match(source, /expectedVersion: review\.value\.expectedVersion/u);
    assert.equal(source.match(/consentToSubscriptionCombination\(api!/gu)?.length, 2);
    assert.match(source, /return result\.settings/u);
    assert.match(source, /onError: recover/u);
    assert.match(source, /queryKey: aiBalanceKeys\.forAccount\(session\.data\?\.id\)/u);
    assert.match(source, /queryKey: familyKeys\.context\(session\.data\?\.id\)/u);
    assert.match(source, /queryKey: mealPlanKeys\.root/u);
});
