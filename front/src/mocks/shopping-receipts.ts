import { z } from 'zod';
import { contracts } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';
import { seedInventoryFixtures } from './inventory.js';
import fixture from '../../contracts/dev-users.json' with { type: 'json' };
import { mockDiaryAccess } from './diary.js';
import { mockFamilyContext } from './family.js';
const listSchema = contracts['GET /api/v1/shopping-lists/{id}'].success.shape.data;
const receiptSchema = contracts['GET /api/v1/receipts/{id}'].success.shape.data.shape.receipt;
const purchaseSchema = contracts['GET /api/v1/purchases/{id}'].success.shape.data;
export const shoppingReceiptsStateSchema = z.object({
    receipts: z.array(z.object({ userId: z.uuid(), receipt: receiptSchema })),
    purchases: z.array(
        z.object({
            userId: z.uuid(),
            receiptId: z.uuid().nullable(),
            listId: z.uuid().nullable(),
            purchase: purchaseSchema,
        }),
    ),
    seeded: z.array(z.string()),
    allocatedLines: z.array(z.string()).default([]),
    archivedFrom: z.record(z.string(), z.enum(['active', 'completed'])),
    previews: z.record(z.string(), z.string()),
    replay: z.record(z.string(), z.object({ input: z.string(), result: z.unknown() })),
    history: z
        .record(
            z.string(),
            z.array(
                z.object({
                    id: z.uuid(),
                    action: z.string(),
                    actorId: z.uuid().nullable(),
                    actorLogin: z.string().nullable(),
                    at: z.iso.datetime(),
                }),
            ),
        )
        .default({}),
});
export type ShoppingReceiptsState = z.infer<typeof shoppingReceiptsStateSchema>;

const consumedTestControls = new Set<string>();
export function consumeResilienceTestControl(request: Request, cookies: Record<string, string>): Response | null {
    if (process.env.NODE_ENV !== 'development' && process.env.NEXT_PUBLIC_E2E_PRODUCTION_MOCKS !== '1') return null;
    const url = new URL(request.url);
    const cookie =
        url.pathname === '/api/v1/family' && request.method.toUpperCase() === 'POST'
            ? cookies.family_test_control
            : /^\/api\/v1\/(shopping-lists|receipts|purchases)(?:\/|$)/.test(url.pathname)
              ? cookies.commerce_test_control
              : undefined;
    if (!cookie) return null;
    let control: { nonce: string; method: string; path: string; kind: string; value: number; message?: string };
    try {
        const encoded = cookie.replace(/-/g, '+').replace(/_/g, '/');
        const binary = atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '='));
        control = JSON.parse(
            new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0))),
        ) as typeof control;
    } catch {
        return null;
    }
    if (
        consumedTestControls.has(control.nonce) ||
        control.method !== request.method.toUpperCase() ||
        control.path !== url.pathname
    )
        return null;
    consumedTestControls.add(control.nonce);
    const { kind, value } = control;
    if (kind !== 'status' || ![403, 409, 412, 503].includes(value)) return null;
    const message =
        typeof control.message === 'string' && control.message.length <= 200
            ? control.message
            : value === 403
              ? 'Доступ к выбранной области потерян'
              : value === 412
                ? 'Состояние изменилось'
                : value === 409
                  ? 'Операция конфликтует с текущим состоянием'
                  : 'Сервис временно недоступен';
    return new Response(
        JSON.stringify({
            error: {
                code:
                    value === 403
                        ? 'FORBIDDEN'
                        : value === 412
                          ? 'PRECONDITION_FAILED'
                          : value === 409
                            ? 'CONFLICT'
                            : 'UPSTREAM_UNAVAILABLE',
                message,
                details: null,
            },
            meta: { requestId: crypto.randomUUID() },
        }),
        { status: value, headers: { 'content-type': 'application/json' } },
    );
}

export const createShoppingReceiptsState = (): ShoppingReceiptsState => ({
    receipts: [],
    purchases: [],
    seeded: [],
    allocatedLines: [],
    archivedFrom: {},
    previews: {},
    replay: {},
    history: {},
});
type Context = {
    state: MockState;
    userId: string | null;
    path: string;
    params: Record<string, string>;
    method: string;
    query: URLSearchParams;
    input: unknown;
    now: number;
    success: (data: unknown) => Response;
    fail: (status: number) => Response;
};
const dec = (s: string) => {
    const [a = '0', b = ''] = s.split('.');
    return BigInt(a) * 100000000n + BigInt(b.padEnd(8, '0'));
};
const txt = (n: bigint) =>
    `${n / 100000000n}${n % 100000000n ? '.' + (n % 100000000n).toString().padStart(8, '0').replace(/0+$/, '') : ''}`;
class Failure extends Error {
    constructor(readonly status: number) {
        super(String(status));
    }
}
function seed(state: MockState, user: string, now: number, scope: 'private' | 'family' = 'private') {
    const data = state.shoppingReceipts;
    if (data.seeded.includes(user)) return;
    data.seeded.push(user);
    if (scope === 'private' && !fixture.users.some((u) => u.id === user)) return;
    seedInventoryFixtures(state.inventory, user, now);
    for (const [no, status] of (['active', 'completed', 'archived'] as const).entries()) {
        const id = crypto.randomUUID();
        state.cookingWorkflow.lists.push({
            userId: user,
            list: listSchema.parse({
                id,
                title: ['На неделю', 'Завтрак дома', 'В архиве — пикник'][no],
                version: 1,
                status,
                createdAt: new Date(now - no * 86400000).toISOString(),
                items: [
                    {
                        id: crypto.randomUUID(),
                        version: 1,
                        name: 'Яблоки',
                        quantity: no === 0 ? null : '2',
                        unit: 'kg',
                        ingredientId: '10000000-0000-4000-8000-000000000002',
                        productId: null,
                        allowAnalog: true,
                        status: no === 1 ? 'purchased' : 'pending',
                        position: 0,
                        manual: true,
                        requirements: {},
                        estimatedPriceMinor: null,
                    },
                ],
                scope,
            }),
        });
    }
    for (const [index, status] of (['draft', 'committed', 'linked'] as const).entries()) {
        const id = `a100000${index}-0000-4000-8000-${user.slice(-12)}`;
        const purchaseId = `a200000${index}-0000-4000-8000-${user.slice(-12)}`;
        const line = {
            id: crypto.randomUUID(),
            name: index === 0 ? 'Яблоки — проверьте количество' : 'Рис',
            quantity: index === 0 ? null : '1',
            unit: 'kg',
            ingredientId: index === 0 ? '10000000-0000-4000-8000-000000000002' : '10000000-0000-4000-8000-000000000003',
            productId: null,
            locationId: null,
            isFood: true,
            intake: false,
            shoppingItemId: null,
            expiryOn: null,
        };
        if (status !== 'draft')
            data.purchases.push({
                userId: user,
                receiptId: id,
                listId: null,
                purchase: purchaseSchema.parse({
                    purchaseId,
                    version: 1,
                    purchasedAt: new Date(now - (index + 1) * 86400000).toISOString(),
                    lines: [{ ...line, version: 1, batchIds: [] }],
                }),
            });
        data.receipts.push({
            userId: user,
            receipt: receiptSchema.parse({
                id,
                version: 1,
                status,
                source: { kind: 'photo', storageStatus: 'deferred', reference: 'Демонстрационный чек' },
                ocrText: line.name,
                lines: [line],
                result: status === 'draft' ? null : { purchaseId, batchIds: [], unknownLineIds: [] },
                history: [
                    { action: 'created', at: new Date(now - (index + 1) * 86400000).toISOString() },
                    ...(status === 'draft'
                        ? []
                        : [
                              {
                                  action: status === 'linked' ? 'linked-existing-purchase' : 'committed',
                                  at: new Date(now - index * 86400000).toISOString(),
                              },
                          ]),
                ],
            }),
        });
    }
}
export { seed as seedShoppingReceiptFixtures };
export function shoppingReceiptsHandle(c: Context): Response | null {
    const { state, userId: user, path, params, method, query, input, now, success, fail } = c;
    if (!/^\/api\/v1\/(shopping-lists|receipts|purchases)(?:\/|$)/.test(path) || path.endsWith('/recipe-preview'))
        return null;
    try {
        if (!user) throw new Failure(401);
        const requestedScope =
            (query.get('scope') ??
                (typeof input === 'object' && input && 'scope' in input ? String(input.scope) : 'private')) === 'family'
                ? 'family'
                : 'private';
        let owner = user;
        if (requestedScope === 'family') {
            const context = mockFamilyContext(state, user);
            if (!context.family) throw new Failure(404);
            if (context.state !== 'active') throw new Failure(403);
            owner = context.family.id;
        }
        seed(state, owner, now, requestedScope);
        const data = structuredClone(state.shoppingReceipts),
            cooking = structuredClone(state.cookingWorkflow),
            inventory = structuredClone(state.inventory);
        const id = params.id ?? '';
        const list = () => {
            const l = cooking.lists.find((r) => r.userId === owner && r.list.id === id)?.list;
            if (!l) throw new Failure(404);
            return l;
        };
        const receipt = () => {
            const r = data.receipts.find((r) => r.userId === owner && r.receipt.id === id)?.receipt;
            if (!r) throw new Failure(404);
            return r;
        };
        const purchase = () => {
            const p = data.purchases.find((p) => p.userId === owner && p.purchase.purchaseId === id);
            if (!p) throw new Failure(404);
            return p;
        };
        const enrich = (l: z.infer<typeof listSchema>) => ({
            ...l,
            progress: { purchased: l.items.filter((i) => i.status === 'purchased').length, total: l.items.length },
        });
        const check = (v: number, expected: number) => {
            if (v !== expected) throw new Failure(412);
        };
        const active = (l: z.infer<typeof listSchema>) => {
            if (l.status !== 'active') throw new Failure(409);
        };
        const draft = (r: z.infer<typeof receiptSchema>) => {
            if (r.status !== 'draft') throw new Failure(409);
        };
        if (method === 'GET') {
            if (path === '/api/v1/receipts/capabilities')
                return success({
                    photo: true,
                    electronicLink: true,
                    pdfUpload: false,
                    ocrAdapter: false,
                    pdfUnavailableReason: 'storage_not_configured',
                });
            if (path === '/api/v1/shopping-lists') {
                const q = z
                    .object({
                        q: z.string().max(200).default(''),
                        status: z.enum(['active', 'completed', 'archived', 'all']).default('active'),
                        cursor: z.uuid().optional(),
                        limit: z.coerce.number().int().min(1).max(100).default(30),
                        scope: z.enum(['private', 'family']).default('private'),
                    })
                    .strict()
                    .parse(Object.fromEntries(query));
                let rows = cooking.lists
                    .filter((r) => r.userId === owner)
                    .map((r) => enrich(r.list))
                    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.id.localeCompare(a.id));
                if (q.cursor) {
                    const anchor = rows.find((l) => l.id === q.cursor);
                    rows = anchor
                        ? rows.filter(
                              (l) =>
                                  (l.createdAt ?? '') < (anchor.createdAt ?? '') ||
                                  (l.createdAt === anchor.createdAt && l.id < anchor.id),
                          )
                        : [];
                }
                rows = rows.filter(
                    (l) =>
                        (q.status === 'all' || l.status === q.status) &&
                        l.title.toLowerCase().includes(q.q.toLowerCase()),
                );
                return success({
                    items: rows.slice(0, q.limit).map(({ items, ...l }) => {
                        void items;
                        return l;
                    }),
                    nextCursor: rows.length > q.limit ? rows[q.limit - 1]!.id : null,
                });
            }
            if (path.endsWith('/history')) {
                list();
                return success({ items: data.history[id] ?? [] });
            }
            if (path.startsWith('/api/v1/shopping-lists')) return success(enrich(list()));
            if (path.startsWith('/api/v1/purchases')) return success(purchase().purchase);
            const r = receipt();
            if (path.endsWith('/duplicates'))
                return success({
                    items: data.purchases
                        .filter((p) => p.userId === owner)
                        .sort((a, b) => b.purchase.purchasedAt.localeCompare(a.purchase.purchasedAt))
                        .slice(0, 20)
                        .map((p) => ({
                            purchaseId: p.purchase.purchaseId,
                            purchasedAt: p.purchase.purchasedAt,
                            reason: 'review-required',
                            lineNames: p.purchase.lines.map((l) => l.name),
                            lineCount: p.purchase.lines.length,
                        })),
                });
            return success({ receipt: r });
        }
        if (state.inventory.blocked.includes(user)) throw new Failure(403);
        const route =
            `POST ${path.replace(id || '__none__', '{id}').replace(params.itemId || '__none__', '{itemId}')}` as keyof typeof contracts;
        const schema = contracts[route]?.request;
        if (!schema) throw new Failure(404);
        const parsed = schema.parse(input);
        const v = z.object({ idempotencyKey: z.uuid().optional() }).passthrough().parse(parsed);
        const binding = `${user}:${path}:${v.idempotencyKey ?? ''}`,
            fingerprint = JSON.stringify(parsed);
        if (v.idempotencyKey && data.replay[binding]) {
            const old = data.replay[binding];
            if (old.input !== fingerprint) throw new Failure(409);
            return success(old.result);
        }
        type Line = z.infer<typeof receiptSchema>['lines'][number];
        type RefLine = Pick<
            Line,
            'quantity' | 'unit' | 'ingredientId' | 'productId' | 'locationId' | 'isFood' | 'intake'
        > & { [key: string]: unknown };
        type List = z.infer<typeof listSchema>;
        const normalizeLine = (line: object): Line =>
            receiptSchema.shape.lines.element.parse({
                ...line,
                amountMinor: 'amountMinor' in line ? line.amountMinor : null,
                originalAmountMinor: 'originalAmountMinor' in line ? line.originalAmountMinor : null,
                discountMinor: 'discountMinor' in line ? line.discountMinor : null,
            });
        function refs(l: RefLine, allowOwn = false) {
            if (l.quantity !== null && dec(l.quantity) <= 0n) throw new Failure(400);
            if (allowOwn && l.quantity !== null && !l.unit) throw new Failure(422);
            if (l.intake && (!l.isFood || l.quantity === null || !l.unit || !l.ingredientId || !l.locationId))
                throw new Failure(422);
            if (l.unit && !['g', 'kg', 'ml', 'l', 'pcs', 'pack', 'serv'].includes(l.unit)) throw new Failure(422);
            if (
                l.ingredientId &&
                !state.products.items.some(
                    (p) =>
                        p.product.id === l.ingredientId &&
                        (p.product.status === 'approved' || (allowOwn && p.authorId === user)),
                )
            )
                throw new Failure(422);
            if (
                l.productId &&
                !state.products.items.some(
                    (p) =>
                        (p.product.status === 'approved' || (allowOwn && p.authorId === user)) &&
                        (!l.ingredientId || p.product.id === l.ingredientId) &&
                        p.product.variants.some((v) => v.products.some((s) => s.id === l.productId)),
                )
            )
                throw new Failure(422);
            if (l.locationId && !inventory.locations.some((r) => r.userId === owner && r.location.id === l.locationId))
                throw new Failure(422);
        }
        function preview(body: { version: number; purchasedAt: string; lines: Line[] }, l: List | null) {
            if (
                new Set(body.lines.map((i) => i.id)).size !== body.lines.length ||
                new Set(body.lines.flatMap((i) => (i.shoppingItemId ? [i.shoppingItemId] : []))).size !==
                    body.lines.filter((i) => i.shoppingItemId).length
            )
                throw new Failure(422);
            const rows = body.lines.map((line) => {
                if (line.isFood && !line.ingredientId) throw new Failure(422);
                refs(line);
                let allocatedQuantity: string | null = null,
                    remainingNeed: string | null = null,
                    overage: string | null = null;
                if (line.shoppingItemId) {
                    if (!l) throw new Failure(422);
                    active(l);
                    const item = l.items.find((i) => i.id === line.shoppingItemId);
                    if (!item) throw new Failure(404);
                    if (
                        item.unit !== line.unit ||
                        (!item.allowAnalog && item.productId !== line.productId) ||
                        (item.ingredientId && item.ingredientId !== line.ingredientId)
                    )
                        throw new Failure(422);
                    if (item.quantity !== null && line.quantity !== null) {
                        const need = dec(item.quantity) - dec(item.allocatedQuantity ?? '0'),
                            positive = need > 0n ? need : 0n,
                            actual = dec(line.quantity),
                            allocate = actual < positive ? actual : positive;
                        allocatedQuantity = txt(allocate);
                        remainingNeed = txt(positive - allocate);
                        overage = txt(actual - allocate);
                    }
                }
                return { id: line.id, allocatedQuantity, remainingNeed, overage, intake: line.intake };
            });
            const tokenKey = JSON.stringify({ user, id, body, rows });
            const previewToken = (data.previews[tokenKey] ??= Array.from(
                crypto.getRandomValues(new Uint8Array(32)),
                (n) => n.toString(16).padStart(2, '0'),
            ).join(''));
            return { previewToken, lines: rows };
        }
        function intake(line: Line, at: string) {
            const batch = contracts['GET /api/v1/inventory/{id}'].success.shape.data.shape.batch.parse({
                id: crypto.randomUUID(),
                name: line.name,
                quantity: line.quantity,
                unit: line.unit,
                locationId: line.locationId,
                ingredientId: line.ingredientId,
                version: 1,
                openedAt: null,
                purchasedOn: at.slice(0, 10),
                expiryOn: line.expiryOn,
                packageState: 'unknown',
                precision: 'exact',
                quantitySource: 'receipt',
                confidence: null,
                pricePaidRub: null,
                storeName: null,
                barcode: null,
                scope: requestedScope,
                archivedAt: null,
                createdAt: new Date(now).toISOString(),
            });
            inventory.batches.push({ userId: owner, batch });
            inventory.history.push({
                userId: owner,
                movement: contracts['GET /api/v1/inventory-history'].success.shape.data.shape.items.element.parse({
                    id: crypto.randomUUID(),
                    action: 'purchase',
                    quantityDelta: line.quantity,
                    recordedAt: new Date(now).toISOString(),
                    effectiveAt: at,
                    actorId: user,
                    before: null,
                    after: batch,
                }),
            });
            return batch.id;
        }
        function commit(
            body: { version: number; purchasedAt: string; lines: Line[]; previewToken: string },
            l: List | null,
            receiptId: string | null,
        ) {
            const seen = preview({ version: body.version, purchasedAt: body.purchasedAt, lines: body.lines }, l);
            if (seen.previewToken !== body.previewToken) throw new Failure(409);
            const purchaseId = crypto.randomUUID(),
                batchIds: string[] = [],
                unknownLineIds: string[] = [];
            const lines = body.lines.map((line, index) => {
                const lineId = crypto.randomUUID();
                if (line.quantity === null) unknownLineIds.push(lineId);
                const allocation = seen.lines[index]!;
                if (
                    l &&
                    line.shoppingItemId &&
                    allocation.allocatedQuantity !== null &&
                    dec(allocation.allocatedQuantity) > 0n
                ) {
                    const item = l.items.find((i) => i.id === line.shoppingItemId)!;
                    item.allocatedQuantity = txt(
                        dec(item.allocatedQuantity ?? '0') + dec(allocation.allocatedQuantity),
                    );
                    item.status = allocation.remainingNeed === '0' ? 'purchased' : 'pending';
                    item.version++;
                    data.allocatedLines.push(lineId);
                }
                const batches = line.intake ? [intake(line, body.purchasedAt)] : [];
                batchIds.push(...batches);
                return { ...line, id: lineId, version: 1, batchIds: batches };
            });
            data.purchases.push({
                userId: owner,
                receiptId,
                listId: l?.id ?? null,
                purchase: { purchaseId, version: 1, purchasedAt: body.purchasedAt, lines },
            });
            if (l) l.version++;
            return { purchaseId, batchIds, unknownLineIds };
        }
        let result: unknown;
        if (path === '/api/v1/shopping-lists') {
            const b = contracts['POST /api/v1/shopping-lists'].request.parse(parsed);
            const l = listSchema.parse({
                id: crypto.randomUUID(),
                title: b.title,
                version: 1,
                status: 'active',
                createdAt: new Date(now).toISOString(),
                items: [],
                scope: requestedScope,
            });
            cooking.lists.push({ userId: owner, list: l });
            result = enrich(l);
        } else if (path.startsWith('/api/v1/shopping-lists')) {
            const l = list();
            const action = path.split('/').at(-1);
            if (action === 'command') {
                const b = contracts['POST /api/v1/shopping-lists/{id}/command'].request.parse(parsed);
                check(l.version, b.version);
                if (b.action === 'rename') {
                    if (l.status === 'archived' || !b.title) throw new Failure(409);
                    l.title = b.title;
                } else if (b.action === 'archive') {
                    if (l.status === 'archived') throw new Failure(409);
                    data.archivedFrom[l.id] = l.status;
                    l.status = 'archived';
                } else if (b.action === 'restore') {
                    if (l.status !== 'archived') throw new Failure(409);
                    l.status = data.archivedFrom[l.id] ?? 'active';
                } else {
                    if (l.status === 'archived') throw new Failure(409);
                    l.status = b.action === 'complete' ? 'completed' : 'active';
                }
                l.version++;
                result = enrich(l);
            } else if (action === 'purchase-preview' || action === 'purchase-commit') {
                const b = contracts['POST /api/v1/shopping-lists/{id}/purchase-preview'].request.parse({
                    version: v.version,
                    purchasedAt: v.purchasedAt,
                    lines: v.lines,
                });
                check(l.version, b.version);
                active(l);
                result =
                    action === 'purchase-preview'
                        ? preview(
                              {
                                  version: b.version,
                                  purchasedAt: b.purchasedAt,
                                  lines: b.lines.map(normalizeLine),
                              },
                              l,
                          )
                        : commit(
                              (() => {
                                  const value =
                                      contracts['POST /api/v1/shopping-lists/{id}/purchase-commit'].request.parse(
                                          parsed,
                                      );
                                  return { ...value, lines: value.lines.map(normalizeLine) };
                              })(),
                              l,
                              null,
                          );
            } else if (action === 'reorder') {
                const b = contracts['POST /api/v1/shopping-lists/{id}/reorder'].request.parse(parsed);
                check(l.version, b.version);
                active(l);
                if (
                    b.itemIds.length !== l.items.length ||
                    new Set(b.itemIds).size !== b.itemIds.length ||
                    b.itemIds.some((i) => !l.items.some((j) => j.id === i))
                )
                    throw new Failure(422);
                l.items = b.itemIds.map((id, position) => ({ ...l.items.find((i) => i.id === id)!, position }));
                l.version++;
                result = enrich(l);
            } else if (action === 'items') {
                const b = contracts['POST /api/v1/shopping-lists/{id}/items'].request.parse(parsed);
                check(l.version, b.version);
                active(l);
                for (const fields of b.items) {
                    const normalizedFields = {
                        ...fields,
                        recipeOrigin: fields.recipeOrigin ?? [],
                        requirements: fields.requirements ?? {},
                        estimatedPriceMinor: fields.estimatedPriceMinor ?? null,
                    };
                    refs(
                        {
                            ...normalizedFields,
                            id: crypto.randomUUID(),
                            locationId: null,
                            isFood: true,
                            intake: false,
                            shoppingItemId: null,
                            expiryOn: null,
                        },
                        true,
                    );
                    l.items.push(
                        listSchema.shape.items.element.parse({
                            ...normalizedFields,
                            id: crypto.randomUUID(),
                            version: 1,
                            status: 'pending',
                            position: l.items.length,
                            manual: !(fields.recipeOrigin ?? []).length,
                            origin: fields.recipeOrigin,
                        }),
                    );
                }
                l.version++;
                result = enrich(l);
            } else {
                const b = contracts['POST /api/v1/shopping-lists/{id}/items/{itemId}'].request.parse(parsed);
                active(l);
                const itemIndex = l.items.findIndex((i) => i.id === params.itemId);
                const item = l.items[itemIndex];
                if (!item) throw new Failure(404);
                check(item.version, b.version);
                if (item.allocatedQuantity !== null && dec(item.allocatedQuantity) > 0n) throw new Failure(409);
                refs(
                    {
                        ...b.fields,
                        id: item.id,
                        locationId: null,
                        isFood: true,
                        intake: false,
                        shoppingItemId: null,
                        expiryOn: null,
                    },
                    true,
                );
                const normalizedFields = {
                    ...b.fields,
                    recipeOrigin: b.fields.recipeOrigin ?? [],
                    requirements: b.fields.requirements ?? {},
                    estimatedPriceMinor: b.fields.estimatedPriceMinor ?? null,
                };
                if (item.ingredientId !== b.fields.ingredientId || item.productId !== b.fields.productId) {
                    const replacement =
                        b.status === 'removed'
                            ? []
                            : [
                                  listSchema.shape.items.element.parse({
                                      ...normalizedFields,
                                      id: crypto.randomUUID(),
                                      version: 1,
                                      status: b.status,
                                      position: item.position,
                                  }),
                              ];
                    l.items.splice(itemIndex, 1, ...replacement);
                } else
                    Object.assign(item, normalizedFields, {
                        version: item.version + 1,
                        status: b.status,
                        origin: b.fields.recipeOrigin ?? [],
                    });
                l.items = l.items.filter((i) => i.status !== 'removed');
                l.version++;
                result = enrich(l);
            }
        } else if (path === '/api/v1/receipts') {
            const b = contracts['POST /api/v1/receipts'].request.parse(parsed);
            const access = mockDiaryAccess(state, user, now);
            if ((b.source.kind === 'electronic_link' || b.financial) && access?.mode !== 'active')
                throw new Failure(403);
            if (b.financial) {
                if (requestedScope !== 'private') throw new Failure(422);
                if (
                    b.lines.some((line) => !line.amountMinor || line.amountMinor <= 0) ||
                    b.lines.reduce((sum, line) => sum + (line.amountMinor ?? 0), 0) !== b.financial.totalMinor
                )
                    throw new Failure(422);
            }
            const r = receiptSchema.parse({
                id: crypto.randomUUID(),
                version: 1,
                status: 'draft',
                source: b.source,
                ocrText: b.ocrText,
                lines: b.lines,
                financial: b.financial
                    ? receiptSchema.shape.financial.parse({
                          ...b.financial,
                          consentedAt: new Date(now).toISOString(),
                      })
                    : null,
                result: null,
                history: [{ action: 'created', at: new Date(now).toISOString() }],
            });
            data.receipts.push({ userId: owner, receipt: r });
            result = { receipt: r };
        } else if (path.startsWith('/api/v1/receipts')) {
            const r = receipt();
            const b = z.object({ version: z.number() }).passthrough().parse(parsed);
            check(r.version, b.version);
            draft(r);
            if (path.endsWith('/edit')) {
                const value = contracts['POST /api/v1/receipts/{id}/edit'].request.parse(parsed);
                if ((value.financial ?? r.financial) && mockDiaryAccess(state, user, now)?.mode !== 'active')
                    throw new Failure(403);
                r.lines = value.lines.map(normalizeLine);
                if (value.financial !== undefined)
                    r.financial = value.financial
                        ? receiptSchema.shape.financial.parse({
                              ...value.financial,
                              consentedAt: r.financial?.consentedAt ?? new Date(now).toISOString(),
                          })
                        : null;
                r.version++;
                r.history.push({ action: 'corrected', at: new Date(now).toISOString() });
                result = { receipt: r };
            } else if (path.endsWith('/intake-preview')) {
                const value = contracts['POST /api/v1/receipts/{id}/intake-preview'].request.parse(parsed);
                result = preview(
                    {
                        version: value.version,
                        purchasedAt: value.purchasedAt,
                        lines: value.lines.map(normalizeLine),
                    },
                    null,
                );
            } else if (path.endsWith('/commit')) {
                const value = contracts['POST /api/v1/receipts/{id}/commit'].request.parse(parsed);
                const normalized = { ...value, lines: value.lines.map(normalizeLine) };
                if (r.financial && mockDiaryAccess(state, user, now)?.mode !== 'active') throw new Failure(403);
                if (
                    r.financial &&
                    (normalized.lines.some((line) => !line.amountMinor || line.amountMinor <= 0) ||
                        normalized.lines.reduce((sum, line) => sum + (line.amountMinor ?? 0), 0) !==
                            r.financial.totalMinor)
                )
                    throw new Failure(422);
                r.result = commit(normalized, null, r.id);
                r.lines = normalized.lines;
                if (r.financial) {
                    const createdAt = new Date(now).toISOString();
                    for (const line of normalized.lines) {
                        state.finance.expenses.push({
                            userId: user,
                            expense: contracts[
                                'GET /api/v1/finance/expenses'
                            ].success.shape.data.shape.items.element.parse({
                                id: crypto.randomUUID(),
                                source: 'receipt',
                                category: line.isFood ? 'groceries' : 'other',
                                amountMinor: line.amountMinor,
                                currency: 'RUB',
                                occurredAt: value.purchasedAt,
                                consentedAt: r.financial.consentedAt ?? createdAt,
                                version: 1,
                                createdAt,
                            }),
                        });
                        if (line.isFood && line.ingredientId && line.unit && line.quantity && line.amountMinor)
                            state.finance.observations.push({
                                userId: user,
                                observation: contracts[
                                    'GET /api/v1/finance/prices'
                                ].success.shape.data.shape.items.element.parse({
                                    id: crypto.randomUUID(),
                                    ingredientId: line.ingredientId,
                                    ingredientName: line.name,
                                    unit: line.unit,
                                    quantity: line.quantity,
                                    amountMinor: line.amountMinor,
                                    currency: 'RUB',
                                    observedAt: value.purchasedAt,
                                    source: 'receipt',
                                    consentedAt: r.financial.consentedAt ?? createdAt,
                                    eligibleForAggregate: false,
                                    version: 1,
                                    createdAt,
                                }),
                            });
                    }
                }
                r.status = 'committed';
                r.version++;
                r.history.push({ action: 'committed', at: new Date(now).toISOString() });
                result = { receipt: r };
            } else {
                const link = contracts['POST /api/v1/receipts/{id}/link-purchase'].request.parse(parsed);
                const p = data.purchases.find((p) => p.userId === owner && p.purchase.purchaseId === link.purchaseId);
                if (!p) throw new Failure(404);
                if (!p.receiptId) {
                    p.receiptId = r.id;
                    p.purchase.version++;
                }
                r.result = {
                    purchaseId: p.purchase.purchaseId,
                    batchIds: p.purchase.lines.flatMap((l) => l.batchIds),
                    unknownLineIds: p.purchase.lines.filter((l) => l.quantity === null).map((l) => l.id),
                };
                r.status = 'linked';
                r.version++;
                r.history.push({ action: 'linked-existing-purchase', at: new Date(now).toISOString() });
                result = { receipt: r };
            }
        } else {
            const p = purchase();
            const b = contracts['POST /api/v1/purchases/{id}/resolve-preview'].request.parse({
                version: v.version,
                line: v.line,
            });
            const line = p.purchase.lines.find((l) => l.id === b.line.id);
            if (!line) throw new Failure(404);
            check(line.version, b.version);
            if (line.intake || line.batchIds.length) throw new Failure(409);
            if (line.quantity !== null) throw new Failure(409);
            if (line.unit !== null && line.unit !== b.line.unit) throw new Failure(422);
            if (
                line.ingredientId !== b.line.ingredientId ||
                line.productId !== b.line.productId ||
                line.shoppingItemId !== b.line.shoppingItemId
            )
                throw new Failure(422);
            const normalizedLine = normalizeLine(b.line);
            refs(normalizedLine);
            if (b.line.quantity === null || !b.line.intake) throw new Failure(422);
            const targetList = cooking.lists.find(
                (r) =>
                    r.userId === owner &&
                    r.list.status === 'active' &&
                    r.list.items.some((i) => i.id === line.shoppingItemId && i.status !== 'removed'),
            )?.list;
            const allocatable = !!targetList && !data.allocatedLines.includes(line.id);
            const review = preview(
                {
                    version: b.version,
                    purchasedAt: p.purchase.purchasedAt,
                    lines: [
                        {
                            ...normalizedLine,
                            shoppingItemId: allocatable ? normalizedLine.shoppingItemId : null,
                        },
                    ],
                },
                allocatable ? targetList : null,
            );
            const previewToken = review.previewToken;
            if (path.endsWith('/resolve-preview')) result = review;
            else {
                const value = contracts['POST /api/v1/purchases/{id}/resolve-commit'].request.parse(parsed);
                if (value.previewToken !== previewToken) throw new Failure(409);
                const batchIds = normalizedLine.intake ? [intake(normalizedLine, p.purchase.purchasedAt)] : [];
                Object.assign(line, normalizedLine, { version: line.version + 1, batchIds });
                const allocation = review.lines[0]!;
                if (allocatable && allocation.allocatedQuantity !== null && dec(allocation.allocatedQuantity) > 0n) {
                    const item = targetList.items.find((i) => i.id === line.shoppingItemId)!;
                    item.allocatedQuantity = txt(
                        dec(item.allocatedQuantity ?? '0') + dec(allocation.allocatedQuantity),
                    );
                    item.status = allocation.remainingNeed === '0' ? 'purchased' : 'pending';
                    item.version++;
                    targetList.version++;
                    data.allocatedLines.push(line.id);
                }
                p.purchase.version++;
                result = p.purchase;
            }
        }
        if (path.startsWith('/api/v1/shopping-lists') && v.idempotencyKey) {
            const listId =
                path === '/api/v1/shopping-lists'
                    ? typeof result === 'object' && result && 'id' in result
                        ? String(result.id)
                        : ''
                    : id;
            if (listId)
                (data.history[listId] ??= []).unshift({
                    id: crypto.randomUUID(),
                    action: path.endsWith('/command')
                        ? `shopping.${String((parsed as { action?: string }).action ?? 'updated')}`
                        : path.endsWith('/reorder')
                          ? 'shopping.reordered'
                          : path.endsWith('/purchase-commit')
                            ? 'shopping.purchase-committed'
                            : path.includes('/items')
                              ? 'shopping.items-updated'
                              : 'shopping.created',
                    actorId: user,
                    actorLogin: fixture.users.find((item) => item.id === user)?.login ?? null,
                    at: new Date(now).toISOString(),
                });
        }
        if (v.idempotencyKey) data.replay[binding] = { input: fingerprint, result: structuredClone(result) };
        state.shoppingReceipts = data;
        state.cookingWorkflow = cooking;
        state.inventory = inventory;
        return success(result);
    } catch (e) {
        if (e instanceof z.ZodError) return fail(400);
        if (e instanceof Failure) return fail(e.status);
        throw e;
    }
}
