import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    normalizeCachedWorkspaceList,
    normalizeCachedWorkspaceRecipe,
    RecipeWorkspaceCompatibility,
} from '../src/entities/recipe/index.js';
import { contracts } from '../src/shared/api/contracts.generated.js';
import { ApiClient } from '../src/shared/api/client.js';
import { createSeed } from '../src/mocks/model.js';
import { workspaceVisibleRecipe } from '../src/mocks/recipe-workspace.js';

function legacyRecipe() {
    const state = createSeed();
    const userId = state.users[0]!.id;
    const current = workspaceVisibleRecipe(state, userId, '70000000-0000-4000-8000-000000000001')!;
    const legacy = { ...current } as Record<string, unknown>;
    delete legacy.review;
    delete legacy.publication;
    return legacy as Omit<typeof current, 'review' | 'publication'>;
}

void test('legacy workspace list, detail and mutation responses gain safe axes before strict parsing', () => {
    const compatibility = new RecipeWorkspaceCompatibility();
    const legacy = legacyRecipe();
    for (const route of [
        'GET /api/v1/recipe-workspace/{id}',
        'POST /api/v1/recipe-workspace/{id}/submit',
        'PUT /api/v1/recipe-workspace/{id}',
    ] as const) {
        const normalized = compatibility.normalize(route, { data: { recipe: legacy } });
        const parsed = contracts[route].success.shape.data.parse((normalized.value as { data: unknown }).data);
        normalized.commit?.();
        assert.equal(parsed.recipe.review.publicReason, null);
        assert.equal(parsed.recipe.publication, null);
    }
    const list = compatibility.normalize('GET /api/v1/recipe-workspace', {
        data: { items: [legacy], total: 1, page: 1, limit: 20 },
    });
    const parsedList = contracts['GET /api/v1/recipe-workspace'].success.shape.data.parse(
        (list.value as { data: unknown }).data,
    );
    list.commit?.();
    assert.equal(parsedList.items[0]!.review.status, 'published');
    assert.equal(compatibility.capability, 'legacy');
});

void test('partial revision axes fail closed and capability resets with the user session', () => {
    const compatibility = new RecipeWorkspaceCompatibility();
    const legacy = legacyRecipe();
    const normalized = compatibility.normalize('GET /api/v1/recipe-workspace/{id}', { data: { recipe: legacy } });
    contracts['GET /api/v1/recipe-workspace/{id}'].success.shape.data.parse(
        (normalized.value as { data: unknown }).data,
    );
    normalized.commit?.();
    assert.equal(compatibility.capability, 'legacy');
    compatibility.invalidate();
    assert.equal(compatibility.capability, 'unknown');
    const malformed = compatibility.normalize('GET /api/v1/recipe-workspace/{id}', {
        data: {
            recipe: {
                ...legacy,
                review: { revisionId: legacy.revisionId, status: 'published', publicReason: null },
            },
        },
    });
    assert.throws(() =>
        contracts['GET /api/v1/recipe-workspace/{id}'].success.shape.data.parse(
            (malformed.value as { data: unknown }).data,
        ),
    );
    assert.equal(compatibility.capability, 'unknown');
});

void test('mixed legacy and revision-aware list fails closed without committing a capability', () => {
    const compatibility = new RecipeWorkspaceCompatibility();
    const legacy = legacyRecipe();
    const current = {
        ...legacy,
        review: { revisionId: legacy.revisionId, status: 'published', publicReason: null },
        publication: null,
    };
    const mixed = compatibility.normalize('GET /api/v1/recipe-workspace', {
        data: { items: [legacy, current], total: 2, page: 1, limit: 20 },
    });
    assert.throws(() =>
        contracts['GET /api/v1/recipe-workspace'].success.shape.data.parse((mixed.value as { data: unknown }).data),
    );
    mixed.commit?.();
    assert.equal(compatibility.capability, 'unknown');
});

void test('legacy offline snapshots are migrated without changing the network capability', () => {
    const legacy = legacyRecipe();
    assert.equal(normalizeCachedWorkspaceRecipe(legacy).review.publicReason, null);
    const list = normalizeCachedWorkspaceList({ items: [legacy], total: 1, page: 1, limit: 20 });
    assert.equal(list.items[0]!.publication, null);
    assert.throws(() => normalizeCachedWorkspaceRecipe({ ...legacy, publication: null }));
});

void test('network capability is pinned until session invalidation and cannot downgrade or upgrade mid-session', () => {
    const legacy = legacyRecipe();
    const current = {
        ...legacy,
        review: { revisionId: legacy.revisionId, status: 'published', publicReason: null },
        publication: null,
    };
    const axesFirst = new RecipeWorkspaceCompatibility();
    axesFirst.normalize('GET /api/v1/recipe-workspace/{id}', { data: { recipe: current } }).commit?.();
    assert.equal(axesFirst.capability, 'revision-axes');
    assert.throws(() => axesFirst.normalize('GET /api/v1/recipe-workspace/{id}', { data: { recipe: legacy } }));
    const legacyFirst = new RecipeWorkspaceCompatibility();
    legacyFirst.normalize('GET /api/v1/recipe-workspace/{id}', { data: { recipe: legacy } }).commit?.();
    assert.equal(legacyFirst.capability, 'legacy');
    assert.throws(() => legacyFirst.normalize('GET /api/v1/recipe-workspace/{id}', { data: { recipe: current } }));
    legacyFirst.invalidate();
    legacyFirst.normalize('GET /api/v1/recipe-workspace/{id}', { data: { recipe: current } }).commit?.();
    assert.equal(legacyFirst.capability, 'revision-axes');
});

void test('ApiClient commits capability only after generated strict parsing succeeds', async () => {
    const compatibility = new RecipeWorkspaceCompatibility();
    const legacy = legacyRecipe();
    const partial = {
        ...legacy,
        review: { revisionId: legacy.revisionId, status: 'published', publicReason: null },
    };
    const client = new ApiClient(
        'http://localhost:3000',
        () => Promise.resolve(Response.json({ data: { recipe: partial }, meta: { requestId: crypto.randomUUID() } })),
        undefined,
        compatibility,
    );
    await assert.rejects(() =>
        client.request('GET /api/v1/recipe-workspace/{id}', undefined, undefined, { id: legacy.id }),
    );
    assert.equal(compatibility.capability, 'unknown');
});
