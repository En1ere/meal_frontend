import type { z } from 'zod';
import type { ApiClient } from '../../shared/api/client.js';
import type { contracts, Success } from '../../shared/api/contracts.generated.js';

type RecipeAllergensTransport = Pick<ApiClient, 'request'>;
export type AllergenReportCommand = z.input<(typeof contracts)['POST /api/v1/allergens/reports']['request']>;

export async function reportRecipeAllergens(
    transport: RecipeAllergensTransport,
    command: AllergenReportCommand,
): Promise<Success<'POST /api/v1/allergens/reports'>['data']> {
    return (await transport.request('POST /api/v1/allergens/reports', command)).data;
}
