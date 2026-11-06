export const mealPlanKeys = {
    root: ['meal-plan'] as const,
    forAccount: (userId: string | undefined) => ['meal-plan', userId] as const,
    automationRecipes: (userId: string | undefined) => ['meal-plan', 'automation-recipes', userId] as const,
    pageRecipes: (userId: string | undefined) => ['meal-plan', 'recipes', userId] as const,
    plan: <Selection>(userId: string | undefined, selection: Selection) => ['meal-plan', userId, selection] as const,
    portions: (scope: 'private' | 'family', userId: string | undefined) => ['portions', scope, userId] as const,
};
