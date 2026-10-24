import { SupportWorkspace } from './support-workspace.js';
import { useRef, useState, type FormEvent } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRuntime } from '../../app/providers.js';
import { ApiError } from '../../shared/api/client.js';
import { useRequestSignal } from '../auth/use-request-signal.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import styles from './admin.module.css';

export function SupportConversation({ id, version, status }: { id: string; version: string; status: string | null }) {
    const { api, queryClient } = useRuntime();
    const beginRequest = useRequestSignal();
    const [body, setBody] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const locked = useRef(false);
    const attempt = useRef<{ fingerprint: string; key: string; version: string } | null>(null);
    const messages = useInfiniteQuery({
        queryKey: ['admin-support-messages', id],
        enabled: !!api,
        initialPageParam: undefined as string | undefined,
        queryFn: async ({ signal, pageParam }) => {
            if (!api) throw new Error('Подключение не готово');
            return (
                await api.request(
                    'POST /api/v1/admin/support/{id}/messages/search',
                    { limit: 20, ...(pageParam ? { cursor: pageParam } : {}) },
                    signal,
                    { id },
                )
            ).data;
        },
        getNextPageParam: (page) => page.nextCursor ?? undefined,
    });
    async function send(action: 'reply' | 'reopen') {
        if (!api || locked.current) return;
        const text = body.trim();
        if (action === 'reply' && (!text || text.length > 10000)) return;
        const fingerprint = JSON.stringify([id, action, text]);
        if (attempt.current && attempt.current.fingerprint !== fingerprint) {
            setMessage(
                'Исход предыдущего запроса неизвестен. Сначала повторите его с прежним текстом, чтобы проверить результат.',
            );
            return;
        }
        attempt.current ??= { fingerprint, key: crypto.randomUUID(), version };
        locked.current = true;
        setBusy(true);
        setMessage('');
        const signal = beginRequest();
        try {
            if (action === 'reply')
                await api.request(
                    'POST /api/v1/admin/support/{id}/reply',
                    { body: text, version: attempt.current.version, idempotencyKey: attempt.current.key },
                    signal,
                    { id },
                );
            else
                await api.request(
                    'POST /api/v1/admin/support/{id}/reopen',
                    { version: attempt.current.version, idempotencyKey: attempt.current.key },
                    signal,
                    { id },
                );
            signal.throwIfAborted();
            attempt.current = null;
            if (action === 'reply') setBody('');
            setMessage(
                action === 'reply'
                    ? 'Ответ сохранён. Пользователь увидит его в обращении.'
                    : 'Обращение открыто повторно.',
            );
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['admin-detail'] }),
                queryClient.invalidateQueries({ queryKey: ['admin-support-workspace', id] }),
                queryClient.invalidateQueries({ queryKey: ['admin-support-messages', id] }),
                queryClient.invalidateQueries({ queryKey: ['admin'] }),
                queryClient.invalidateQueries({ queryKey: ['admin-related'] }),
            ]);
        } catch (error) {
            if (signal.aborted) return;
            if (error instanceof ApiError && error.status === 409) {
                attempt.current = null;
                setMessage('Обращение изменилось. Данные обновляются; проверьте их перед повторной отправкой.');
                await queryClient.invalidateQueries({ queryKey: ['admin-detail'] });
            } else {
                if (error instanceof ApiError && error.status < 500) attempt.current = null;
                setMessage(
                    error instanceof ApiError && error.status < 500
                        ? error.message
                        : 'Исход запроса неизвестен. Обновите переписку. Повторная отправка того же текста использует тот же ключ операции.',
                );
            }
        } finally {
            locked.current = false;
            setBusy(false);
        }
    }
    function submit(event: FormEvent) {
        event.preventDefault();
        void send('reply');
    }
    const items = [
        ...new Map((messages.data?.pages ?? []).flatMap((page) => page.items).map((item) => [item.id, item])).values(),
    ];
    return (
        <section className={styles.card}>
            <SupportWorkspace key={id} id={id} />
            <h2>Переписка</h2>
            <p className={styles.muted}>
                Сначала показаны последние сообщения. Дата отправки указана у каждого сообщения.
            </p>
            {messages.isPending && <ArcSkeleton variant="lines" lines={3} label="Загружаем переписку…" />}
            {messages.isError && (
                <p role="alert">
                    Не удалось загрузить переписку. {messages.error.message}
                    {items.length > 0 && ' Показана ранее загруженная переписка; её актуальность не подтверждена.'}
                </p>
            )}
            <button
                className="button outline"
                disabled={messages.isFetching || busy}
                onClick={() => void messages.refetch()}
            >
                Обновить переписку
            </button>
            {messages.isSuccess && !items.length && <p>Сообщений пока нет.</p>}
            <ol className={styles.messages}>
                {items.map((item) => (
                    <li key={item.id}>
                        <p className={styles.muted}>
                            {item.authorId ? `Автор: ${item.authorId}` : 'Автор не указан'} ·{' '}
                            {new Date(item.createdAt).toLocaleString()}
                        </p>
                        <p>{item.body}</p>
                    </li>
                ))}
            </ol>
            {messages.hasNextPage && (
                <button
                    className="button outline"
                    disabled={messages.isFetching}
                    onClick={() => void messages.fetchNextPage()}
                >
                    Ещё сообщения
                </button>
            )}
            {status === 'closed' ? (
                <div>
                    <p>Обращение закрыто. Для продолжения переписки откройте его повторно.</p>
                    <button className="button outline" disabled={busy} onClick={() => void send('reopen')}>
                        Открыть повторно
                    </button>
                </div>
            ) : (
                <form onSubmit={submit}>
                    <label htmlFor="support-reply">Ответ пользователю</label>
                    <textarea
                        className={styles['message-input']}
                        id="support-reply"
                        value={body}
                        onChange={(event) => setBody(event.target.value)}
                        required
                        maxLength={10000}
                        rows={5}
                        disabled={busy}
                    />
                    <p className={styles.muted}>Ответ будет виден автору обращения. До 10 000 символов.</p>
                    <button className="button primary" disabled={busy || !body.trim()}>
                        {busy ? 'Сохраняем…' : 'Отправить ответ'}
                    </button>
                </form>
            )}
            {message && <p role="status">{message}</p>}
        </section>
    );
}
