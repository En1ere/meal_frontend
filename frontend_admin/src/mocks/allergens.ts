import { z } from 'zod';
import { contracts } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';
import { allergenAsset } from './allergen-assets.js';

const iconSchema = z.object({
    state: z.enum(['fallback', 'custom', 'unavailable']),
    url: z.string().nullable(),
    fallbackKey: z.string(),
    alt: z.string(),
});
const mappingSchema = z.object({
    id: z.uuid(),
    subjectType: z.enum(['ingredient', 'variant', 'product']),
    subjectId: z.uuid(),
    subjectName: z.string(),
    status: z.enum(['contains', 'may_contain', 'unknown']),
    source: z.string(),
    version: z.number().int().positive(),
});
const itemSchema = z.object({
    code: z.string(),
    name: z.string(),
    version: z.number().int().positive(),
    icon: iconSchema,
    mappings: z.array(mappingSchema),
});
export const allergensStateSchema = z.object({ items: z.array(itemSchema), replay: z.record(z.string(), z.string()) });
export type AllergensState = z.infer<typeof allergensStateSchema>;
const uuid = (group: number, value: number) => `${group}0000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const definitions = [
    ['milk', 'Молоко'],
    ['egg', 'Яйца'],
    ['fish', 'Рыба'],
    ['shellfish', 'Ракообразные'],
    ['tree_nuts', 'Орехи'],
    ['peanut', 'Арахис'],
    ['gluten', 'Глютен'],
    ['soy', 'Соя'],
    ['sesame', 'Кунжут'],
    ['celery', 'Сельдерей'],
    ['mustard', 'Горчица'],
    ['lupin', 'Люпин'],
    ['molluscs', 'Моллюски'],
    ['sulfites', 'Сульфиты'],
] as const;
const raster = new Set(['milk', 'egg', 'fish', 'shellfish', 'tree_nuts', 'peanut', 'gluten', 'soy']);
const iconName = (code: string) => (code === 'tree_nuts' ? 'tree-nuts' : raster.has(code) ? code : 'unknown');
export function createAllergensState(): AllergensState {
    return {
        replay: {},
        items: definitions.map(([code, name], index) => ({
            code,
            name,
            version: 1,
            icon: {
                state: 'fallback',
                url: `/assets/allergens/${iconName(code)}.png`,
                fallbackKey: raster.has(code) ? `allergen-${code}` : 'allergen-unknown',
                alt: `Пиктограмма: ${name}`,
            },
            mappings:
                index < 8
                    ? [
                          {
                              id: uuid(3, index * 10 + 1),
                              subjectType: 'ingredient',
                              subjectId: uuid(1, index * 10 + 1),
                              subjectName: [
                                  'Молоко',
                                  'Яичный порошок',
                                  'Лосось',
                                  'Креветки',
                                  'Миндаль',
                                  'Арахисовая паста',
                                  'Пшеничная мука',
                                  'Соевый соус',
                              ][index]!,
                              status: 'contains',
                              source: 'Демонстрационный словарь',
                              version: 1,
                          },
                          {
                              id: uuid(3, index * 10 + 2),
                              subjectType: 'product',
                              subjectId: uuid(2, index * 10 + 2),
                              subjectName: [
                                  'Сыр',
                                  'Майонез',
                                  'Рыбный соус',
                                  'Морской коктейль',
                                  'Печенье',
                                  'Шоколад',
                                  'Паста',
                                  'Тофу',
                              ][index]!,
                              status: index % 3 === 0 ? 'may_contain' : 'contains',
                              source: 'Маркировка продукта',
                              version: 1,
                          },
                      ]
                    : [],
        })),
    };
}
const counts = (item: AllergensState['items'][number]) => ({
    activeMappings: item.mappings.length,
    ingredientMappings: item.mappings.filter((mapping) => mapping.subjectType === 'ingredient').length,
    variantMappings: item.mappings.filter((mapping) => mapping.subjectType === 'variant').length,
    productMappings: item.mappings.filter((mapping) => mapping.subjectType === 'product').length,
});
const detail = (item: AllergensState['items'][number]) => ({
    ...item,
    ...counts(item),
    iconUpload: {
        mode: 'unavailable' as const,
        reason: 'В рабочем режиме загрузка недоступна до подключения хранилища и антивирусной проверки.',
    },
});
const subjects = () =>
    createAllergensState().items.flatMap((item, index) => [
        ...item.mappings.map((mapping) => ({
            subjectType: mapping.subjectType,
            subjectId: mapping.subjectId,
            subjectName: mapping.subjectName,
            imageUrl: null,
        })),
        {
            subjectType: 'variant' as const,
            subjectId: uuid(4, index + 1),
            subjectName: `${item.name} · стандартный вариант`,
            imageUrl: null,
        },
    ]);

export function allergensHandle(c: {
    state: MockState;
    path: string;
    params: Record<string, string>;
    method: string;
    query: URLSearchParams;
    input: unknown;
    success: (data: unknown) => Response;
    fail: (status: number) => Response;
}): Response | null {
    const { state, path, params, method, query, input, success, fail } = c;
    if (path !== '/api/v1/admin/allergens' && !path.startsWith('/api/v1/admin/allergens/')) return null;
    if (path === '/api/v1/admin/allergens/subjects' && method === 'GET') {
        const parsed = z
            .object({
                subjectType: z.enum(['ingredient', 'variant', 'product']),
                q: z.string().trim().max(100).default(''),
                limit: z.coerce.number().int().min(1).max(100).default(20),
            })
            .strict()
            .safeParse(Object.fromEntries(query));
        if (!parsed.success) return fail(400);
        return success({
            items: subjects()
                .filter(
                    (item) =>
                        item.subjectType === parsed.data.subjectType &&
                        item.subjectName.toLocaleLowerCase('ru').includes(parsed.data.q.toLocaleLowerCase('ru')),
                )
                .slice(0, parsed.data.limit),
        });
    }
    if (path === '/api/v1/admin/allergens' && method === 'GET') {
        const parsed = z
            .object({
                q: z.string().default(''),
                limit: z.coerce.number().int().min(1).max(100).default(50),
                offset: z.coerce.number().int().min(0).default(0),
            })
            .safeParse(Object.fromEntries(query));
        if (!parsed.success) return fail(400);
        const q = parsed.data.q.toLocaleLowerCase('ru');
        const matches = state.allergens.items.filter((item) =>
            `${item.code} ${item.name}`.toLocaleLowerCase('ru').includes(q),
        );
        return success({
            items: matches.slice(parsed.data.offset, parsed.data.offset + parsed.data.limit).map((item) => ({
                code: item.code,
                name: item.name,
                version: item.version,
                ...counts(item),
                icon: item.icon,
            })),
            total: matches.length,
            limit: parsed.data.limit,
            offset: parsed.data.offset,
        });
    }
    const item = state.allergens.items.find((entry) => entry.code === params.code);
    if (!item) return fail(404);
    if (method === 'GET') return success(detail(item));
    const replayKey = (key: string) => `${item.code}:${path}:${key}`;
    const replay = (body: { idempotencyKey: string; expectedVersion: number }, run: () => void) => {
        const encoded = JSON.stringify(input),
            previous = state.allergens.replay[replayKey(body.idempotencyKey)];
        if (previous) return previous === encoded ? success(detail(item)) : fail(409);
        if (body.expectedVersion !== item.version) return fail(409);
        run();
        item.version++;
        state.allergens.replay[replayKey(body.idempotencyKey)] = encoded;
        return success(detail(item));
    };
    if (path.endsWith('/mappings') && method === 'POST') {
        const parsed = contracts['POST /api/v1/admin/allergens/{code}/mappings'].request.safeParse(input);
        if (!parsed.success) return fail(400);
        const subject = subjects().find(
            (entry) => entry.subjectType === parsed.data.subjectType && entry.subjectId === parsed.data.subjectId,
        );
        if (!state.allergens.replay[replayKey(parsed.data.idempotencyKey)]) {
            if (parsed.data.action === 'add' && !subject) return fail(404);
            if (
                parsed.data.action === 'add' &&
                item.mappings.some(
                    (entry) =>
                        entry.subjectType === parsed.data.subjectType && entry.subjectId === parsed.data.subjectId,
                )
            )
                return fail(409);
            if (parsed.data.action === 'remove' && !item.mappings.some((entry) => entry.id === parsed.data.mappingId))
                return fail(404);
        }
        return replay(parsed.data, () => {
            if (parsed.data.action === 'remove')
                item.mappings = item.mappings.filter((entry) => entry.id !== parsed.data.mappingId);
            else
                item.mappings.push({
                    id: crypto.randomUUID(),
                    subjectType: parsed.data.subjectType,
                    subjectId: parsed.data.subjectId,
                    subjectName: subject!.subjectName,
                    status: parsed.data.status ?? 'contains',
                    source: parsed.data.source,
                    version: 1,
                });
        });
    }
    if (path.endsWith('/icon') && method === 'PUT') {
        const parsed = contracts['PUT /api/v1/admin/allergens/{code}/icon'].request.safeParse(input);
        if (!parsed.success) return fail(400);
        return replay(parsed.data, () => {
            item.icon =
                parsed.data.action === 'remove'
                    ? {
                          state: 'fallback',
                          url: `/assets/allergens/${iconName(item.code)}.png`,
                          fallbackKey: raster.has(item.code) ? `allergen-${item.code}` : 'allergen-unknown',
                          alt: parsed.data.altText,
                      }
                    : {
                          state: 'fallback',
                          url: `/assets/allergens/${iconName(item.code)}.png`,
                          fallbackKey: parsed.data.fallbackKey,
                          alt: parsed.data.altText,
                      };
        });
    }
    if (path.endsWith('/icon/upload') && method === 'POST') {
        const parsed = contracts['POST /api/v1/admin/allergens/{code}/icon/upload'].request.safeParse(input);
        if (!parsed.success) return fail(400);
        return replay(parsed.data, () => {
            item.icon = {
                state: 'custom',
                url: allergenAsset(parsed.data.checksumSha256) ?? `/assets/allergens/${iconName(item.code)}.png`,
                fallbackKey: item.icon.fallbackKey,
                alt: parsed.data.altText,
            };
        });
    }
    return fail(404);
}
