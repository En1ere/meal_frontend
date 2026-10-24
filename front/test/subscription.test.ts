import assert from 'node:assert/strict';
import test from 'node:test';
import { createSeed } from '../src/mocks/model.js';
import { subscriptionHandle } from '../src/mocks/subscription.js';
import { contracts } from '../src/shared/api/contracts.generated.js';

const now = Date.parse('2026-10-09T12:00:00.000Z');

function setup(login: string) {
    const state = createSeed();
    let userId = state.users.find((user) => user.login === login)!.id;
    const send = async (method: string, path: string, input?: unknown, at = now) => {
        const response = subscriptionHandle({
            state,
            userId,
            path,
            method,
            input,
            now: at,
            success: (data) => Response.json({ data, meta: { requestId: crypto.randomUUID() } }),
            fail: (status, code = 'FAILED') =>
                Response.json(
                    { error: { code, message: 'Ошибка', details: null }, meta: { requestId: crypto.randomUUID() } },
                    { status },
                ),
        })!;
        return { response, body: (await response.json()) as unknown };
    };
    return {
        state,
        send,
        get userId() {
            return userId;
        },
        setUser(id: string) {
            userId = id;
        },
    };
}

void test('Free buys promoted Pro and sees the regular renewal amount', async () => {
    const context = setup('user1');
    const overview = await context.send('GET', '/api/v1/settings/subscription');
    const current = contracts['GET /api/v1/settings/subscription'].success.parse(overview.body).data;
    const promotion = current.promotion;
    assert.ok(promotion);
    assert.equal(promotion.monthAmountMinor, 53_900);
    const previewResult = await context.send('POST', '/api/v1/settings/subscription/plan/preview', {
        expectedVersion: current.version,
        idempotencyKey: crypto.randomUUID(),
        targetPlan: 'pro',
        period: 'month',
        timing: 'now',
        promotionOfferId: promotion.offerId,
    });
    const preview = contracts['POST /api/v1/settings/subscription/plan/preview'].success.parse(previewResult.body).data;
    assert.equal(preview.amountMinor, 53_900);
    assert.equal(preview.nextAmountMinor, 59_900);
    const committed = await context.send('POST', '/api/v1/settings/subscription/plan/commit', {
        previewId: preview.previewId,
        expectedVersion: preview.expectedVersion,
        idempotencyKey: crypto.randomUUID(),
    });
    assert.equal(
        contracts['POST /api/v1/settings/subscription/plan/commit'].success.parse(committed.body).data.current.plan,
        'pro',
    );
});

void test('Plus can preview immediate credit or schedule Pro at period end', async () => {
    const context = setup('plus1');
    const current = contracts['GET /api/v1/settings/subscription'].success.parse(
        (await context.send('GET', '/api/v1/settings/subscription')).body,
    ).data;
    const immediate = contracts['POST /api/v1/settings/subscription/plan/preview'].success.parse(
        (
            await context.send('POST', '/api/v1/settings/subscription/plan/preview', {
                expectedVersion: current.version,
                idempotencyKey: crypto.randomUUID(),
                targetPlan: 'pro',
                period: 'month',
                timing: 'now',
                promotionOfferId: null,
            })
        ).body,
    ).data;
    assert.ok(immediate.creditMinor > 0);
    const scheduled = contracts['POST /api/v1/settings/subscription/plan/preview'].success.parse(
        (
            await context.send('POST', '/api/v1/settings/subscription/plan/preview', {
                expectedVersion: current.version,
                idempotencyKey: crypto.randomUUID(),
                targetPlan: 'pro',
                period: 'year',
                timing: 'period_end',
                promotionOfferId: null,
            })
        ).body,
    ).data;
    assert.equal(scheduled.creditMinor, 0);
    assert.equal(scheduled.startsAt, current.current.endsAt);
});

void test('Pro renewal and downgrade are preview-confirmed', async () => {
    const context = setup('pro1');
    const current = contracts['GET /api/v1/settings/subscription'].success.parse(
        (await context.send('GET', '/api/v1/settings/subscription')).body,
    ).data;
    const renewal = contracts['POST /api/v1/settings/subscription/renewal/preview'].success.parse(
        (
            await context.send('POST', '/api/v1/settings/subscription/renewal/preview', {
                expectedVersion: current.version,
                idempotencyKey: crypto.randomUUID(),
                enabled: false,
            })
        ).body,
    ).data;
    const renewed = contracts['POST /api/v1/settings/subscription/renewal/commit'].success.parse(
        (
            await context.send('POST', '/api/v1/settings/subscription/renewal/commit', {
                previewId: renewal.previewId,
                expectedVersion: renewal.expectedVersion,
                idempotencyKey: crypto.randomUUID(),
            })
        ).body,
    ).data;
    assert.equal(renewed.current.autoRenew, false);
    const downgrade = contracts['POST /api/v1/settings/subscription/downgrade/preview'].success.parse(
        (
            await context.send('POST', '/api/v1/settings/subscription/downgrade/preview', {
                expectedVersion: renewed.version,
                idempotencyKey: crypto.randomUUID(),
                targetPlan: 'plus',
            })
        ).body,
    ).data;
    assert.equal(downgrade.currentPlan, 'pro');
    assert.equal(downgrade.targetPlan, 'plus');
    assert.equal(downgrade.amountMinor, 39_900);
    await context.send('POST', '/api/v1/settings/subscription/downgrade/commit', {
        previewId: downgrade.previewId,
        expectedVersion: downgrade.expectedVersion,
        idempotencyKey: crypto.randomUUID(),
    });
    const afterBoundary = contracts['GET /api/v1/settings/subscription'].success.parse(
        (await context.send('GET', '/api/v1/settings/subscription', undefined, Date.parse(downgrade.effectiveAt) + 1))
            .body,
    ).data;
    assert.equal(afterBoundary.current.plan, 'plus');
});

void test('disabled renewal expires a personal plan instead of keeping access forever', async () => {
    const context = setup('pro1');
    const current = contracts['GET /api/v1/settings/subscription'].success.parse(
        (await context.send('GET', '/api/v1/settings/subscription')).body,
    ).data;
    const renewal = contracts['POST /api/v1/settings/subscription/renewal/preview'].success.parse(
        (
            await context.send('POST', '/api/v1/settings/subscription/renewal/preview', {
                expectedVersion: current.version,
                idempotencyKey: crypto.randomUUID(),
                enabled: false,
            })
        ).body,
    ).data;
    const disabled = contracts['POST /api/v1/settings/subscription/renewal/commit'].success.parse(
        (
            await context.send('POST', '/api/v1/settings/subscription/renewal/commit', {
                previewId: renewal.previewId,
                expectedVersion: renewal.expectedVersion,
                idempotencyKey: crypto.randomUUID(),
            })
        ).body,
    ).data;
    assert.equal(disabled.current.autoRenew, false);
    assert.ok(disabled.current.endsAt);

    const expired = contracts['GET /api/v1/settings/subscription'].success.parse(
        (await context.send('GET', '/api/v1/settings/subscription', undefined, Date.parse(disabled.current.endsAt) + 1))
            .body,
    ).data;
    assert.equal(expired.current.plan, 'free');
    assert.equal(expired.current.source, 'none');
    assert.equal(expired.current.subscriptionId, null);
    assert.equal(expired.current.endsAt, null);
    assert.equal(context.state.users.find((user) => user.id === context.userId)?.plan, 'free');
});

void test('two family Plus owners consent once and receive Pro through the later end date', async () => {
    const context = setup('plus1');
    const first = contracts['GET /api/v1/settings/subscription'].success.parse(
        (await context.send('GET', '/api/v1/settings/subscription')).body,
    ).data;
    const peer = first.combination.candidates[0]!;
    const preview = contracts['POST /api/v1/settings/subscription/combination/preview'].success.parse(
        (
            await context.send('POST', '/api/v1/settings/subscription/combination/preview', {
                expectedVersion: first.version,
                idempotencyKey: crypto.randomUUID(),
                peerUserId: peer.userId,
                recipientId: context.userId,
            })
        ).body,
    ).data;
    const firstConsent = contracts['POST /api/v1/settings/subscription/combination/consent'].success.parse(
        (
            await context.send('POST', '/api/v1/settings/subscription/combination/consent', {
                previewId: preview.previewId,
                combinationId: preview.combinationId,
                expectedVersion: first.version,
                idempotencyKey: crypto.randomUUID(),
            })
        ).body,
    ).data;
    assert.equal(firstConsent.status, 'consent_pending');
    context.setUser(peer.userId);
    const peerOverview = contracts['GET /api/v1/settings/subscription'].success.parse(
        (await context.send('GET', '/api/v1/settings/subscription')).body,
    ).data;
    const applied = contracts['POST /api/v1/settings/subscription/combination/consent'].success.parse(
        (
            await context.send('POST', '/api/v1/settings/subscription/combination/consent', {
                previewId: preview.previewId,
                combinationId: preview.combinationId,
                expectedVersion: peerOverview.version,
                idempotencyKey: crypto.randomUUID(),
            })
        ).body,
    ).data;
    assert.equal(applied.status, 'applied');
    assert.equal(applied.resultEndsAt, preview.resultEndsAt);
    assert.equal(applied.settings.current.plan, 'pro');
    const subscriptionBuckets = applied.settings.ai.buckets.filter((bucket) => bucket.kind === 'subscription');
    assert.equal(subscriptionBuckets.length, 1);
    assert.equal(subscriptionBuckets[0]?.granted, 60);

    const sourceSubscriptionIds = [preview.firstSubscriptionId, preview.secondSubscriptionId];
    assert.equal(
        context.state.subscription.records.some((record) =>
            sourceSubscriptionIds.includes(record.subscriptionId ?? ''),
        ),
        false,
    );
    const nonRecipientId = [preview.firstUserId, preview.secondUserId].find((id) => id !== preview.recipientId)!;
    const nonRecipientRecord = context.state.subscription.records.find((record) => record.userId === nonRecipientId)!;
    assert.equal(nonRecipientRecord.plan, 'free');
    assert.equal(nonRecipientRecord.source, 'none');
    assert.equal(nonRecipientRecord.autoRenew, false);

    const family = context.state.family.families.find((item) => item.id === preview.familyId)!;
    family.archived = true;
    context.setUser(nonRecipientId);
    const afterCoverageLoss = contracts['GET /api/v1/settings/subscription'].success.parse(
        (await context.send('GET', '/api/v1/settings/subscription')).body,
    ).data;
    assert.equal(afterCoverageLoss.current.plan, 'free');
});
