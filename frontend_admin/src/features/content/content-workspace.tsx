import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CriticalConfirmation } from '../auth/critical-confirmation.js';
import { useRequestSignal } from '../auth/use-request-signal.js';
import type { ContentCommand, ContentCompare, ContentResult } from './contracts.js';
import styles from './content-workspace.module.css';

export type ContentApi = (command: ContentCommand, signal?: AbortSignal) => Promise<ContentResult>;
export function ContentWorkspace({ section, id, api }: { section: 'queues' | 'catalog'; id: string; api: ContentApi }) {
    const cache = useQueryClient();
    const key = ['admin-content', section, id];
    const query = useQuery({ queryKey: key, queryFn: ({ signal }) => api({ action: 'load' }, signal) });
    const [reason, setReason] = useState('');
    const [second, setSecond] = useState('');
    const [canonical, setCanonical] = useState(id);
    const [choices, setChoices] = useState<Record<string, 'left' | 'right'>>({});
    const [preview, setPreview] = useState<ContentResult['comparison']>(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);
    const busy = useRef(false);
    const retry = useRef<{ digest: string; key: string } | null>(null);
    const beginRequest = useRequestSignal();
    async function run(command: ContentCommand) {
        if (busy.current) return;
        busy.current = true;
        setPending(true);
        setError('');
        setMessage('');
        if (command.action !== 'load' && command.action !== 'compare') {
            const digest = JSON.stringify({ ...command, data: { ...command.data, idempotencyKey: '' } });
            if (retry.current?.digest !== digest) retry.current = { digest, key: command.data.idempotencyKey };
            command = { ...command, data: { ...command.data, idempotencyKey: retry.current.key } } as ContentCommand;
        }
        const signal = beginRequest();
        try {
            const result = await api(command, signal);
            signal.throwIfAborted();
            cache.setQueryData(key, result);
            setPreview(result.comparison);
            setMessage(
                result.message || (command.action === 'compare' ? 'Предпросмотр обновлён.' : 'Решение сохранено.'),
            );
            retry.current = null;
        } catch (failure) {
            if (!signal.aborted)
                setError(failure instanceof Error ? failure.message : 'Не удалось выполнить действие.');
        } finally {
            busy.current = false;
            setPending(false);
        }
    }
    const data = query.data;
    if (query.isPending) return <p role="status">Загрузка материала и версий…</p>;
    if (query.isError || !data)
        return (
            <p role="alert">
                Не удалось получить материал.{' '}
                <button className="button outline" onClick={() => void query.refetch()}>
                    Повторить
                </button>
            </p>
        );
    const left = data.cards.find((card) => card.id === id);
    const right = data.cards.find((card) => card.id === second);
    const compare: ContentCompare | null =
        left && right
            ? {
                  leftId: left.id,
                  rightId: right.id,
                  leftVersion: left.version,
                  rightVersion: right.version,
                  canonicalId: canonical,
                  choices,
              }
            : null;
    return (
        <section className={styles.workspace} aria-busy={pending}>
            <h2>{section === 'queues' ? 'Проверка версии материала' : 'Сравнение и объединение дублей'}</h2>
            {error && (
                <p role="alert">
                    {error}{' '}
                    <button
                        className="button outline"
                        disabled={pending}
                        onClick={() => {
                            setPreview(null);
                            void query.refetch();
                        }}
                    >
                        Обновить данные
                    </button>
                </p>
            )}
            {message && <p role="status">{message}</p>}
            {section === 'queues' ? (
                <>
                    <div className={styles.columns}>
                        {(
                            [
                                ['current', 'Публичная версия'],
                                ['pending', 'Версия на проверке'],
                            ] as const
                        ).map(([field, title]) => (
                            <article key={field}>
                                <h3>{title}</h3>
                                {data[field] ? (
                                    <>
                                        <p>Версия {data[field].version}</p>
                                        <dl>
                                            {Object.entries(data[field].fields).map(([name, value]) => (
                                                <div key={name}>
                                                    <dt>{name}</dt>
                                                    <dd>{value ?? 'Не указано'}</dd>
                                                </div>
                                            ))}
                                        </dl>
                                    </>
                                ) : (
                                    <p>{field === 'current' ? 'Публичной версии нет.' : 'Ожидающей версии нет.'}</p>
                                )}
                            </article>
                        ))}
                    </div>
                    <p>
                        Отклонение новой версии сохраняет прежнюю публичную. Скрытие сохраняет доступ автора и семьи;
                        возврат в публикацию проходит модерацию.
                    </p>
                    <label>
                        Причина, видимая автору
                        <textarea
                            value={reason}
                            maxLength={2000}
                            disabled={pending}
                            onChange={(e) => setReason(e.target.value)}
                        />
                    </label>
                    <div className={styles.actions}>
                        {(['approve', 'reject', 'hide', 'unpublish'] as const).map((action) => (
                            <button
                                className="button outline"
                                key={action}
                                disabled={
                                    pending ||
                                    (action !== 'approve' && !reason.trim()) ||
                                    (action === 'approve' || action === 'reject' ? !data.pending : !data.current)
                                }
                                onClick={() =>
                                    void run({
                                        action: 'moderate',
                                        data: {
                                            action,
                                            version: data.version,
                                            reason,
                                            idempotencyKey: crypto.randomUUID(),
                                        },
                                    })
                                }
                            >
                                {
                                    {
                                        approve: 'Одобрить эту версию',
                                        reject: 'Отклонить с причиной',
                                        hide: 'Скрыть публично',
                                        unpublish: 'Снять с публикации',
                                    }[action]
                                }
                            </button>
                        ))}
                    </div>
                </>
            ) : (
                <>
                    {left?.aliasOf ? (
                        <p>Эта карточка объединена с {left.aliasOf}. Старый идентификатор продолжает работать.</p>
                    ) : (
                        <>
                            <label>
                                Кандидат для сравнения
                                <select
                                    value={second}
                                    disabled={pending}
                                    onChange={(e) => {
                                        setSecond(e.target.value);
                                        setChoices({});
                                        setPreview(null);
                                    }}
                                >
                                    <option value="">Выберите карточку</option>
                                    {data.cards
                                        .filter((card) => card.id !== id && !card.aliasOf)
                                        .map((card) => (
                                            <option key={card.id} value={card.id}>
                                                {card.name}
                                            </option>
                                        ))}
                                </select>
                            </label>
                            <label>
                                Основная карточка
                                <select
                                    value={canonical}
                                    disabled={pending || !right}
                                    onChange={(e) => {
                                        setCanonical(e.target.value);
                                        setPreview(null);
                                    }}
                                >
                                    <option value={id}>{left?.name ?? id}</option>
                                    {right && <option value={right.id}>{right.name}</option>}
                                </select>
                            </label>
                            {left && right && (
                                <div className={styles.table}>
                                    <table>
                                        <caption>Явное разрешение каждого различия</caption>
                                        <thead>
                                            <tr>
                                                <th>Поле</th>
                                                <th>Текущая карточка</th>
                                                <th>Кандидат</th>
                                                <th>Итог</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.keys(left.fields).map((field) => (
                                                <tr key={field}>
                                                    <th>{field}</th>
                                                    <td>{left.fields[field] ?? 'Не указано'}</td>
                                                    <td>{right.fields[field] ?? 'Не указано'}</td>
                                                    <td>
                                                        {left.fields[field] === right.fields[field] ? (
                                                            'Совпадает'
                                                        ) : (
                                                            <select
                                                                aria-label={`Итог поля ${field}`}
                                                                value={choices[field] ?? ''}
                                                                disabled={pending}
                                                                onChange={(e) => {
                                                                    setChoices({
                                                                        ...choices,
                                                                        [field]: e.target.value as 'left' | 'right',
                                                                    });
                                                                    setPreview(null);
                                                                }}
                                                            >
                                                                <option value="">Разрешите конфликт</option>
                                                                <option value="left">Текущая карточка</option>
                                                                <option value="right">Кандидат</option>
                                                            </select>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            <p>
                                Фасовки сохранятся отдельными вариантами. Прошлое питание, покупки и расходы не
                                пересчитываются. Старые ID сохраняются как ссылки.
                            </p>
                            <button
                                className="button outline"
                                disabled={pending || !compare}
                                onClick={() => compare && void run({ action: 'compare', data: compare })}
                            >
                                Предпросмотр объединения
                            </button>
                            {preview && (
                                <article>
                                    <h3>Итог и последствия</h3>
                                    {preview.blockedReason && <p role="alert">{preview.blockedReason}</p>}
                                    <dl>
                                        {Object.entries(preview.resolved).map(([field, value]) => (
                                            <div key={field}>
                                                <dt>{field}</dt>
                                                <dd>{value ?? 'Не указано'}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                    <p>
                                        Основной ID: {preview.canonicalId}. Вариантов фасовки:{' '}
                                        {new Set([...preview.left.variants, ...preview.right.variants]).size}. Источники
                                        и авторство сохраняются.
                                    </p>
                                    {preview.conflicts.some((field) => !choices[field]) && (
                                        <p>Выберите итог для каждого конфликта.</p>
                                    )}
                                </article>
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
                            <CriticalConfirmation />
                            <div className={styles.actions}>
                                <button
                                    className="button outline"
                                    disabled={
                                        pending ||
                                        !compare ||
                                        !preview ||
                                        !!preview.blockedReason ||
                                        preview.conflicts.some((field) => !choices[field]) ||
                                        !reason.trim()
                                    }
                                    onClick={() =>
                                        compare &&
                                        preview &&
                                        void run({
                                            action: 'merge',
                                            data: {
                                                ...compare,
                                                previewKey: preview.previewKey,
                                                reason,
                                                idempotencyKey: crypto.randomUUID(),
                                            },
                                        })
                                    }
                                >
                                    Подтвердить объединение
                                </button>
                                <button
                                    className="button outline"
                                    disabled={pending || !compare || !reason.trim()}
                                    onClick={() =>
                                        compare &&
                                        void run({
                                            action: 'not-duplicate',
                                            data: {
                                                leftId: compare.leftId,
                                                rightId: compare.rightId,
                                                leftVersion: compare.leftVersion,
                                                rightVersion: compare.rightVersion,
                                                reason,
                                                idempotencyKey: crypto.randomUUID(),
                                            },
                                        })
                                    }
                                >
                                    Это не дубли
                                </button>
                            </div>
                        </>
                    )}
                </>
            )}
            <details>
                <summary>История решений ({data.history.length})</summary>
                {data.history.map((entry, index) => (
                    <article key={index}>
                        <p>
                            {entry.action} · {new Date(entry.at).toLocaleString('ru-RU')}
                        </p>
                        <p>
                            {entry.reason || 'Без дополнительного комментария'} · {entry.actor}
                        </p>
                    </article>
                ))}
            </details>
        </section>
    );
}
