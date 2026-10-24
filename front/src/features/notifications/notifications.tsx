'use client';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useRuntime } from '../../app/providers.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { Guard, useSession } from '../auth/session.js';
import { PersonalShell } from '../personalization/shell.js';
import styles from './notifications.module.css';
import { useConsent } from '../legal/consent-state.js';

const categories = [
    ['all', 'Все'],
    ['security', 'Безопасность'],
    ['inventory', 'Запасы'],
    ['planning', 'План'],
    ['cooking', 'Готовка'],
    ['family', 'Семья'],
    ['community', 'Сообщество'],
    ['moderation', 'Модерация'],
    ['support', 'Поддержка'],
    ['subscription', 'Тариф'],
    ['ai', 'AI'],
    ['achievements', 'Достижения'],
    ['news', 'Новости'],
] as const;
type Category = (typeof categories)[number][0];
const priority: Record<string, string> = {
    critical: 'Критичное',
    important: 'Важное',
    informational: 'Информация',
    marketing: 'Предложение',
};
const notificationChannelName = 'meal-notification-change';
function useNotificationSync(refresh: () => void) {
    useEffect(() => {
        if (!('BroadcastChannel' in window)) return;
        const channel = new BroadcastChannel(notificationChannelName);
        channel.onmessage = refresh;
        return () => channel.close();
    }, [refresh]);
}
function broadcastNotificationChange() {
    if (!('BroadcastChannel' in window)) return;
    const channel = new BroadcastChannel(notificationChannelName);
    channel.postMessage('changed');
    channel.close();
}
function CenterContent() {
    const { api, queryClient } = useRuntime();
    const session = useSession('user');
    const search = useSearchParams();
    const router = useRouter();
    const raw = search.get('category');
    const category: Category = categories.some((x) => x[0] === raw) ? (raw as Category) : 'all';
    const unread = search.get('unread') === '1';
    const key = ['notifications', session.data?.id, category, unread] as const;
    const query = useQuery({
        queryKey: key,
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) =>
            (
                await api!.request('GET /api/v1/notifications', undefined, signal, undefined, {
                    query: { category, unread: unread ? '1' : '0', limit: '50', offset: '0' },
                })
            ).data,
    });
    const refresh = useCallback(
        () => void queryClient.invalidateQueries({ queryKey: ['notifications', session.data?.id] }),
        [queryClient, session.data?.id],
    );
    useNotificationSync(refresh);
    const read = useMutation({
        mutationFn: async (item: { id: string; version: number }) =>
            (
                await api!.request(
                    'POST /api/v1/notifications/{id}/read',
                    { expectedVersion: item.version, idempotencyKey: crypto.randomUUID() },
                    undefined,
                    { id: item.id },
                )
            ).data,
        onSettled: refresh,
        onSuccess: broadcastNotificationChange,
    });
    const all = useMutation({
        mutationFn: async () =>
            (
                await api!.request('POST /api/v1/notifications/read-all', {
                    category,
                    idempotencyKey: crypto.randomUUID(),
                })
            ).data,
        onSettled: refresh,
        onSuccess: broadcastNotificationChange,
    });
    const href = (next: Category, nextUnread = unread) =>
        `/notifications?category=${next}${nextUnread ? '&unread=1' : ''}`;
    return (
        <>
            <div className={styles.heading}>
                <div>
                    <h1>Уведомления</h1>
                    <p>{query.data ? `${query.data.unreadCount} непрочитанных` : 'События вашего аккаунта'}</p>
                </div>
                <div className={styles.actions}>
                    <Link href="/settings/notifications">Настройки</Link>
                    <button
                        className="button outline"
                        disabled={all.isPending || !query.data?.unreadCount}
                        onClick={() => all.mutate()}
                    >
                        Прочитать все
                    </button>
                </div>
            </div>
            <nav className={styles.tabs} aria-label="Категории уведомлений">
                {categories.map(([code, label]) => (
                    <Link key={code} href={href(code)} aria-current={category === code ? 'page' : undefined}>
                        {label}
                        {code !== 'all' && query.data ? ` · ${query.data.categoryCounts[code]}` : ''}
                    </Link>
                ))}
            </nav>
            <label className={styles.unread}>
                <input
                    type="checkbox"
                    checked={unread}
                    onChange={(event) => router.push(href(category, event.target.checked))}
                />
                Только непрочитанные
            </label>
            {query.isPending ? (
                <p role="status">Загружаем уведомления…</p>
            ) : query.isError ? (
                <section className={styles.panel} role="alert">
                    <h2>Не удалось загрузить уведомления</h2>
                    <button className="button outline" onClick={() => void query.refetch()}>
                        Повторить
                    </button>
                </section>
            ) : query.data.items.length === 0 ? (
                <section className={styles.panel}>
                    <h2>Здесь пока пусто</h2>
                    <p>Новые события появятся в соответствующей категории.</p>
                </section>
            ) : (
                <div className={styles.list}>
                    {query.data.items.map((item) => (
                        <article className={`${styles.item} ${item.readAt ? styles.read : ''}`} key={item.id}>
                            <div>
                                <span className={styles.priority}>{priority[item.priority] ?? item.priority}</span>
                                <h2>{item.title}</h2>
                                <p>{item.body}</p>
                                <small>
                                    {new Date(item.occurredAt).toLocaleString('ru')}
                                    {item.groupedCount > 1 ? ` · ${item.groupedCount} события` : ''}
                                </small>
                            </div>
                            <div className={styles['item-actions']}>
                                {!item.readAt && (
                                    <button
                                        className="text-button"
                                        disabled={read.isPending}
                                        onClick={() => read.mutate({ id: item.id, version: item.version })}
                                    >
                                        Прочитано
                                    </button>
                                )}
                                {item.href && <Link href={item.href}>Открыть</Link>}
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </>
    );
}
export function NotificationCenter() {
    return (
        <Guard context="user">
            <PersonalShell>
                <CenterContent />
            </PersonalShell>
        </Guard>
    );
}

type Preferences = Success<'GET /api/v1/notification-preferences'>['data'];
function SettingsContent() {
    const { api, queryClient } = useRuntime();
    const session = useSession('user');
    const marketingConsent = useConsent('marketing');
    const query = useQuery({
        queryKey: ['notification-preferences', session.data?.id],
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/notification-preferences', undefined, signal)).data,
    });
    const [draft, setDraft] = useState<Preferences | null>(null);
    const refresh = useCallback(() => {
        setDraft(null);
        void queryClient.invalidateQueries({ queryKey: ['notification-preferences', session.data?.id] });
    }, [queryClient, session.data?.id]);
    useNotificationSync(refresh);
    const mutation = useMutation({
        mutationFn: async (value: Preferences) =>
            (
                await api!.request('PUT /api/v1/notification-preferences', {
                    categories: value.categories,
                    quietHours: value.quietHours,
                    planReminderTime: value.planReminderTime,
                    timezone: value.timezone,
                    urgentFoodRisk: value.urgentFoodRisk,
                    expectedVersion: value.version,
                    idempotencyKey: crypto.randomUUID(),
                })
            ).data,
        onSuccess: (value) => {
            queryClient.setQueryData(['notification-preferences', session.data?.id], value);
            setDraft(value);
            broadcastNotificationChange();
        },
        onError: () => {
            setDraft(null);
            void query.refetch();
        },
    });
    if (query.isPending) return <p role="status">Загружаем настройки…</p>;
    if (query.isError) return <p role="alert">Настройки уведомлений недоступны.</p>;
    const value = draft ?? query.data;
    const setChannel = (category: string, channel: 'push' | 'email', enabled: boolean) =>
        setDraft({
            ...value,
            categories: value.categories.map((x) => (x.category === category ? { ...x, [channel]: enabled } : x)),
        });
    return (
        <>
            <div className={styles.heading}>
                <div>
                    <h1>Настройки уведомлений</h1>
                    <p>Внутренние уведомления остаются в центре. Внешние каналы включаются отдельно.</p>
                </div>
                <Link href="/notifications">Центр уведомлений</Link>
            </div>
            <section className={styles.notice} role="status">
                <strong>Маркетинговые сообщения: {marketingConsent.enabled ? 'разрешены' : 'не разрешены'}</strong>
                <p>
                    Это отдельное согласие. Настройки сервисных каналов ниже не выдают его автоматически и не отменяют
                    критичные сообщения безопасности.
                </p>
                <Link href="/settings/privacy?consent=marketing&returnTo=/settings/notifications">
                    Управлять согласием
                </Link>
            </section>
            {(!value.deliveryAvailable.push || !value.deliveryAvailable.email) && (
                <section className={styles.notice}>
                    <strong>Доставка ещё не подключена</strong>
                    <p>
                        Недоступные Web Push и email нельзя включить до подключения соответствующих провайдеров.
                        Остальные настройки сохраняются как обычно.
                    </p>
                </section>
            )}
            <form
                className={styles.form}
                onSubmit={(e) => {
                    e.preventDefault();
                    mutation.mutate(value);
                }}
            >
                <section className={styles.table}>
                    <div className={styles['table-head']}>
                        <strong>Категория</strong>
                        <strong>Web Push</strong>
                        <strong>Email</strong>
                    </div>
                    {value.categories.map((row) => (
                        <div className={styles['table-row']} key={row.category}>
                            <span>{categories.find((x) => x[0] === row.category)?.[1] ?? row.category}</span>
                            <label className={styles['check-cell']}>
                                <input
                                    aria-label={`Web Push: ${row.category}`}
                                    type="checkbox"
                                    checked={row.push}
                                    disabled={!value.deliveryAvailable.push || mutation.isPending}
                                    onChange={(e) => setChannel(row.category, 'push', e.target.checked)}
                                />
                            </label>
                            <label className={styles['check-cell']}>
                                <input
                                    aria-label={`Email: ${row.category}`}
                                    type="checkbox"
                                    checked={row.email}
                                    disabled={!value.deliveryAvailable.email || mutation.isPending}
                                    onChange={(e) => setChannel(row.category, 'email', e.target.checked)}
                                />
                            </label>
                        </div>
                    ))}
                </section>
                <section className={styles.grid}>
                    <label>
                        Начало тихих часов
                        <input
                            type="time"
                            value={value.quietHours.start}
                            onChange={(e) =>
                                setDraft({ ...value, quietHours: { ...value.quietHours, start: e.target.value } })
                            }
                        />
                    </label>
                    <label>
                        Конец тихих часов
                        <input
                            type="time"
                            value={value.quietHours.end}
                            onChange={(e) =>
                                setDraft({ ...value, quietHours: { ...value.quietHours, end: e.target.value } })
                            }
                        />
                    </label>
                    <label>
                        Напоминание о плане
                        <input
                            type="time"
                            value={value.planReminderTime}
                            onChange={(e) => setDraft({ ...value, planReminderTime: e.target.value })}
                        />
                    </label>
                    <label>
                        Часовой пояс
                        <input
                            value={value.timezone}
                            maxLength={100}
                            onChange={(e) => setDraft({ ...value, timezone: e.target.value })}
                        />
                    </label>
                </section>
                <label className={styles.unread}>
                    <input
                        type="checkbox"
                        checked={value.urgentFoodRisk}
                        onChange={(e) => setDraft({ ...value, urgentFoodRisk: e.target.checked })}
                    />
                    Разрешить срочные предупреждения о пищевом риске во время тихих часов
                </label>
                {mutation.isError && <p role="alert">Не удалось сохранить. Актуальные настройки загружены повторно.</p>}
                {mutation.isSuccess && <p role="status">Настройки сохранены.</p>}
                <button className="button primary" disabled={mutation.isPending}>
                    Сохранить
                </button>
            </form>
        </>
    );
}
export function NotificationSettings() {
    return (
        <Guard context="user">
            <PersonalShell>
                <SettingsContent />
            </PersonalShell>
        </Guard>
    );
}
