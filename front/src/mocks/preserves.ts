import { z } from 'zod';
import { contracts } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';
import { seedInventoryFixtures } from './inventory.js';
import { publicRecipeFixtures } from './recipe-fixtures.js';
import { workspaceRecipeFixture } from './recipe-workspace.js';
import fixture from '../../contracts/dev-users.json' with { type: 'json' };
import { mockFamilyContext } from './family.js';
const preserveSchema = contracts['GET /api/v1/preserves/{id}'].success.shape.data.shape.preserve;
type Preserve = z.infer<typeof preserveSchema>;
const eventSchema = contracts['GET /api/v1/preserves/{id}/history'].success.shape.data.shape.items.element;
const qrLabelSchema = contracts['GET /api/v1/preserves/{id}/qr-label'].success.shape.data.shape.label.unwrap();
export const preservesStateSchema = z.object({
    items: z.array(
        z.object({ userId: z.uuid(), preserve: preserveSchema, batchVersion: z.number().int().positive().default(1) }),
    ),
    history: z.array(z.object({ userId: z.uuid(), preserveId: z.uuid(), event: eventSchema })),
    seeded: z.array(z.string()),
    replay: z.record(z.string(), z.object({ input: z.string(), result: z.unknown() })),
    previews: z.record(z.string(), z.string()),
    openedDates: z.record(z.string(), z.string()).default({}),
    qrLabels: z.array(z.object({ userId: z.uuid(), preserveId: z.uuid(), label: qrLabelSchema })).default([]),
});
export type PreservesState = z.infer<typeof preservesStateSchema>;
export const createPreservesState = (): PreservesState => ({
    items: [],
    history: [],
    seeded: [],
    replay: {},
    previews: {},
    openedDates: {},
    qrLabels: [],
});
interface Context {
    state: MockState;
    userId: string | null;
    path: string;
    params: Record<string, string>;
    method: string;
    query: URLSearchParams;
    input: unknown;
    now: number;
    success: (data: unknown) => Response;
    fail: (status: number, code?: string) => Response;
}
class Failure extends Error {
    constructor(readonly status: number) {
        super(String(status));
    }
}
const decimal = (s: string) => {
    const [a = '0', b = ''] = s.split('.');
    return BigInt(a) * 100000000n + BigInt(b.padEnd(8, '0'));
};
const decimalText = (n: bigint) =>
    `${n / 100000000n}${n % 100000000n ? '.' + (n % 100000000n).toString().padStart(8, '0').replace(/0+$/, '') : ''}`;
const total = (values: (string | null)[]) => {
    if (values.some((v) => v === null)) return null;
    const n = values.reduce<bigint>((a, v) => a + decimal(v!), 0n);
    if (n > 999999999999999999999999n) throw new Failure(422);
    return decimalText(n);
};
export function seedPreserveFixtures(state: MockState, userId: string, now: number) {
    const data = state.preserves;
    if (data.seeded.includes(userId)) return;
    data.seeded.push(userId);
    if (!fixture.users.some((u) => u.id === userId)) return;
    seedInventoryFixtures(state.inventory, userId, now);
    const locationId = state.inventory.locations.find((l) => l.userId === userId)?.location.id ?? null;
    const date = (n: number) => new Date(now + n * 86400000).toISOString().slice(0, 10);
    const iso = new Date(now).toISOString();
    for (let i = 0; i < 7; i++) {
        const quantity = i === 3 ? null : i === 5 ? '0' : '500';
        const p: Preserve = {
            id: crypto.randomUUID(),
            batchId: crypto.randomUUID(),
            version: 1,
            name: [
                'Клубничное варенье',
                'Маринованные огурцы',
                'Томатный соус',
                'Сушёные травы',
                'Квашеная капуста',
                'Использованное яблочное пюре',
                'Варенье — архив',
            ][i]!,
            type: i === 0 || i === 6 ? 'jam' : i === 3 ? 'dried' : i === 4 ? 'fermented' : 'canned',
            createdOn: date(-30),
            expiryOn: i === 3 || i === 4 ? null : date(i === 0 ? -2 : i === 2 ? 3 : 90),
            shelfLifeDays: null,
            locationId: i === 3 ? null : locationId,
            unit: 'g',
            volumePerUnit: null,
            notes: i === 4 ? 'Проверить состояние перед использованием' : null,
            tags: [],
            ingredients: [{ name: i === 0 ? 'Клубника' : 'Овощи', ingredientId: null, quantity: null, unit: null }],
            imageUrl: null,
            quantity,
            createdAt: iso,
            archivedAt: i === 6 ? iso : null,
            recipeRevisionId: null,
            recipeId: null,
            recipeTitle: null,
            containers: [
                {
                    id: crypto.randomUUID(),
                    label: 'Банка 1',
                    initialQuantity: quantity,
                    remainingQuantity: quantity,
                    openedAt: i === 2 ? new Date(now - 86400000).toISOString() : null,
                    depletedAt: i === 5 ? iso : null,
                    version: 1,
                },
            ],
            scope: 'private',
            capabilities: { qr: false, print: false, reason: 'requires-plus' },
        };
        if (i === 1) {
            p.containers.push({
                ...p.containers[0]!,
                id: crypto.randomUUID(),
                label: 'Банка 2',
                openedAt: new Date(now - 86400000).toISOString(),
            });
            p.quantity = '1000';
        }
        data.items.push({ userId, preserve: p, batchVersion: 1 });
        for (const container of p.containers)
            if (container.openedAt) data.openedDates[container.id] = container.openedAt.slice(0, 10);
        data.history.push({
            userId,
            preserveId: p.id,
            event: {
                id: crypto.randomUUID(),
                action: 'preserve.created',
                recordedAt: iso,
                details: { quantity: p.quantity, containerCount: p.containers.length },
            },
        });
    }
}
export function preserveStockSnapshot(p: Preserve, version: number) {
    return {
        id: p.batchId,
        name: p.name,
        quantity: p.quantity,
        unit: p.unit,
        version,
        locationId: p.locationId,
        ingredientId: null,
        openedAt: null,
        purchasedOn: null,
        expiryOn: p.expiryOn,
        packageState: 'unknown',
        precision: 'exact',
        quantitySource: 'user',
        confidence: null,
        pricePaidRub: null,
        storeName: null,
        barcode: null,
        scope: p.scope,
        archivedAt: p.archivedAt,
        createdAt: p.createdAt,
    };
}
function historyDetails(value: unknown) {
    const source =
        value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    const result: Record<string, unknown> = {};
    for (const key of ['containerId', 'quantity', 'before', 'after', 'openedAt', 'recipeId', 'revisionId'])
        if (typeof source[key] === 'string' || source[key] === null) result[key] = source[key];
    if (typeof source.containerCount === 'number') result.containerCount = source.containerCount;
    return eventSchema.shape.details.parse(result);
}
export function preservesHandle(c: Context): Response | null {
    const { state, userId, path, params, method, query, input, now, success, fail } = c;
    if (!path.startsWith('/api/v1/preserves')) return null;
    try {
        if (!userId) throw new Failure(401);
        seedPreserveFixtures(state, userId, now);
        const requestedScope = z
            .enum(['private', 'family'])
            .default('private')
            .parse(method === 'GET' ? (query.get('scope') ?? undefined) : (input as { scope?: unknown } | null)?.scope);
        const familyContext = requestedScope === 'family' ? mockFamilyContext(state, userId) : null;
        if (requestedScope === 'family' && !familyContext?.family) throw new Failure(404);
        if (requestedScope === 'family' && familyContext?.state !== 'active') throw new Failure(403);
        const ownerKey = requestedScope === 'family' ? familyContext!.family!.id : userId;
        if (requestedScope === 'family' && !state.preserves.seeded.includes(`family:${ownerKey}`)) {
            state.preserves.seeded.push(`family:${ownerKey}`);
            const examples = state.preserves.items.filter((row) => row.userId === userId).slice(0, 2);
            for (const example of examples) {
                const preserve = structuredClone(example.preserve);
                preserve.id = crypto.randomUUID();
                preserve.batchId = crypto.randomUUID();
                preserve.scope = 'family';
                preserve.containers = preserve.containers.map((container) => ({
                    ...container,
                    id: crypto.randomUUID(),
                }));
                state.preserves.items.push({ userId: ownerKey, preserve, batchVersion: 1 });
            }
        }
        const data = structuredClone(state.preserves);
        const workspace = structuredClone(state.recipeWorkspace);
        const inventory = structuredClone(state.inventory);
        const id = params.id ?? '';
        const get = () => {
            const p = data.items.find((r) => r.userId === ownerKey && r.preserve.id === id)?.preserve;
            if (!p) throw new Failure(404);
            return p;
        };
        const qrAvailable =
            requestedScope === 'family' ||
            ['plus', 'pro'].includes(state.users.find((user) => user.id === userId)?.plan ?? 'free');
        const withCapabilities = (p: Preserve): Preserve => ({
            ...p,
            capabilities: {
                qr: qrAvailable,
                print: qrAvailable,
                reason: qrAvailable ? null : 'requires-plus',
            },
        });
        const check = (p: Preserve, version: number, archive = false) => {
            if (p.version !== version) throw new Failure(412);
            if (p.archivedAt && !archive) throw new Failure(409);
        };
        const audit = (p: Preserve, action: string, details: unknown) =>
            data.history.push({
                userId: ownerKey,
                preserveId: p.id,
                event: {
                    id: crypto.randomUUID(),
                    action: 'preserve.' + action,
                    recordedAt: new Date(now).toISOString(),
                    details: historyDetails(details),
                },
            });
        const refs = (p: Pick<Preserve, 'unit' | 'locationId' | 'imageUrl' | 'ingredients'>) => {
            if (
                p.locationId &&
                !state.inventory.locations.some((l) => l.userId === ownerKey && l.location.id === p.locationId)
            )
                throw new Failure(422);
            if (p.imageUrl && !/^\/(?:assets|preserves)\/[A-Za-z0-9/_-]+\.(?:png|jpe?g|webp)$/.test(p.imageUrl)) {
                try {
                    const u = new URL(p.imageUrl);
                    if (u.protocol !== 'https:' || u.username || u.password) throw new Error();
                } catch {
                    throw new Failure(422);
                }
            }
            for (const line of p.ingredients) {
                if (
                    line.ingredientId &&
                    !state.products.items.some(
                        (r) =>
                            r.product.id === line.ingredientId &&
                            (r.product.status === 'approved' || r.authorId === userId),
                    )
                )
                    throw new Failure(422);
            }
        };
        if (method === 'GET') {
            if (path === '/api/v1/preserves') {
                const q = z
                    .object({
                        q: z.string().trim().max(200).default(''),
                        type: preserveSchema.shape.type.optional(),
                        locationId: z.union([z.uuid(), z.literal('none')]).optional(),
                        status: z.enum(['active', 'archived', 'all']).default('active'),
                        attention: z.enum(['all', 'expiring', 'expired', 'unknown']).default('all'),
                        days: z.coerce.number().int().min(1).max(365).default(14),
                        localDate: z.iso.date(),
                        page: z.coerce.number().int().min(1).max(10000).default(1),
                        limit: z.coerce.number().int().min(1).max(100).default(20),
                        scope: z.enum(['private', 'family']).default('private'),
                    })
                    .strict()
                    .parse(Object.fromEntries(query));
                const cutoff = new Date(Date.parse(q.localDate) + q.days * 86400000).toISOString().slice(0, 10);
                const base = data.items
                    .filter((r) => r.userId === ownerKey)
                    .map((r) => r.preserve)
                    .filter(
                        (p) =>
                            p.name.toLowerCase().includes(q.q.toLowerCase()) &&
                            (!q.type || p.type === q.type) &&
                            (!q.locationId ||
                                (q.locationId === 'none' ? p.locationId === null : p.locationId === q.locationId)) &&
                            (q.status === 'all' || (q.status === 'archived') === !!p.archivedAt),
                    );
                const attentionCount = base.filter(
                    (p) => !p.archivedAt && p.expiryOn !== null && p.expiryOn <= cutoff,
                ).length;
                const items = base
                    .filter(
                        (p) =>
                            q.attention === 'all' ||
                            (q.attention === 'unknown' && p.expiryOn === null) ||
                            (q.attention === 'expired' && p.expiryOn !== null && p.expiryOn < q.localDate) ||
                            (q.attention === 'expiring' && p.expiryOn !== null && p.expiryOn <= cutoff),
                    )
                    .sort((a, b) => b.createdOn.localeCompare(a.createdOn) || a.id.localeCompare(b.id));
                return success({
                    items: items.slice((q.page - 1) * q.limit, q.page * q.limit).map(withCapabilities),
                    total: items.length,
                    attentionCount,
                    page: q.page,
                    limit: q.limit,
                });
            }
            const p = get();
            if (path.endsWith('/qr-label')) {
                const label =
                    data.qrLabels.find((row) => row.userId === ownerKey && row.preserveId === p.id)?.label ?? null;
                return success({
                    label,
                    capability: { available: qrAvailable, reason: qrAvailable ? null : 'requires-plus' },
                });
            }
            if (path.endsWith('/history')) {
                const q = z
                    .object({
                        page: z.coerce.number().int().min(1).max(10000).default(1),
                        limit: z.coerce.number().int().min(1).max(100).default(20),
                        scope: z.enum(['private', 'family']).default('private'),
                    })
                    .strict()
                    .parse(Object.fromEntries(query));
                const items = data.history
                    .filter((r) => r.userId === ownerKey && r.preserveId === p.id)
                    .map((r) => r.event)
                    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || a.id.localeCompare(b.id));
                return success({
                    items: items.slice((q.page - 1) * q.limit, q.page * q.limit),
                    total: items.length,
                    ...q,
                });
            }
            return success({ preserve: withCapabilities(p) });
        }
        if (state.inventory.blocked.includes(userId)) throw new Failure(403);
        const route =
            `POST ${path.replace(id || '__none__', '{id}').replace(params.containerId || '__none__', '{containerId}')}` as keyof typeof contracts;
        const contract = contracts[route];
        if (!contract?.request) throw new Failure(404);
        const body = contract.request.parse(input);
        if (path.endsWith('/qr-label')) {
            const p = get();
            const value = contracts['POST /api/v1/preserves/{id}/qr-label'].request.parse(body);
            if (!qrAvailable) throw new Failure(403);
            if (p.version !== value.preserveVersion) throw new Failure(412);
            const binding = `${ownerKey}:${path}:${value.idempotencyKey}`;
            const prior = data.replay[binding];
            if (prior) return success(prior.result);
            const current = data.qrLabels.find((row) => row.userId === ownerKey && row.preserveId === p.id);
            const label = qrLabelSchema.parse({
                id: crypto.randomUUID(),
                revision: (current?.label.revision ?? 0) + 1,
                issuedAt: new Date(now).toISOString(),
                revokedAt: null,
                payload: {
                    schemaVersion: 1,
                    id: p.id,
                    name: p.name,
                    type: p.type,
                    createdOn: p.createdOn,
                    expiryOn: p.expiryOn,
                    appUrl: `mealplanner://preserve/${p.id}`,
                },
            });
            if (current) current.label = label;
            else data.qrLabels.push({ userId: ownerKey, preserveId: p.id, label });
            audit(p, 'qr-issued', { labelId: label.id, revision: label.revision });
            const result = { label, capability: { available: true, reason: null } };
            data.replay[binding] = { input: JSON.stringify(body), result };
            state.preserves = data;
            return success(result);
        }
        const previewInput = contracts['POST /api/v1/preserves/{id}/consume-preview'].request;
        function preview(p: Preserve, b: z.infer<typeof previewInput>) {
            check(p, b.version);
            const jar = p.containers.find((j) => j.id === b.containerId);
            if (!jar) throw new Failure(404);
            if (jar.version !== b.containerVersion) throw new Failure(412);
            if (!p.unit) throw new Failure(422);
            if (jar.remainingQuantity === null) throw new Failure(409);
            const remainder = decimal(jar.remainingQuantity) - decimal(b.quantity);
            if (decimal(b.quantity) <= 0n || remainder < 0n) throw new Failure(422);
            const fingerprint = JSON.stringify({
                userId,
                id: p.id,
                version: p.version,
                containerId: jar.id,
                containerVersion: jar.version,
                before: jar.remainingQuantity,
                quantity: b.quantity,
                unit: p.unit,
            });
            let token = data.previews[fingerprint];
            if (!token) {
                token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
                    n.toString(16).padStart(2, '0'),
                ).join('');
                data.previews[fingerprint] = token;
            }
            return {
                preserveId: p.id,
                containerId: jar.id,
                before: jar.remainingQuantity,
                after: decimalText(remainder),
                unit: p.unit,
                previewToken: token,
            };
        }
        if (path.endsWith('/consume-preview')) {
            const result = preview(get(), previewInput.parse(body));
            state.preserves = data;
            return success(result);
        }
        const command = z.object({ idempotencyKey: z.uuid() }).passthrough().parse(body);
        const binding = `${ownerKey}:${path}:${command.idempotencyKey}`,
            fingerprint = JSON.stringify(body),
            prior = data.replay[binding];
        if (prior) {
            if (prior.input !== fingerprint) throw new Failure(409);
            return success(prior.result);
        }
        let result: unknown;
        if (path === '/api/v1/preserves') {
            const b = contracts['POST /api/v1/preserves'].request.parse(body);
            const { idempotencyKey, ...preserveFields } = b;
            if (idempotencyKey !== command.idempotencyKey) throw new Failure(409);
            refs(b);
            if (b.containers.some((j) => j.quantity !== null) && !b.unit) throw new Failure(422);
            let recipeId: string | null = null,
                recipeTitle: string | null = null;
            if (b.recipeRevisionId) {
                const candidate = [
                    ...publicRecipeFixtures(),
                    ...state.recipeWorkspace.recipes
                        .filter((r) => r.userId === userId)
                        .map((r) => workspaceRecipeFixture(state, userId, r.recipe.id))
                        .filter((r) => r !== null),
                ].find((r) => r.revisionId === b.recipeRevisionId);
                if (
                    !candidate ||
                    state.recipeWorkspace.hidden.includes(candidate.id) ||
                    (!publicRecipeFixtures().some(
                        (r) => r.id === candidate.id && r.revisionId === candidate.revisionId,
                    ) &&
                        !workspaceRecipeFixture(state, userId, candidate.id))
                )
                    throw new Failure(422);
                recipeId = candidate.id;
                recipeTitle = candidate.title;
            }
            const p = preserveSchema.parse({
                ...preserveFields,
                id: crypto.randomUUID(),
                batchId: crypto.randomUUID(),
                version: 1,
                quantity: total(b.containers.map((j) => j.quantity)),
                createdAt: new Date(now).toISOString(),
                archivedAt: null,
                recipeId,
                recipeTitle,
                containers: b.containers.map((j) => ({
                    id: crypto.randomUUID(),
                    label: j.label,
                    initialQuantity: j.quantity,
                    remainingQuantity: j.quantity,
                    openedAt: null,
                    depletedAt: j.quantity !== null && decimal(j.quantity) === 0n ? new Date(now).toISOString() : null,
                    version: 1,
                })),
                scope: requestedScope,
                capabilities: { qr: false, print: false, reason: 'requires-plus' },
            });
            data.items.push({ userId: ownerKey, preserve: p, batchVersion: 1 });
            audit(p, 'created', { quantity: p.quantity, unit: p.unit, containerCount: p.containers.length });
            result = { preserve: p };
        } else {
            const p = get();
            const action = path.split('/').at(-1);
            const b = z.object({ version: z.number().int().positive() }).passthrough().parse(body);
            if (action === 'recipe-base' && p.recipeId && p.recipeRevisionId)
                result = { recipeId: p.recipeId, revisionId: p.recipeRevisionId };
            else {
                check(p, b.version, action === 'archive' || action === 'restore');
                if (action === 'edit') {
                    const v = contracts['POST /api/v1/preserves/{id}/edit'].request.parse(body);
                    refs(v.fields);
                    if (
                        p.containers.some(
                            (container) =>
                                container.openedAt &&
                                (data.openedDates[container.id] ?? container.openedAt.slice(0, 10)) <
                                    v.fields.createdOn,
                        )
                    )
                        throw new Failure(422);
                    if (p.unit !== null && p.unit !== v.fields.unit) throw new Failure(409);
                    if (!v.fields.unit && p.containers.some((j) => j.remainingQuantity !== null))
                        throw new Failure(422);
                    Object.assign(p, v.fields);
                    audit(p, 'edited', { after: v.fields });
                } else if (action === 'archive' || action === 'restore') {
                    p.archivedAt = action === 'archive' ? new Date(now).toISOString() : null;
                    audit(p, action, {});
                } else if (action === 'recipe-base') {
                    const recipeId = crypto.randomUUID(),
                        revisionId = crypto.randomUUID();
                    const document = {
                        title: p.name,
                        description: `Основа из заготовки «${p.name}».\n${p.ingredients.map((i) => i.name).join(', ')}${p.notes ? '\n' + p.notes : ''}`,
                        category: null,
                        tags: p.tags,
                        baseServings: 1,
                        method: '',
                        ingredients: p.ingredients
                            .filter((i) => i.ingredientId)
                            .map((i) => ({
                                ingredientId: i.ingredientId,
                                variantId: null,
                                productId: null,
                                sourceRecipeId: null,
                                quantity: i.quantity,
                                unit: i.unit,
                                optional: false,
                            })),
                        steps: [],
                    };
                    const recipe = contracts['GET /api/v1/recipe-workspace/{id}'].success.shape.data.shape.recipe.parse(
                        {
                            id: recipeId,
                            revisionId,
                            version: 1,
                            revision: 1,
                            status: 'draft',
                            archived: false,
                            baseRecipeId: null,
                            availabilityScope: 'private',
                            authorLogin: state.users.find((user) => user.id === userId)?.login ?? null,
                            canEdit: true,
                            document,
                            nutrition: {
                                status: 'unavailable',
                                base: null,
                                uncoveredIngredientIds: document.ingredients.map((i) => i.ingredientId!),
                            },
                        },
                    );
                    workspace.recipes.push({
                        userId,
                        familyId: requestedScope === 'family' ? ownerKey : null,
                        recipe,
                        history: [],
                        submittedRevisionIds: [],
                    });
                    p.recipeId = recipeId;
                    p.recipeRevisionId = revisionId;
                    p.recipeTitle = p.name;
                    audit(p, 'recipe-base-created', { recipeId, revisionId });
                    result = { recipeId, revisionId };
                } else if (action === 'consume') {
                    const v = contracts['POST /api/v1/preserves/{id}/consume'].request.parse(body);
                    const before = preview(p, v);
                    if (before.previewToken !== v.previewToken) throw new Failure(409);
                    const batchVersion = data.items.find(
                        (r) => r.userId === ownerKey && r.preserve.id === p.id,
                    )!.batchVersion;
                    const snapshotBefore = preserveStockSnapshot(p, batchVersion);
                    const jar = p.containers.find((j) => j.id === v.containerId)!;
                    jar.remainingQuantity = before.after;
                    jar.depletedAt = decimal(before.after) === 0n ? new Date(now).toISOString() : null;
                    jar.version++;
                    p.quantity = total(p.containers.map((j) => j.remainingQuantity));
                    inventory.history.push({
                        userId: ownerKey,
                        movement: contracts[
                            'GET /api/v1/inventory-history'
                        ].success.shape.data.shape.items.element.parse({
                            id: crypto.randomUUID(),
                            action: 'consume',
                            quantityDelta: `-${v.quantity}`,
                            recordedAt: new Date(now).toISOString(),
                            effectiveAt: new Date(now).toISOString(),
                            actorId: userId,
                            before: snapshotBefore,
                            after: preserveStockSnapshot(p, batchVersion + 1),
                        }),
                    });
                    audit(p, 'consumed', before);
                } else {
                    const jar = p.containers.find((j) => j.id === params.containerId);
                    if (!jar) throw new Failure(404);
                    const v = z.object({ containerVersion: z.number() }).passthrough().parse(body);
                    if (jar.version !== v.containerVersion) throw new Failure(412);
                    if (action === 'open') {
                        const open =
                            contracts['POST /api/v1/preserves/{id}/containers/{containerId}/open'].request.parse(body);
                        if (jar.openedAt) throw new Failure(409);
                        let parts: Intl.DateTimeFormatPart[];
                        try {
                            parts = new Intl.DateTimeFormat('en', {
                                timeZone: open.timezone,
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                            }).formatToParts(new Date(open.openedAt));
                        } catch {
                            throw new Failure(400);
                        }
                        const local = ['year', 'month', 'day']
                            .map((t) => parts.find((p) => p.type === t)!.value)
                            .join('-');
                        if (local < p.createdOn || Date.parse(open.openedAt) > now) throw new Failure(422);
                        jar.openedAt = open.openedAt;
                        data.openedDates[jar.id] = local;
                        audit(p, 'opened', { containerId: jar.id, openedAt: jar.openedAt });
                    } else if (action === 'quantity') {
                        const qty =
                            contracts['POST /api/v1/preserves/{id}/containers/{containerId}/quantity'].request.parse(
                                body,
                            ).quantity;
                        if (qty !== null && !p.unit) throw new Failure(422);
                        const before = jar.remainingQuantity;
                        jar.remainingQuantity = qty;
                        jar.initialQuantity =
                            qty === null
                                ? null
                                : jar.initialQuantity === null || decimal(qty) > decimal(jar.initialQuantity)
                                  ? qty
                                  : jar.initialQuantity;
                        jar.depletedAt = qty !== null && decimal(qty) === 0n ? new Date(now).toISOString() : null;
                        p.quantity = total(p.containers.map((j) => j.remainingQuantity));
                        audit(p, 'quantity-adjusted', { containerId: jar.id, before, after: qty });
                    } else throw new Failure(404);
                    jar.version++;
                }
                p.version++;
                if (action !== 'open' && action !== 'recipe-base')
                    data.items.find((r) => r.userId === ownerKey && r.preserve.id === p.id)!.batchVersion++;
                result ??= { preserve: p };
            }
        }
        data.replay[binding] = { input: fingerprint, result: structuredClone(result) };
        state.preserves = data;
        state.recipeWorkspace = workspace;
        state.inventory = inventory;
        return success(result);
    } catch (e) {
        if (e instanceof z.ZodError) return fail(400);
        if (e instanceof Failure) return fail(e.status);
        throw e;
    }
}
