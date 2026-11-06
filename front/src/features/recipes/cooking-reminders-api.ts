import type { ApiClient } from '../../shared/api/client.js';
import type { Success } from '../../shared/api/contracts.generated.js';

type CookingReminderTransport = Pick<ApiClient, 'request'>;

export async function loadCookingReminderPreferences(
    transport: CookingReminderTransport,
    signal: AbortSignal,
): Promise<Success<'GET /api/v1/cooking-attempts/reminder-preferences'>['data']> {
    return (await transport.request('GET /api/v1/cooking-attempts/reminder-preferences', undefined, signal)).data;
}
