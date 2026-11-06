import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
    createFinanceBudget,
    createFinanceExpense,
    createFinancePrice,
    loadFinanceAnalytics,
    loadFinanceBudgets,
    loadFinanceExpense,
    loadFinanceExpenses,
    loadFinanceOverview,
    loadFinancePriceCatalog,
    loadFinancePrices,
    updateFinanceBudget,
    updateFinanceExpense,
} from '../src/features/finance/api.js';
import { financeKeys } from '../src/features/finance/query-keys.js';

void test('finance analytics key preserves exact account, range and category tuple', () => {
    assert.deepEqual(financeKeys.analytics(undefined, '2026-01-01', '2026-03-31', ''), [
        'finance-analytics',
        undefined,
        '2026-01-01',
        '2026-03-31',
        '',
    ]);
    assert.deepEqual(financeKeys.analytics('user-a', '2026-01-01', '2026-03-31', 'groceries'), [
        'finance-analytics',
        'user-a',
        '2026-01-01',
        '2026-03-31',
        'groceries',
    ]);
});

void test('finance price keys keep list, catalog and broad invalidation projections distinct', () => {
    assert.deepEqual(financeKeys.pricesRoot, ['finance-prices']);
    assert.deepEqual(financeKeys.prices(undefined), ['finance-prices', undefined]);
    assert.deepEqual(financeKeys.prices('user-a'), ['finance-prices', 'user-a']);
    assert.deepEqual(financeKeys.priceCatalog(undefined), ['finance-price-catalog', undefined]);
    assert.deepEqual(financeKeys.priceCatalog('user-a'), ['finance-price-catalog', 'user-a']);
});

void test('finance expense list keeps exact filters and distinct broad refresh prefixes', () => {
    assert.deepEqual(financeKeys.expensesRoot, ['finance-expenses']);
    assert.deepEqual(financeKeys.expenses(undefined, '2026-01-01', '2026-01-31', ''), [
        'finance-expenses',
        undefined,
        '2026-01-01',
        '2026-01-31',
        '',
    ]);
    assert.deepEqual(financeKeys.expenses('user-a', '2026-02-01', '2026-02-28', 'groceries'), [
        'finance-expenses',
        'user-a',
        '2026-02-01',
        '2026-02-28',
        'groceries',
    ]);
    assert.deepEqual(financeKeys.overviewRoot, ['finance-overview']);
    assert.notDeepEqual(financeKeys.expensesRoot, financeKeys.overviewRoot);
});

void test('finance overview and budgets keep exact distinct range and account projections', () => {
    assert.deepEqual(financeKeys.overview(undefined, '2026-01-01', '2026-01-31'), [
        'finance-overview',
        undefined,
        '2026-01-01',
        '2026-01-31',
    ]);
    assert.deepEqual(financeKeys.overview('user-a', '2026-02-01', '2026-02-28'), [
        'finance-overview',
        'user-a',
        '2026-02-01',
        '2026-02-28',
    ]);
    assert.deepEqual(financeKeys.budgetsRoot, ['finance-budgets']);
    assert.deepEqual(financeKeys.budgets(undefined), ['finance-budgets', undefined]);
    assert.deepEqual(financeKeys.budgets('user-a'), ['finance-budgets', 'user-a']);
    assert.notDeepEqual(financeKeys.overviewRoot, financeKeys.budgetsRoot);
});

void test('finance expense detail keeps its singular cache lifecycle distinct from the list', () => {
    assert.deepEqual(financeKeys.expenseRoot, ['finance-expense']);
    assert.deepEqual(financeKeys.expense(undefined, 'expense-a'), ['finance-expense', undefined, 'expense-a']);
    assert.deepEqual(financeKeys.expense('user-a', 'expense-b'), ['finance-expense', 'user-a', 'expense-b']);
    assert.notDeepEqual(financeKeys.expenseRoot, financeKeys.expensesRoot);
});

void test('finance adapter preserves filters, prepared commands, If-Match, projections and native errors', async () => {
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

    assert.equal(await loadFinanceAnalytics(transport as never, '2026-01-01', '2026-01-31', '', signal), envelope.data);
    assert.equal(await loadFinancePrices(transport as never, signal), envelope.data);
    assert.equal(await loadFinancePriceCatalog(transport as never, signal), envelope.data);
    assert.equal(await createFinancePrice(transport as never, command), envelope);
    assert.equal(
        await loadFinanceExpenses(transport as never, '2026-01-01', '2026-01-31', 'groceries', signal),
        envelope.data,
    );
    assert.equal(await createFinanceExpense(transport as never, command), envelope);
    assert.equal(await loadFinanceExpense(transport as never, 'expense-a', signal), envelope.data);
    assert.equal(await updateFinanceExpense(transport as never, 'expense-a', command, 6), envelope);
    assert.equal(await loadFinanceOverview(transport as never, '2026-01-01', '2026-01-31', signal), envelope.data);
    assert.equal(await loadFinanceBudgets(transport as never, signal), envelope.data);
    assert.equal(await createFinanceBudget(transport as never, command), envelope);
    assert.equal(await updateFinanceBudget(transport as never, 'budget-a', command, 6), envelope);

    assert.deepEqual(calls, [
        [
            'GET /api/v1/finance/analytics',
            undefined,
            signal,
            undefined,
            { query: { from: '2026-01-01', to: '2026-01-31' } },
        ],
        ['GET /api/v1/finance/prices', undefined, signal],
        ['GET /api/v1/finance/prices/catalog', undefined, signal],
        ['POST /api/v1/finance/prices', command],
        [
            'GET /api/v1/finance/expenses',
            undefined,
            signal,
            undefined,
            { query: { from: '2026-01-01', to: '2026-01-31', category: 'groceries' } },
        ],
        ['POST /api/v1/finance/expenses', command],
        ['GET /api/v1/finance/expenses/{id}', undefined, signal, { id: 'expense-a' }],
        ['PUT /api/v1/finance/expenses/{id}', command, undefined, { id: 'expense-a' }, { ifMatch: 6 }],
        [
            'GET /api/v1/finance/overview',
            undefined,
            signal,
            undefined,
            { query: { from: '2026-01-01', to: '2026-01-31' } },
        ],
        ['GET /api/v1/finance/budgets', undefined, signal],
        ['POST /api/v1/finance/budgets', command],
        ['PUT /api/v1/finance/budgets/{id}', command, undefined, { id: 'budget-a' }, { ifMatch: 6 }],
    ]);

    const error = new Error('transport failed');
    await assert.rejects(
        loadFinanceBudgets({ request: () => Promise.reject(error) } as never),
        (actual) => actual === error,
    );
});

void test('finance analytics uses its private owner without changing request or UI semantics', async () => {
    const [source, adapter] = await Promise.all([
        readFile('src/features/finance/analytics-route.tsx', 'utf8'),
        readFile('src/features/finance/api.ts', 'utf8'),
    ]);

    assert.match(source, /queryKey: financeKeys\.analytics\(session\.data\?\.id, from, to, category\)/u);
    assert.doesNotMatch(source, /\[['"]finance-analytics['"]/u);
    assert.match(source, /enabled: !!api && !!session\.data && from <= to/u);
    assert.match(source, /loadFinanceAnalytics\(api!, from, to, category, signal\)/u);
    assert.match(adapter, /query: \{ from, to, \.\.\.\(category \? \{ category \} : \{\}\) \}/u);
    assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.match(source, /<ErrorPanel error=\{analytics\.error\} retry=\{\(\) => void analytics\.refetch\(\)\} \/>/u);
    assert.match(source, /aria-label="Фильтры аналитики"/u);
});

void test('finance prices use exact owned projections without changing transport or command semantics', async () => {
    const source = await readFile('src/features/finance/prices-route.tsx', 'utf8');

    assert.match(source, /queryKey: financeKeys\.prices\(session\.data\?\.id\)/u);
    assert.match(source, /queryKey: financeKeys\.priceCatalog\(session\.data\?\.id\)/u);
    assert.match(source, /invalidateQueries\(\{ queryKey: financeKeys\.pricesRoot \}\)/u);
    assert.doesNotMatch(source, /queryKey: \[['"]finance-(?:prices|price-catalog)['"]/u);
    assert.match(source, /loadFinancePrices\(api!, signal\)/u);
    assert.match(source, /loadFinancePriceCatalog\(api!, signal\)/u);
    assert.match(source, /createFinancePrice\(api!, \{/u);
    assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.match(source, /financeConsent: true/u);
    assert.match(source, /idempotencyKey: crypto\.randomUUID\(\)/u);
    assert.match(source, /setOpen\(false\)/u);
});

void test('finance expenses use exact owners without changing filters, command or invalidation fan-out', async () => {
    const [source, adapter] = await Promise.all([
        readFile('src/features/finance/expenses-route.tsx', 'utf8'),
        readFile('src/features/finance/api.ts', 'utf8'),
    ]);

    assert.match(source, /queryKey: financeKeys\.expenses\(session\.data\?\.id, from, to, category\)/u);
    assert.match(source, /invalidateQueries\(\{ queryKey: financeKeys\.expensesRoot \}\)/u);
    assert.match(source, /invalidateQueries\(\{ queryKey: financeKeys\.overviewRoot \}\)/u);
    assert.match(source, /invalidateQueries\(\{ queryKey: proOverviewKeys\.root \}\)/u);
    assert.doesNotMatch(source, /queryKey: \[['"]finance-(?:expenses|overview)['"]/u);
    assert.match(source, /loadFinanceExpenses\(api!, from, to, category, signal\)/u);
    assert.match(adapter, /query: \{ from, to, \.\.\.\(category \? \{ category \} : \{\}\) \}/u);
    assert.match(source, /createFinanceExpense\(api!, \{/u);
    assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.match(source, /financeConsent: true/u);
    assert.match(source, /idempotencyKey: crypto\.randomUUID\(\)/u);
    assert.match(source, /await Promise\.all\(/u);
});

void test('finance overview uses exact owners without changing budget read or write semantics', async () => {
    const source = await readFile('src/features/finance/overview-route.tsx', 'utf8');

    assert.match(source, /queryKey: financeKeys\.overview\(session\.data\?\.id, from, to\)/u);
    assert.match(source, /queryKey: financeKeys\.budgets\(session\.data\?\.id\)/u);
    assert.match(source, /invalidateQueries\(\{ queryKey: financeKeys\.overviewRoot \}\)/u);
    assert.match(source, /invalidateQueries\(\{ queryKey: financeKeys\.budgetsRoot \}\)/u);
    assert.doesNotMatch(source, /queryKey: \[['"]finance-(?:overview|budgets)['"]/u);
    assert.match(source, /loadFinanceOverview\(api!, from, to, signal\)/u);
    assert.match(source, /loadFinanceBudgets\(api!, signal\)/u);
    assert.match(source, /updateFinanceBudget\(/u);
    assert.match(source, /createFinanceBudget\(api!, \{/u);
    assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.match(source, /expectedVersion: current\.version/u);
    assert.match(source, /\},\s*current\.version,\s*\)/u);
    assert.match(source, /idempotencyKey: crypto\.randomUUID\(\)/u);
    assert.match(source, /category: null/u);
});

void test('finance detail uses exact owners without changing optimistic update semantics', async () => {
    const source = await readFile('src/features/finance/expense-detail-route.tsx', 'utf8');

    assert.match(source, /queryKey: financeKeys\.expense\(session\.data\?\.id, id\)/u);
    assert.match(source, /invalidateQueries\(\{ queryKey: financeKeys\.expenseRoot \}\)/u);
    assert.match(source, /invalidateQueries\(\{ queryKey: financeKeys\.expensesRoot \}\)/u);
    assert.match(source, /invalidateQueries\(\{ queryKey: financeKeys\.overviewRoot \}\)/u);
    assert.doesNotMatch(source, /queryKey: \[['"]finance-(?:expense|expenses|overview)['"]/u);
    assert.match(source, /loadFinanceExpense\(api!, id, signal\)/u);
    assert.match(source, /updateFinanceExpense\(/u);
    assert.doesNotMatch(source, /\.request\s*\(/u);
    assert.match(source, /expectedVersion: query\.data\.expense\.version/u);
    assert.match(source, /\},\s*query\.data\.expense\.version,\s*\)/u);
    assert.match(source, /idempotencyKey: crypto\.randomUUID\(\)/u);
    assert.match(source, /await Promise\.all\(/u);
    assert.doesNotMatch(source, /'PATCH \/api\/v1\/finance\/expenses/u);
    assert.doesNotMatch(source, /'DELETE \/api\/v1\/finance\/expenses/u);
});
