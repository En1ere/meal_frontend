import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CriticalConfirmation } from '../auth/critical-confirmation.js';
import { useRequestSignal } from '../auth/use-request-signal.js';
import type { ReviewCommand, ReviewResult } from './contracts.js';
import styles from './review-workspace.module.css';
export type ReviewApi = (command: ReviewCommand, signal?: AbortSignal) => Promise<ReviewResult>;
export function ReviewWorkspace({
    section,
    id,
    api,
}: {
    section: 'legal-requests' | 'rollback';
    id: string;
    api: ReviewApi;
}) {
    const cache = useQueryClient();
    const key = ['admin-review', section, id];
    const query = useQuery({
        queryKey: key,
        queryFn: ({ signal }) => api({ action: 'load' }, signal),
        refetchInterval: 60000,
    });
    const [reason, setReason] = useState('');
    const [preview, setPreview] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const busy = useRef(false);
    const beginRequest = useRequestSignal();
    const retry = useRef<{ digest: string; key: string } | null>(null);
    async function run(command: ReviewCommand) {
        if (busy.current) return;
        busy.current = true;
        setPending(true);
        setError('');
        setMessage('');
        if (command.action === 'prepare-export' || command.action === 'apply-rollback') {
            const digest = JSON.stringify({ ...command, data: { ...command.data, idempotencyKey: '' } });
            if (retry.current?.digest !== digest) retry.current = { digest, key: command.data.idempotencyKey };
            command = { ...command, data: { ...command.data, idempotencyKey: retry.current.key } };
        }
        const signal = beginRequest();
        try {
            const result = await api(command, signal);
            signal.throwIfAborted();
            cache.setQueryData(key, result);
            setPreview(result.previewKey);
            setMessage(result.message);
            retry.current = null;
        } catch (failure) {
            if (!signal.aborted) setError(failure instanceof Error ? failure.message : 'Не удалось выполнить команду.');
        } finally {
            busy.current = false;
            setPending(false);
        }
    }
    if (query.isPending) return <p role="status">Загрузка зависимостей и истории…</p>;
    if (query.isError || !query.data)
        return (
            <p role="alert">
                Не удалось загрузить запрос.{' '}
                <button className="button outline" onClick={() => void query.refetch()}>
                    Повторить
                </button>
            </p>
        );
    const data = query.data;
    return (
        <section className={styles.workspace} aria-busy={pending}>
            <h2>
                {section === 'legal-requests'
                    ? 'Проверка запроса и экспорт данных'
                    : 'Предпросмотр компенсирующего отката'}
            </h2>
            {error && <p role="alert">{error}</p>}
            {message && <p role="status">{message}</p>}
            {section === 'legal-requests' ? (
                <>
                    <p>
                        Заявитель: {data.requesterId ?? 'Не определён'}.{' '}
                        {data.identityVerified
                            ? 'Проверка личности подтверждена.'
                            : 'Подтверждение личности ещё не получено.'}
                    </p>
                    <p>
                        {data.identityEvidence ??
                            'Статус поступает из проверенного процесса аккаунта или поддержки. Вручную отметить проверку на этой странице нельзя.'}
                    </p>
                    <h3>Зависимости</h3>
                    <ul>
                        {data.dependencies.map((item) => (
                            <li key={item.label}>
                                <strong>{item.label}</strong>: {item.detail}
                            </li>
                        ))}
                    </ul>
                    <h3>Состав экспорта</h3>
                    <p>
                        Предпросмотр показывает состав и зависимости, но не создаёт файл. Чужие приватные данные не
                        включаются.
                    </p>
                    <p role="note">Подготовка и выдача архива недоступны до подключения защищённого хранилища.</p>
                    {data.exportData && (
                        <article>
                            <h3>{data.exportData.status === 'ready' ? 'Тестовый файл готов' : 'Срок файла истёк'}</h3>
                            <p>
                                Доступен заявителю до {new Date(data.exportData.expiresAt).toLocaleString('ru-RU')}.
                                Администратор не может скачать файл другого пользователя.
                            </p>
                            <ul>
                                {data.exportData.sections.map((name) => (
                                    <li key={name}>{name}</li>
                                ))}
                            </ul>
                        </article>
                    )}
                    <button className="button outline" disabled title="Не утверждены сроки хранения">
                        Окончательное удаление недоступно
                    </button>
                    <p>TODO: утвердить политику хранения аккаунтов, платежей, обращений, аудита и резервных копий.</p>
                </>
            ) : (
                <>
                    <p>
                        Поздние чужие изменения сохраняются. Откат создаёт новые компенсирующие события, не
                        перезаписывает старую историю.
                    </p>
                    <div className={styles.table}>
                        <table>
                            <caption>Последствия для каждого элемента</caption>
                            <thead>
                                <tr>
                                    <th>Объект</th>
                                    <th>До / после исходного действия</th>
                                    <th>Сейчас</th>
                                    <th>Результат проверки</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.items.map((item) => (
                                    <tr key={item.id}>
                                        <td>{item.targetId}</td>
                                        <td>
                                            {item.before} → {item.after}
                                        </td>
                                        <td>
                                            {item.current} · версия {item.actualVersion}
                                        </td>
                                        <td>
                                            <strong>
                                                {
                                                    {
                                                        ready: 'Готов',
                                                        conflict: 'Конфликт',
                                                        blocked: 'Не поддерживается',
                                                        applied: 'Компенсирован',
                                                    }[item.state]
                                                }
                                            </strong>
                                            <p>{item.reason}</p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <CriticalConfirmation />
                </>
            )}
            <button
                className="button outline"
                disabled={pending}
                onClick={() => void run({ action: 'preview', data: { version: data.version } })}
            >
                Обновить предпросмотр последствий
            </button>
            {preview && (
                <p role="status">
                    Предпросмотр подготовлен для версии {data.version}. При изменении зависимостей сервер отклонит
                    выполнение.
                </p>
            )}
            <label>
                Причина действия
                <textarea
                    maxLength={2000}
                    value={reason}
                    disabled={pending}
                    onChange={(e) => setReason(e.target.value)}
                />
            </label>
            <button
                className="button outline"
                disabled={
                    pending ||
                    !preview ||
                    !reason.trim() ||
                    (section === 'legal-requests' ? true : !data.items.some((item) => item.state === 'ready'))
                }
                onClick={() =>
                    preview &&
                    void run({
                        action: section === 'legal-requests' ? 'prepare-export' : 'apply-rollback',
                        data: {
                            version: data.version,
                            previewKey: preview,
                            reason,
                            idempotencyKey: crypto.randomUUID(),
                        },
                    })
                }
            >
                {section === 'legal-requests'
                    ? 'Подготовка архива недоступна'
                    : 'Компенсировать только готовые элементы'}
            </button>
            <details>
                <summary>История ({data.history.length})</summary>
                {data.history.map((entry, index) => (
                    <article key={index}>
                        <p>
                            {entry.action} · {new Date(entry.at).toLocaleString('ru-RU')}
                        </p>
                        <p>{entry.reason}</p>
                        <small>{entry.actor}</small>
                    </article>
                ))}
            </details>
            {!!data.relatedRequests.length && (
                <nav aria-label="Связанные примеры запросов">
                    <ul>
                        {data.relatedRequests.map((request) => (
                            <li key={request.id}>
                                <Link to={`/admin/legal-requests/${request.id}`}>{request.label}</Link>
                            </li>
                        ))}
                    </ul>
                </nav>
            )}
        </section>
    );
}
