import type { z } from 'zod';
import type { ApiClient } from '../../shared/api/client.js';
import type { contracts, Success } from '../../shared/api/contracts.generated.js';

type RecipeMineTransport = Pick<ApiClient, 'request'>;
type WorkspaceScope = 'private' | 'family';
type WorkspaceStatus = 'active' | 'archived';
type WorkspaceCommandBody = z.input<(typeof contracts)['POST /api/v1/recipe-workspace/{id}/archive']['request']>;

export type RecipeMineCommand = 'archive' | 'restore' | 'submit' | 'rollback';
export type RecipeMineCommandInput = {
    action: RecipeMineCommand;
    id: string;
    body: WorkspaceCommandBody;
};

export async function loadMineRecipes(
    transport: RecipeMineTransport,
    input: { q: string; scope: WorkspaceScope; status: WorkspaceStatus; page: number },
    signal: AbortSignal,
): Promise<Success<'GET /api/v1/recipe-workspace'>['data']> {
    return (
        await transport.request('GET /api/v1/recipe-workspace', undefined, signal, undefined, {
            query: {
                q: input.q,
                scope: input.scope,
                status: input.status,
                page: String(input.page),
                limit: '20',
            },
        })
    ).data;
}

export async function runMineRecipeCommand(
    transport: RecipeMineTransport,
    input: RecipeMineCommandInput,
    signal?: AbortSignal,
): Promise<void> {
    if (input.action === 'archive') {
        await transport.request('POST /api/v1/recipe-workspace/{id}/archive', input.body, signal, { id: input.id });
        return;
    }
    if (input.action === 'restore') {
        await transport.request('POST /api/v1/recipe-workspace/{id}/restore', input.body, signal, { id: input.id });
        return;
    }
    if (input.action === 'submit') {
        await transport.request('POST /api/v1/recipe-workspace/{id}/submit', input.body, signal, { id: input.id });
        return;
    }
    await transport.request('POST /api/v1/recipe-workspace/{id}/rollback', input.body, signal, { id: input.id });
}
