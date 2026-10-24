import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRuntime } from '../../app/providers.js';
import { CriticalConfirmation } from '../auth/critical-confirmation.js';
import { useRequestSignal } from '../auth/use-request-signal.js';

export function AccountDeletionReview({ id, version }: { id: string; version: number }) {
    const { api } = useRuntime();
    const queryClient = useQueryClient();
    const begin = useRequestSignal();
    const [decision, setDecision] = useState<'approve' | 'reject'>('approve');
    const [reason, setReason] = useState('');
    const [confirmed, setConfirmed] = useState(false);
    const [message, setMessage] = useState('');
    const lock = useRef(false);
    const mutation = useMutation({
        mutationFn: async () => {
            if (!api) throw new Error('Подключение не готово');
            const signal = begin();
            return (
                await api.request(
                    'POST /api/v1/admin/account-deletions/{id}/review',
                    { decision, expectedVersion: version, reason: reason.trim() },
                    signal,
                    { id },
                )
            ).data;
        },
        onSuccess: async (result) => {
            setConfirmed(false);
            setMessage(
                result.status === 'rejected'
                    ? 'Запрос отклонён. Решение сохранено в истории.'
                    : 'Проверка подтверждена. Финализация по-прежнему зависит от сроков хранения и блокеров.',
            );
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['admin-detail'] }),
                queryClient.invalidateQueries({ queryKey: ['admin-review'] }),
                queryClient.invalidateQueries({ queryKey: ['admin'] }),
            ]);
        },
        onSettled: () => {
            lock.current = false;
        },
    });
    function submit(event: FormEvent) {
        event.preventDefault();
        if (lock.current || !confirmed || reason.trim().length < 10) return;
        lock.current = true;
        setMessage('');
        mutation.mutate();
    }
    return (
        <section className="sessions-panel">
            <h2>Решение по удалению аккаунта</h2>
            <p>
                Подтверждение не удаляет данные немедленно. Оно разрешает перейти к ожиданию сроков хранения; активные
                блокеры и повторная проверка политики остаются обязательными.
            </p>
            <CriticalConfirmation />
            <form onSubmit={submit}>
                <label>
                    Решение
                    <select
                        value={decision}
                        disabled={mutation.isPending}
                        onChange={(event) => {
                            setDecision(event.target.value as 'approve' | 'reject');
                            setConfirmed(false);
                        }}
                    >
                        <option value="approve">Подтвердить проверку</option>
                        <option value="reject">Отклонить запрос</option>
                    </select>
                </label>
                <label>
                    Основание решения
                    <textarea
                        required
                        minLength={10}
                        maxLength={1000}
                        value={reason}
                        disabled={mutation.isPending}
                        onChange={(event) => {
                            setReason(event.target.value);
                            setConfirmed(false);
                        }}
                    />
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={confirmed}
                        disabled={mutation.isPending}
                        onChange={(event) => setConfirmed(event.target.checked)}
                    />
                    Подтверждаю решение и его основание
                </label>
                <button
                    className={decision === 'reject' ? 'button outline' : 'button primary'}
                    disabled={mutation.isPending || !confirmed || reason.trim().length < 10}
                >
                    {mutation.isPending ? 'Сохраняем…' : decision === 'approve' ? 'Подтвердить проверку' : 'Отклонить'}
                </button>
            </form>
            {mutation.isError && <p role="alert">{mutation.error.message}</p>}
            {message && <p role="status">{message}</p>}
        </section>
    );
}
