import { z } from 'zod';
import type { MockState } from './model.js';
import { hasConsent } from './legal.js';
import { publicRecipeFixtures } from './recipe-fixtures.js';

type SearchType = 'product' | 'recipe' | 'brand' | 'store';

const querySchema = z
    .object({
        type: z.enum(['product', 'recipe', 'brand', 'store']),
        q: z.string().trim().min(1).max(200),
        limit: z.coerce.number().int().min(1).max(50).default(20),
        cursor: z.string().max(2000).regex(/^\d+$/).optional(),
    })
    .strict();

const normalize = (value: string) => value.toLocaleLowerCase('ru-RU').replaceAll('ё', 'е');
const matches = (query: string, ...values: (string | null | undefined)[]) =>
    values.some((value) => value && normalize(value).includes(query));

function page<T>(type: SearchType, items: T[], limit: number, cursor: string | undefined) {
    const offset = cursor ? Number(cursor) : 0;
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > items.length) return null;
    const nextOffset = offset + limit;
    return {
        type,
        items: items.slice(offset, nextOffset),
        nextCursor: nextOffset < items.length ? String(nextOffset) : null,
    };
}

export function searchHandle(c: {
    state: MockState;
    userId: string | null;
    path: string;
    method: string;
    query: URLSearchParams;
    success: (data: unknown) => Response;
    fail: (status: number, code?: string) => Response;
}): Response | null {
    const { state, userId, path, method, query, success, fail } = c;
    if (path !== '/api/v1/search') return null;
    if (method !== 'GET') return fail(404);
    if (!userId) return fail(401);
    const parsed = querySchema.safeParse(Object.fromEntries(query));
    if (!parsed.success) return fail(400);
    const { type, limit, cursor } = parsed.data;
    const q = normalize(parsed.data.q);
    const visibleProducts = state.products.items.filter(
        (row) => row.product.status === 'approved' || row.authorId === userId,
    );

    if (type === 'product') {
        const items = visibleProducts
            .map((row) => row.product)
            .filter((product) => matches(q, product.name, ...product.aliases))
            .sort((left, right) => left.name.localeCompare(right.name, 'ru') || left.id.localeCompare(right.id))
            .map(({ id, name, categoryCode, defaultUnit, status }) => ({
                type: 'product' as const,
                id,
                name,
                categoryCode,
                defaultUnit,
                status,
            }));
        const result = page(type, items, limit, cursor);
        return result ? success(result) : fail(400);
    }

    if (type === 'recipe') {
        const hidden = new Set(state.recipeWorkspace.hidden);
        const items = publicRecipeFixtures()
            .filter((recipe) => {
                const author = state.users.find((candidate) => candidate.login === recipe.authorLogin);
                return (
                    !hidden.has(recipe.id) &&
                    (!author || hasConsent(state.legal, author.id, 'dissemination')) &&
                    matches(q, recipe.title, recipe.description, recipe.authorLogin, recipe.category, ...recipe.tags)
                );
            })
            .sort((left, right) => left.title.localeCompare(right.title, 'ru') || left.id.localeCompare(right.id))
            .map((recipe) => ({
                type: 'recipe' as const,
                id: recipe.id,
                title: recipe.title,
                description: recipe.description,
                imageUrl: recipe.imageUrl,
                authorLogin: recipe.authorLogin,
                category: recipe.category,
                durationMinutes: recipe.durationMinutes,
                rating: recipe.rating,
                ratingCount: recipe.ratingCount,
            }));
        const result = page(type, items, limit, cursor);
        return result ? success(result) : fail(400);
    }

    if (type === 'brand') {
        const brands = new Map<string, { id: string; name: string; products: Set<string> }>();
        for (const row of visibleProducts)
            for (const variant of row.product.variants)
                for (const product of variant.products) {
                    const name = product.brand?.trim();
                    if (!name) continue;
                    const key = normalize(name);
                    const existing = brands.get(key);
                    if (existing) existing.products.add(row.product.id);
                    else brands.set(key, { id: product.id, name, products: new Set([row.product.id]) });
                }
        const items = [...brands.values()]
            .filter((brand) => matches(q, brand.name))
            .sort((left, right) => left.name.localeCompare(right.name, 'ru') || left.id.localeCompare(right.id))
            .map((brand) => ({
                type: 'brand' as const,
                id: brand.id,
                name: brand.name,
                productCount: brand.products.size,
            }));
        const result = page(type, items, limit, cursor);
        return result ? success(result) : fail(400);
    }

    const stores = new Map<string, { id: string; name: string }>();
    for (const row of state.inventory.batches) {
        if (row.userId !== userId) continue;
        const name = row.batch.storeName?.trim();
        if (!name) continue;
        const key = normalize(name);
        if (!stores.has(key)) stores.set(key, { id: row.batch.id, name });
    }
    const items = [...stores.values()]
        .filter((store) => matches(q, store.name))
        .sort((left, right) => left.name.localeCompare(right.name, 'ru') || left.id.localeCompare(right.id))
        .map((store) => ({ type: 'store' as const, ...store }));
    const result = page(type, items, limit, cursor);
    return result ? success(result) : fail(400);
}
