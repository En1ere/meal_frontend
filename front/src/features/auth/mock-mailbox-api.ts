import type { ApiClient } from '../../shared/api/client.js';
import type { Success } from '../../shared/api/contracts.generated.js';

export type MockMailboxTransport = Pick<ApiClient, 'request'>;

export async function loadMockMailbox(
    transport: MockMailboxTransport,
    email: string,
    signal?: AbortSignal,
): Promise<Success<'POST /api/v1/dev/mailbox'>['data']['messages']> {
    return (await transport.request('POST /api/v1/dev/mailbox', { email }, signal)).data.messages;
}
