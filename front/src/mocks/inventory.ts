import { z } from 'zod';
import fixture from '../../contracts/dev-users.json' with { type: 'json' };
import { contracts } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';
import { mockFamilyContext } from './family.js';
const batchSchema = contracts['GET /api/v1/inventory/{id}'].success.shape.data.shape.batch;
const locationSchema = contracts['GET /api/v1/inventory-locations'].success.shape.data.shape.items.element;
const historySchema = contracts['GET /api/v1/inventory-history'].success.shape.data.shape.items.element;
type Batch = z.infer<typeof batchSchema>;
export const inventoryStateSchema = z.object({
    batches: z.array(z.object({ userId: z.string(), batch: batchSchema })),
    locations: z.array(z.object({ userId: z.string(), location: locationSchema })),
    history: z.array(z.object({ userId: z.string(), movement: historySchema })),
    replay: z.record(z.string(), z.object({ hash: z.string(), data: z.unknown() })),
    seeded: z.array(z.string()),
    blocked: z.array(z.string()),
});
export type InventoryState = z.infer<typeof inventoryStateSchema>;
export function createInventoryState(): InventoryState {
    return { batches: [], locations: [], history: [], replay: {}, seeded: [], blocked: [] };
}
interface Context {
    state: MockState;
    userId: string;
    path: string;
    method: string;
    query: URLSearchParams;
    params: Record<string, string>;
    input: unknown;
    ifMatch: string | null | undefined;
    now: number;
    success: (data: unknown) => Response;
    fail: (status: number, code?: string) => Response;
    canUseIngredient?: (id: string, scope: 'private' | 'family') => boolean;
}
const known = [
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003',
];
const decimal = (value: string) => {
    const [whole, fraction = ''] = value.split('.');
    return BigInt(whole ?? '0') * 100000000n + BigInt(fraction.padEnd(8, '0'));
};
const decimalText = (value: bigint) => {
    const sign = value < 0n ? '-' : '';
    const abs = value < 0n ? -value : value;
    const fraction = (abs % 100000000n).toString().padStart(8, '0').replace(/0+$/, '');
    return `${sign}${abs / 100000000n}${fraction ? `.${fraction}` : ''}`;
};
class Failure extends Error {
    constructor(readonly status: number) {
        super(String(status));
    }
}
function seed(
    state: InventoryState,
    ownerKey: string,
    actorOrNow: string | number,
    scope: 'private' | 'family' = 'private',
    nowValue?: number,
) {
    const actorId = typeof actorOrNow === 'string' ? actorOrNow : ownerKey;
    const now = typeof actorOrNow === 'number' ? actorOrNow : nowValue!;
    const seedKey = `${scope}:${ownerKey}`;
    if (state.seeded.includes(seedKey) || (scope === 'private' && state.seeded.includes(ownerKey))) return;
    state.seeded.push(seedKey);
    if (!fixture.users.some((user) => user.id === actorId)) return;
    const fridge = { id: crypto.randomUUID(), name: 'Холодильник', type: 'fridge' as const, version: 1 };
    const shelf = { id: crypto.randomUUID(), name: 'Кухонный шкаф', type: 'cabinet' as const, version: 1 };
    state.locations.push({ userId: ownerKey, location: fridge }, { userId: ownerKey, location: shelf });
    const date = (offset: number) => new Date(now + offset * 86400000).toISOString().slice(0, 10);
    for (let index = 0; index < 5; index++) {
        const batch: Batch = {
            id: crypto.randomUUID(),
            ingredientId: known[index % 3]!,
            name: [
                scope === 'family' ? 'Общее молоко' : 'Молоко',
                scope === 'family' ? 'Семейные яблоки' : 'Яблоки',
                'Рис',
                'Молоко — проверить срок',
                'Яблоки — архив',
            ][index]!,
            quantity: index === 3 ? null : ['0.75', '6', '1000', '0', '2'][index]!,
            unit: index % 3 === 0 ? 'l' : index % 3 === 1 ? 'pcs' : 'g',
            locationId: index % 3 === 0 ? fridge.id : shelf.id,
            purchasedOn: date(-3),
            expiryOn: index === 3 ? null : date(index === 0 ? 1 : index === 1 ? -1 : 30),
            openedAt: index === 0 ? new Date(now - 86400000).toISOString() : null,
            packageState: index === 0 ? 'opened' : 'sealed',
            precision: index === 3 ? 'estimated' : 'exact',
            quantitySource: 'user',
            confidence: null,
            pricePaidRub: index === 3 ? null : '125.50',
            storeName: index === 3 ? null : 'Тестовый магазин',
            barcode: null,
            scope,
            version: 1,
            archivedAt: index === 4 ? new Date(now).toISOString() : null,
            createdAt: new Date(now - index * 60000).toISOString(),
        };
        state.batches.push({ userId: ownerKey, batch });
        state.history.push({
            userId: ownerKey,
            movement: {
                id: crypto.randomUUID(),
                action: 'purchase',
                quantityDelta: batch.quantity,
                actorId,
                recordedAt: batch.createdAt,
                effectiveAt: batch.createdAt,
                before: null,
                after: structuredClone(batch),
            },
        });
    }
}
export function inventoryHandle(ctx: Context): Response | null {
    const { state, userId, path, method, query, params, input, now, success, fail } = ctx;
    if (
        ![
            '/api/v1/inventory',
            '/api/v1/inventory-locations',
            '/api/v1/inventory-history',
            '/api/v1/inventory/import/commit',
        ].includes(path) &&
        !/^\/api\/v1\/inventory\/[^/]+(?:\/command)?$/.test(path)
    )
        return null;
    const inventory = state.inventory;
    const timestamp = new Date(now).toISOString();
    const owner = (scope: 'private' | 'family') => {
        if (scope === 'private') return userId;
        const family = mockFamilyContext(state, userId);
        if (family.state === 'none' || !family.family) throw new Failure(404);
        if (family.state !== 'active') throw new Failure(403);
        return family.family.id;
    };
    let ownerKey = userId;
    let selectedScope: 'private' | 'family' = 'private';
    const selectScope = (scope: 'private' | 'family') => {
        selectedScope = scope;
        ownerKey = owner(scope);
        seed(inventory, ownerKey, userId, scope, now);
    };
    const find = (id: string) => {
        const found = inventory.batches.find((row) => row.userId === ownerKey && row.batch.id === id);
        if (!found) throw new Failure(404);
        return found;
    };
    const checkLocation = (id: string | null) => {
        if (id && !inventory.locations.some((row) => row.userId === ownerKey && row.location.id === id))
            throw new Failure(422);
    };
    const movement = (action: string, before: Batch | null, after: Batch) => {
        inventory.history.push({
            userId: ownerKey,
            movement: {
                id: crypto.randomUUID(),
                action,
                quantityDelta:
                    after.quantity !== null &&
                    (before === null || (before.quantity !== null && before.unit === after.unit))
                        ? decimalText(decimal(after.quantity) - (before?.quantity ? decimal(before.quantity) : 0n))
                        : null,
                actorId: userId,
                effectiveAt: timestamp,
                recordedAt: timestamp,
                before: structuredClone(before),
                after: structuredClone(after),
            },
        });
    };
    const version = (value: number) => {
        if (!ctx.ifMatch) throw new Failure(428);
        if (ctx.ifMatch !== `"${value}"`) throw new Failure(412);
    };
    try {
        if (method === 'GET') {
            const parsedScope = z
                .enum(['private', 'family'])
                .default('private')
                .safeParse(query.get('scope') ?? undefined);
            if (!parsedScope.success) throw new Failure(400);
            selectScope(parsedScope.data);
            if (path === '/api/v1/inventory-locations')
                return success({
                    items: inventory.locations
                        .filter((row) => row.userId === ownerKey)
                        .map((row) => row.location)
                        .sort((a, b) => a.name.localeCompare(b.name)),
                });
            if (path === '/api/v1/inventory-history') {
                const parsed = z
                    .object({
                        batchId: z.uuid().optional(),
                        q: z.string().max(200).default(''),
                        action: z
                            .enum([
                                'purchase',
                                'consume',
                                'cook',
                                'adjust',
                                'transfer',
                                'archive',
                                'restore',
                                'compensate',
                            ])
                            .optional(),
                        from: z.iso.datetime().optional(),
                        to: z.iso.datetime().optional(),
                        limit: z.coerce.number().int().min(1).max(100).default(100),
                        offset: z.coerce.number().int().min(0).max(100000).default(0),
                        scope: z.enum(['private', 'family']).default('private'),
                    })
                    .strict()
                    .safeParse(Object.fromEntries(query));
                if (!parsed.success) throw new Failure(400);
                const q = parsed.data;
                const items = inventory.history
                    .filter((row) => row.userId === ownerKey && (!q.batchId || row.movement.after.id === q.batchId))
                    .map((row) => row.movement)
                    .filter(
                        (row) =>
                            (!q.action || row.action === q.action) &&
                            row.after.name.toLocaleLowerCase().includes(q.q.toLocaleLowerCase()) &&
                            (!q.from || Date.parse(row.effectiveAt) >= Date.parse(q.from)) &&
                            (!q.to || Date.parse(row.effectiveAt) <= Date.parse(q.to)),
                    )
                    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || b.id.localeCompare(a.id));
                return success({
                    items: items.slice(q.offset, q.offset + q.limit),
                    total: items.length,
                    limit: q.limit,
                    offset: q.offset,
                });
            }
            if (path === '/api/v1/inventory') {
                const parsed = z
                    .object({
                        q: z.string().max(200).default(''),
                        status: z.enum(['active', 'archived', 'all']).default('active'),
                        attention: z.enum(['all', 'expiring', 'unknown']).default('all'),
                        days: z.coerce
                            .number()
                            .pipe(z.union([z.literal(3), z.literal(7), z.literal(14)]))
                            .default(3),
                        localDate: z.iso.date(),
                        ingredientId: z.uuid().optional(),
                        locationId: z.uuid().optional(),
                        limit: z.coerce.number().int().min(1).max(100).default(50),
                        offset: z.coerce.number().int().min(0).max(100000).default(0),
                        scope: z.enum(['private', 'family']).default('private'),
                    })
                    .strict()
                    .safeParse(Object.fromEntries(query));
                if (!parsed.success) throw new Failure(400);
                const q = parsed.data;
                const deadline = new Date(Date.parse(q.localDate + 'T00:00:00Z') + q.days * 86400000)
                    .toISOString()
                    .slice(0, 10);
                const rows = inventory.batches
                    .filter((row) => row.userId === ownerKey)
                    .map((row) => row.batch)
                    .filter(
                        (batch) =>
                            (q.status === 'all' || (q.status === 'archived') === !!batch.archivedAt) &&
                            batch.name.toLocaleLowerCase().includes(q.q.toLocaleLowerCase()) &&
                            (!q.ingredientId || batch.ingredientId === q.ingredientId) &&
                            (!q.locationId || batch.locationId === q.locationId) &&
                            (q.attention === 'all' ||
                                (q.attention === 'unknown'
                                    ? batch.expiryOn === null
                                    : batch.expiryOn !== null && batch.expiryOn <= deadline)),
                    )
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
                return success({ items: rows.slice(q.offset, q.offset + q.limit), total: rows.length });
            }
            return success({ batch: find(params.id ?? path.split('/').at(-1) ?? '').batch });
        }
        if (method !== 'POST') return fail(404);
        if (inventory.blocked.includes(userId)) throw new Failure(403);
        const route =
            path === '/api/v1/inventory'
                ? 'POST /api/v1/inventory'
                : path === '/api/v1/inventory/import/commit'
                  ? 'POST /api/v1/inventory/import/commit'
                  : path === '/api/v1/inventory-locations'
                    ? 'POST /api/v1/inventory-locations'
                    : 'POST /api/v1/inventory/{id}/command';
        const parsed = contracts[route].request.safeParse(input);
        if (!parsed.success) throw new Failure(400);
        const body = parsed.data;
        const importRows = 'rows' in body ? body.rows : undefined;
        const requestedScope = importRows ? importRows[0]?.scope : 'scope' in body ? body.scope : undefined;
        if (!requestedScope) throw new Failure(400);
        if (importRows?.some((row) => row.scope !== requestedScope)) throw new Failure(400);
        selectScope(requestedScope);
        if ('version' in body) version(body.version);
        const target = path === '/api/v1/inventory-locations' && 'id' in body ? body.id : path;
        const key = `${userId}:${selectedScope}:${ownerKey}:${target}:${body.idempotencyKey}`;
        const hash = JSON.stringify(body);
        const prior = inventory.replay[key];
        if (prior) {
            if (prior.hash !== hash) throw new Failure(409);
            return success(prior.data);
        }
        const create = (raw: unknown) => {
            const data = contracts['POST /api/v1/inventory'].request.parse(raw);
            if (!(ctx.canUseIngredient?.(data.ingredientId, data.scope) ?? known.includes(data.ingredientId)))
                throw new Failure(422);
            checkLocation(data.locationId);
            const { idempotencyKey: _key, ...fields } = data;
            void _key;
            const batch: Batch = {
                ...fields,
                quantitySource: fields.quantitySource ?? 'user',
                confidence: fields.confidence ?? null,
                id: crypto.randomUUID(),
                version: 1,
                archivedAt: null,
                createdAt: timestamp,
            };
            inventory.batches.push({ userId: ownerKey, batch });
            movement('purchase', null, batch);
            return batch;
        };
        let result: unknown;
        if (path === '/api/v1/inventory') result = { batch: create(body) };
        else if (path === '/api/v1/inventory/import/commit') {
            const data = contracts['POST /api/v1/inventory/import/commit'].request.parse(body);
            const before = structuredClone(inventory);
            try {
                result = { items: data.rows.map(create) };
            } catch (error) {
                Object.assign(inventory, before);
                throw error;
            }
        } else if (path === '/api/v1/inventory-locations') {
            const data = contracts['POST /api/v1/inventory-locations'].request.parse(body);
            if (data.action === 'create') {
                const location = { id: crypto.randomUUID(), name: data.name, type: data.type, version: 1 };
                inventory.locations.push({ userId: ownerKey, location });
                result = { location };
            } else {
                const row = inventory.locations.find((row) => row.userId === ownerKey && row.location.id === data.id);
                if (!row) throw new Failure(404);
                if (row.location.version !== data.version) throw new Failure(412);
                row.location = { ...row.location, name: data.name, version: row.location.version + 1 };
                result = { location: row.location };
            }
        } else {
            const data = contracts['POST /api/v1/inventory/{id}/command'].request.parse(body);
            const found = find(params.id ?? path.split('/').at(-2) ?? '');
            const before = structuredClone(found.batch);
            if (before.version !== data.version) throw new Failure(412);
            if (before.archivedAt && data.action !== 'restore') throw new Failure(409);
            let batch = { ...before, version: before.version + 1 };
            if (data.action === 'edit') {
                checkLocation(data.fields.locationId);
                batch = {
                    ...batch,
                    ...data.fields,
                    quantitySource: data.fields.quantitySource ?? 'user',
                    confidence: data.fields.confidence ?? null,
                };
            }
            if (data.action === 'transfer') {
                checkLocation(data.locationId);
                batch.locationId = data.locationId;
            }
            if (data.action === 'consume') {
                if (before.quantity === null) throw new Failure(409);
                const amount = decimal(data.quantity);
                if (amount <= 0n || amount > decimal(before.quantity)) throw new Failure(422);
                batch.quantity = decimalText(decimal(before.quantity) - amount);
            }
            if (data.action === 'archive') batch.archivedAt = timestamp;
            if (data.action === 'restore') {
                if (!before.archivedAt) throw new Failure(409);
                batch.archivedAt = null;
            }
            found.batch = batch;
            movement(data.action === 'edit' ? 'adjust' : data.action, before, batch);
            result = { batch };
        }
        inventory.replay[key] = { hash, data: structuredClone(result) };
        return success(result);
    } catch (error) {
        if (error instanceof Failure) return fail(error.status);
        throw error;
    }
}

export { seed as seedInventoryFixtures };
