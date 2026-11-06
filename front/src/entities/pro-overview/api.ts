import type { ApiClient } from '../../shared/api/client.js';
import type { Success } from '../../shared/api/contracts.generated.js';

export type ProOverview = Success<'GET /api/v1/pro/overview'>['data'];
export type ProOverviewReadTransport = Pick<ApiClient, 'request'>;

export async function loadProOverview(transport: ProOverviewReadTransport, signal?: AbortSignal): Promise<ProOverview> {
    return (await transport.request('GET /api/v1/pro/overview', undefined, signal)).data;
}
