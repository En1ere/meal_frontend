import { conditionModel, conditionPayload, serializeChanges, stableUuid } from '../features/releases/api.js';
import type { CanonicalPatch, ReleaseChange } from '../features/releases/contracts.js';
import { releaseWorkspaceCommand, ReleaseMockError, type ReleaseWorkspaceState } from './release-workspace.js';

const groupCategory = {
    culinary: 'culinary',
    inventory_planning: 'planning',
    author: 'author',
    community_catalog: 'community',
    collections_family: 'collections',
    seasonal_secret: 'seasonal',
} as const;

function canonicalCondition(value: ReturnType<typeof conditionPayload>) {
    const hasNestedArrayValue = Object.values(value).some(
        (entry) => Array.isArray(entry) && entry.some((item) => typeof item === 'object' && item !== null),
    );
    return hasNestedArrayValue ? { legacy: JSON.stringify(value) } : value;
}
const categoryGroup = {
    culinary: 'culinary',
    inventory: 'inventory_planning',
    planning: 'inventory_planning',
    author: 'author',
    community: 'community_catalog',
    catalog: 'community_catalog',
    collections: 'collections_family',
    family: 'collections_family',
    seasonal: 'seasonal_secret',
    secret: 'seasonal_secret',
} as const;
const summary = (release: ReleaseWorkspaceState['releases'][number]) => ({
    id: release.id,
    name: release.title,
    status: release.status === 'published' ? ('published' as const) : ('draft' as const),
    version: release.version,
    patchCount: serializeChanges(release.changes).length,
    createdAt: release.createdAt,
    updatedAt: release.updatedAt,
    publishedAt: release.publishedAt,
    sourceReleaseId: null,
    rolledBackFromEventId: release.rolledBackAt
        ? (release.events.find((event) => event.kind === 'rolled_back')?.id ?? null)
        : null,
});
const detail = (release: ReleaseWorkspaceState['releases'][number]) => ({
    ...summary(release),
    patches: serializeChanges(release.changes),
    validation: {
        valid: release.status === 'ready',
        conflicts: release.validation.warnings,
        errors: release.validation.errors,
    },
    ack: release.clientRevision ? { clientRevision: release.clientRevision, checksum: '0'.repeat(64) } : null,
});
function fromPatches(state: ReleaseWorkspaceState, patches: CanonicalPatch[]): ReleaseChange[] {
    const changes: ReleaseChange[] = [];
    const ranks: ReleaseWorkspaceState['ranks'] = [];
    for (const patch of patches) {
        if (patch.resourceType === 'achievement') {
            const source = state.achievements.find((item) => item.code === patch.resourceKey);
            if (patch.action === 'retire') {
                if (source) {
                    const achievement = {
                        code: source.code,
                        title: source.title,
                        description: source.description,
                        group: source.group,
                        condition: source.condition,
                        secret: source.secret,
                        icon: source.icon,
                    };
                    changes.push({
                        entityType: 'achievement',
                        entityId: source.id,
                        label: source.title,
                        changeType: 'retire',
                        expectedVersion: patch.expectedVersion,
                        achievement,
                    });
                }
            } else {
                const id = source?.id ?? crypto.randomUUID();
                changes.push({
                    entityType: 'achievement',
                    entityId: id,
                    label: patch.payload.title,
                    changeType: patch.action === 'create' ? 'add' : 'update',
                    expectedVersion: patch.expectedVersion,
                    achievement: {
                        code: patch.payload.code,
                        title: patch.payload.title,
                        description: patch.payload.description,
                        icon: patch.payload.icon,
                        group: categoryGroup[patch.payload.category],
                        condition: conditionModel(patch.payload.condition),
                        secret: patch.payload.secret,
                    },
                });
            }
        } else if (patch.resourceType === 'reputation_title')
            ranks.push({
                id: state.ranks[patch.payload.level - 1]?.id ?? crypto.randomUUID(),
                minimum: patch.payload.threshold,
                title: patch.payload.title,
                version: patch.expectedVersion,
            });
        else if (patch.resourceType === 'legal_text')
            changes.push({
                entityType: 'legal_text',
                entityId: crypto.randomUUID(),
                label: patch.payload.kind,
                changeType: patch.action === 'create' ? 'add' : 'update',
                expectedVersion: patch.expectedVersion,
                summary: patch.payload.content,
                effectiveAt: patch.payload.effectiveAt,
            });
        else if (patch.resourceType === 'product_description')
            changes.push({
                entityType: 'product_description',
                entityId: patch.payload.productId,
                label: state.products.find((item) => item.id === patch.payload.productId)?.name ?? patch.resourceKey,
                changeType: patch.action === 'create' ? 'add' : 'update',
                expectedVersion: patch.expectedVersion,
                summary: patch.payload.description,
            });
        else if (patch.resourceType === 'content_document') {
            const source = state.contentDocuments.find((item) => item.key === patch.resourceKey);
            const document = patch.action === 'retire' ? source?.value : patch.payload;
            if (document)
                changes.push({
                    entityType: 'content_document',
                    entityId: stableUuid(`document-${patch.resourceKey}`),
                    resourceKey: patch.resourceKey,
                    label: document.title,
                    changeType: patch.action === 'create' ? 'add' : patch.action,
                    expectedVersion: patch.expectedVersion,
                    document,
                });
        } else if (patch.resourceType === 'dictionary_entry') {
            const source = state.dictionaryEntries.find((item) => item.key === patch.resourceKey);
            const entry = patch.action === 'retire' ? source?.value : patch.payload;
            if (entry)
                changes.push({
                    entityType: 'dictionary_entry',
                    entityId: stableUuid(`dictionary-${patch.resourceKey}`),
                    resourceKey: patch.resourceKey,
                    label: entry.label,
                    changeType: patch.action === 'create' ? 'add' : patch.action,
                    expectedVersion: patch.expectedVersion,
                    entry,
                });
        }
    }
    if (ranks.length)
        changes.push({
            entityType: 'reputation',
            entityId: '00000040-0000-4000-8000-000000000001',
            label: 'Шкала репутации',
            changeType: 'update',
            ranks: ranks.toSorted((a, b) => a.minimum - b.minimum),
        });
    return changes;
}

export function releaseApi(
    state: ReleaseWorkspaceState,
    path: string,
    method: string,
    input: unknown,
    context: { critical: boolean; now: number },
) {
    if (path === '/api/v1/admin/content-releases' && method === 'GET') return { items: state.releases.map(summary) };
    if (path === '/api/v1/admin/content-releases/history' && method === 'GET')
        return {
            items: state.releases.flatMap((release) =>
                release.events
                    .filter((event) => event.kind === 'published' || event.kind === 'rolled_back')
                    .map((event) => ({
                        id: event.id,
                        releaseId: release.id,
                        kind: event.kind as 'published' | 'rolled_back',
                        createdAt: event.at,
                        snapshot: serializeChanges(release.changes),
                    })),
            ),
        };
    if (path === '/api/v1/admin/content-releases/sources' && method === 'GET')
        return {
            achievements: state.achievements.map((item) => ({
                key: item.code,
                version: item.version,
                retired: false,
                value: {
                    code: item.code,
                    title: item.title,
                    description: item.description,
                    icon: item.icon,
                    category: groupCategory[item.group],
                    condition: canonicalCondition(conditionPayload(item.condition)),
                    reputationDelta: 0,
                    secret: item.secret,
                },
            })),
            reputationTitles: state.ranks.map((item, index) => ({
                key: `level-${index + 1}`,
                version: item.version,
                retired: false,
                value: { level: index + 1, threshold: item.minimum, title: item.title },
            })),
            legalTexts: state.legalTexts.map((item) => ({
                key: item.key,
                version: item.version,
                retired: false,
                value: { kind: item.key, content: item.content, effectiveAt: item.effectiveAt },
            })),
            products: state.products,
            contentDocuments: state.contentDocuments,
            dictionaryEntries: state.dictionaryEntries,
        };
    if (path === '/api/v1/admin/content-releases' && method === 'POST') {
        const body = input as { name: string; idempotencyKey: string };
        releaseWorkspaceCommand(
            state,
            { action: 'create', title: body.name, idempotencyKey: body.idempotencyKey },
            context,
        );
        return detail(state.releases[0]!);
    }
    const match = /^\/api\/v1\/admin\/content-releases\/([0-9a-f-]+)(?:\/(validate|publish|rollback|edit))?$/.exec(
        path,
    );
    if (!match) return null;
    const release = state.releases.find((item) => item.id === match[1]);
    if (!release) throw new ReleaseMockError(404, 'Релиз не найден');
    const action = match[2];
    if (method === 'GET' && !action) return detail(release);
    if (method === 'PUT' && !action) {
        const body = input as {
            name: string;
            expectedVersion: number;
            patches: CanonicalPatch[];
            clientRevision: number;
            checksum: string;
        };
        const result = releaseWorkspaceCommand(
            state,
            {
                action: 'save',
                releaseId: release.id,
                baseVersion: body.expectedVersion,
                clientRevision: body.clientRevision,
                checksum: body.checksum,
                patch: { title: body.name, changes: fromPatches(state, body.patches) },
            },
            context,
        );
        return {
            ...detail(result.workspace.releases.find((item) => item.id === release.id)!),
            ack: { clientRevision: body.clientRevision, checksum: body.checksum },
        };
    }
    const body = input as { expectedVersion?: number; idempotencyKey?: string; name?: string };
    if (action === 'edit') {
        releaseWorkspaceCommand(
            state,
            {
                action: 'reopen',
                releaseId: release.id,
                expectedVersion: release.version,
                idempotencyKey: body.idempotencyKey ?? crypto.randomUUID(),
            },
            context,
        );
        return detail(state.releases[0]!);
    }
    if (action === 'validate') {
        releaseWorkspaceCommand(
            state,
            { action: 'validate', releaseId: release.id, expectedVersion: body.expectedVersion! },
            context,
        );
        return detail(release);
    }
    if (action === 'publish' || action === 'rollback') {
        releaseWorkspaceCommand(
            state,
            {
                action,
                releaseId: release.id,
                expectedVersion: body.expectedVersion!,
                idempotencyKey: body.idempotencyKey!,
            },
            context,
        );
        return detail(release);
    }
    return null;
}
