export const financeKeys = {
    analytics: (userId: string | undefined, from: string, to: string, category: string) =>
        ['finance-analytics', userId, from, to, category] as const,
    expensesRoot: ['finance-expenses'] as const,
    expenses: (userId: string | undefined, from: string, to: string, category: string) =>
        ['finance-expenses', userId, from, to, category] as const,
    expenseRoot: ['finance-expense'] as const,
    expense: (userId: string | undefined, id: string) => ['finance-expense', userId, id] as const,
    overviewRoot: ['finance-overview'] as const,
    overview: (userId: string | undefined, from: string, to: string) => ['finance-overview', userId, from, to] as const,
    budgetsRoot: ['finance-budgets'] as const,
    budgets: (userId: string | undefined) => ['finance-budgets', userId] as const,
    pricesRoot: ['finance-prices'] as const,
    prices: (userId: string | undefined) => ['finance-prices', userId] as const,
    priceCatalog: (userId: string | undefined) => ['finance-price-catalog', userId] as const,
};
