import { useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../app/providers.js';
import { ApiError } from '../../shared/api/client.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import { CriticalConfirmation } from '../auth/critical-confirmation.js';
import { useRequestSignal } from '../auth/use-request-signal.js';
import styles from './free-ai-workspace.module.css';

const kindLabels: Record<string, string> = {
    trial: 'Пробная / административная',
    purchased: 'Купленный пакет',
    subscription: 'Подписка',
    transferred: 'Передано',
    family_reserve: 'Семейный резерв',
};

export function FreeAiWorkspace({ id }: { id: string }) {
    const { api, queryClient } = useRuntime();
    const begin = useRequestSignal();
    const [actions, setActions] = useState('10');
    const [expiresAt, setExpiresAt] = useState('');
    const [reason, setReason] = useState('');
    const [preview, setPreview] = useState('');
    const [confirmed, setConfirmed] = useState(false);
    const [pending, setPending] = useState(false);
    const [feedback, setFeedback] = useState('');
    const attempt = useRef<{ key: string; fingerprint: string; version: string } | null>(null);
    const locked = useRef(false);
    const query = useQuery({
        queryKey: ['admin-free-ai', id],
        enabled: !!api,
        queryFn: async ({ signal }) => {
            if (!api) throw new Error('Подключение не готово');
            return (await api.request('GET /api/v1/admin/free-ai/users/{id}', undefined, signal, { id })).data;
        },
    });
    const fingerprint = JSON.stringify([actions, expiresAt, reason.trim()]);
    const previewKey = JSON.stringify([fingerprint, query.data?.user.version]);
    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!api || !query.data || locked.current) return;
        if (preview !== previewKey) {
            setPreview(previewKey);
            setConfirmed(false);
            setFeedback('');
            return;
        }
        if (!confirmed) return;
        if (attempt.current && attempt.current.fingerprint !== fingerprint) {
            setFeedback('Сначала повторите прежний запрос: его результат пока неизвестен.');
            return;
        }
        attempt.current ??= {
            key: crypto.randomUUID(),
            fingerprint,
            version: query.data.user.version,
        };
        locked.current = true;
        setPending(true);
        const signal = begin();
        try {
            const result = await api.request(
                'POST /api/v1/admin/free-ai/users/{id}/grants',
                {
                    expectedUserVersion: attempt.current.version,
                    actions: Number(actions),
                    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
                    reason: reason.trim(),
                    idempotencyKey: attempt.current.key,
                    confirmed: true,
                },
                signal,
                { id },
            );
            signal.throwIfAborted();
            attempt.current = null;
            setPreview('');
            setConfirmed(false);
            setFeedback(`Выдано ${result.data.granted} действий. Операция записана в аудит.`);
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['admin-free-ai', id] }),
                queryClient.invalidateQueries({ queryKey: ['admin-related', undefined, 'users', id] }),
                queryClient.invalidateQueries({ queryKey: ['admin-related'] }),
            ]);
        } catch (error) {
            if (signal.aborted) return;
            if (error instanceof ApiError && error.status < 500) {
                attempt.current = null;
                if (error.status === 409) void query.refetch();
            }
            setFeedback(error instanceof Error ? error.message : 'Не удалось сохранить выдачу.');
        } finally {
            locked.current = false;
            setPending(false);
        }
    }
    if (query.isPending) return <ArcSkeleton variant="lines" lines={4} label="Загружаем AI-квоту Free…" />;
    if (query.isError)
        return (
            <section className="sessions-panel">
                <h2>AI-квота Free</h2>
                <p role="alert">{query.error.message}</p>
                <button className="button outline" onClick={() => void query.refetch()}>
                    Повторить
                </button>
            </section>
        );
    const data = query.data;
    return (
        <section className="sessions-panel">
            <h2>AI-квота Free</h2>
            <p>
                {data.user.displayName} · @{data.user.login}. Доступно {data.available}, зарезервировано {data.reserved}
                , общий остаток {data.total}.
            </p>
            <div className={styles.summary} aria-label="Баланс AI">
                <strong>{data.available}</strong>
                <span>действий доступно</span>
                <strong>{data.buckets.length}</strong>
                <span>активных и исторических корзин</span>
            </div>
            <h3>Корзины квоты</h3>
            {data.buckets.length ? (
                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Источник</th>
                                <th>Выдано</th>
                                <th>Доступно</th>
                                <th>Резерв</th>
                                <th>Срок</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.buckets.map((bucket) => (
                                <tr key={bucket.id}>
                                    <td>{kindLabels[bucket.kind] ?? bucket.kind}</td>
                                    <td>{bucket.granted}</td>
                                    <td>{bucket.available}</td>
                                    <td>{bucket.reserved}</td>
                                    <td>
                                        {bucket.expiresAt ? new Date(bucket.expiresAt).toLocaleString() : 'Без срока'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p>Квота ещё не выдавалась.</p>
            )}
            <h3>Последние списания</h3>
            {data.recentOperations.length ? (
                <ul className={styles.operations}>
                    {data.recentOperations.map((operation) => (
                        <li key={operation.id}>
                            {new Date(operation.createdAt).toLocaleString()} · {operation.status} · {operation.cost}{' '}
                            действий
                        </li>
                    ))}
                </ul>
            ) : (
                <p>Списаний пока нет.</p>
            )}
            <CriticalConfirmation />
            <form onSubmit={(event) => void submit(event)} aria-busy={pending}>
                <h3>Выдать пробную квоту</h3>
                <p>Выдача бесплатна, не меняет тариф и требует TOTP-подтверждения критичных действий.</p>
                <label>
                    Количество действий
                    <input
                        type="number"
                        min="1"
                        max="10000"
                        required
                        value={actions}
                        onChange={(event) => setActions(event.target.value)}
                        disabled={pending}
                    />
                </label>
                <label>
                    Срок действия (местное время; пусто — без срока)
                    <input
                        type="datetime-local"
                        value={expiresAt}
                        onChange={(event) => setExpiresAt(event.target.value)}
                        disabled={pending}
                    />
                </label>
                <label>
                    Причина
                    <textarea
                        required
                        minLength={1}
                        maxLength={2000}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        disabled={pending}
                    />
                </label>
                {preview === previewKey && (
                    <div className={styles.preview} role="region" aria-label="Предпросмотр выдачи AI-квоты">
                        <h4>Проверьте выдачу</h4>
                        <p>
                            Пользователь получит {actions} действий
                            {expiresAt ? ` до ${new Date(expiresAt).toLocaleString()}` : ' без срока'}.
                        </p>
                        <p>Причина: {reason}</p>
                        <label>
                            <input
                                type="checkbox"
                                checked={confirmed}
                                onChange={(event) => setConfirmed(event.target.checked)}
                            />
                            Данные проверены
                        </label>
                    </div>
                )}
                <button className="button primary" disabled={pending || !reason.trim()}>
                    {preview === previewKey ? 'Выдать квоту' : 'Проверить выдачу'}
                </button>
            </form>
            {feedback && <p role="status">{feedback}</p>}
        </section>
    );
}
