'use client';
import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRuntime } from '../../shared/runtime/index.js';
import { ApiError } from '../../shared/api/client.js';
import { authRoutes, type AuthContext } from '../../shared/auth/routes.js';
import { Brand } from '../../shared/ui/brand.js';
import { ThemeControl } from '../../shared/ui/theme-control.js';
import { useSession } from '../../entities/session/client.js';
import { useRequestSignal } from '../../shared/api/use-request-signal.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import { InlineLoader as ArcInlineLoader } from '@meal-planner/design-system';

export function SessionsPanel({ context }: { context: AuthContext }) {
    const runtime = useRuntime();
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [messageIsError, setMessageIsError] = useState(false);
    const locked = useRef(false);
    const beginRequest = useRequestSignal();
    const kind = context === 'user' ? 'user' : 'staff';
    const sessions = useQuery({
        queryKey: ['sessions', kind],
        enabled: !!runtime.api,
        queryFn: async ({ signal }) => {
            if (!runtime.api) throw new Error('API not ready');
            return (
                await runtime.api.request(
                    kind === 'user' ? 'GET /api/v1/auth/sessions' : 'GET /api/v1/staff/auth/sessions',
                    undefined,
                    signal,
                )
            ).data.sessions;
        },
    });
    async function act(action: 'logout' | 'others') {
        if (!runtime.api || locked.current) return;
        locked.current = true;
        setBusy(true);
        setMessage('');
        setMessageIsError(false);
        const signal = beginRequest();
        try {
            if (action === 'logout') {
                await runtime.api.request(
                    kind === 'user' ? 'POST /api/v1/auth/logout' : 'POST /api/v1/staff/auth/logout',
                    undefined,
                    signal,
                );
                signal.throwIfAborted();
                runtime.reset();
                runtime.broadcast();
                router.replace(authRoutes[context].login);
            } else {
                const response = await runtime.api.request(
                    kind === 'user'
                        ? 'POST /api/v1/auth/sessions/revoke-others'
                        : 'POST /api/v1/staff/auth/sessions/revoke-others',
                    undefined,
                    signal,
                );
                signal.throwIfAborted();
                await runtime.queryClient.invalidateQueries({ queryKey: ['sessions', kind] });
                signal.throwIfAborted();
                runtime.broadcast();
                setMessage(`Завершено других сессий: ${response.data.revokedCount}`);
            }
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') return;
            setMessageIsError(true);
            setMessage(
                error instanceof ApiError ? error.message : 'Не удалось выполнить действие. Проверьте подключение.',
            );
        } finally {
            locked.current = false;
            setBusy(false);
        }
    }
    return (
        <section className="sessions-panel">
            <h2>Активные сессии</h2>
            {sessions.isPending ? (
                <ArcSkeleton variant="lines" lines={3} label="Загружаем сессии…" />
            ) : sessions.isError ? (
                <p role="alert">
                    Не удалось загрузить сессии.{' '}
                    <button className="text-button" onClick={() => void sessions.refetch()}>
                        Повторить
                    </button>
                </p>
            ) : (
                <ul>
                    {sessions.data.map((session) => (
                        <li key={session.id}>
                            <strong>{session.current ? 'Текущая сессия' : 'Другая сессия'}</strong>
                            <span>Вход {new Date(session.authenticatedAt).toLocaleString('ru-RU')}</span>
                            <small>До {new Date(session.expiresAt).toLocaleString('ru-RU')}</small>
                        </li>
                    ))}
                </ul>
            )}
            <div className="actions">
                <button className="button outline" disabled={busy || !runtime.api} onClick={() => void act('others')}>
                    Завершить другие сессии
                </button>
                <button className="button primary" disabled={busy || !runtime.api} onClick={() => void act('logout')}>
                    {busy && <ArcInlineLoader label={null} />}
                    Выйти
                </button>
            </div>
            {message && <p role={messageIsError ? 'alert' : 'status'}>{message}</p>}
        </section>
    );
}
export function StaffHome({ context }: { context: 'moderator' }) {
    const session = useSession(context);
    return (
        <main id="main" className="staff-home">
            <Brand />
            <ThemeControl />
            <p className="eyebrow">Модерация</p>
            <h1>Служебный вход подтверждён</h1>
            <p>{session.data?.displayName}. Двухфакторная проверка пройдена.</p>
            <p className="inline-note">
                На этом этапе доступны управление сессиями и выход. Рабочие инструменты этого раздела ещё не подключены.
            </p>
            <SessionsPanel context={context} />
            <Link href="/about">О сервисе</Link>
        </main>
    );
}
