import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../app/providers.js';
import { Guard, useSession } from '../auth/session.js';
import { useRequestSignal } from '../auth/use-request-signal.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import { InlineLoader as ArcInlineLoader } from '@meal-planner/design-system';
import type { NotificationChannel } from './preferences.js';

const channels = [
    { key: 'browser', title: 'Браузер', description: 'Системные уведомления при открытой фоновой вкладке.' },
    {
        key: 'mobilePush',
        title: 'Мобильный Web Push',
        description:
            'Push-уведомления на подключённых устройствах. Каждое устройство потребует отдельной подписки и разрешения.',
    },
    { key: 'email', title: 'Email', description: 'Письма на подтверждённый адрес аккаунта администратора.' },
] as const;

export function NotificationSettingsPage() {
    return (
        <Guard context="admin">
            <NotificationSettingsContent />
        </Guard>
    );
}
function NotificationSettingsContent() {
    const { api, queryClient } = useRuntime();
    const session = useSession('admin');
    const beginRequest = useRequestSignal();
    const locked = useRef(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const queryKey = ['notification-settings', session.data?.id];
    const settings = useQuery({
        queryKey,
        enabled: !!api && session.data?.context === 'admin',
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/admin/notification-preferences', undefined, signal)).data,
        staleTime: 0,
    });
    async function update(channel: NotificationChannel, enabled: boolean) {
        if (locked.current) return;
        locked.current = true;
        setBusy(true);
        setMessage('');
        const signal = beginRequest();
        try {
            const result = (
                await api!.request('POST /api/v1/admin/notification-preferences', { channel, enabled }, signal)
            ).data;
            signal.throwIfAborted();
            queryClient.setQueryData(queryKey, result);
            setMessage('Настройка сохранена. Реальная доставка ещё не подключена.');
        } catch (error) {
            if (!signal.aborted) setMessage(error instanceof Error ? error.message : 'Не удалось сохранить настройку.');
        } finally {
            locked.current = false;
            setBusy(false);
        }
    }
    return (
        <main id="main" className="staff-home">
            <nav className="actions" aria-label="Навигация настроек">
                <Link to="/settings/recipes">Рецепты и антиспам</Link>
                <Link to="/admin">К обзору</Link>
                <Link to="/notifications">Центр уведомлений</Link>
                <Link to="/">Сессии и безопасность</Link>
            </nav>
            <h1>Уведомления</h1>
            <p className="inline-note">
                Сейчас сохраняются только предпочтения. Доставка уведомлений и писем ещё не подключена. Подписанных
                устройств пока нет.
            </p>
            <section className="sessions-panel" aria-busy={busy}>
                {settings.isPending ? (
                    <ArcSkeleton variant="lines" lines={3} label="Загружаем настройки…" />
                ) : settings.isError ? (
                    <div role="alert">
                        <p>Не удалось загрузить настройки. {settings.error.message}</p>
                        <button onClick={() => void settings.refetch()}>Повторить</button>
                    </div>
                ) : (
                    <>
                        <p>Email аккаунта: {settings.data.verifiedEmail ?? 'Подтверждённый адрес отсутствует'}</p>
                        {channels.map((channel) => (
                            <div key={channel.key}>
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={settings.data.preferences[channel.key]}
                                        disabled={busy || (channel.key === 'email' && !settings.data.verifiedEmail)}
                                        onChange={(event) => void update(channel.key, event.target.checked)}
                                    />
                                    {channel.title}
                                </label>
                                <p className="inline-note">{channel.description}</p>
                            </div>
                        ))}
                    </>
                )}
                {busy && <ArcInlineLoader label="Сохраняем…" />}
                {message && <p role="status">{message}</p>}
            </section>
        </main>
    );
}
