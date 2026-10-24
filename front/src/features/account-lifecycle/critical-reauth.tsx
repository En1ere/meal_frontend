'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../app/providers.js';
import { ApiError } from '../../shared/api/client.js';
import styles from './lifecycle.module.css';

export type ReauthResult = { token: string; expiresAt: string };

export function CriticalReauthDialog({
    open,
    purpose,
    onCancel,
    onSuccess,
}: {
    open: boolean;
    purpose: 'export' | 'account_lifecycle';
    onCancel: () => void;
    onSuccess: (value: ReauthResult) => void;
}) {
    const { api } = useRuntime();
    const dialog = useRef<HTMLDialogElement>(null);
    const [password, setPassword] = useState('');
    const [method, setMethod] = useState<'totp' | 'recovery'>('totp');
    const [code, setCode] = useState('');
    const security = useQuery({
        queryKey: ['auth', 'security', 'critical-reauth'],
        enabled: open && !!api,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/auth/security', undefined, signal)).data,
    });
    const mutation = useMutation({
        mutationFn: async () =>
            (
                await api!.request('POST /api/v1/account/critical-reauth', {
                    purpose,
                    password,
                    factor: security.data?.authenticatorEnabled ? { method, code } : null,
                })
            ).data,
        onSuccess: (value) => {
            setPassword('');
            setCode('');
            dialog.current?.close();
            onSuccess({ token: value.reauthToken, expiresAt: value.expiresAt });
        },
    });
    useEffect(() => {
        const node = dialog.current;
        if (!node) return;
        if (open && !node.open) node.showModal();
        if (!open && node.open) node.close();
    }, [open]);
    const close = () => {
        if (mutation.isPending) return;
        setPassword('');
        setCode('');
        onCancel();
    };
    const submit = (event: FormEvent) => {
        event.preventDefault();
        mutation.mutate();
    };
    const riskHeld = mutation.error instanceof ApiError && mutation.error.code === 'RISK_HELD';
    return (
        <dialog ref={dialog} className={styles.dialog} aria-labelledby="critical-reauth-title" onClose={close}>
            <form onSubmit={submit}>
                <div className={styles['dialog-body']}>
                    <p className={styles.eyebrow}>Критическое действие</p>
                    <h2 id="critical-reauth-title">Подтвердите личность</h2>
                    <p>Подтверждение действует один раз и только для выбранного действия.</p>
                    {security.isPending ? (
                        <p role="status">Проверяем способы входа…</p>
                    ) : security.isError ? (
                        <p role="alert">Не удалось проверить способ подтверждения. Закройте окно и повторите.</p>
                    ) : (
                        <>
                            <label>
                                Текущий пароль
                                <input
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                />
                            </label>
                            {security.data.authenticatorEnabled && (
                                <>
                                    <label>
                                        Способ подтверждения
                                        <select
                                            value={method}
                                            onChange={(event) =>
                                                setMethod(event.target.value === 'recovery' ? 'recovery' : 'totp')
                                            }
                                        >
                                            <option value="totp">Код приложения</option>
                                            <option value="recovery">Резервный код</option>
                                        </select>
                                    </label>
                                    <label>
                                        {method === 'totp' ? 'Шестизначный код' : 'Резервный код'}
                                        <input
                                            inputMode={method === 'totp' ? 'numeric' : 'text'}
                                            autoComplete="one-time-code"
                                            required
                                            minLength={6}
                                            value={code}
                                            onChange={(event) => setCode(event.target.value.trim())}
                                        />
                                    </label>
                                </>
                            )}
                        </>
                    )}
                    {mutation.isError && (
                        <p role="alert">
                            {riskHeld
                                ? 'Операция временно удержана проверкой риска. Обратитесь в поддержку.'
                                : 'Подтверждение не принято или истекло. Проверьте данные и повторите.'}
                        </p>
                    )}
                </div>
                <div className={styles['dialog-actions']}>
                    <button
                        type="button"
                        className="button outline"
                        autoFocus
                        onClick={() => dialog.current?.close()}
                        disabled={mutation.isPending}
                    >
                        Отмена
                    </button>
                    <button
                        className="button primary"
                        disabled={security.isPending || security.isError || mutation.isPending || riskHeld}
                    >
                        {mutation.isPending ? 'Проверяем…' : 'Подтвердить'}
                    </button>
                </div>
            </form>
        </dialog>
    );
}
