import { z } from 'zod';
import { contracts } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';
const detailSchema = contracts['GET /api/v1/products/{id}'].success.shape.data.shape.product;
export const productsStateSchema = z.object({
    items: z.array(z.object({ authorId: z.string().nullable(), product: detailSchema })),
    replay: z.record(z.string(), z.object({ input: z.string(), id: z.string() })),
});
export type ProductsState = z.infer<typeof productsStateSchema>;
export const reference = {
    categories: [
        { id: '20000000-0000-4000-8000-000000000001', code: 'milk', name: 'Молочные продукты' },
        { id: '20000000-0000-4000-8000-000000000002', code: 'fruit', name: 'Фрукты' },
        { id: '20000000-0000-4000-8000-000000000003', code: 'grain', name: 'Крупы' },
    ],
    allergens: [
        { code: 'milk', name: 'Молоко' },
        { code: 'gluten', name: 'Глютен' },
        { code: 'nuts', name: 'Орехи' },
    ],
};
export function createProductsState(): ProductsState {
    return {
        items: ['Молоко 2,5%', 'Яблоки', 'Рис'].map((name, index) => ({
            authorId: null,
            product: {
                id: `10000000-0000-4000-8000-00000000000${index + 1}`,
                name,
                categoryCode: reference.categories[index]!.code,
                defaultUnit: index === 0 ? 'ml' : 'g',
                status: 'approved',
                owned: false,
                version: 1,
                aliases: index === 0 ? ['молоко пастеризованное'] : [],
                nutrition:
                    index === 0
                        ? {
                              kcal: '52',
                              protein: '3',
                              fat: '2.5',
                              carbs: '4.7',
                              basisQuantity: '100',
                              basisUnit: 'ml',
                              source: 'catalog',
                              confidence: null,
                              compositionText: 'Молоко нормализованное',
                          }
                        : null,
                allergens: index === 0 ? [{ code: 'milk', name: 'Молоко', status: 'contains', source: 'catalog' }] : [],
                variants: [],
                provenance: 'Демонстрационный каталог',
                proposalId: null,
            },
        })),
        replay: {},
    };
}
export const canUseProduct = (state: MockState, userId: string, id: string) =>
    state.products.items.some((row) => row.product.id === id && (row.authorId === null || row.authorId === userId));
function barcodeValid(code: string) {
    if (![8, 12, 13, 14].includes(code.length) || !/^\d+$/.test(code)) return false;
    let sum = 0;
    for (let i = code.length - 2, w = 3; i >= 0; i--, w = 4 - w) sum += Number(code[i]) * w;
    return (10 - (sum % 10)) % 10 === Number(code.at(-1));
}
export function productsHandle(c: {
    state: MockState;
    userId: string;
    path: string;
    params: Record<string, string>;
    method: string;
    query: URLSearchParams;
    input: unknown;
    success: (data: unknown) => Response;
    fail: (status: number, code?: string) => Response;
}): Response | null {
    const { state, userId, path, method, query, input, success, fail } = c;
    if (!path.startsWith('/api/v1/products')) return null;
    if (path === '/api/v1/products/reference' && method === 'GET') return success(reference);
    const allowed = state.products.items.filter((row) => row.authorId === null || row.authorId === userId);
    if (path === '/api/v1/products' && method === 'GET') {
        const parsed = z
            .object({
                q: z.string().trim().max(200).default(''),
                limit: z.coerce.number().int().min(1).max(100).default(20),
                offset: z.coerce.number().int().min(0).max(100000).default(0),
                barcode: z
                    .string()
                    .regex(/^\d{8,14}$/)
                    .optional(),
            })
            .strict()
            .safeParse(Object.fromEntries(query));
        if (!parsed.success) return fail(400);
        const { limit, offset, barcode: code } = parsed.data;
        const q = parsed.data.q.toLocaleLowerCase('ru');
        if (code && !barcodeValid(code)) return fail(400);
        const items = allowed
            .map((r) => r.product)
            .filter(
                (p) =>
                    [p.name, ...p.aliases].some((n) => n.toLocaleLowerCase('ru').includes(q)) &&
                    (!code || p.variants.some((v) => v.products.some((s) => s.barcodes.includes(code)))),
            )
            .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
        return success({
            items: items
                .slice(offset, offset + limit)
                .map(({ id, name, categoryCode, defaultUnit, status, owned }) => ({
                    id,
                    name,
                    categoryCode,
                    defaultUnit,
                    status,
                    owned,
                })),
            total: items.length,
            limit,
            offset,
        });
    }
    if (path === '/api/v1/products/proposals' && method === 'POST') {
        if (state.inventory.blocked.includes(userId)) return fail(403);
        const parsed = contracts['POST /api/v1/products/proposals'].request.safeParse(input);
        if (!parsed.success) return fail(400);
        const x = { ...parsed.data, source: parsed.data.source ?? 'user', sourceText: parsed.data.sourceText ?? null };
        if ((x.barcode && !barcodeValid(x.barcode)) || (x.packageQuantity !== null && !/[1-9]/.test(x.packageQuantity)))
            return fail(400);
        if (new Set(x.allergens.map((a) => a.code)).size !== x.allergens.length) return fail(400);
        const category = reference.categories.find((c) => c.id === x.categoryId);
        if (!category || x.allergens.some((a) => !reference.allergens.some((r) => r.code === a.code))) return fail(400);
        const key = userId + ':' + x.idempotencyKey,
            serialized = JSON.stringify(x),
            prior = state.products.replay[key];
        if (prior) {
            if (prior.input !== serialized) return fail(409);
            const product = allowed.find((r) => r.product.id === prior.id)?.product;
            return product ? success({ product }) : fail(404);
        }
        if (
            x.barcode &&
            state.products.items.some((r) =>
                r.product.variants.some((v) => v.products.some((p) => p.barcodes.includes(x.barcode!))),
            )
        )
            return fail(409);
        const id = crypto.randomUUID();
        const product = detailSchema.parse({
            id,
            name: x.name,
            categoryCode: category.code,
            defaultUnit: x.unit,
            status: 'pending',
            owned: true,
            version: 1,
            aliases: [],
            nutrition: null,
            allergens: [],
            variants: [
                {
                    id: crypto.randomUUID(),
                    name: x.name,
                    products: [
                        {
                            id: crypto.randomUUID(),
                            name: x.name,
                            brand: x.brand,
                            packageQuantity: x.packageQuantity,
                            packageUnit: x.unit,
                            barcodes: x.barcode ? [x.barcode] : [],
                            nutrition: {
                                kcal: x.kcal,
                                protein: x.protein,
                                fat: x.fat,
                                carbs: x.carbs,
                                basisQuantity: '100',
                                basisUnit: x.nutritionBasisUnit,
                                source: x.source,
                                confidence: null,
                                compositionText: x.compositionText,
                            },
                            allergens: x.allergens.map((a) => ({
                                ...a,
                                name: reference.allergens.find((r) => r.code === a.code)!.name,
                                source: x.source,
                            })),
                        },
                    ],
                },
            ],
            provenance: 'Предложено вами; ожидает модерации',
            proposalId: crypto.randomUUID(),
        });
        state.products.items.push({ authorId: userId, product });
        state.products.replay[key] = { input: serialized, id };
        return success({ product });
    }
    const product = allowed.find((row) => row.product.id === c.params.id)?.product;
    return method === 'GET' && product ? success({ product }) : fail(404);
}
