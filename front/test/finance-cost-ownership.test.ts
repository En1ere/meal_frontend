import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadFinanceCost } from '../src/entities/finance-cost/api.js';
import { financeCostKeys, type FinanceCostRoute } from '../src/entities/finance-cost/query-keys.js';

const routes = [
    'GET /api/v1/finance/costs/recipes/{id}',
    'GET /api/v1/finance/costs/shopping-lists/{id}',
    'GET /api/v1/finance/costs/meal-plans/{id}',
] as const satisfies readonly FinanceCostRoute[];

const estimate = {
    knownSubtotalMinor: 1500,
    estimatedTotalMinor: 2000,
    knownLineCount: 3,
    totalLineCount: 4,
    complete: false,
    disclaimer: 'Тестовая оценка',
} as const;

interface RecordedRequest {
    route: string;
    body: unknown;
    signal: AbortSignal | undefined;
    params: unknown;
}

function transportFixture() {
    const requests: RecordedRequest[] = [];
    const request = (route: string, body?: unknown, signal?: AbortSignal, params?: unknown) => {
        requests.push({ route, body, signal, params });
        return Promise.resolve({ data: estimate });
    };
    return { requests, transport: { request } };
}

void test('finance-cost keys preserve exact route, resource and account tuple', () => {
    assert.deepEqual(financeCostKeys.estimate(routes[0], 'recipe-a', undefined), [
        'finance-cost',
        routes[0],
        'recipe-a',
        undefined,
    ]);
    assert.deepEqual(financeCostKeys.estimate(routes[2], 'plan-a', 'user-a'), [
        'finance-cost',
        routes[2],
        'plan-a',
        'user-a',
    ]);
});

void test('finance-cost adapter dispatches every route with exact id, signal and data', async () => {
    const { requests, transport } = transportFixture();
    const controller = new AbortController();
    for (const [index, route] of routes.entries())
        assert.equal(await loadFinanceCost(transport, route, `resource-${index}`, controller.signal), estimate);
    assert.deepEqual(
        requests,
        routes.map((route, index) => ({
            route,
            body: undefined,
            signal: controller.signal,
            params: { id: `resource-${index}` },
        })),
    );
});

void test('finance-cost client consumes private owners without direct transport calls', async () => {
    const source = await readFile('src/entities/finance-cost/client.tsx', 'utf8');
    assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.match(source, /financeCostKeys\.estimate\(route, id, session\.data\?\.id\)/u);
    assert.match(source, /loadFinanceCost\(api!, route, id, signal\)/u);
    assert.match(source, /retry: false/u);
});
