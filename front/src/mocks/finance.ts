import { z } from 'zod';
import { contracts } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';
import { mockDiaryAccess } from './diary.js';
import { publicRecipeFixtures, recipeProductFixtures } from './recipe-fixtures.js';

const expenseSchema = contracts['GET /api/v1/finance/expenses'].success.shape.data.shape.items.element;
const budgetSchema = contracts['GET /api/v1/finance/budgets'].success.shape.data.shape.items.element;
const observationSchema = contracts['GET /api/v1/finance/prices'].success.shape.data.shape.items.element;
const replaySchema = z.strictObject({ hash: z.string(), data: z.unknown() });
export const financeStateSchema = z.strictObject({
    expenses: z.array(z.strictObject({ userId: z.uuid(), expense: expenseSchema })),
    budgets: z.array(z.strictObject({ userId: z.uuid(), budget: budgetSchema })),
    observations: z.array(z.strictObject({ userId: z.uuid(), observation: observationSchema })).default([]),
    replay: z.record(z.string(), replaySchema),
});
export type FinanceState = z.infer<typeof financeStateSchema>;
export const createFinanceState = (): FinanceState => ({ expenses: [], budgets: [], observations: [], replay: {} });

type Context = {
    state: MockState;
    userId: string | null;
    path: string;
    method: string;
    query: URLSearchParams;
    params: Record<string, string>;
    input: unknown;
    ifMatch: string | null;
    now: number;
    success: (data: unknown) => Response;
    fail: (status: number, code?: string) => Response;
};

const period = (query: URLSearchParams) => {
    const value = z
        .strictObject({
            from: z.iso.date(),
            to: z.iso.date(),
            category: z.enum(['groceries', 'delivery', 'restaurant', 'prepared_food', 'beverages', 'other']).optional(),
        })
        .safeParse(Object.fromEntries(query));
    if (!value.success || value.data.from > value.data.to) return null;
    const days = Math.floor((Date.parse(value.data.to) - Date.parse(value.data.from)) / 86400000) + 1;
    return days > 366 ? null : value.data;
};
const dataThrough = (endsAt: string | null, to: string) => {
    const cutoff = endsAt?.slice(0, 10);
    return cutoff && cutoff < to ? cutoff : to;
};
const ingredientCatalog = [
    ['1', 'Молоко', 'ml'],
    ['2', 'Яблоки', 'g'],
    ['3', 'Рис', 'g'],
    ...recipeProductFixtures,
].map(([index, name, unit]) => ({ ingredientId: `10000000-0000-4000-8000-${index.padStart(12, '0')}`, name, unit }));
export const priceFor = (
    state: MockState,
    userId: string,
    ingredientId: string,
    unit: string,
    cutoff: string | null,
) => {
    const item = state.finance.observations
        .filter(
            (row) =>
                row.userId === userId &&
                row.observation.ingredientId === ingredientId &&
                row.observation.unit === unit &&
                (!cutoff || row.observation.createdAt <= cutoff),
        )
        .sort((a, b) => b.observation.observedAt.localeCompare(a.observation.observedAt))[0]?.observation;
    if (!item) return null;
    return contracts['GET /api/v1/finance/prices'].success.shape.data.shape.resolved.element.parse({
        ingredientId,
        ingredientName: item.ingredientName,
        unit,
        amountMinor: Math.round(item.amountMinor / Number(item.quantity)),
        perQuantity: '1',
        currency: 'RUB',
        source: 'personal_latest',
        observedAt: item.observedAt,
        sampleCount: 1,
        methodVersion: 'personal-latest-v1',
    });
};
const estimate = (
    state: MockState,
    userId: string,
    access: NonNullable<ReturnType<typeof mockDiaryAccess>>,
    type: 'recipe' | 'shopping_list' | 'meal_plan',
    id: string,
) => {
    let title = '';
    let raw: Array<{ ingredientId: string | null; name: string; quantity: string | null; unit: string | null }> = [];
    if (type === 'recipe') {
        const recipe = publicRecipeFixtures().find((item) => item.id === id);
        if (!recipe) return null;
        title = recipe.title;
        raw = recipe.ingredients
            .filter((item) => !item.optional)
            .map((item) => ({
                ingredientId: item.ingredientId,
                name: item.name,
                quantity: item.quantity,
                unit: item.unit,
            }));
    } else if (type === 'shopping_list') {
        const row = state.cookingWorkflow.lists.find((item) => item.userId === userId && item.list.id === id);
        if (!row) return null;
        title = row.list.title;
        raw = row.list.items
            .filter((item) => item.status !== 'removed')
            .map((item) => ({
                ingredientId: item.ingredientId,
                name: item.name,
                quantity: item.quantity,
                unit: item.unit,
            }));
    } else {
        const row = state.mealPlan.plans.find((item) => item.userId === userId && item.id === id);
        if (!row) return null;
        title = 'Личный план питания';
        for (const entry of row.entries) {
            const recipe = entry.recipe ? publicRecipeFixtures().find((item) => item.id === entry.recipe!.id) : null;
            if (!recipe) continue;
            for (const item of recipe.ingredients.filter((item) => !item.optional))
                raw.push({
                    ingredientId: item.ingredientId,
                    name: item.name,
                    quantity: item.quantity
                        ? String((Number(item.quantity) * entry.portions) / recipe.baseServings)
                        : null,
                    unit: item.unit,
                });
        }
    }
    const cutoff = access.mode === 'read_only' ? access.periodEndsAt : null;
    const lines = raw.map((line) => {
        const reason = !line.ingredientId
            ? 'unknown_ingredient'
            : !line.quantity
              ? 'unknown_quantity'
              : !line.unit
                ? 'unknown_unit'
                : null;
        const price = reason ? null : priceFor(state, userId, line.ingredientId!, line.unit!, cutoff);
        const estimatedMinor = price && line.quantity ? Math.round(price.amountMinor * Number(line.quantity)) : null;
        return { ...line, price, estimatedMinor, reason: reason ?? (price ? 'priced' : 'price_unavailable') };
    });
    const known = lines.filter((line) => line.estimatedMinor !== null),
        knownSubtotalMinor = known.reduce((sum, line) => sum + line.estimatedMinor!, 0),
        complete = lines.length > 0 && known.length === lines.length;
    return {
        access,
        subject: { type, id, title },
        currency: 'RUB',
        approximate: true,
        disclaimer: 'Примерная стоимость. Цены зависят от региона, магазина, бренда и даты покупки.',
        complete,
        knownLineCount: known.length,
        totalLineCount: lines.length,
        knownSubtotalMinor,
        estimatedTotalMinor: complete ? knownSubtotalMinor : null,
        lines,
    };
};

export function financeHandle(context: Context): Response | null {
    const { state, userId, path, method, query, params, input, ifMatch, now, success, fail } = context;
    if (!path.startsWith('/api/v1/finance/')) return null;
    if (!userId) return fail(401);
    const access = mockDiaryAccess(state, userId, now);
    const expenseDetail = /^\/api\/v1\/finance\/expenses\/[^/]+$/.test(path);
    const budgetDetail = /^\/api\/v1\/finance\/budgets\/[^/]+$/.test(path);
    if (!access) return fail(403, 'PRO_REQUIRED');
    if (method !== 'GET' && access.mode !== 'active') return fail(403, 'PRO_READ_ONLY');

    const replay = (target: string, key: string, body: unknown, create: () => unknown) => {
        const id = `${userId}:${target}:${key}`;
        const hash = JSON.stringify(body);
        const existing = state.finance.replay[id];
        if (existing) return existing.hash === hash ? success(existing.data) : fail(409, 'IDEMPOTENCY_CONFLICT');
        const data = create();
        if (data instanceof Response) return data;
        state.finance.replay[id] = { hash, data };
        return success(data);
    };

    if (path === '/api/v1/finance/prices/catalog' && method === 'GET')
        return success({ access, items: ingredientCatalog });
    if (path === '/api/v1/finance/prices' && method === 'GET') {
        const cutoff = access.mode === 'read_only' ? access.periodEndsAt : null;
        const items = state.finance.observations
            .filter((row) => row.userId === userId && (!cutoff || row.observation.createdAt <= cutoff))
            .map((row) => row.observation)
            .sort((a, b) => b.observedAt.localeCompare(a.observedAt));
        const keys = [...new Map(items.map((item) => [`${item.ingredientId}:${item.unit}`, item])).values()];
        return success({
            access,
            scope: 'private',
            currency: 'RUB',
            disclaimer: 'Примерная стоимость. Цены зависят от региона, магазина, бренда и даты покупки.',
            items,
            resolved: keys.map((item) => priceFor(state, userId, item.ingredientId, item.unit, cutoff)).filter(Boolean),
        });
    }
    if (path === '/api/v1/finance/prices' && method === 'POST') {
        const parsed = contracts['POST /api/v1/finance/prices'].request.safeParse(input);
        if (!parsed.success) return fail(400);
        return replay('observation:new', parsed.data.idempotencyKey, parsed.data, () => {
            const ingredient = ingredientCatalog.find(
                (item) => item.ingredientId === parsed.data.ingredientId && item.unit === parsed.data.unit,
            );
            if (!ingredient) return fail(404);
            const timestamp = new Date(now).toISOString();
            const item = observationSchema.parse({
                id: crypto.randomUUID(),
                ingredientId: ingredient.ingredientId,
                ingredientName: ingredient.name,
                unit: ingredient.unit,
                quantity: parsed.data.quantity,
                amountMinor: parsed.data.amountMinor,
                currency: 'RUB',
                observedAt: parsed.data.observedAt,
                source: 'manual',
                consentedAt: timestamp,
                eligibleForAggregate: false,
                version: 1,
                createdAt: timestamp,
            });
            state.finance.observations.push({ userId, observation: item });
            return { access, observation: item, resolved: priceFor(state, userId, item.ingredientId, item.unit, null) };
        });
    }
    const costMatch = path.match(/^\/api\/v1\/finance\/costs\/(recipes|shopping-lists|meal-plans)\/([^/]+)$/);
    if (costMatch && method === 'GET') {
        const type =
            costMatch[1] === 'recipes' ? 'recipe' : costMatch[1] === 'shopping-lists' ? 'shopping_list' : 'meal_plan';
        const result = estimate(state, userId, access, type, costMatch[2]!);
        return result ? success(result) : fail(404);
    }
    if (path === '/api/v1/finance/analytics' && method === 'GET') {
        const selected = period(query);
        if (!selected) return fail(400);
        const through = dataThrough(access.periodEndsAt, selected.to);
        const days = Math.floor((Date.parse(through) - Date.parse(selected.from)) / 86400000) + 1;
        if (days < 1) return fail(400);
        const expenses = state.finance.expenses
            .filter(
                (row) =>
                    row.userId === userId &&
                    row.expense.occurredAt.slice(0, 10) >= selected.from &&
                    row.expense.occurredAt.slice(0, 10) <= through &&
                    (!selected.category || row.expense.category === selected.category),
            )
            .map((row) => row.expense);
        const categoryRows = [...new Set(expenses.map((item) => item.category))].map((category) => ({
            category,
            amountMinor: expenses
                .filter((item) => item.category === category)
                .reduce((sum, item) => sum + item.amountMinor, 0),
            count: expenses.filter((item) => item.category === category).length,
        }));
        const receipts = state.shoppingReceipts.receipts
            .filter((row) => row.userId === userId && row.receipt.status === 'committed' && row.receipt.financial)
            .map((row) => row.receipt)
            .filter((receipt) => {
                const date = receipt.history.findLast((item) => item.action === 'committed')?.at.slice(0, 10);
                return !!date && date >= selected.from && date <= through;
            });
        const receiptGroups = receipts
            .map((receipt) => ({
                receipt,
                lines: receipt.lines.filter(
                    (line) => !selected.category || (line.isFood ? 'groceries' : 'other') === selected.category,
                ),
            }))
            .filter((group) => group.lines.length > 0);
        const receiptLines = receiptGroups.flatMap((group) => group.lines);
        const knownOriginal = receiptLines.filter((line) => line.originalAmountMinor !== null);
        const confirmedSavingsMinor = knownOriginal.length
            ? knownOriginal.reduce(
                  (sum, line) => sum + Math.max(0, line.originalAmountMinor! - (line.amountMinor ?? 0)),
                  0,
              )
            : null;
        const stores = [...new Set(receiptGroups.map(({ receipt }) => receipt.financial!.storeName ?? null))].map(
            (storeName) => {
                const rows = receiptGroups.filter(
                    ({ receipt }) => (receipt.financial!.storeName ?? null) === storeName,
                );
                return {
                    storeName,
                    amountMinor: rows.reduce(
                        (sum, group) =>
                            sum + group.lines.reduce((lineSum, line) => lineSum + (line.amountMinor ?? 0), 0),
                        0,
                    ),
                    receiptCount: rows.length,
                };
            },
        );
        const total = expenses.reduce((sum, item) => sum + item.amountMinor, 0);
        const receiptTotal = receiptGroups.reduce(
            (sum, group) => sum + group.lines.reduce((lineSum, line) => lineSum + (line.amountMinor ?? 0), 0),
            0,
        );
        const forecastAvailable = days >= 28 && expenses.length >= 3;
        return success({
            access,
            scope: 'private',
            period: { from: selected.from, to: selected.to, dataThrough: through, days },
            category: selected.category ?? null,
            currency: 'RUB',
            totals: {
                expenseMinor: total,
                expenseCount: expenses.length,
                receiptCount: receiptGroups.length,
                averageReceiptMinor: receiptGroups.length ? Math.round(receiptTotal / receiptGroups.length) : null,
                purchaseFrequencyPer30Days: receiptGroups.length
                    ? Number(((receiptGroups.length * 30) / days).toFixed(2))
                    : null,
                confirmedSavingsMinor,
            },
            completeness: {
                receiptLineCount: receiptLines.length,
                originalPriceKnownLineCount: knownOriginal.length,
                savingsCoveragePercent: receiptLines.length
                    ? Number(((knownOriginal.length / receiptLines.length) * 100).toFixed(1))
                    : null,
            },
            categories: categoryRows.sort((a, b) => b.amountMinor - a.amountMinor),
            stores: stores.sort((a, b) => b.amountMinor - a.amountMinor),
            forecast: {
                available: forecastAvailable,
                projected30DayMinor: forecastAvailable ? Math.round((total / days) * 30) : null,
                basisDays: days,
                reason: forecastAvailable ? 'available' : 'insufficient_history',
            },
        });
    }

    if (path === '/api/v1/finance/expenses' && method === 'GET') {
        const selected = period(query);
        if (!selected) return fail(400);
        const through = dataThrough(access.periodEndsAt, selected.to);
        const items = state.finance.expenses
            .filter(
                (row) =>
                    row.userId === userId &&
                    row.expense.occurredAt.slice(0, 10) >= selected.from &&
                    row.expense.occurredAt.slice(0, 10) <= through &&
                    (!selected.category || row.expense.category === selected.category),
            )
            .map((row) => row.expense)
            .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
        return success(
            contracts['GET /api/v1/finance/expenses'].success.shape.data.parse({
                access,
                scope: 'private',
                period: { from: selected.from, to: selected.to, dataThrough: through },
                category: selected.category ?? null,
                items,
                totalMinor: items.reduce((sum, item) => sum + item.amountMinor, 0),
                currency: 'RUB',
            }),
        );
    }
    if (path === '/api/v1/finance/expenses' && method === 'POST') {
        const parsed = contracts['POST /api/v1/finance/expenses'].request.safeParse(input);
        if (!parsed.success) return fail(400);
        return replay('expense:new', parsed.data.idempotencyKey, parsed.data, () => {
            const timestamp = new Date(now).toISOString();
            const item = expenseSchema.parse({
                id: crypto.randomUUID(),
                source: 'manual',
                category: parsed.data.category,
                amountMinor: parsed.data.amountMinor,
                currency: 'RUB',
                occurredAt: parsed.data.occurredAt,
                consentedAt: timestamp,
                version: 1,
                createdAt: timestamp,
            });
            state.finance.expenses.push({ userId, expense: item });
            return { access, expense: item };
        });
    }
    if (expenseDetail && method === 'GET') {
        const row = state.finance.expenses.find(
            (candidate) => candidate.userId === userId && candidate.expense.id === params.id,
        );
        if (!row || (access.mode === 'read_only' && access.periodEndsAt && row.expense.createdAt > access.periodEndsAt))
            return fail(404);
        return success({ access, expense: row.expense });
    }
    if (expenseDetail && method === 'PUT') {
        const parsed = contracts['PUT /api/v1/finance/expenses/{id}'].request.safeParse(input);
        if (!parsed.success) return fail(400);
        return replay(`expense:${params.id}`, parsed.data.idempotencyKey, parsed.data, () => {
            const row = state.finance.expenses.find(
                (candidate) => candidate.userId === userId && candidate.expense.id === params.id,
            );
            if (!row) return fail(404);
            if (ifMatch !== `"${row.expense.version}"` || parsed.data.expectedVersion !== row.expense.version)
                return fail(412, 'VERSION_MISMATCH');
            row.expense.category = parsed.data.category;
            row.expense.amountMinor = parsed.data.amountMinor;
            row.expense.occurredAt = parsed.data.occurredAt;
            row.expense.version++;
            return { access, expense: row.expense };
        });
    }
    if (path === '/api/v1/finance/budgets' && method === 'GET') {
        const cutoff = access.mode === 'read_only' ? access.periodEndsAt : null;
        return success(
            contracts['GET /api/v1/finance/budgets'].success.shape.data.parse({
                access,
                scope: 'private',
                supportsCategoryBudgets: false,
                items: state.finance.budgets
                    .filter((row) => row.userId === userId && (!cutoff || row.budget.createdAt <= cutoff))
                    .map((row) => row.budget)
                    .sort((left, right) => right.startsOn.localeCompare(left.startsOn)),
            }),
        );
    }
    if (path === '/api/v1/finance/budgets' && method === 'POST') {
        const parsed = contracts['POST /api/v1/finance/budgets'].request.safeParse(input);
        if (!parsed.success || parsed.data.startsOn > parsed.data.endsOn) return fail(400);
        return replay('budget:new', parsed.data.idempotencyKey, parsed.data, () => {
            if (
                state.finance.budgets.some(
                    (row) =>
                        row.userId === userId &&
                        row.budget.startsOn <= parsed.data.endsOn &&
                        row.budget.endsOn >= parsed.data.startsOn,
                )
            )
                return fail(409, 'BUDGET_OVERLAP');
            const item = budgetSchema.parse({
                id: crypto.randomUUID(),
                amountMinor: parsed.data.amountMinor,
                currency: 'RUB',
                startsOn: parsed.data.startsOn,
                endsOn: parsed.data.endsOn,
                category: null,
                version: 1,
                createdAt: new Date(now).toISOString(),
            });
            state.finance.budgets.push({ userId, budget: item });
            return { budget: item };
        });
    }
    if (budgetDetail && method === 'PUT') {
        const parsed = contracts['PUT /api/v1/finance/budgets/{id}'].request.safeParse(input);
        if (!parsed.success || parsed.data.startsOn > parsed.data.endsOn) return fail(400);
        return replay(`budget:${params.id}`, parsed.data.idempotencyKey, parsed.data, () => {
            const row = state.finance.budgets.find(
                (candidate) => candidate.userId === userId && candidate.budget.id === params.id,
            );
            if (!row) return fail(404);
            if (ifMatch !== `"${row.budget.version}"` || parsed.data.expectedVersion !== row.budget.version)
                return fail(412, 'VERSION_MISMATCH');
            if (
                state.finance.budgets.some(
                    (candidate) =>
                        candidate !== row &&
                        candidate.userId === userId &&
                        candidate.budget.startsOn <= parsed.data.endsOn &&
                        candidate.budget.endsOn >= parsed.data.startsOn,
                )
            )
                return fail(409, 'BUDGET_OVERLAP');
            row.budget.amountMinor = parsed.data.amountMinor;
            row.budget.startsOn = parsed.data.startsOn;
            row.budget.endsOn = parsed.data.endsOn;
            row.budget.version++;
            return { budget: row.budget };
        });
    }
    if (path === '/api/v1/finance/overview' && method === 'GET') {
        const selected = period(query);
        if (!selected) return fail(400);
        const through = dataThrough(access.periodEndsAt, selected.to);
        const expenses = state.finance.expenses
            .filter(
                (row) =>
                    row.userId === userId &&
                    row.expense.occurredAt.slice(0, 10) >= selected.from &&
                    row.expense.occurredAt.slice(0, 10) <= through,
            )
            .map((row) => row.expense);
        const activeBudget =
            state.finance.budgets
                .filter((row) => row.userId === userId)
                .map((row) => row.budget)
                .find((item) => item.startsOn <= through && item.endsOn >= selected.from) ?? null;
        const totalMinor = expenses.reduce((sum, item) => sum + item.amountMinor, 0);
        const spent = activeBudget
            ? expenses
                  .filter(
                      (item) =>
                          item.occurredAt.slice(0, 10) >= activeBudget.startsOn &&
                          item.occurredAt.slice(0, 10) <= activeBudget.endsOn,
                  )
                  .reduce((sum, item) => sum + item.amountMinor, 0)
            : null;
        return success(
            contracts['GET /api/v1/finance/overview'].success.shape.data.parse({
                access,
                scope: 'private',
                period: { from: selected.from, to: selected.to, dataThrough: through },
                expenseCount: expenses.length,
                totalMinor,
                currency: 'RUB',
                budget: activeBudget,
                budgetSpentMinor: spent,
                budgetRemainingMinor: activeBudget && spent !== null ? activeBudget.amountMinor - spent : null,
                forecastAvailable: false,
            }),
        );
    }
    return fail(404);
}
