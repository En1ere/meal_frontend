import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../app/providers.js';
import { Guard, useSession } from '../auth/session.js';
import { useRequestSignal } from '../auth/use-request-signal.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import { InlineLoader as ArcInlineLoader } from '@meal-planner/design-system';
import {
    notificationCenterSchema,
    validNotificationTimeZone,
    type NotificationCategory,
    type NotificationCenterSettings,
    type NotificationCenter,
} from './center-contracts.js';
import styles from './notification-center.module.css';

const categories: { key: NotificationCategory; title: string }[] = [
    { key: 'security', title: 'Безопасность и права' },
    { key: 'payments', title: 'Платежи и возвраты' },
    { key: 'support', title: 'Обращения и апелляции' },
    { key: 'moderation', title: 'Модерация' },
    { key: 'operations', title: 'Ошибки и задачи' },
    { key: 'campaigns', title: 'Рассылки' },
];
export function NotificationCenterPage() {
    return (
        <Guard context="admin">
            <NotificationCenterContent />
        </Guard>
    );
}
function NotificationCenterContent() {
    const { api, queryClient } = useRuntime();
    const session = useSession('admin');
    const beginRequest = useRequestSignal();
    const lock = useRef(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [category, setCategory] = useState<NotificationCategory>('security');
    const key = ['notification-center', session.data?.id];
    const query = useQuery({
        queryKey: key,
        enabled: !!api && session.data?.context === 'admin',
        queryFn: async ({ signal }) =>
            notificationCenterSchema.parse(
                (await api!.request('GET /api/v1/admin/notification-center', undefined, signal)).data,
            ),
    });
    async function mutate(kind: 'settings' | 'read', body: unknown) {
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        setMessage('');
        const signal = beginRequest();
        try {
            const route =
                kind === 'settings'
                    ? 'POST /api/v1/admin/notification-center/settings'
                    : 'POST /api/v1/admin/notification-center/read';
            const data = notificationCenterSchema.parse((await api!.request(route, body, signal)).data);
            signal.throwIfAborted();
            queryClient.setQueryData(key, data);
            setMessage(kind === 'settings' ? 'Настройки сохранены.' : 'Уведомление прочитано.');
        } catch (error) {
            if (!signal.aborted)
                setMessage(
                    `${error instanceof Error ? error.message : 'Не удалось сохранить.'} Обновите данные перед повторной попыткой.`,
                );
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }
    return (
        <main id="main" className="staff-home">
            <nav className="actions" aria-label="Навигация уведомлений">
                <Link to="/admin">К обзору</Link>
                <Link to="/settings/notifications">Общие каналы</Link>
            </nav>
            <h1>Центр уведомлений</h1>
            {query.isPending ? (
                <ArcSkeleton variant="lines" lines={5} label="Загружаем уведомления…" />
            ) : query.isError ? (
                <div role="alert">
                    <p>Не удалось загрузить уведомления. {query.error.message}</p>
                    <button className="button outline" onClick={() => void query.refetch()}>
                        Повторить
                    </button>
                </div>
            ) : (
                <>
                    {!query.data.deliveryConnected && (
                        <p className="inline-note">
                            Доставка email и push ещё не подключена. Здесь доступны настройки и демонстрационные
                            события; сохранение настройки не отправляет уведомление.
                        </p>
                    )}
                    <div className={styles.tabs} role="tablist" aria-label="Категории уведомлений">
                        {categories.map((entry, index) => (
                            <button
                                className="button outline"
                                key={entry.key}
                                id={`tab-${entry.key}`}
                                role="tab"
                                type="button"
                                aria-selected={category === entry.key}
                                aria-controls="notification-panel"
                                tabIndex={category === entry.key ? 0 : -1}
                                onClick={() => setCategory(entry.key)}
                                onKeyDown={(event) => {
                                    let next = index;
                                    if (event.key === 'ArrowRight') next = (index + 1) % categories.length;
                                    else if (event.key === 'ArrowLeft')
                                        next = (index + categories.length - 1) % categories.length;
                                    else if (event.key === 'Home') next = 0;
                                    else if (event.key === 'End') next = categories.length - 1;
                                    else return;
                                    event.preventDefault();
                                    setCategory(categories[next]!.key);
                                    document.getElementById(`tab-${categories[next]!.key}`)?.focus();
                                }}
                            >
                                {entry.title}{' '}
                                <span aria-label="Непрочитанных">
                                    {
                                        query.data.items.filter((item) => item.category === entry.key && !item.readAt)
                                            .length
                                    }
                                </span>
                            </button>
                        ))}
                    </div>
                    <section
                        id="notification-panel"
                        role="tabpanel"
                        aria-labelledby={`tab-${category}`}
                        className="sessions-panel"
                    >
                        <h2>{categories.find((entry) => entry.key === category)!.title}</h2>
                        {query.data.items.filter((item) => item.category === category).length === 0 && (
                            <p>В этой категории пока нет уведомлений.</p>
                        )}
                        {query.data.items
                            .filter((item) => item.category === category)
                            .map((item) => (
                                <article key={item.id} className={styles.item}>
                                    <h3>{item.title}</h3>
                                    <p>{item.summary}</p>
                                    <p className="inline-note">
                                        <time dateTime={item.createdAt}>
                                            {new Date(item.createdAt).toLocaleString()}
                                        </time>{' '}
                                        · {item.readAt ? 'Прочитано' : 'Новое'}
                                        {item.occurrences > 1 ? ` · Повторений: ${item.occurrences}` : ''}
                                    </p>
                                    <div className="actions">
                                        <Link to={item.destination}>Открыть раздел</Link>
                                        {!item.readAt && (
                                            <button
                                                className="button outline"
                                                disabled={busy}
                                                onClick={() => void mutate('read', { id: item.id })}
                                            >
                                                Отметить прочитанным
                                            </button>
                                        )}
                                    </div>
                                </article>
                            ))}
                    </section>
                    <SettingsEditor
                        key={query.data.version}
                        data={query.data}
                        busy={busy}
                        save={(settings) => void mutate('settings', { expectedVersion: query.data.version, settings })}
                    />
                    <button
                        className="button outline"
                        disabled={busy || query.isFetching}
                        onClick={() => void query.refetch()}
                    >
                        Обновить уведомления
                    </button>
                </>
            )}
            {busy && <ArcInlineLoader label="Сохраняем…" />}
            {message && <p role="status">{message}</p>}
        </main>
    );
}

function SettingsEditor({
    data,
    busy,
    save,
}: {
    data: NotificationCenter;
    busy: boolean;
    save: (settings: NotificationCenterSettings) => void;
}) {
    const [settings, setSettings] = useState(() => structuredClone(data.settings));
    const [error, setError] = useState('');
    return (
        <form
            className="sessions-panel"
            onSubmit={(event) => {
                event.preventDefault();
                if (
                    !validNotificationTimeZone(settings.quietHours.timeZone) ||
                    settings.quietHours.start === settings.quietHours.end
                ) {
                    setError('Укажите корректный часовой пояс и разные начало и конец тихих часов.');
                    return;
                }
                setError('');
                save(settings);
            }}
        >
            <h2>Настройки по категориям</h2>
            <p className="inline-note">
                Каналы изначально выключены. Email: {data.verifiedEmail ?? 'нет подтверждённого адреса'}. Разрешения
                устройств подключаются отдельно.
            </p>
            <fieldset disabled={busy} className={styles.fieldset}>
                <legend>Каналы доставки</legend>
                {categories.map((entry) => (
                    <fieldset key={entry.key} className={styles.category}>
                        <legend>{entry.title}</legend>
                        <div className={styles.channels}>
                            {(
                                [
                                    ['browser', 'Браузер'],
                                    ['mobilePush', 'Мобильный push'],
                                    ['email', 'Email'],
                                ] as const
                            ).map(([channel, title]) => (
                                <label key={channel} className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={settings.categories[entry.key][channel]}
                                        disabled={channel === 'email' && !data.verifiedEmail}
                                        onChange={(event) =>
                                            setSettings({
                                                ...settings,
                                                categories: {
                                                    ...settings.categories,
                                                    [entry.key]: {
                                                        ...settings.categories[entry.key],
                                                        [channel]: event.target.checked,
                                                    },
                                                },
                                            })
                                        }
                                    />
                                    {title}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                ))}
                <h3>Тихие часы</h3>
                <p className="inline-note">
                    События безопасности обходят тихие часы, но не выключенные каналы. Остальные уведомления ждут
                    окончания.
                </p>
                <div className={styles.fields}>
                    {(['start', 'end'] as const).map((name) => (
                        <label key={name}>
                            {name === 'start' ? 'Начало' : 'Окончание'}
                            <input
                                required
                                type="time"
                                value={settings.quietHours[name]}
                                onChange={(event) =>
                                    setSettings({
                                        ...settings,
                                        quietHours: { ...settings.quietHours, [name]: event.target.value },
                                    })
                                }
                            />
                        </label>
                    ))}
                    <label>
                        Часовой пояс IANA
                        <input
                            required
                            maxLength={100}
                            value={settings.quietHours.timeZone}
                            onChange={(event) =>
                                setSettings({
                                    ...settings,
                                    quietHours: { ...settings.quietHours, timeZone: event.target.value },
                                })
                            }
                        />
                    </label>
                </div>
                <h3>Повторяющиеся ошибки</h3>
                <div className={styles.fields}>
                    {(
                        [
                            ['count', 'Число ошибок', 100000],
                            ['windowMinutes', 'За период, минут', 10080],
                            ['repeatMinutes', 'Повторять не чаще, минут', 10080],
                        ] as const
                    ).map(([name, title, max]) => (
                        <label key={name}>
                            {title}
                            <input
                                type="number"
                                required
                                min={1}
                                max={max}
                                step={1}
                                value={settings.thresholds[name]}
                                onChange={(event) =>
                                    setSettings({
                                        ...settings,
                                        thresholds: { ...settings.thresholds, [name]: Number(event.target.value) },
                                    })
                                }
                            />
                        </label>
                    ))}
                </div>
                <button className="button outline" type="submit">
                    Сохранить настройки
                </button>
            </fieldset>
            {error && <p role="alert">{error}</p>}
        </form>
    );
}
