import { z } from 'zod';
import { contracts } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';
import { publicRecipeFixtures } from './recipe-fixtures.js';
import { createAllergenReportSupportTicket } from './support.js';

export const allergenReportsStateSchema = z.object({
    replay: z.record(z.string(), z.object({ input: z.string(), ticketId: z.uuid(), ticketNumber: z.string() })),
});
export type AllergenReportsState = z.infer<typeof allergenReportsStateSchema>;
export const createAllergenReportsState = (): AllergenReportsState => ({ replay: {} });

export function allergenReportsHandle(c: {
    state: MockState;
    userId: string | null;
    path: string;
    method: string;
    input: unknown;
    now: number;
    success: (data: unknown) => Response;
    fail: (status: number) => Response;
}): Response | null {
    const { state, userId, path, method, input, now, success, fail } = c;
    if (path !== '/api/v1/allergens/reports') return null;
    if (method !== 'POST') return fail(404);
    if (!userId) return fail(401);
    const parsed = contracts['POST /api/v1/allergens/reports'].request.safeParse(input);
    if (!parsed.success) return fail(400);
    const body = parsed.data;
    const recipe = publicRecipeFixtures().find(
        (item) =>
            item.id === body.recipeId &&
            item.revisionId === body.revisionId &&
            !state.recipeWorkspace.hidden.includes(item.id),
    );
    if (!recipe) return fail(404);
    const allowed = new Set(recipe.allergenCompleteness.unknownIngredients.map((item) => item.recipeIngredientId));
    if (body.unknownIngredientIds.some((id) => !allowed.has(id))) return fail(409);
    const key = `${userId}:${body.idempotencyKey}`;
    const encoded = JSON.stringify(body);
    const previous = state.allergenReports.replay[key];
    if (previous)
        return previous.input === encoded
            ? success({ ticketId: previous.ticketId, ticketNumber: previous.ticketNumber })
            : fail(409);
    const result = createAllergenReportSupportTicket({
        state,
        userId,
        recipeTitle: recipe.title,
        recipeId: recipe.id,
        revisionId: recipe.revisionId,
        ingredientNames: recipe.allergenCompleteness.unknownIngredients
            .filter((item) => body.unknownIngredientIds.includes(item.recipeIngredientId))
            .map((item) => item.name),
        note: body.note ?? '',
        now,
    });
    state.allergenReports.replay[key] = { input: encoded, ...result };
    return success(result);
}
