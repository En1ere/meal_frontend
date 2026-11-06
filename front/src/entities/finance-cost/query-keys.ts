export type FinanceCostRoute =
    | 'GET /api/v1/finance/costs/recipes/{id}'
    | 'GET /api/v1/finance/costs/shopping-lists/{id}'
    | 'GET /api/v1/finance/costs/meal-plans/{id}';

export const financeCostKeys = {
    estimate: (route: FinanceCostRoute, id: string, userId: string | undefined) =>
        ['finance-cost', route, id, userId] as const,
};
