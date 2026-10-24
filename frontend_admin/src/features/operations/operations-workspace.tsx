import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../app/providers.js';
import { useSession } from '../auth/session.js';
import { useRequestSignal } from '../auth/use-request-signal.js';
import { CriticalConfirmation } from '../auth/critical-confirmation.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import { InlineLoader as ArcInlineLoader } from '@meal-planner/design-system';
import { operationsResultSchema, type Operation, type OperationsResult } from './contracts.js';

const labels: Record<Operation, string> = {
    retry: 'Повторить задачу',
    cancel: 'Отменить ожидающую задачу',
    new: 'Новая',
    in_progress: 'В работе',
    resolved: 'Решена',
    ignored: 'Игнорируется',
};
export function OperationsWorkspace({
    section,
    id,
    itemVersion,
}: {
    section: 'operations' | 'errors';
    id: string;
    itemVersion: string;
}) {
    const { api, queryClient } = useRuntime();
    const session = useSession('admin');
    const beginRequest = useRequestSignal();
    const [operation, setOperation] = useState<Operation>(section === 'errors' ? 'in_progress' : 'retry');
    const [reason, setReason] = useState('');
    const [ignoreUntil, setIgnoreUntil] = useState('');
    const [preview, setPreview] = useState<OperationsResult | null>(null);
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const lock = useRef(false);
    const attempt = useRef<string | null>(null);
    const key = ['operations-workspace', session.data?.id, section, id, itemVersion];
    const query = useQuery({
        queryKey: key,
        enabled: !!api,
        queryFn: async ({ signal }) =>
            operationsResultSchema.parse(
                (
                    await api!.request(
                        'POST /api/v1/admin/operations-workspace/inspect',
                        {
                            section,
                            id,
                            action: 'inspect',
                            operation,
                            reason: '',
                            ignoreUntil: null,
                            expectedVersion: itemVersion,
                            idempotencyKey: crypto.randomUUID(),
                        },
                        signal,
                    )
                ).data,
            ),
    });
    function changed() {
        setPreview(null);
        attempt.current = null;
        setMessage('');
    }
    async function run(action: 'preview' | 'execute') {
        if (lock.current || !query.data) return;
        if (action === 'execute' && (!preview || preview.version !== query.data.version)) return;
        lock.current = true;
        setBusy(true);
        setMessage('');
        const signal = beginRequest();
        try {
            attempt.current ??= crypto.randomUUID();
            const body = {
                section,
                id,
                action,
                operation,
                reason,
                ignoreUntil: operation === 'ignored' && ignoreUntil ? new Date(ignoreUntil).toISOString() : null,
                expectedVersion: preview?.version ?? query.data.version,
                idempotencyKey: attempt.current,
            };
            const result = operationsResultSchema.parse(
                (
                    await api!.request(
                        action === 'preview'
                            ? 'POST /api/v1/admin/operations-workspace/preview'
                            : 'POST /api/v1/admin/operations-workspace/execute',
                        body,
                        signal,
                    )
                ).data,
            );
            signal.throwIfAborted();
            if (action === 'preview') setPreview(result);
            else {
                setPreview(null);
                attempt.current = null;
                setMessage(result.message);
                await queryClient.invalidateQueries({ queryKey: ['operations-workspace'] });
                await queryClient.invalidateQueries({ queryKey: ['admin'] });
                await queryClient.invalidateQueries({ queryKey: ['admin-detail'] });
            }
        } catch (error) {
            if (!signal.aborted) setMessage(error instanceof Error ? error.message : 'Не удалось выполнить команду.');
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }
    return (
        <section className="sessions-panel" aria-busy={busy}>
            <h2>{section === 'errors' ? 'Состояние инцидента' : 'Управление задачей'}</h2>
            {query.isPending ? (
                <ArcSkeleton variant="lines" lines={3} />
            ) : query.isError ? (
                <div role="alert">
                    <p>{query.error.message}</p>
                    <button
                        onClick={() => {
                            changed();
                            void query.refetch();
                        }}
                    >
                        Повторить загрузку
                    </button>
                </div>
            ) : (
                <>
                    <p>
                        Текущее состояние:{' '}
                        {labels[query.data.status as Operation] ??
                            (
                                {
                                    failed: 'Ошибка',
                                    queued: 'Ожидает',
                                    pending: 'Ожидает',
                                    running: 'Выполняется',
                                    cancelled: 'Отменена',
                                } as Record<string, string>
                            )[query.data.status] ??
                            query.data.status}
                    </p>
                    <p className="inline-note">{query.data.failure}</p>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            void run('preview');
                        }}
                    >
                        <fieldset disabled={busy} style={{ border: 0, padding: 0, minWidth: 0 }}>
                            <label>
                                Действие
                                <select
                                    value={operation}
                                    onChange={(event) => {
                                        changed();
                                        setOperation(event.target.value as Operation);
                                    }}
                                >
                                    {query.data.allowed.map((entry) => (
                                        <option key={entry.operation} value={entry.operation} disabled={!entry.enabled}>
                                            {labels[entry.operation]}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            {query.data.allowed
                                .filter((entry) => !entry.enabled)
                                .map((entry) => (
                                    <p className="inline-note" key={entry.operation}>
                                        {labels[entry.operation]}: {entry.reason}
                                    </p>
                                ))}
                            <label>
                                Причина
                                <textarea
                                    required
                                    maxLength={2000}
                                    value={reason}
                                    onChange={(event) => {
                                        changed();
                                        setReason(event.target.value);
                                    }}
                                />
                            </label>
                            {operation === 'ignored' && (
                                <label>
                                    Игнорировать до (ваше локальное время)
                                    <input
                                        required
                                        type="datetime-local"
                                        value={ignoreUntil}
                                        onChange={(event) => {
                                            changed();
                                            setIgnoreUntil(event.target.value);
                                        }}
                                    />
                                </label>
                            )}
                            <button
                                disabled={!query.data.allowed.find((entry) => entry.operation === operation)?.enabled}
                                type="submit"
                            >
                                Проверить последствия
                            </button>
                        </fieldset>
                    </form>
                    {preview?.preview && (
                        <section aria-label="Предпросмотр последствий">
                            <h3>Последствия</h3>
                            <p>{preview.preview.summary}</p>
                            <p>Причина: {reason}</p>
                            {preview.preview.critical && <CriticalConfirmation />}
                            <button disabled={busy} onClick={() => void run('execute')}>
                                Подтвердить действие
                            </button>
                            <button disabled={busy} onClick={changed}>
                                Отказаться
                            </button>
                        </section>
                    )}
                </>
            )}
            {busy && <ArcInlineLoader label="Выполняем…" />}
            {message && <p role="status">{message}</p>}
        </section>
    );
}
