import { z } from 'zod';
import type { MockState } from './model.js';
export const newsReadsSchema = z.record(z.string(), z.string());
export type NewsReads = z.infer<typeof newsReadsSchema>;
// Explicit standalone demo publication. Admin and user mock stores are separate apps.
const item = {
    id: '73000000-0000-4000-8000-000000000002',
    type: 'important' as const,
    title: 'Демонстрационное объявление о семейном меню',
    publishedAt: '2026-10-06T00:00:00.000Z',
    pages: [
        {
            blocks: [
                {
                    kind: 'text' as const,
                    text: 'Это демонстрационный материал для проверки чтения новостей. Он не является реальной рассылкой.',
                },
            ],
        },
        {
            blocks: [
                {
                    kind: 'text' as const,
                    text: 'Закрытие объявления не означает согласия и не отмечает его прочитанным. Для этого предусмотрено отдельное действие.',
                },
            ],
        },
    ],
};
export function newsHandle(c: {
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
}): Response | null {
    const { state, userId, path, params, method, query, input, now, success, fail } = c;
    if (path !== '/api/v1/news' && !path.startsWith('/api/v1/news/')) return null;
    if (path === '/api/v1/news' && method === 'GET') {
        const parsed = z
            .object({ cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(20) })
            .strict()
            .safeParse(Object.fromEntries(query));
        if (!parsed.success || parsed.data.cursor) return fail(400);
        return success({
            items: [
                {
                    id: item.id,
                    type: item.type,
                    title: item.title,
                    publishedAt: item.publishedAt,
                    coverImage: null,
                    pageCount: item.pages.length,
                },
            ],
            nextCursor: null,
        });
    }
    if (params.id !== item.id) return fail(404);
    const key = `${userId}:${item.id}`;
    if (method === 'GET')
        return success({
            ...item,
            coverImage: null,
            pageCount: item.pages.length,
            readAt: userId ? (state.newsReads[key] ?? null) : null,
        });
    if (method === 'POST' && path.endsWith('/read')) {
        if (!userId) return fail(401);
        if (!z.object({ idempotencyKey: z.uuid() }).strict().safeParse(input).success) return fail(400);
        state.newsReads[key] ??= new Date(now).toISOString();
        return success({ id: item.id, readAt: state.newsReads[key] });
    }
    return fail(404);
}
