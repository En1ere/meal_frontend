import type { ApiClient } from '../../shared/api/client.js';
import {
    achievementClauseSchema,
    canonicalDetailSchema,
    type AchievementCondition,
    type CanonicalPatch,
    type Release,
    type ReleaseAck,
    type ReleaseChange,
    type ReleaseCommand,
    type ReleaseWorkspace,
} from './contracts.js';
const categoryToGroup = {
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
const groupToCategory = {
    culinary: 'culinary',
    inventory_planning: 'planning',
    author: 'author',
    community_catalog: 'community',
    collections_family: 'collections',
    seasonal_secret: 'seasonal',
} as const;
export function stableUuid(value: string) {
    let a = 0x811c9dc5,
        b = 0x9e3779b9;
    for (const char of value) {
        a = Math.imul(a ^ char.charCodeAt(0), 16777619);
        b = Math.imul(b + char.charCodeAt(0), 2246822519);
    }
    const hex = `${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}0000000000000000`;
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export function conditionModel(value: Record<string, JsonValue>): AchievementCondition {
    const clause = achievementClauseSchema.safeParse(value);
    if (clause.success) return { kind: 'clause', clause: clause.data };
    if ('all' in value && Array.isArray(value.all)) {
        const clauses = achievementClauseSchema.array().min(1).max(10).safeParse(value.all);
        if (clauses.success) return { kind: 'all', clauses: clauses.data };
    }
    return {
        kind: 'legacy',
        raw: value,
        reason: 'Условие не входит в allowlist aggregate-v1 и требует ручной миграции.',
    };
}
export function conditionPayload(value: AchievementCondition): Record<string, JsonValue> {
    if (value.kind === 'clause') return value.clause;
    if (value.kind === 'all') return { all: value.clauses };
    return value.raw as Record<string, JsonValue>;
}
export function serializeChanges(changes: ReleaseChange[]): CanonicalPatch[] {
    const patches: CanonicalPatch[] = [];
    for (const change of changes) {
        if (change.entityType === 'achievement') {
            if (change.changeType === 'retire')
                patches.push({
                    patchId: stableUuid(`patch-achievement-${change.entityId}`),
                    expectedVersion: change.expectedVersion,
                    resourceType: 'achievement',
                    action: 'retire',
                    resourceKey: change.achievement.code,
                    payload: null,
                });
            else
                patches.push({
                    patchId: stableUuid(`patch-achievement-${change.entityId}`),
                    expectedVersion: change.expectedVersion,
                    resourceType: 'achievement',
                    action: change.changeType === 'add' ? 'create' : 'update',
                    resourceKey: change.achievement.code,
                    payload: {
                        code: change.achievement.code,
                        title: change.achievement.title,
                        description: change.achievement.description,
                        icon: change.achievement.icon,
                        category: groupToCategory[change.achievement.group],
                        condition: conditionPayload(change.achievement.condition),
                        reputationDelta: 0,
                        secret: change.achievement.secret,
                    },
                });
        } else if (change.entityType === 'reputation')
            for (const [index, rank] of change.ranks.entries())
                patches.push({
                    patchId: stableUuid(`patch-rank-${rank.id}`),
                    expectedVersion: rank.version,
                    resourceType: 'reputation_title',
                    action: rank.version ? 'update' : 'create',
                    resourceKey: `level-${index + 1}`,
                    payload: { level: index + 1, threshold: rank.minimum, title: rank.title },
                });
        else if (change.entityType === 'legal_text')
            patches.push({
                patchId: stableUuid(`patch-legal-${change.entityId}`),
                expectedVersion: change.expectedVersion,
                resourceType: 'legal_text',
                action: change.changeType === 'add' ? 'create' : 'update',
                resourceKey: change.label,
                payload: { kind: change.label, content: change.summary, effectiveAt: change.effectiveAt },
            });
        else if (change.entityType === 'product_description')
            patches.push({
                patchId: stableUuid(`patch-product-${change.entityId}`),
                expectedVersion: change.expectedVersion,
                resourceType: 'product_description',
                action: change.changeType === 'add' ? 'create' : 'update',
                resourceKey: change.entityId,
                payload: { productId: change.entityId, description: change.summary },
            });
        else if (change.entityType === 'content_document')
            patches.push({
                patchId: stableUuid(`patch-document-${change.entityId}`),
                expectedVersion: change.expectedVersion,
                resourceType: 'content_document',
                action: change.changeType === 'retire' ? 'retire' : change.changeType === 'add' ? 'create' : 'update',
                resourceKey: change.resourceKey,
                payload: change.changeType === 'retire' ? null : change.document,
            } as CanonicalPatch);
        else
            patches.push({
                patchId: stableUuid(`patch-dictionary-${change.entityId}`),
                expectedVersion: change.expectedVersion,
                resourceType: 'dictionary_entry',
                action: change.changeType === 'retire' ? 'retire' : change.changeType === 'add' ? 'create' : 'update',
                resourceKey: change.resourceKey,
                payload: change.changeType === 'retire' ? null : change.entry,
            } as CanonicalPatch);
    }
    return patches;
}
export async function sha256(value: unknown) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
function mapChanges(
    input: unknown,
    rankSources: ReleaseWorkspace['ranks'],
    achievementSources: ReleaseWorkspace['achievements'],
    documentSources: ReleaseWorkspace['contentDocuments'],
    dictionarySources: ReleaseWorkspace['dictionaryEntries'],
): ReleaseChange[] {
    const patches = canonicalDetailSchema.shape.patches.parse(input);
    const result: ReleaseChange[] = [];
    const rankPatches = patches.filter((patch) => patch.resourceType === 'reputation_title');
    for (const patch of patches) {
        if (patch.resourceType === 'achievement' && patch.action !== 'retire')
            result.push({
                entityType: 'achievement',
                entityId:
                    achievementSources.find((item) => item.code === patch.resourceKey)?.id ??
                    stableUuid(`achievement-${patch.resourceKey}`),
                label: patch.payload.title,
                changeType: patch.action === 'create' ? 'add' : 'update',
                expectedVersion: patch.expectedVersion,
                achievement: {
                    code: patch.payload.code,
                    title: patch.payload.title,
                    description: patch.payload.description,
                    icon: patch.payload.icon,
                    group: categoryToGroup[patch.payload.category],
                    condition: conditionModel(patch.payload.condition),
                    secret: patch.payload.secret,
                },
            });
        else if (patch.resourceType === 'achievement') {
            const source = achievementSources.find((item) => item.code === patch.resourceKey);
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
                result.push({
                    entityType: 'achievement',
                    entityId: source.id,
                    label: source.title,
                    changeType: 'retire',
                    expectedVersion: patch.expectedVersion,
                    achievement,
                });
            }
        } else if (patch.resourceType === 'legal_text')
            result.push({
                entityType: 'legal_text',
                entityId: stableUuid(`legal-${patch.resourceKey}`),
                label: patch.payload.kind,
                changeType: patch.action === 'create' ? 'add' : 'update',
                expectedVersion: patch.expectedVersion,
                summary: patch.payload.content,
                effectiveAt: patch.payload.effectiveAt,
            });
        else if (patch.resourceType === 'product_description')
            result.push({
                entityType: 'product_description',
                entityId: patch.payload.productId,
                label: patch.resourceKey,
                changeType: patch.action === 'create' ? 'add' : 'update',
                expectedVersion: patch.expectedVersion,
                summary: patch.payload.description,
            });
        else if (patch.resourceType === 'content_document') {
            const source = documentSources.find((item) => item.key === patch.resourceKey);
            const document = patch.action === 'retire' ? source?.value : patch.payload;
            if (document)
                result.push({
                    entityType: 'content_document',
                    entityId: stableUuid(`document-${patch.resourceKey}`),
                    resourceKey: patch.resourceKey,
                    label: document.title,
                    changeType: patch.action === 'create' ? 'add' : patch.action,
                    expectedVersion: patch.expectedVersion,
                    document,
                });
        } else if (patch.resourceType === 'dictionary_entry') {
            const source = dictionarySources.find((item) => item.key === patch.resourceKey);
            const entry = patch.action === 'retire' ? source?.value : patch.payload;
            if (entry)
                result.push({
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
    if (rankPatches.length)
        result.push({
            entityType: 'reputation',
            entityId: stableUuid('reputation-scale'),
            label: 'Шкала репутации',
            changeType: 'update',
            ranks: rankPatches
                .toSorted(
                    (a, b) =>
                        (a.resourceType === 'reputation_title' ? a.payload.level : 0) -
                        (b.resourceType === 'reputation_title' ? b.payload.level : 0),
                )
                .map((patch, index) =>
                    patch.resourceType === 'reputation_title'
                        ? {
                              id: stableUuid(`rank-${patch.payload.level}`),
                              minimum: patch.payload.threshold,
                              title: patch.payload.title,
                              version: patch.expectedVersion,
                          }
                        : rankSources[index]!,
                ),
        });
    return result;
}
async function fetchWorkspace(api: ApiClient, signal?: AbortSignal): Promise<ReleaseWorkspace> {
    const [list, history, sources] = await Promise.all([
        api.request('GET /api/v1/admin/content-releases', undefined, signal),
        api.request('GET /api/v1/admin/content-releases/history', undefined, signal),
        api.request('GET /api/v1/admin/content-releases/sources', undefined, signal),
    ]);
    const sourceRanks = sources.data.reputationTitles
        .toSorted((a, b) => a.value.level - b.value.level)
        .map((item) => ({
            id: stableUuid(`rank-${item.key}`),
            minimum: item.value.threshold,
            title: item.value.title,
            version: item.version,
        }));
    const defaults = [
        [0, 'Новичок'],
        [25, 'Участник'],
        [75, 'Помощник'],
        [150, 'Знаток'],
        [300, 'Автор'],
        [600, 'Эксперт'],
        [1000, 'Наставник'],
        [1750, 'Мастер'],
        [3000, 'Шеф сообщества'],
        [5000, 'Легенда'],
    ] as const;
    const ranks =
        sourceRanks.length === 10
            ? sourceRanks
            : defaults.map(([minimum, title], index) => ({
                  id: stableUuid(`rank-${index + 1}`),
                  minimum,
                  title,
                  version: 0,
              }));
    const achievements = sources.data.achievements
        .filter((item) => !item.retired)
        .map((item) => ({
            id: stableUuid(`achievement-${item.key}`),
            code: item.value.code,
            title: item.value.title,
            description: item.value.description,
            group: categoryToGroup[item.value.category],
            condition: conditionModel(item.value.condition),
            secret: item.value.secret,
            icon: item.value.icon,
            version: item.version,
            updatedAt: new Date(0).toISOString(),
        }));
    const details = await Promise.all(
        list.data.items.map((item) =>
            api.request('GET /api/v1/admin/content-releases/{id}', undefined, signal, { id: item.id }),
        ),
    );
    const releases: Release[] = details.map(({ data }) => ({
        id: data.id,
        title: data.name,
        status: data.status === 'published' ? 'published' : data.validation.valid ? 'ready' : 'draft',
        version: data.version,
        clientRevision: data.ack?.clientRevision ?? 0,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        publishedAt: data.publishedAt,
        rolledBackAt: data.rolledBackFromEventId ? data.updatedAt : null,
        changes: mapChanges(
            data.patches,
            ranks,
            achievements,
            sources.data.contentDocuments,
            sources.data.dictionaryEntries,
        ),
        validation: {
            errors: data.validation.errors,
            warnings: data.validation.conflicts,
            validatedVersion: data.validation.valid ? data.version : null,
        },
        events: history.data.items
            .filter((event) => event.releaseId === data.id)
            .map((event) => ({
                id: event.id,
                kind: event.kind,
                at: event.createdAt,
                actor: 'admin',
                version: data.version,
            })),
    }));
    return {
        releases,
        achievements,
        ranks,
        legalTexts: sources.data.legalTexts
            .filter((item) => !item.retired)
            .map((item) => ({
                key: item.key,
                version: item.version,
                content: item.value.content,
                effectiveAt: item.value.effectiveAt,
            })),
        products: sources.data.products,
        contentDocuments: sources.data.contentDocuments,
        dictionaryEntries: sources.data.dictionaryEntries,
        rollbackSnapshots: {},
        serverRevision: 1,
    };
}
export const loadReleaseWorkspace = fetchWorkspace;
export async function runReleaseCommand(
    api: ApiClient,
    command: ReleaseCommand,
    signal?: AbortSignal,
): Promise<ReleaseAck> {
    let message = '',
        ack: ReleaseAck['ack'] = null;
    if (command.action === 'create') {
        await api.request(
            'POST /api/v1/admin/content-releases',
            { name: command.title, idempotencyKey: command.idempotencyKey },
            signal,
        );
        message = 'Черновик релиза создан';
    } else if (command.action === 'save') {
        const patches = serializeChanges(command.patch.changes);
        const checksum = await sha256({ name: command.patch.title, patches, clientRevision: command.clientRevision });
        const response = await api.request(
            'PUT /api/v1/admin/content-releases/{id}',
            {
                name: command.patch.title,
                expectedVersion: command.baseVersion,
                patches,
                clientRevision: command.clientRevision,
                checksum,
                idempotencyKey: crypto.randomUUID(),
            },
            signal,
            { id: command.releaseId },
        );
        if (response.data.ack)
            ack = {
                releaseId: command.releaseId,
                baseVersion: response.data.version,
                clientRevision: response.data.ack.clientRevision,
                checksum: response.data.ack.checksum,
            };
        message = 'Черновик сохранён на сервере';
    } else if (command.action === 'validate') {
        await api.request(
            'POST /api/v1/admin/content-releases/{id}/validate',
            { expectedVersion: command.expectedVersion },
            signal,
            { id: command.releaseId },
        );
        message = 'Релиз проверен';
    } else if (command.action === 'publish' || command.action === 'rollback') {
        await api.request(
            command.action === 'publish'
                ? 'POST /api/v1/admin/content-releases/{id}/publish'
                : 'POST /api/v1/admin/content-releases/{id}/rollback',
            { expectedVersion: command.expectedVersion, idempotencyKey: command.idempotencyKey },
            signal,
            { id: command.releaseId },
        );
        message = command.action === 'publish' ? 'Релиз опубликован' : 'Релиз откачен в черновик';
    } else if (command.action === 'reopen') {
        await api.request(
            'POST /api/v1/admin/content-releases/{id}/edit',
            { name: 'Новая редакция', idempotencyKey: crypto.randomUUID() },
            signal,
            { id: command.releaseId },
        );
        message = 'Создана новая редакция';
    } else throw new Error('Публикация каталога вне релиза запрещена');
    return { workspace: await fetchWorkspace(api, signal), ack, message };
}
