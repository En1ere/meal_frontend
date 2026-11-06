import type { ApiClient } from '../../shared/api/client.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import type { FinanceCostRoute } from './query-keys.js';

export type FinanceCostData =
    | Success<'GET /api/v1/finance/costs/recipes/{id}'>['data']
    | Success<'GET /api/v1/finance/costs/shopping-lists/{id}'>['data']
    | Success<'GET /api/v1/finance/costs/meal-plans/{id}'>['data'];
export type FinanceCostTransport = Pick<ApiClient, 'request'>;

export async function loadFinanceCost(
    transport: FinanceCostTransport,
    route: FinanceCostRoute,
    id: string,
    signal?: AbortSignal,
): Promise<FinanceCostData> {
    return (await transport.request(route, undefined, signal, { id })).data;
}
