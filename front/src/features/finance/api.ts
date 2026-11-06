import type { z } from 'zod';
import type { ApiClient } from '../../shared/api/client.js';
import type { contracts, Success } from '../../shared/api/contracts.generated.js';

export type FinanceTransport = Pick<ApiClient, 'request'>;
export type FinanceCategory = Success<'GET /api/v1/finance/expenses'>['data']['items'][number]['category'];
export type FinancePriceCommand = z.input<(typeof contracts)['POST /api/v1/finance/prices']['request']>;
export type FinanceExpenseCreateCommand = z.input<(typeof contracts)['POST /api/v1/finance/expenses']['request']>;
export type FinanceExpenseUpdateCommand = z.input<(typeof contracts)['PUT /api/v1/finance/expenses/{id}']['request']>;
export type FinanceBudgetCreateCommand = z.input<(typeof contracts)['POST /api/v1/finance/budgets']['request']>;
export type FinanceBudgetUpdateCommand = z.input<(typeof contracts)['PUT /api/v1/finance/budgets/{id}']['request']>;

export async function loadFinanceAnalytics(
    transport: FinanceTransport,
    from: string,
    to: string,
    category: FinanceCategory | '',
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/finance/analytics'>['data']> {
    return (
        await transport.request('GET /api/v1/finance/analytics', undefined, signal, undefined, {
            query: { from, to, ...(category ? { category } : {}) },
        })
    ).data;
}

export async function loadFinancePrices(
    transport: FinanceTransport,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/finance/prices'>['data']> {
    return (await transport.request('GET /api/v1/finance/prices', undefined, signal)).data;
}

export async function loadFinancePriceCatalog(
    transport: FinanceTransport,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/finance/prices/catalog'>['data']> {
    return (await transport.request('GET /api/v1/finance/prices/catalog', undefined, signal)).data;
}

export function createFinancePrice(
    transport: FinanceTransport,
    command: FinancePriceCommand,
): Promise<Success<'POST /api/v1/finance/prices'>> {
    return transport.request('POST /api/v1/finance/prices', command);
}

export async function loadFinanceExpenses(
    transport: FinanceTransport,
    from: string,
    to: string,
    category: FinanceCategory | '',
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/finance/expenses'>['data']> {
    return (
        await transport.request('GET /api/v1/finance/expenses', undefined, signal, undefined, {
            query: { from, to, ...(category ? { category } : {}) },
        })
    ).data;
}

export function createFinanceExpense(
    transport: FinanceTransport,
    command: FinanceExpenseCreateCommand,
): Promise<Success<'POST /api/v1/finance/expenses'>> {
    return transport.request('POST /api/v1/finance/expenses', command);
}

export async function loadFinanceExpense(
    transport: FinanceTransport,
    id: string,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/finance/expenses/{id}'>['data']> {
    return (await transport.request('GET /api/v1/finance/expenses/{id}', undefined, signal, { id })).data;
}

export function updateFinanceExpense(
    transport: FinanceTransport,
    id: string,
    command: FinanceExpenseUpdateCommand,
    ifMatch: number,
): Promise<Success<'PUT /api/v1/finance/expenses/{id}'>> {
    return transport.request('PUT /api/v1/finance/expenses/{id}', command, undefined, { id }, { ifMatch });
}

export async function loadFinanceOverview(
    transport: FinanceTransport,
    from: string,
    to: string,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/finance/overview'>['data']> {
    return (
        await transport.request('GET /api/v1/finance/overview', undefined, signal, undefined, { query: { from, to } })
    ).data;
}

export async function loadFinanceBudgets(
    transport: FinanceTransport,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/finance/budgets'>['data']> {
    return (await transport.request('GET /api/v1/finance/budgets', undefined, signal)).data;
}

export function createFinanceBudget(
    transport: FinanceTransport,
    command: FinanceBudgetCreateCommand,
): Promise<Success<'POST /api/v1/finance/budgets'>> {
    return transport.request('POST /api/v1/finance/budgets', command);
}

export function updateFinanceBudget(
    transport: FinanceTransport,
    id: string,
    command: FinanceBudgetUpdateCommand,
    ifMatch: number,
): Promise<Success<'PUT /api/v1/finance/budgets/{id}'>> {
    return transport.request('PUT /api/v1/finance/budgets/{id}', command, undefined, { id }, { ifMatch });
}
