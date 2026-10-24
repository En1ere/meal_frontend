import { z } from 'zod';
import { contracts } from '../../shared/api/contracts.generated.js';
export const recipeCacheKey = 'meal-planner-recipes-read-v1';
const recipeSchema = contracts['GET /api/v1/recipes/{id}'].success.shape.data.shape.recipe;
const schema = z.object({
    owner: z.string(),
    items: z.array(z.object({ savedAt: z.string(), recipe: recipeSchema })).max(2),
});
export type CachedRecipe = z.infer<typeof schema>['items'][number];
export function readRecipeCache(storage: Pick<Storage, 'getItem'>, owner: string): CachedRecipe[] {
    try {
        const parsed = schema.safeParse(JSON.parse(storage.getItem(recipeCacheKey) ?? 'null'));
        return parsed.success && parsed.data.owner === owner
            ? parsed.data.items.filter((item) => Date.parse(item.savedAt) > Date.now() - 30 * 86400000)
            : [];
    } catch {
        return [];
    }
}
export function storeRecipeCache(
    storage: Pick<Storage, 'getItem' | 'setItem'>,
    owner: string,
    recipe: z.infer<typeof recipeSchema>,
    now = new Date().toISOString(),
) {
    const items = [
        { savedAt: now, recipe },
        ...readRecipeCache(storage, owner).filter((item) => item.recipe.id !== recipe.id),
    ].slice(0, 2);
    try {
        storage.setItem(recipeCacheKey, JSON.stringify({ owner, items }));
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('storage'));
    } catch {
        /* Storage may be disabled or full; a failed cache is never a successful save. */
    }
}
export function clearRecipeCache(storage: Pick<Storage, 'removeItem'>) {
    try {
        storage.removeItem(recipeCacheKey);
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('storage'));
    } catch {
        /* Optional browser storage may be unavailable. */
    }
}
export function clearBrowserRecipeCache() {
    try {
        clearRecipeCache(localStorage);
    } catch {
        /* Optional storage is unavailable. */
    }
}
