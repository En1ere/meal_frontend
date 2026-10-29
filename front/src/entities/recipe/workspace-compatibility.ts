import { contracts, type Route, type Success } from '../../shared/api/contracts.generated.js';
import type { ApiResponseCompatibility } from '../../shared/api/client.js';

type Capability = 'unknown' | 'legacy' | 'revision-axes';
type JsonObject = Record<string, unknown>;

const WORKSPACE_ROUTES = new Set<Route>([
    'GET /api/v1/recipe-workspace',
    'GET /api/v1/recipe-workspace/{id}',
    'POST /api/v1/recipe-workspace',
    'PUT /api/v1/recipe-workspace/{id}',
    'POST /api/v1/recipe-workspace/{id}/archive',
    'POST /api/v1/recipe-workspace/{id}/restore',
    'POST /api/v1/recipe-workspace/{id}/rollback',
    'POST /api/v1/recipe-workspace/{id}/submit',
    'POST /api/v1/recipe-workspace/{id}/variant',
]);

function object(value: unknown): value is JsonObject {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function reviewStatus(value: unknown): string {
    switch (value) {
        case 'private':
        case 'archived':
            return 'draft';
        case 'pending_review':
        case 'approved':
            return 'pending';
        case 'changes_requested':
            return 'rejected';
        default:
            return typeof value === 'string' ? value : 'draft';
    }
}

function normalizeLegacyRecipe(value: unknown): { value: unknown; capability?: Exclude<Capability, 'unknown'> } {
    if (!object(value)) return { value };
    const hasReview = Object.hasOwn(value, 'review');
    const hasPublication = Object.hasOwn(value, 'publication');
    if (hasReview && hasPublication) return { value, capability: 'revision-axes' };
    // A partially rolled-out or malformed response is never repaired: strict generated parsing must reject it.
    if (hasReview || hasPublication) return { value };
    if (typeof value.revisionId !== 'string') return { value };
    const status = reviewStatus(value.status);
    const publishedAt = typeof value.publishedAt === 'string' ? value.publishedAt : null;
    return {
        value: {
            ...value,
            status,
            review: { revisionId: value.revisionId, status, publicReason: null },
            // Old responses normally have no publication timestamp. Fail closed instead of inventing one.
            publication:
                status === 'published' && publishedAt !== null ? { revisionId: value.revisionId, publishedAt } : null,
        },
        capability: 'legacy',
    };
}

export class RecipeWorkspaceCompatibility implements ApiResponseCompatibility {
    private capabilityValue: Capability = 'unknown';

    get capability(): Capability {
        return this.capabilityValue;
    }

    invalidate(): void {
        this.capabilityValue = 'unknown';
    }

    normalize(route: Route, value: unknown): { value: unknown; commit?: () => void } {
        if (!WORKSPACE_ROUTES.has(route) || !object(value) || !object(value.data)) return { value };
        const envelope = value;
        const data = value.data;
        const capabilities = new Set<Exclude<Capability, 'unknown'>>();
        let nextData: JsonObject = data;
        if (Array.isArray(data.items)) {
            const items = data.items.map((item) => {
                const normalized = normalizeLegacyRecipe(item);
                if (normalized.capability) capabilities.add(normalized.capability);
                return normalized.value;
            });
            nextData = { ...data, items };
        } else if (Object.hasOwn(data, 'recipe')) {
            const normalized = normalizeLegacyRecipe(data.recipe);
            if (normalized.capability) capabilities.add(normalized.capability);
            nextData = { ...data, recipe: normalized.value };
        }
        if (capabilities.size > 1) return { value };
        const capability = capabilities.values().next().value;
        if (capability && this.capabilityValue !== 'unknown' && this.capabilityValue !== capability)
            throw new TypeError('Recipe workspace response capability changed within the authenticated session');
        return {
            value: nextData === data ? value : { ...envelope, data: nextData },
            ...(capability ? { commit: () => (this.capabilityValue = capability) } : {}),
        };
    }
}

export function normalizeCachedWorkspaceList(data: unknown): Success<'GET /api/v1/recipe-workspace'>['data'] {
    const normalized = new RecipeWorkspaceCompatibility().normalize('GET /api/v1/recipe-workspace', { data });
    return contracts['GET /api/v1/recipe-workspace'].success.shape.data.parse(
        (normalized.value as { data: unknown }).data,
    );
}

export function normalizeCachedWorkspaceRecipe(
    recipe: unknown,
): Success<'GET /api/v1/recipe-workspace/{id}'>['data']['recipe'] {
    const normalized = new RecipeWorkspaceCompatibility().normalize('GET /api/v1/recipe-workspace/{id}', {
        data: { recipe },
    });
    return contracts['GET /api/v1/recipe-workspace/{id}'].success.shape.data.parse(
        (normalized.value as { data: unknown }).data,
    ).recipe;
}
