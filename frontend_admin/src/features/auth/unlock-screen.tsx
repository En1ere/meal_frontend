import { useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useRuntime } from '../../app/providers.js';
import { ApiError } from '../../shared/api/client.js';
import { setAdminUnlock } from '../../shared/auth/unlock.js';
import { InlineLoader as ArcInlineLoader } from '@meal-planner/design-system';
import { AuthShell } from './auth-shell.js';
import { useRequestSignal } from './use-request-signal.js';
import styles from './security.module.css';

export function useAdminStatus() {
    const { api } = useRuntime();
    return useQuery({
        queryKey: ['admin-auth-status'],
        enabled: !!api,
        queryFn: async ({ signal }) => {
            if (!api) throw new Error('API not ready');
            try {
                return (await api.request('GET /api/v1/admin/auth/status', undefined, signal)).data;
            } catch (error) {
                if (error instanceof ApiError && error.status === 401) return null;
                throw error;
            }
        },
    });
}

export function UnlockScreen({ returnTo }: { returnTo: string }) {
    const runtime = useRuntime();
    const navigate = useNavigate();
    const [code, setCode] = useState('');
    const [method, setMethod] = useState<'totp' | 'recovery'>('totp');
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const locked = useRef(false);
    const beginRequest = useRequestSignal();
    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!runtime.api || locked.current) return;
        locked.current = true;
        setPending(true);
        setError('');
        const signal = beginRequest();
        try {
            const response = await runtime.api.request('POST /api/v1/admin/auth/unlock', { code, method }, signal);
            signal.throwIfAborted();
            runtime.api.invalidate();
            setAdminUnlock(response.data.unlockToken);
            runtime.queryClient.clear();
            runtime.queryClient.setQueryData(['session', 'admin'], response.data.user);
            void navigate(returnTo, { replace: true });
        } catch (failure) {
            if (signal.aborted) return;
            setError(failure instanceof ApiError ? failure.message : 'Не удалось проверить код. Повторите попытку.');
            void runtime.queryClient.invalidateQueries({ queryKey: ['admin-auth-status'] });
        } finally {
            setCode('');
            setPending(false);
            locked.current = false;
        }
    }
    async function logout() {
        if (!runtime.api || locked.current) return;
        locked.current = true;
        setPending(true);
        setError('');
        const signal = beginRequest();
        try {
            await runtime.api.request('POST /api/v1/admin/auth/logout', undefined, signal);
            signal.throwIfAborted();
            runtime.reset();
            runtime.broadcast();
        } catch (failure) {
            if (!signal.aborted)
                setError(failure instanceof ApiError ? failure.message : 'Не удалось завершить сессию.');
        } finally {
            setPending(false);
            locked.current = false;
        }
    }
    return (
        <AuthShell staff>
            <h1>Подтвердите повторный вход</h1>
            <p className="auth-subtitle">
                Сессия сохранена на 7 дней с полного входа. Подтвердите доступ в этой вкладке; срок сессии не
                продлевается.
            </p>
            <form onSubmit={(event) => void submit(event)} aria-busy={pending}>
                <label htmlFor="unlock-code">{method === 'totp' ? 'Код из приложения' : 'Резервный код'}</label>
                <input
                    id="unlock-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    required
                    autoComplete="one-time-code"
                    inputMode={method === 'totp' ? 'numeric' : 'text'}
                    minLength={6}
                    maxLength={method === 'totp' ? 6 : 64}
                    disabled={pending}
                />
                {error && (
                    <p className="form-error" role="alert">
                        {error}
                    </p>
                )}
                <button className="button primary" disabled={pending}>
                    {pending && <ArcInlineLoader label={null} />}Подтвердить
                </button>
            </form>
            <button
                className={`text-button ${styles.alternate}`}
                disabled={pending}
                onClick={() => {
                    setMethod(method === 'totp' ? 'recovery' : 'totp');
                    setCode('');
                    setError('');
                }}
            >
                {method === 'totp' ? 'Использовать резервный код' : 'Ввести код из приложения'}
            </button>
            <button className={`text-button ${styles.alternate}`} disabled={pending} onClick={() => void logout()}>
                Выйти и сменить аккаунт
            </button>
        </AuthShell>
    );
}
