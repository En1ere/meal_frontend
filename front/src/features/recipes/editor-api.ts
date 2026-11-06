import type { z } from 'zod';
import type { ApiClient } from '../../shared/api/client.js';
import type { contracts, Success } from '../../shared/api/contracts.generated.js';

type RecipeEditorTransport = Pick<ApiClient, 'request'>;
type WorkspaceScope = 'private' | 'family';
type CreateWorkspaceBody = z.input<(typeof contracts)['POST /api/v1/recipe-workspace']['request']>;
type UpdateWorkspaceBody = z.input<(typeof contracts)['PUT /api/v1/recipe-workspace/{id}']['request']>;
export type SaveWorkspaceAction =
    { action: 'create'; body: CreateWorkspaceBody } | { action: 'update'; id: string; body: UpdateWorkspaceBody };

export async function loadRecipeEditorProducts(
    transport: RecipeEditorTransport,
    search: string,
    signal: AbortSignal,
): Promise<Success<'GET /api/v1/products'>['data']> {
    return (
        await transport.request('GET /api/v1/products', undefined, signal, undefined, {
            query: { q: search, limit: '100' },
        })
    ).data;
}

export async function loadRecipeWorkspace(
    transport: RecipeEditorTransport,
    id: string,
    scope: WorkspaceScope,
    signal: AbortSignal,
): Promise<Success<'GET /api/v1/recipe-workspace/{id}'>['data']['recipe']> {
    return (
        await transport.request('GET /api/v1/recipe-workspace/{id}', undefined, signal, { id }, { query: { scope } })
    ).data.recipe;
}

export async function saveRecipeWorkspace(
    transport: RecipeEditorTransport,
    input: SaveWorkspaceAction,
    signal: AbortSignal,
): Promise<Success<'POST /api/v1/recipe-workspace'>['data']['recipe']> {
    if (input.action === 'update')
        return (await transport.request('PUT /api/v1/recipe-workspace/{id}', input.body, signal, { id: input.id })).data
            .recipe;
    return (await transport.request('POST /api/v1/recipe-workspace', input.body, signal)).data.recipe;
}
