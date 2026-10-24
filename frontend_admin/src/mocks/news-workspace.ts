import { newsCommandSchema, newsItemSchema, type NewsContent, type NewsResult } from '../features/news/contracts.js';
import type { AdminState } from './admin-model.js';

export interface NewsRecipient {
    id?: string;
    role?: 'admin' | 'moderator' | 'user' | null;
    plan: 'free' | 'plus' | 'pro';
    gender: 'female' | 'male' | 'unknown';
    family: boolean;
    registeredAt: string | null;
    activeAt: string | null;
    allowedChannels: ('in_app' | 'email' | 'push')[];
}
export function matchesNewsAudience(content: NewsContent, user: NewsRecipient): boolean {
    const a = content.audience;
    const range = (value: string | null, from: string | null, to: string | null) =>
        (!from && !to) || (!!value && (!from || value >= from) && (!to || value <= to));
    return (
        (!a.plans.length || a.plans.includes(user.plan)) &&
        (!a.genders.length || a.genders.includes(user.gender)) &&
        (!a.families.length || a.families.includes(user.family ? 'yes' : 'no')) &&
        range(user.registeredAt, a.registeredFrom, a.registeredTo) &&
        range(user.activeAt, a.activeFrom, a.activeTo) &&
        content.channels.some((channel) => user.allowedChannels.includes(channel))
    );
}
export class NewsMockError extends Error {
    constructor(
        readonly status: number,
        message: string,
    ) {
        super(message);
    }
}
const assertInAppOnly = (content: NewsContent) => {
    if (content.channels.some((channel) => channel !== 'in_app'))
        throw new NewsMockError(503, 'Email и push недоступны до подключения провайдеров.');
};
const deliver = (
    state: AdminState,
    itemId: string,
    title: string,
    recipients: NewsRecipient[],
    key: string,
    now: number,
) => {
    const notifications = (state.tables.notifications ??= []);
    for (const recipient of recipients) {
        if (!recipient.id) continue;
        const dedup = `news:${key}:${recipient.id}`;
        if (notifications.some((row) => row.dedup_key === dedup)) continue;
        notifications.push({
            id: crypto.randomUUID(),
            category: 'news',
            priority: 'informational',
            payload: JSON.stringify({ type: 'news', newsId: itemId, title }),
            dedup_key: dedup,
            available_at: new Date(now).toISOString(),
            read_at: null,
            user_id: recipient.id,
            announcement_id: itemId,
        });
    }
};
export function newsWorkspaceCommand(
    state: AdminState,
    input: unknown,
    context: {
        actorId: string;
        critical: boolean;
        now: number;
        recipients: NewsRecipient[];
    },
): NewsResult {
    const parsed = newsCommandSchema.safeParse(input);
    if (!parsed.success) throw new NewsMockError(400, 'Проверьте поля новости.');
    const command = parsed.data;
    const rows = (state.tables.news_workspace ??= []);
    const items = rows.map((row) => newsItemSchema.parse(JSON.parse(String(row.payload))));
    const result = (message: string): NewsResult => ({ items, preview: null, message });
    if (command.action === 'list') return result('');
    const log = (state.tables.news_workspace_commands ??= []);
    const digest = JSON.stringify(command);
    if ('idempotencyKey' in command) {
        const previous = log.find((row) => row.id === command.idempotencyKey && row.actor_id === context.actorId);
        if (previous) {
            if (previous.digest !== digest) throw new NewsMockError(409, 'Ключ команды уже использован.');
            return JSON.parse(String(previous.result)) as NewsResult;
        }
    }
    let item = items.find((value) => value.id === command.id);
    if (command.action !== 'save' && !item) throw new NewsMockError(404, 'Новость не найдена.');
    if ((item?.version ?? 0) !== command.version) throw new NewsMockError(409, 'Новость изменилась. Обновите данные.');
    if (command.action === 'preview' && item) {
        const content = item.content;
        return {
            ...result('Предварительное число по тестовым данным.'),
            preview: {
                id: item.id,
                version: item.version,
                recipients: context.recipients.filter((u) => matchesNewsAudience(content, u)).length,
                preliminary: true,
                mock: true,
            },
        };
    }
    if (command.action === 'save') {
        if (item?.status === 'scheduled') throw new NewsMockError(409, 'Сначала отмените запланированную отправку.');
        if (!item) {
            item = {
                id: command.id,
                version: 1,
                content: command.content,
                status: 'draft',
                scheduledAt: null,
                history: [],
            };
            items.push(item);
        } else {
            item.history.push({
                version: item.version,
                at: new Date(context.now).toISOString(),
                content: item.content,
            });
            item.content = command.content;
            item.version++;
        }
    } else if (command.action === 'launch' && item) {
        if (!context.critical) throw new NewsMockError(403, 'Требуется критичное подтверждение.');
        assertInAppOnly(item.content);
        if (item.status === 'scheduled') throw new NewsMockError(409, 'Отправка уже запланирована.');
        if (command.scheduledAt && Date.parse(command.scheduledAt) <= context.now)
            throw new NewsMockError(400, 'Выберите будущее время.');
        item.status = command.scheduledAt ? 'scheduled' : 'published';
        item.scheduledAt = command.scheduledAt;
        item.version++;
        if (!command.scheduledAt) {
            const content = item.content;
            deliver(
                state,
                item.id,
                content.title,
                context.recipients.filter((recipient) => matchesNewsAudience(content, recipient)),
                command.idempotencyKey,
                context.now,
            );
        }
    } else if (command.action === 'cancel' && item) {
        if (item.status !== 'scheduled' || !item.scheduledAt || Date.parse(item.scheduledAt) <= context.now)
            throw new NewsMockError(409, 'Отменить можно только ещё не начатую отправку.');
        item.status = 'cancelled';
        item.scheduledAt = null;
        item.version++;
    } else if (command.action === 'test' && item) {
        assertInAppOnly(item.content);
        deliver(
            state,
            item.id,
            item.content.title,
            context.recipients.filter(
                (recipient) =>
                    (command.recipients.includes('admin') && recipient.role === 'admin') ||
                    (command.recipients.includes('moderator') && recipient.role === 'moderator'),
            ),
            `test:${command.idempotencyKey}`,
            context.now,
        );
    }
    const response = result(
        command.action === 'test'
            ? 'Тестовое сообщение доставлено внутри приложения.'
            : command.action === 'launch'
              ? command.scheduledAt
                  ? 'Публикация внутри приложения запланирована.'
                  : 'Новость опубликована внутри приложения.'
              : 'Изменения сохранены.',
    );
    state.tables.news_workspace = items.map((value) => ({ id: value.id, payload: JSON.stringify(value) }));
    if ('idempotencyKey' in command)
        log.push({ id: command.idempotencyKey, actor_id: context.actorId, digest, result: JSON.stringify(response) });
    (state.tables.audit_events ??= []).push({
        id: crypto.randomUUID(),
        actor_id: context.actorId,
        action: `admin.news.${command.action}`,
        target_id: command.id,
        created_at: new Date(context.now).toISOString(),
    });
    return response;
}
