import { cache } from 'react';
import { ApiClient, ApiError } from '../api/client.js';
import type { Success } from '../api/contracts.generated.js';
type Recipe = Success<'GET /api/v1/recipes/{id}'>['data']['recipe'];
export type PublicRecipeResult = { kind: 'found'; recipe: Recipe } | { kind: 'missing' } | { kind: 'unavailable' };
// Public-only, request-local memoization. No cookie/header forwarding and no shared personal cache.
export const getPublicRecipe = cache(async (id: string): Promise<PublicRecipeResult> => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
        return { kind: 'missing' };
    if (
        process.env.NEXT_PUBLIC_API_MODE === 'mock' &&
        (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_E2E_PRODUCTION_MOCKS === '1')
    ) {
        const { publicRecipeFixtures } = await import('../../mocks/recipe-fixtures.js');
        const recipe = publicRecipeFixtures().find((entry) => entry.id === id);
        return recipe ? { kind: 'found', recipe } : { kind: 'missing' };
    }
    try {
        const origin = process.env.BACKEND_ORIGIN ?? 'http://localhost:3001';
        const client = new ApiClient(origin);
        const response = await client.request('GET /api/v1/recipes/{id}', undefined, AbortSignal.timeout(5000), { id });
        return { kind: 'found', recipe: response.data.recipe };
    } catch (error) {
        return error instanceof ApiError && error.status === 404 ? { kind: 'missing' } : { kind: 'unavailable' };
    }
});
