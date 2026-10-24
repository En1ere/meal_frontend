import { z } from 'zod';

const uuid = z.uuid();
const iso = z.iso.datetime();
export const achievementGroupSchema = z.enum([
    'culinary',
    'inventory_planning',
    'author',
    'community_catalog',
    'collections_family',
    'seasonal_secret',
]);
export const achievementMetricSchema = z.enum([
    'cookCount',
    'distinctRecipes',
    'breakfastCount',
    'soupCount',
    'bakingCount',
    'dessertCount',
    'vegetableCount',
    'fishCount',
    'plantCount',
    'cuisineCount',
    'leftoverCount',
    'earlyCount',
    'nightCount',
    'preciseCount',
    'seasonalCount',
    'seasonalMonthCount',
    'batchCount',
    'locatedBatchCount',
    'activeBatchCount',
    'activeInventoryDays',
    'preserveCount',
    'planCount',
    'maxPlanDays',
    'shoppingCount',
    'familyShoppingCount',
    'receiptCount',
    'publishedCount',
    'completeRecipeCount',
    'maxIndependentCooks',
    'seriesCount',
    'helpfulCount',
    'followerCount',
    'followingCount',
    'correctionCount',
    'allergenCount',
    'sourceCount',
    'photoCount',
    'bookmarkCount',
    'familyCookCount',
    'familyWeeklyCooks',
    'familyPlanDays',
    'holidayCount',
    'everythingUsedCount',
    'expiredActiveCount',
]);
export const achievementClauseSchema = z.strictObject({
    metric: achievementMetricSchema,
    operator: z.enum(['gte', 'eq']),
    threshold: z.number().int().nonnegative(),
});
export const achievementConditionSchema = z.union([
    z.strictObject({ kind: z.literal('clause'), clause: achievementClauseSchema }),
    z.strictObject({ kind: z.literal('all'), clauses: z.array(achievementClauseSchema).min(1).max(10) }),
    z.strictObject({ kind: z.literal('legacy'), raw: z.json(), reason: z.string() }),
]);
export const achievementSchema = z.strictObject({
    id: uuid,
    code: z.string().trim().min(2).max(80),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(500),
    group: achievementGroupSchema,
    condition: achievementConditionSchema,
    secret: z.boolean(),
    icon: z.strictObject({
        assetId: z.uuid().nullable(),
        fallbackKey: z.string().trim().min(1).max(80),
        alt: z.string().trim().min(1).max(200),
    }),
    version: z.number().int().positive(),
    updatedAt: iso,
});
export const reputationRankSchema = z.strictObject({
    id: uuid,
    minimum: z.number().int().min(0).max(1_000_000),
    title: z.string().trim().min(1).max(80),
    version: z.number().int().positive(),
});
const documentBase = {
    locale: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/),
    title: z.string().trim().min(1).max(160),
    body: z.string().trim().min(1).max(200_000),
};
export const contentDocumentSchema = z.discriminatedUnion('namespace', [
    z.strictObject({
        ...documentBase,
        namespace: z.literal('help'),
        metadata: z.strictObject({
            schemaVersion: z.literal(1),
            slug: z.string().trim().min(1).max(160),
            audience: z.enum(['all', 'user', 'admin']),
        }),
    }),
    z.strictObject({
        ...documentBase,
        namespace: z.literal('pricing'),
        metadata: z.strictObject({
            schemaVersion: z.literal(1),
            plan: z.enum(['free', 'plus']),
            billingPeriod: z.enum(['none', 'month', 'year']),
        }),
    }),
    z.strictObject({
        ...documentBase,
        namespace: z.literal('onboarding'),
        metadata: z.strictObject({
            schemaVersion: z.literal(1),
            flow: z.string().trim().min(1).max(160),
            step: z.number().int().positive(),
        }),
    }),
    z.strictObject({
        ...documentBase,
        namespace: z.literal('notification_template'),
        metadata: z.strictObject({
            schemaVersion: z.literal(1),
            channel: z.enum(['in_app', 'email', 'push']),
            templateKey: z.string().trim().min(1).max(160),
            variables: z.array(z.string().trim().min(1).max(160)).max(50),
        }),
    }),
    z.strictObject({
        ...documentBase,
        namespace: z.literal('feature_copy'),
        metadata: z.strictObject({
            schemaVersion: z.literal(1),
            featureKey: z.string().trim().min(1).max(160),
            placement: z.string().trim().min(1).max(160),
        }),
    }),
]);
export const dictionaryEntrySchema = z.strictObject({
    schemaVersion: z.literal(1),
    dictionary: z.enum(['category', 'unit', 'allergen']),
    code: z
        .string()
        .max(120)
        .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/),
    label: z.string().trim().min(1).max(160),
    description: z.string().max(2000).nullable(),
    icon: achievementSchema.shape.icon,
    sortOrder: z.number().int().min(0).max(1_000_000),
    enabled: z.boolean(),
});
const contentDocumentSourceSchema = z.strictObject({
    key: z.string().min(1).max(160),
    version: z.number().int().positive(),
    retired: z.boolean(),
    value: contentDocumentSchema,
});
const dictionaryEntrySourceSchema = z.strictObject({
    key: z.string().min(1).max(160),
    version: z.number().int().positive(),
    retired: z.boolean(),
    value: dictionaryEntrySchema,
});
const releaseChangeSchema = z.discriminatedUnion('entityType', [
    z.strictObject({
        entityType: z.literal('achievement'),
        entityId: uuid,
        label: z.string(),
        changeType: z.enum(['add', 'update', 'retire']),
        expectedVersion: z.number().int().min(0),
        achievement: achievementSchema.omit({ id: true, version: true, updatedAt: true }),
    }),
    z.strictObject({
        entityType: z.literal('reputation'),
        entityId: uuid,
        label: z.string(),
        changeType: z.literal('update'),
        ranks: z.array(reputationRankSchema).length(10),
    }),
    z.strictObject({
        entityType: z.literal('legal_text'),
        entityId: uuid,
        label: z.string(),
        changeType: z.enum(['add', 'update']),
        expectedVersion: z.number().int().min(0),
        summary: z.string(),
        effectiveAt: iso,
    }),
    z.strictObject({
        entityType: z.literal('product_description'),
        entityId: uuid,
        label: z.string(),
        changeType: z.enum(['add', 'update']),
        expectedVersion: z.number().int().min(0),
        summary: z.string(),
    }),
    z.strictObject({
        entityType: z.literal('content_document'),
        entityId: uuid,
        resourceKey: z.string().trim().min(1).max(160),
        label: z.string(),
        changeType: z.enum(['add', 'update', 'retire']),
        expectedVersion: z.number().int().min(0),
        document: contentDocumentSchema,
    }),
    z.strictObject({
        entityType: z.literal('dictionary_entry'),
        entityId: uuid,
        resourceKey: z.string().trim().min(1).max(160),
        label: z.string(),
        changeType: z.enum(['add', 'update', 'retire']),
        expectedVersion: z.number().int().min(0),
        entry: dictionaryEntrySchema,
    }),
]);
const releaseEventSchema = z.strictObject({
    id: uuid,
    kind: z.enum(['created', 'saved', 'validated', 'published', 'rolled_back', 'reopened']),
    at: iso,
    actor: z.string(),
    version: z.number().int().positive(),
});
export const releaseSchema = z.strictObject({
    id: uuid,
    title: z.string().trim().min(1).max(160),
    status: z.enum(['draft', 'ready', 'published']),
    version: z.number().int().positive(),
    clientRevision: z.number().int().min(0),
    createdAt: iso,
    updatedAt: iso,
    publishedAt: iso.nullable(),
    rolledBackAt: iso.nullable(),
    changes: z.array(releaseChangeSchema).max(500),
    validation: z.strictObject({
        errors: z.array(z.string()),
        warnings: z.array(z.string()),
        validatedVersion: z.number().int().positive().nullable(),
    }),
    events: z.array(releaseEventSchema),
});
export const releaseWorkspaceSchema = z.strictObject({
    releases: z.array(releaseSchema),
    achievements: z.array(achievementSchema),
    ranks: z.array(reputationRankSchema).length(10),
    legalTexts: z.array(
        z.strictObject({
            key: z.string(),
            version: z.number().int().positive(),
            content: z.string(),
            effectiveAt: iso,
        }),
    ),
    products: z.array(
        z.strictObject({
            id: uuid,
            name: z.string(),
            version: z.number().int().min(0),
            description: z.string().nullable(),
        }),
    ),
    contentDocuments: z.array(contentDocumentSourceSchema),
    dictionaryEntries: z.array(dictionaryEntrySourceSchema),
    rollbackSnapshots: z
        .record(
            z.string(),
            z.strictObject({
                contentDocuments: z.array(contentDocumentSourceSchema),
                dictionaryEntries: z.array(dictionaryEntrySourceSchema),
            }),
        )
        .default({}),
    serverRevision: z.number().int().positive(),
});
export const releaseAckSchema = z.strictObject({
    workspace: releaseWorkspaceSchema,
    ack: z
        .strictObject({
            releaseId: uuid,
            baseVersion: z.number().int().positive(),
            clientRevision: z.number().int().min(0),
            checksum: z.string().min(1).max(100),
        })
        .nullable(),
    message: z.string(),
});
export const releaseEnvelopeSchema = z.strictObject({
    data: releaseWorkspaceSchema,
    meta: z.strictObject({ requestId: z.string() }),
});
export const releaseAckEnvelopeSchema = z.strictObject({
    data: releaseAckSchema,
    meta: z.strictObject({ requestId: z.string() }),
});
const key = { idempotencyKey: uuid };
export const releaseCommandSchema = z.discriminatedUnion('action', [
    z.strictObject({ action: z.literal('create'), title: z.string().trim().min(1).max(160), ...key }),
    z.strictObject({
        action: z.literal('save'),
        releaseId: uuid,
        baseVersion: z.number().int().positive(),
        clientRevision: z.number().int().min(1),
        checksum: z.string().min(1).max(100),
        patch: z.strictObject({
            title: z.string().trim().min(1).max(160),
            changes: z.array(releaseChangeSchema).max(500),
        }),
    }),
    z.strictObject({ action: z.literal('validate'), releaseId: uuid, expectedVersion: z.number().int().positive() }),
    z.strictObject({
        action: z.literal('publish'),
        releaseId: uuid,
        expectedVersion: z.number().int().positive(),
        ...key,
    }),
    z.strictObject({
        action: z.literal('rollback'),
        releaseId: uuid,
        expectedVersion: z.number().int().positive(),
        ...key,
    }),
    z.strictObject({
        action: z.literal('reopen'),
        releaseId: uuid,
        expectedVersion: z.number().int().positive(),
        ...key,
    }),
]);

export type ReleaseWorkspace = z.infer<typeof releaseWorkspaceSchema>;
export type Release = z.infer<typeof releaseSchema>;
export type ReleaseChange = z.infer<typeof releaseChangeSchema>;
export type Achievement = z.infer<typeof achievementSchema>;
export type ReputationRank = z.infer<typeof reputationRankSchema>;
export type AchievementMetric = z.infer<typeof achievementMetricSchema>;
export type AchievementClause = z.infer<typeof achievementClauseSchema>;
export type AchievementCondition = z.infer<typeof achievementConditionSchema>;
export type ContentDocument = z.infer<typeof contentDocumentSchema>;
export type DictionaryEntry = z.infer<typeof dictionaryEntrySchema>;
export type ReleaseCommand = z.infer<typeof releaseCommandSchema>;
export type ReleaseAck = z.infer<typeof releaseAckSchema>;

const canonicalIconSchema = achievementSchema.shape.icon;
export const canonicalAchievementPayloadSchema = z.strictObject({
    code: z.string(),
    title: z.string(),
    description: z.string(),
    icon: canonicalIconSchema,
    category: z.enum([
        'culinary',
        'inventory',
        'planning',
        'author',
        'community',
        'catalog',
        'collections',
        'family',
        'seasonal',
        'secret',
    ]),
    condition: z.record(z.string(), z.json()),
    reputationDelta: z.number().int(),
    secret: z.boolean(),
});
export const canonicalPatchSchema = z.union([
    z.strictObject({
        patchId: uuid,
        expectedVersion: z.number().int().min(0),
        resourceType: z.literal('achievement'),
        action: z.enum(['create', 'update']),
        resourceKey: z.string(),
        payload: canonicalAchievementPayloadSchema,
    }),
    z.strictObject({
        patchId: uuid,
        expectedVersion: z.number().int().min(0),
        resourceType: z.literal('achievement'),
        action: z.literal('retire'),
        resourceKey: z.string(),
        payload: z.null(),
    }),
    z.strictObject({
        patchId: uuid,
        expectedVersion: z.number().int().min(0),
        resourceType: z.literal('reputation_title'),
        action: z.enum(['create', 'update']),
        resourceKey: z.string(),
        payload: z.strictObject({ level: z.number().int(), threshold: z.number().int(), title: z.string() }),
    }),
    z.strictObject({
        patchId: uuid,
        expectedVersion: z.number().int().min(0),
        resourceType: z.literal('legal_text'),
        action: z.enum(['create', 'update']),
        resourceKey: z.string(),
        payload: z.strictObject({ kind: z.string(), content: z.string(), effectiveAt: iso }),
    }),
    z.strictObject({
        patchId: uuid,
        expectedVersion: z.number().int().min(0),
        resourceType: z.literal('product_description'),
        action: z.enum(['create', 'update']),
        resourceKey: z.string(),
        payload: z.strictObject({ productId: uuid, description: z.string() }),
    }),
    z.strictObject({
        patchId: uuid,
        expectedVersion: z.number().int().min(0),
        resourceType: z.literal('content_document'),
        action: z.enum(['create', 'update']),
        resourceKey: z.string(),
        payload: contentDocumentSchema,
    }),
    z.strictObject({
        patchId: uuid,
        expectedVersion: z.number().int().min(0),
        resourceType: z.literal('content_document'),
        action: z.literal('retire'),
        resourceKey: z.string(),
        payload: z.null(),
    }),
    z.strictObject({
        patchId: uuid,
        expectedVersion: z.number().int().min(0),
        resourceType: z.literal('dictionary_entry'),
        action: z.enum(['create', 'update']),
        resourceKey: z.string(),
        payload: dictionaryEntrySchema,
    }),
    z.strictObject({
        patchId: uuid,
        expectedVersion: z.number().int().min(0),
        resourceType: z.literal('dictionary_entry'),
        action: z.literal('retire'),
        resourceKey: z.string(),
        payload: z.null(),
    }),
]);
export const canonicalSummarySchema = z.strictObject({
    id: uuid,
    name: z.string(),
    status: z.enum(['draft', 'published']),
    version: z.number().int().positive(),
    patchCount: z.number().int(),
    createdAt: iso,
    updatedAt: iso,
    publishedAt: iso.nullable(),
    sourceReleaseId: uuid.nullable(),
    rolledBackFromEventId: uuid.nullable(),
});
export const canonicalDetailSchema = canonicalSummarySchema.extend({
    patches: z.array(canonicalPatchSchema),
    validation: z.strictObject({ valid: z.boolean(), conflicts: z.array(z.string()), errors: z.array(z.string()) }),
    ack: z
        .strictObject({ clientRevision: z.number().int().positive(), checksum: z.string().regex(/^[a-f0-9]{64}$/) })
        .nullable(),
});
export const canonicalListSchema = z.strictObject({ items: z.array(canonicalSummarySchema) });
export const canonicalHistorySchema = z.strictObject({
    items: z.array(
        z.strictObject({
            id: uuid,
            releaseId: uuid,
            kind: z.enum(['published', 'rolled_back']),
            createdAt: iso,
            snapshot: z.array(canonicalPatchSchema),
        }),
    ),
});
export const canonicalSourcesSchema = z.strictObject({
    achievements: z.array(
        z.strictObject({
            key: z.string(),
            version: z.number().int().positive(),
            retired: z.boolean(),
            value: canonicalAchievementPayloadSchema,
        }),
    ),
    reputationTitles: z.array(
        z.strictObject({
            key: z.string(),
            version: z.number().int().positive(),
            retired: z.boolean(),
            value: z.strictObject({ level: z.number().int(), threshold: z.number().int(), title: z.string() }),
        }),
    ),
    legalTexts: z.array(
        z.strictObject({
            key: z.string(),
            version: z.number().int().positive(),
            retired: z.boolean(),
            value: z.strictObject({ kind: z.string(), content: z.string(), effectiveAt: iso }),
        }),
    ),
    products: z.array(
        z.strictObject({
            id: uuid,
            name: z.string(),
            version: z.number().int().min(0),
            description: z.string().nullable(),
        }),
    ),
    contentDocuments: z.array(contentDocumentSourceSchema),
    dictionaryEntries: z.array(dictionaryEntrySourceSchema),
});
export const envelope = <T extends z.ZodType>(data: T) =>
    z.strictObject({ data, meta: z.strictObject({ requestId: z.string() }) });
export type CanonicalPatch = z.infer<typeof canonicalPatchSchema>;
