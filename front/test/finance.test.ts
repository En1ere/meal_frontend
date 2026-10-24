import assert from 'node:assert/strict';
import test from 'node:test';
import { contracts } from '../src/shared/api/contracts.generated.js';
import { createSeed } from '../src/mocks/model.js';
import { financeHandle } from '../src/mocks/finance.js';
import { publicRecipeFixtures } from '../src/mocks/recipe-fixtures.js';

const userId = '10000000-0000-4000-8000-000000000003';
const now = Date.parse('2026-10-08T12:00:00.000Z');

function setup() {
    const state = createSeed();
    const success = (data: unknown) => Response.json(data);
    const fail = (status: number) => Response.json({}, { status });
    const send = (
        path: string,
        method: string,
        input?: unknown,
        params: Record<string, string> = {},
        ifMatch: string | null = null,
        query = new URLSearchParams(),
    ) => financeHandle({ state, userId, path, method, input, params, ifMatch, query, now, success, fail })!;
    return { state, send };
}

void test('active Pro creates a consented private expense idempotently', async () => {
    const { state, send } = setup();
    const body = {
        category: 'groceries',
        amountMinor: 12550,
        occurredAt: '2026-10-08T08:00:00.000Z',
        financeConsent: true,
        idempotencyKey: crypto.randomUUID(),
    } as const;
    const first = contracts['POST /api/v1/finance/expenses'].success.shape.data.parse(
        await send('/api/v1/finance/expenses', 'POST', body).json(),
    );
    const replay = contracts['POST /api/v1/finance/expenses'].success.shape.data.parse(
        await send('/api/v1/finance/expenses', 'POST', body).json(),
    );
    assert.equal(first.expense.id, replay.expense.id);
    assert.equal(state.finance.expenses.length, 1);
    const list = contracts['GET /api/v1/finance/expenses'].success.shape.data.parse(
        await send(
            '/api/v1/finance/expenses',
            'GET',
            undefined,
            {},
            null,
            new URLSearchParams('from=2026-10-01&to=2026-10-31'),
        ).json(),
    );
    assert.equal(list.totalMinor, 12550);
    assert.equal(list.scope, 'private');
});

void test('expense edit requires the current version and a budget period cannot overlap', async () => {
    const { send } = setup();
    const created = contracts['POST /api/v1/finance/expenses'].success.shape.data.parse(
        await send('/api/v1/finance/expenses', 'POST', {
            category: 'other',
            amountMinor: 1000,
            occurredAt: '2026-10-08T08:00:00.000Z',
            financeConsent: true,
            idempotencyKey: crypto.randomUUID(),
        }).json(),
    );
    const edit = {
        category: 'restaurant',
        amountMinor: 2500,
        occurredAt: '2026-10-08T09:00:00.000Z',
        expectedVersion: 1,
        idempotencyKey: crypto.randomUUID(),
    } as const;
    assert.equal(
        send(`/api/v1/finance/expenses/${created.expense.id}`, 'PUT', edit, { id: created.expense.id }, '"2"').status,
        412,
    );
    assert.equal(
        send(`/api/v1/finance/expenses/${created.expense.id}`, 'PUT', edit, { id: created.expense.id }, '"1"').status,
        200,
    );
    const budget = {
        amountMinor: 500000,
        startsOn: '2026-10-01',
        endsOn: '2026-10-31',
        category: null,
        idempotencyKey: crypto.randomUUID(),
    } as const;
    assert.equal(send('/api/v1/finance/budgets', 'POST', budget).status, 200);
    assert.equal(
        send('/api/v1/finance/budgets', 'POST', { ...budget, idempotencyKey: crypto.randomUUID() }).status,
        409,
    );
});

void test('former Pro reads saved finance but cannot mutate it', () => {
    const { state, send } = setup();
    state.users.find((user) => user.id === userId)!.plan = 'free';
    state.subscription.trialHistory.push(userId);
    state.finance.expenses.push({
        userId,
        expense: contracts['GET /api/v1/finance/expenses'].success.shape.data.shape.items.element.parse({
            id: crypto.randomUUID(),
            source: 'manual',
            category: 'groceries',
            amountMinor: 1000,
            currency: 'RUB',
            occurredAt: '2026-09-20T10:00:00.000Z',
            consentedAt: '2026-09-20T10:00:00.000Z',
            version: 1,
            createdAt: '2026-09-20T10:00:00.000Z',
        }),
    });
    assert.equal(
        send(
            '/api/v1/finance/expenses',
            'GET',
            undefined,
            {},
            null,
            new URLSearchParams('from=2026-09-01&to=2026-10-08'),
        ).status,
        200,
    );
    assert.equal(send('/api/v1/finance/expenses', 'POST', {}).status, 403);
});

void test('price history resolves a personal unit price and keeps incomplete recipe totals honest', async () => {
    const { state, send } = setup();
    const recipe = publicRecipeFixtures()[0]!;
    const ingredient = recipe.ingredients.find((item) => !item.optional)!;
    const body = {
        ingredientId: ingredient.ingredientId!,
        unit: ingredient.unit!,
        quantity: '500',
        amountMinor: 12500,
        observedAt: '2026-10-08T08:00:00.000Z',
        financeConsent: true,
        idempotencyKey: crypto.randomUUID(),
    } as const;
    const created = contracts['POST /api/v1/finance/prices'].success.shape.data.parse(
        await send('/api/v1/finance/prices', 'POST', body).json(),
    );
    assert.equal(created.resolved.amountMinor, 25);
    assert.equal(created.observation.eligibleForAggregate, false);
    assert.equal(state.finance.observations.length, 1);
    const estimate = contracts['GET /api/v1/finance/costs/recipes/{id}'].success.shape.data.parse(
        await send(`/api/v1/finance/costs/recipes/${recipe.id}`, 'GET').json(),
    );
    assert.equal(estimate.complete, false);
    assert.equal(estimate.estimatedTotalMinor, null);
    assert.equal(estimate.knownLineCount, 1);
    assert.ok(estimate.knownSubtotalMinor > 0);
});

void test('analytics exposes a forecast only with a long enough expense history', async () => {
    const { send } = setup();
    for (const [index, occurredAt] of [
        '2026-08-10T08:00:00.000Z',
        '2026-09-10T08:00:00.000Z',
        '2026-10-08T08:00:00.000Z',
    ].entries())
        assert.equal(
            send('/api/v1/finance/expenses', 'POST', {
                category: index === 2 ? 'restaurant' : 'groceries',
                amountMinor: 1000 + index * 100,
                occurredAt,
                financeConsent: true,
                idempotencyKey: crypto.randomUUID(),
            }).status,
            200,
        );
    const result = contracts['GET /api/v1/finance/analytics'].success.shape.data.parse(
        await send(
            '/api/v1/finance/analytics',
            'GET',
            undefined,
            {},
            null,
            new URLSearchParams('from=2026-08-01&to=2026-10-08'),
        ).json(),
    );
    assert.equal(result.forecast.available, true);
    assert.ok(result.forecast.projected30DayMinor);
    assert.equal(result.totals.confirmedSavingsMinor, null);
    assert.equal(result.completeness.savingsCoveragePercent, null);
});
