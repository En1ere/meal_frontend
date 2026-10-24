import type { Success } from '../../shared/api/contracts.generated.js';
export type WorkspaceRecipe = Success<'GET /api/v1/recipe-workspace/{id}'>['data']['recipe'];
export type RecipeDocument = WorkspaceRecipe['document'];
export const emptyDocument = (): RecipeDocument => ({
    title: '',
    description: null,
    category: null,
    tags: [],
    baseServings: 1,
    method: '',
    ingredients: [],
    steps: [],
});
export function moveRow<T>(rows: T[], index: number, direction: -1 | 1): T[] {
    const next = index + direction;
    if (index < 0 || index >= rows.length || next < 0 || next >= rows.length) return rows;
    const copy = [...rows];
    [copy[index], copy[next]] = [copy[next]!, copy[index]!];
    return copy;
}
export const submissionProblems = (document: RecipeDocument): string[] => [
    ...(!document.title.trim() ? ['Укажите название'] : []),
    ...(!document.ingredients.length ? ['Добавьте ингредиент'] : []),
    ...(!document.steps.length || document.steps.some((step) => !step.text.trim())
        ? ['Заполните шаги приготовления']
        : []),
];
export const recipeStatus: Record<string, string> = {
    draft: 'Черновик',
    private: 'Личный',
    pending: 'На модерации',
    pending_review: 'На модерации',
    approved: 'Одобрен',
    published: 'Опубликован',
    rejected: 'Нужны исправления',
    changes_requested: 'Нужны исправления',
    archived: 'Архив',
};
