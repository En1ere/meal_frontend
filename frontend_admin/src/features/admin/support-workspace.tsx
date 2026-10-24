import { useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useRuntime } from '../../app/providers.js';
import { ApiError } from '../../shared/api/client.js';
import { useRequestSignal } from '../auth/use-request-signal.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import styles from './admin.module.css';

type Attachment = { name: string; type: string; size: number; duration: number | null };
async function describeFile(file: File): Promise<Attachment> {
    const accepted = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf',
        'video/mp4',
        'video/webm',
        'video/quicktime',
    ];
    if (!accepted.includes(file.type) || file.size < 1 || file.size > 10485760)
        throw new Error('Допустимы JPEG, PNG, WebP, PDF, MP4, WebM, MOV до 10 МБ.');
    let duration: number | null = null;
    if (file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file);
        try {
            duration = await new Promise<number>((resolve, reject) => {
                const video = document.createElement('video');
                const timer = setTimeout(() => {
                    video.removeAttribute('src');
                    video.load();
                    reject(new Error('Не удалось проверить длительность видео.'));
                }, 10000);
                video.preload = 'metadata';
                video.onloadedmetadata = () => {
                    clearTimeout(timer);
                    resolve(video.duration);
                };
                video.onerror = () => {
                    clearTimeout(timer);
                    reject(new Error('Браузер не может прочитать это видео.'));
                };
                video.src = url;
            });
        } finally {
            URL.revokeObjectURL(url);
        }
        if (!Number.isFinite(duration) || duration <= 0 || duration > 10)
            throw new Error('Видео должно длиться не более 10 секунд.');
    }
    return { name: file.name, type: file.type, size: file.size, duration };
}
export function SupportWorkspace({ id }: { id: string }) {
    const { api, queryClient } = useRuntime();
    const begin = useRequestSignal();
    const [action, setAction] = useState('note');
    const [target, setTarget] = useState('');
    const [text, setText] = useState('');
    const [files, setFiles] = useState<Attachment[]>([]);
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState('');
    const lock = useRef(false);
    const attempt = useRef<{ fingerprint: string; key: string; version: string } | null>(null);
    const query = useQuery({
        queryKey: ['admin-support-workspace', id],
        enabled: !!api,
        queryFn: async ({ signal }) => {
            if (!api) throw new Error('Подключение не готово');
            return (await api.request('GET /api/v1/admin/support/{id}/workspace', undefined, signal, { id })).data;
        },
    });
    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!api || !query.data || lock.current) return;
        const fingerprint = JSON.stringify([id, action, target, text, files]);
        if (attempt.current && attempt.current.fingerprint !== fingerprint) {
            setFeedback('Сначала повторите прежнюю операцию: её результат неизвестен.');
            return;
        }
        attempt.current ??= { fingerprint, key: crypto.randomUUID(), version: query.data.version };
        lock.current = true;
        setBusy(true);
        const signal = begin();
        try {
            await api.request(
                'POST /api/v1/admin/support/{id}/manage',
                {
                    version: attempt.current.version,
                    idempotencyKey: attempt.current.key,
                    action,
                    targetId: target || null,
                    text,
                    attachments: files,
                },
                signal,
                { id },
            );
            signal.throwIfAborted();
            attempt.current = null;
            setText('');
            setFiles([]);
            setFeedback('Сохранено.');
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['admin-support-workspace', id] }),
                queryClient.invalidateQueries({ queryKey: ['admin-support-messages', id] }),
                queryClient.invalidateQueries({ queryKey: ['admin-detail'] }),
                queryClient.invalidateQueries({ queryKey: ['admin'] }),
            ]);
        } catch (error) {
            if (signal.aborted) return;
            if (error instanceof ApiError && error.status < 500) {
                attempt.current = null;
                if (error.status === 409) void query.refetch();
            }
            setFeedback(error instanceof Error ? error.message : 'Неизвестный результат. Повторите прежнюю операцию.');
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }
    if (query.isPending) return <ArcSkeleton variant="lines" lines={3} label="Загружаем инструменты поддержки…" />;
    if (query.isError)
        return (
            <section className={styles.card}>
                <p role="alert">{query.error.message}</p>
                <button className="button outline" onClick={() => void query.refetch()}>
                    Повторить
                </button>
            </section>
        );
    const data = query.data;
    return (
        <section className={styles.card}>
            <h2>Работа с обращением</h2>
            <p>
                Ответственный: {data.staff.find((s) => s.id === data.assigneeId)?.label ?? 'Общая очередь'}.
                Администратор может вмешаться независимо от назначения.
            </p>
            <h3>Заметки и версии</h3>
            {!data.messages.length && <p>Сообщений пока нет.</p>}
            {data.messages
                .filter((m) => m.internal || m.edited)
                .map((m) => (
                    <article key={m.id}>
                        <p>
                            <strong>
                                {m.internal ? 'Внутренняя заметка' : 'Сообщение'}
                                {m.edited ? ' · Изменено' : ''}
                            </strong>
                        </p>
                        <p>{m.body}</p>
                        {m.revisions.length > 0 && (
                            <details>
                                <summary>История версий — только сотрудникам</summary>
                                {m.revisions.map((r, i) => (
                                    <p key={i}>
                                        {r.createdAt}: {r.body}
                                    </p>
                                ))}
                            </details>
                        )}
                    </article>
                ))}
            <h3>Вложения</h3>
            <p>
                Приватные файлы. Загрузка и модерация вложений недоступны до подключения защищённого хранилища и
                медиасканера. Ни mock, ни backend не создают фиктивную загрузку.
            </p>
            {data.attachments.map((a) => (
                <p key={a.id}>
                    {a.name} —{' '}
                    {
                        {
                            uploading: 'Загружается',
                            pending: 'Проверяется',
                            ready: 'Готов',
                            rejected: 'Отклонён',
                            hidden: 'Скрыт',
                        }[a.status]
                    }
                    {a.reason ? `: ${a.reason}` : ''}. Скачивание пока недоступно.
                </p>
            ))}
            <form onSubmit={(event) => void submit(event)}>
                <label>
                    Действие
                    <select
                        value={action}
                        disabled={busy}
                        onChange={(e) => {
                            setAction(e.target.value);
                            setTarget('');
                            setFiles([]);
                            setText('');
                        }}
                    >
                        <option value="note">Внутренняя заметка</option>
                        <option value="assign">Назначить ответственного</option>
                        <option value="edit">Изменить своё сообщение</option>
                        <option value="attach" disabled>
                            Отправить вложения — storage не подключён
                        </option>
                        <option value="hide" disabled>
                            Скрыть вложение — storage не подключён
                        </option>
                    </select>
                </label>
                {action === 'assign' && (
                    <label>
                        Сотрудник
                        <select value={target} onChange={(e) => setTarget(e.target.value)} disabled={busy}>
                            <option value="">Вернуть в общую очередь</option>
                            {data.staff.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.label}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                {action === 'edit' && (
                    <label>
                        Моё сообщение
                        <select
                            required
                            value={target}
                            disabled={busy}
                            onChange={(e) => {
                                setTarget(e.target.value);
                                setText(data.messages.find((m) => m.id === e.target.value)?.body ?? '');
                            }}
                        >
                            <option value="">Выберите сообщение</option>
                            {data.messages
                                .filter((m) => m.canEdit)
                                .map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.body.slice(0, 80)}
                                    </option>
                                ))}
                        </select>
                    </label>
                )}
                {action === 'hide' && (
                    <label>
                        Вложение
                        <select required value={target} disabled={busy} onChange={(e) => setTarget(e.target.value)}>
                            <option value="">Выберите файл</option>
                            {data.attachments.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.name}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                {action !== 'assign' && (
                    <label>
                        {action === 'hide' ? 'Причина скрытия' : 'Текст'}
                        <textarea
                            className={styles['message-input']}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            required={action !== 'attach'}
                            maxLength={10000}
                            disabled={busy}
                        />
                    </label>
                )}
                {action === 'attach' && (
                    <label>
                        До 5 файлов по 10 МБ; видео до 10 секунд
                        <input
                            type="file"
                            multiple
                            accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/webm,video/quicktime"
                            disabled={busy}
                            onChange={(e) => {
                                const selected = [...(e.target.files ?? [])];
                                setFiles([]);
                                if (selected.length > 5) {
                                    setFeedback('Не более 5 файлов.');
                                    return;
                                }
                                setBusy(true);
                                void Promise.all(selected.map(describeFile))
                                    .then(setFiles)
                                    .catch((error: unknown) =>
                                        setFeedback(error instanceof Error ? error.message : 'Ошибка файла'),
                                    )
                                    .finally(() => setBusy(false));
                            }}
                        />
                        {files.map((f) => (
                            <span key={f.name}>{f.name} </span>
                        ))}
                    </label>
                )}
                <button className="button primary" disabled={busy || action === 'attach' || action === 'hide'}>
                    {busy ? 'Сохраняем…' : 'Сохранить'}
                </button>
            </form>
            {feedback && <p role="status">{feedback}</p>}
        </section>
    );
}
export function SupportCreate() {
    const { api, queryClient } = useRuntime();
    const begin = useRequestSignal();
    const [recipient, setRecipient] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [result, setResult] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
    const lock = useRef(false);
    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!api || lock.current) return;
        const fingerprint = JSON.stringify([recipient, subject, body]);
        if (attempt.current && attempt.current.fingerprint !== fingerprint) {
            setError('Повторите прежний запрос для проверки результата.');
            return;
        }
        attempt.current ??= { fingerprint, key: crypto.randomUUID() };
        lock.current = true;
        setBusy(true);
        setError('');
        const signal = begin();
        try {
            const response = await api.request(
                'POST /api/v1/admin/support/create',
                { requesterId: recipient, subject, body, idempotencyKey: attempt.current.key },
                signal,
            );
            signal.throwIfAborted();
            attempt.current = null;
            setResult(response.data.ticketId);
            await queryClient.invalidateQueries({ queryKey: ['admin'] });
        } catch (e) {
            if (signal.aborted) return;
            if (e instanceof ApiError && e.status < 500) attempt.current = null;
            setError(e instanceof Error ? e.message : 'Ошибка отправки');
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }
    return (
        <details className={styles.card}>
            <summary>Начать новое обращение</summary>
            <p>По существующему вопросу продолжите прежнее обращение. Пользователь видит отправителя «Поддержка».</p>
            <form onSubmit={(e) => void submit(e)}>
                <label>
                    UUID пользователя
                    <input required value={recipient} onChange={(e) => setRecipient(e.target.value)} disabled={busy} />
                </label>
                <label>
                    Тема
                    <input
                        required
                        maxLength={200}
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        disabled={busy}
                    />
                </label>
                <label>
                    Сообщение
                    <textarea
                        className={styles['message-input']}
                        required
                        maxLength={10000}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        disabled={busy}
                    />
                </label>
                <button className="button primary" disabled={busy}>
                    {busy ? 'Создаём…' : 'Создать обращение'}
                </button>
            </form>
            {error && <p role="alert">{error}</p>}
            {result && (
                <p role="status">
                    <Link to={`/admin/support/${result}`}>Открыть созданное обращение</Link>
                </p>
            )}
        </details>
    );
}
