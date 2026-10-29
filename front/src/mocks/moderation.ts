import { z } from 'zod';
import type { Principal } from '../shared/api/contracts.generated.js';

const queueSchema = z.enum(['recipes', 'recipe_variants', 'products', 'reports', 'support', 'authorship']);
const itemSchema = z.strictObject({
    id: z.uuid(),
    queue: queueSchema,
    title: z.string(),
    status: z.string(),
    assignment: z.enum(['unassigned', 'mine', 'other']),
    priority: z.enum(['normal', 'high', 'critical']),
    dueAt: z.iso.datetime().nullable(),
    version: z.number().int().positive(),
    publicContent: z.string(),
    originalContent: z.string(),
    context: z.array(z.string()),
    signals: z.array(z.string()),
});
const supportSchema = z.strictObject({
    id: z.uuid(),
    version: z.number().int().positive(),
    subject: z.string(),
    status: z.string(),
    category: z.string(),
    assignment: z.enum(['unassigned', 'mine', 'other']),
    messages: z.array(
        z.strictObject({
            id: z.uuid(),
            author: z.enum(['user', 'support']),
            body: z.string(),
            createdAt: z.iso.datetime(),
        }),
    ),
});
export const moderationStateSchema = z.strictObject({ items: z.array(itemSchema), support: z.array(supportSchema) });
export type ModerationState = z.infer<typeof moderationStateSchema>;

const ids = {
    recipe: 'c1000000-0000-4000-8000-000000000001',
    variant: 'c1000000-0000-4000-8000-000000000002',
    product: 'c1000000-0000-4000-8000-000000000003',
    report: 'c1000000-0000-4000-8000-000000000004',
    authorship: 'c1000000-0000-4000-8000-000000000005',
    support: 'c1000000-0000-4000-8000-000000000006',
    closedSupport: 'c1000000-0000-4000-8000-000000000007',
};

type ModerationAction = 'approve' | 'reject' | 'publish' | 'hide' | 'unpublish';

export function moderationActionsForStatus(status: string): ModerationAction[] {
    if (status === 'published') return ['hide', 'unpublish'];
    if (['approved', 'pending'].includes(status)) return ['publish', 'reject'];
    if (['queued', 'in_review'].includes(status)) return ['approve', 'reject'];
    return [];
}

export function createModerationState(): ModerationState {
    const due = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString();
    return {
        items: [
            {
                id: ids.recipe,
                queue: 'recipes',
                title: 'Тыквенный суп с имбирём',
                status: 'pending',
                assignment: 'unassigned',
                priority: 'high',
                dueAt: due,
                version: 1,
                publicContent: 'Тыква, морковь и имбирь. Варить 25 минут, затем измельчить.',
                originalContent: 'Авторская редакция с подробными шагами и источником фотографии.',
                context: ['Первая публикация автора', 'Автоматические проверки пройдены'],
                signals: ['Проверьте соответствие фотографии тексту'],
            },
            {
                id: ids.variant,
                queue: 'recipe_variants',
                title: 'Постный вариант сырников',
                status: 'in_review',
                assignment: 'mine',
                priority: 'normal',
                dueAt: due,
                version: 2,
                publicContent: 'Вариант без молочных продуктов.',
                originalContent: 'Замена творога на тофу и овсяную муку.',
                context: ['Вариант существующего рецепта'],
                signals: [],
            },
            {
                id: 'c1000000-0000-4000-8000-000000000008',
                queue: 'recipes',
                title: 'Салат с печёной свёклой',
                status: 'pending',
                assignment: 'unassigned',
                priority: 'normal',
                dueAt: due,
                version: 1,
                publicContent: 'Свёкла, руккола и семена подсолнечника.',
                originalContent: 'Новая редакция с уточнённой температурой запекания.',
                context: ['Первая публикация автора'],
                signals: [],
            },
            {
                id: 'c1000000-0000-4000-8000-000000000009',
                queue: 'recipes',
                title: 'Запечённые яблоки',
                status: 'pending',
                assignment: 'unassigned',
                priority: 'normal',
                dueAt: due,
                version: 1,
                publicContent: 'Яблоки с корицей без добавленного сахара.',
                originalContent: 'Авторская редакция с вариантами начинки.',
                context: ['Повторная публикация автора'],
                signals: [],
            },
            {
                id: ids.product,
                queue: 'products',
                title: 'Овсяное молоко 1 л',
                status: 'pending',
                assignment: 'unassigned',
                priority: 'normal',
                dueAt: due,
                version: 1,
                publicContent: 'Напиток овсяный, 1 л.',
                originalContent: 'Сведения с упаковки: овёс, вода, соль.',
                context: ['Новая карточка продукта'],
                signals: [],
            },
            {
                id: 'c1000000-0000-4000-8000-000000000010',
                queue: 'recipe_variants',
                title: 'Опубликованный вариант для скрытия',
                status: 'published',
                assignment: 'mine',
                priority: 'normal',
                dueAt: due,
                version: 3,
                publicContent: 'Опубликованная редакция варианта.',
                originalContent: 'Защищённая редакция варианта для проверки скрытия.',
                context: ['Материал опубликован'],
                signals: [],
            },
            {
                id: 'c1000000-0000-4000-8000-000000000011',
                queue: 'recipe_variants',
                title: 'Опубликованный вариант для снятия',
                status: 'published',
                assignment: 'mine',
                priority: 'normal',
                dueAt: due,
                version: 4,
                publicContent: 'Вторая опубликованная редакция варианта.',
                originalContent: 'Защищённая редакция варианта для снятия с публикации.',
                context: ['Материал опубликован'],
                signals: [],
            },
            {
                id: ids.report,
                queue: 'reports',
                title: 'Жалоба на описание рецепта',
                status: 'pending',
                assignment: 'unassigned',
                priority: 'critical',
                dueAt: due,
                version: 1,
                publicContent: 'Пользователь сообщил о потенциально опасной температуре приготовления.',
                originalContent: 'Исходный шаг: запекать при 120 °C 10 минут.',
                context: ['Категория: безопасность приготовления'],
                signals: ['Высокий приоритет из-за риска для здоровья'],
            },
            {
                id: ids.authorship,
                queue: 'authorship',
                title: 'Запрос на подтверждение авторства',
                status: 'pending',
                assignment: 'other',
                priority: 'normal',
                dueAt: due,
                version: 1,
                publicContent: 'Заявитель просит указать исходного автора.',
                originalContent: 'Приложена ссылка на исходную публикацию.',
                context: ['Без финансовых или юридических документов'],
                signals: [],
            },
        ],
        support: [
            {
                id: ids.support,
                version: 1,
                subject: 'Не сохраняется список покупок',
                status: 'waiting_for_support',
                category: 'technical',
                assignment: 'unassigned',
                messages: [
                    {
                        id: 'c2000000-0000-4000-8000-000000000001',
                        author: 'user',
                        body: 'После добавления продукта список возвращается в прежнее состояние.',
                        createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
                    },
                ],
            },
            {
                id: ids.closedSupport,
                version: 2,
                subject: 'Закрытое обращение для проверки повторного открытия',
                status: 'closed',
                category: 'technical',
                assignment: 'unassigned',
                messages: [
                    {
                        id: 'c2000000-0000-4000-8000-000000000002',
                        author: 'support',
                        body: 'Ранее обращение было закрыто после подтверждения решения.',
                        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                    },
                ],
            },
        ],
    };
}

type ResponseFactory = (data: unknown) => Response;
type FailFactory = (status: number, code?: string) => Response;
const consumedTestControls = new Set<string>();

function consumeTestControl(cookie: string | undefined, method: string, path: string, fail: FailFactory) {
    if ((process.env.NODE_ENV !== 'development' && process.env.NEXT_PUBLIC_E2E_PRODUCTION_MOCKS !== '1') || !cookie)
        return null;
    try {
        const encoded = cookie.replace(/-/g, '+').replace(/_/g, '/');
        const binary = atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '='));
        const control = JSON.parse(
            new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0))),
        ) as { nonce?: string; method?: string; path?: string; status?: number; mode?: 'once' | 'sticky' };
        const sticky = control.mode === 'sticky';
        if (
            !control.nonce ||
            (!sticky && consumedTestControls.has(control.nonce)) ||
            control.method !== method ||
            control.path !== path ||
            !control.status ||
            (control.mode !== undefined && control.mode !== 'once' && control.mode !== 'sticky') ||
            ![401, 403, 404, 409, 412, 429, 500, 503].includes(control.status)
        )
            return null;
        if (!sticky) consumedTestControls.add(control.nonce);
        return fail(control.status);
    } catch {
        return null;
    }
}

export function moderationHandle(context: {
    state: ModerationState;
    principal: Principal | null;
    path: string;
    method: string;
    params: Record<string, string>;
    query: URLSearchParams;
    input: unknown;
    cookies?: Record<string, string>;
    now: number;
    success: ResponseFactory;
    fail: FailFactory;
}) {
    const { state, principal, path, method, params, query, input, cookies, now, success, fail } = context;
    if (!path.startsWith('/api/v1/moderator/')) return null;
    const controlled = consumeTestControl(cookies?.moderator_test_control, method, path, fail);
    if (controlled) return controlled;
    if (!principal || principal.context !== 'moderator') return fail(401);
    const row = (item: ModerationState['items'][number]) => ({
        id: item.id,
        queue: item.queue,
        title: item.title,
        status: item.status,
        assignment: item.assignment,
        priority: item.priority,
        dueAt: item.dueAt,
        version: item.version,
        canClaim: item.assignment === 'unassigned' && ['pending', 'queued'].includes(item.status),
        canSkip: item.assignment === 'unassigned' && ['pending', 'queued'].includes(item.status),
        canOpen: item.assignment !== 'other',
    });
    const supportRow = (ticket: ModerationState['support'][number]) => ({
        id: ticket.id,
        queue: 'support' as const,
        title: ticket.subject,
        status: ticket.status,
        assignment: ticket.assignment,
        priority: 'normal' as const,
        dueAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
        version: ticket.version,
        canClaim: false,
        canSkip: false,
        canOpen: ticket.assignment !== 'other',
    });
    const itemDetail = (item: ModerationState['items'][number]) => ({
        id: item.id,
        queue: item.queue,
        title: item.title,
        status: item.status,
        version: item.version,
        assignment: item.assignment,
        publicView: { title: item.title, content: item.publicContent },
        original: { title: item.title, content: item.originalContent },
        context: item.context,
        signals: item.signals,
        related: state.items
            .filter((candidate) => candidate.queue === item.queue && candidate.id !== item.id)
            .slice(0, 3)
            .map((candidate) => ({ id: candidate.id, title: candidate.title })),
        actions: item.assignment === 'mine' ? moderationActionsForStatus(item.status) : [],
    });
    if (path === '/api/v1/moderator/overview' && method === 'GET') {
        const titles = {
            recipes: 'Рецепты',
            recipe_variants: 'Варианты рецептов',
            products: 'Продукты',
            reports: 'Жалобы',
            support: 'Поддержка',
            authorship: 'Авторство',
        } as const;
        return success({
            queues: Object.entries(titles).map(([key, title]) => ({
                key,
                title,
                count:
                    key === 'support' ? state.support.length : state.items.filter((item) => item.queue === key).length,
                available: true,
            })),
            assigned: state.items.filter((item) => item.assignment === 'mine').map(row),
            sla: { state: 'normal', label: 'Сроки в норме' },
        });
    }
    if (path.startsWith('/api/v1/moderator/queues/') && method === 'GET') {
        const queue = params.queue;
        let items =
            queue === 'support'
                ? state.support.map(supportRow)
                : state.items.filter((item) => item.queue === queue).map(row);
        for (const key of ['status', 'assignment', 'priority'] as const) {
            const value = query.get(key);
            if (value && value !== 'all') items = items.filter((item) => item[key] === value);
        }
        const parsedCursor = Number.parseInt(query.get('cursor') ?? '0', 10);
        const offset = Number.isSafeInteger(parsedCursor) && parsedCursor > 0 ? parsedCursor : 0;
        const pageSize = 2;
        const page = items.slice(offset, offset + pageSize);
        return success({
            queue,
            title:
                queue === 'recipe_variants'
                    ? 'Варианты рецептов'
                    : queue === 'support'
                      ? 'Поддержка'
                      : ((
                            {
                                recipes: 'Рецепты',
                                products: 'Продукты',
                                reports: 'Жалобы',
                                authorship: 'Авторство',
                            } as Record<string, string>
                        )[queue!] ?? 'Очередь'),
            items: page,
            nextCursor: offset + page.length < items.length ? String(offset + page.length) : null,
        });
    }
    const item = state.items.find((candidate) => candidate.id === params.id);
    if (path.startsWith('/api/v1/moderator/items/') && !item) return fail(404);
    if (item?.assignment === 'other') return fail(403);
    if (item && method === 'GET') return success(itemDetail(item));
    if (item && method === 'POST') {
        const command = input as { version?: number; action?: string };
        if (command.version !== item.version) return fail(409);
        if (path.endsWith('/claim')) {
            if (item.assignment !== 'unassigned') return fail(409);
            item.assignment = 'mine';
            item.status = 'in_review';
            item.version++;
        } else if (path.endsWith('/skip')) {
            if (item.assignment !== 'unassigned') return fail(409);
        } else if (path.endsWith('/decision')) {
            if (item.assignment !== 'mine') return fail(403);
            if (!moderationActionsForStatus(item.status).includes(command.action as ModerationAction)) return fail(409);
            item.status =
                command.action === 'approve'
                    ? 'approved'
                    : command.action === 'reject'
                      ? 'rejected'
                      : command.action === 'publish'
                        ? 'published'
                        : (command.action ?? item.status);
            if (command.action !== 'approve') item.assignment = 'unassigned';
            item.version++;
        }
        return success({ ...itemDetail(item), related: [] });
    }
    const ticket = state.support.find((candidate) => candidate.id === params.id);
    if (path.startsWith('/api/v1/moderator/support/') && !ticket) return fail(404);
    if (ticket?.assignment === 'other') return fail(403);
    if (ticket) {
        if (method === 'POST') {
            const command = input as { version?: number; message?: string };
            if (command.version !== ticket.version) return fail(409);
            if (path.endsWith('/reply')) {
                if (!command.message?.trim() || ticket.status === 'closed') return fail(409);
                ticket.messages.push({
                    id: crypto.randomUUID(),
                    author: 'support',
                    body: command.message.trim(),
                    createdAt: new Date(now).toISOString(),
                });
                ticket.assignment = 'mine';
                ticket.status = 'waiting_for_user';
            } else if (path.endsWith('/reopen')) {
                if (ticket.status !== 'closed') return fail(409);
                ticket.assignment = 'mine';
                ticket.status = 'waiting_for_support';
            }
            ticket.version++;
        }
        return success({
            ...ticket,
            context: [`Категория: ${ticket.category}`, 'Внутренние заметки и финансовые данные скрыты.'],
            related: null,
            canReply: ticket.status !== 'closed',
            canReopen: ticket.status === 'closed',
        });
    }
    return fail(404);
}
