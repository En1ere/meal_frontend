import { z } from 'zod';
import type { MockState } from './model.js';
import { publicRecipeFixtures, recipeSummary } from './recipe-fixtures.js';
import { hasConsent } from './legal.js';

const cursorSchema = z.object({ scope: z.string(), at: z.string(), id: z.string() }).strict();
const encode = (scope: string, at: string, id: string) => btoa(encodeURIComponent(JSON.stringify({ scope, at, id })));
export function communityHandle(c: {
    state: MockState;
    userId: string | null;
    path: string;
    params: Record<string, string>;
    method: string;
    query: URLSearchParams;
    success: (data: unknown) => Response;
    fail: (status: number) => Response;
}): Response | null {
    const { state, userId, path, params, method, query, success, fail } = c;
    const feed = path === '/api/v1/community';
    const comments = /^\/api\/v1\/community\/recipes\/[^/]+\/comments$/.test(path);
    const following = path === '/api/v1/profile/following';
    const follow = /^\/api\/v1\/authors\/[^/]+\/follow$/.test(path) && method === 'GET';
    if (!feed && !comments && !following && !follow) return null;
    if (method !== 'GET') return fail(404);
    if ((following || follow) && !userId) return fail(401);
    const recipes = publicRecipeFixtures().filter((recipe) => {
        const author = state.users.find((candidate) => candidate.login === recipe.authorLogin);
        return (
            !state.recipeWorkspace.hidden.includes(recipe.id) &&
            !state.recipeWorkspace.recipes.some((row) => row.recipe.id === recipe.id && row.recipe.archived) &&
            (!author || hasConsent(state.legal, author.id, 'dissemination'))
        );
    });
    if (follow) {
        const author = state.users.find(
            (user) => user.login.toLowerCase() === params.username?.toLowerCase() && user.active && user.verified,
        );
        if (!author || !hasConsent(state.legal, author.id, 'dissemination')) return fail(404);
        return success({
            username: author.login,
            following: state.recommendations.follows.some(
                (row) => row.followerId === userId && row.authorId === author.id,
            ),
        });
    }
    const parsed = z
        .object({
            q: z.string().trim().max(200).default(''),
            category: z.string().max(100).optional(),
            author: z.string().max(256).optional(),
            sort: z.enum(['newest', 'oldest']).default('newest'),
            limit: z.coerce.number().int().min(1).max(100).default(20),
            cursor: z.string().max(4096).optional(),
        })
        .strict()
        .safeParse(Object.fromEntries(query));
    if (!parsed.success) return fail(400);
    const input = parsed.data;
    const scope = JSON.stringify([
        path,
        input.q,
        input.category ?? '',
        input.author ?? '',
        input.sort,
        following ? userId : null,
    ]);
    let cursor: z.infer<typeof cursorSchema> | null = null;
    if (input.cursor) {
        try {
            cursor = cursorSchema.parse(JSON.parse(decodeURIComponent(atob(input.cursor))));
        } catch {
            return fail(400);
        }
        if (cursor.scope !== scope) return fail(400);
    }
    const page = <T>(rows: Array<{ id: string; at: string; item: T }>, descending: boolean) => {
        const compare = (a: { at: string; id: string }, b: { at: string; id: string }) =>
            (a.at.localeCompare(b.at) || a.id.localeCompare(b.id)) * (descending ? -1 : 1);
        const filtered = rows.sort(compare).filter((row) => !cursor || compare(row, cursor) > 0);
        const selected = filtered.slice(0, input.limit);
        const last = selected.at(-1);
        return success({
            items: selected.map((row) => row.item),
            nextCursor: filtered.length > input.limit && last ? encode(scope, last.at, last.id) : null,
        });
    };
    if (feed)
        return page(
            recipes
                .filter(
                    (recipe) =>
                        `${recipe.title} ${recipe.description ?? ''}`.toLowerCase().includes(input.q.toLowerCase()) &&
                        (!input.category || recipe.category === input.category) &&
                        (!input.author || recipe.authorLogin?.toLowerCase() === input.author.toLowerCase()),
                )
                .map((recipe) => ({
                    id: recipe.id,
                    at: recipe.publishedAt ?? '',
                    item: { ...recipeSummary(recipe), availability: null },
                })),
            input.sort === 'newest',
        );
    if (comments) {
        const recipe = recipes.find((recipe) => recipe.id === params.id);
        if (!recipe) return fail(404);
        const stored = state.recipeWorkspace.comments
            .filter((row) => {
                const author = state.users.find((candidate) => candidate.id === row.userId);
                return (
                    row.recipeId === recipe.id &&
                    !row.removed &&
                    hasConsent(state.legal, author?.id ?? null, 'dissemination')
                );
            })
            .map((row) => ({
                id: row.id,
                body: row.body,
                authorLogin: row.authorLogin,
                createdAt: row.createdAt,
                edited: !!row.editedAt,
                replyToId: row.replyToId,
            }));
        const items = [
            ...recipe.comments.filter((item) => {
                const author = state.users.find((candidate) => candidate.login === item.authorLogin);
                return (
                    !state.recipeWorkspace.comments.some((row) => row.id === item.id) &&
                    (!author || hasConsent(state.legal, author.id, 'dissemination'))
                );
            }),
            ...stored,
        ];
        return page(
            items.map((item) => ({ id: item.id, at: item.createdAt, item })),
            false,
        );
    }
    return page(
        state.recommendations.follows
            .filter((row) => row.followerId === userId)
            .flatMap((row) => {
                const author = state.users.find((user) => user.id === row.authorId && user.active && user.verified);
                return author && hasConsent(state.legal, author.id, 'dissemination')
                    ? [
                          {
                              id: row.authorId,
                              at: row.createdAt,
                              item: {
                                  username: author.login,
                                  avatarUrl: null,
                                  recipeCount: recipes.filter((recipe) => recipe.authorLogin === author.login).length,
                                  following: true,
                              },
                          },
                      ]
                    : [];
            }),
        true,
    );
}
