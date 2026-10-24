import assert from 'node:assert/strict';
import test from 'node:test';
import { contracts } from '../src/shared/api/contracts.generated.js';
import { releaseApi } from '../src/mocks/release-api.js';
import { createReleaseWorkspaceState } from '../src/mocks/release-workspace.js';
import { canonicalPatchSchema } from '../src/features/releases/contracts.js';

await test('canonical release sources keep compound achievement rules contract-safe and explicitly legacy', () => {
    const sources = releaseApi(
        createReleaseWorkspaceState(),
        '/api/v1/admin/content-releases/sources',
        'GET',
        undefined,
        { critical: false, now: Date.now() },
    );
    const envelope = { data: sources, meta: { requestId: crypto.randomUUID() } };
    const parsed = contracts['GET /api/v1/admin/content-releases/sources'].success.parse(envelope);
    const legacy = parsed.data.achievements.find((item) => 'legacy' in item.value.condition);
    assert.ok(legacy);
    assert.match(String(legacy.value.condition.legacy), /"all"/u);
});

await test('canonical release patches accept action variants that share a resource type', () => {
    const common = {
        patchId: crypto.randomUUID(),
        expectedVersion: 0,
        resourceType: 'achievement' as const,
        resourceKey: 'e2e-achievement',
    };
    assert.equal(
        canonicalPatchSchema.parse({
            ...common,
            action: 'create',
            payload: {
                code: 'e2e-achievement',
                title: 'E2E achievement',
                description: 'Contract regression',
                icon: { assetId: null, fallbackKey: 'book', alt: 'Book' },
                category: 'culinary',
                condition: { kind: 'recipes_count', threshold: 1 },
                reputationDelta: 0,
                secret: false,
            },
        }).action,
        'create',
    );
    assert.equal(canonicalPatchSchema.parse({ ...common, action: 'retire', payload: null }).action, 'retire');
});
