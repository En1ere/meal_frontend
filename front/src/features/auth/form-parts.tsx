'use client';
import { useId, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { ApiError } from '../../shared/api/client.js';
import { ZodError } from 'zod';
import { InlineLoader as ArcInlineLoader } from '@meal-planner/design-system';
import { useRequestSignal } from './use-request-signal.js';

export const passwordHelp = 'От 12 до 128 символов: строчные и заглавные буквы, цифры и специальные символы.';
export function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
    const id = useId();
    return (
        <label htmlFor={id}>
            {label}
            <input id={id} {...props} />
        </label>
    );
}
export function PasswordField({
    label = 'Пароль',
    fresh = false,
    ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; fresh?: boolean }) {
    const id = useId();
    const [visible, setVisible] = useState(false);
    return (
        <div>
            <label htmlFor={id}>{label}</label>
            <div className="password-field">
                <input
                    id={id}
                    type={visible ? 'text' : 'password'}
                    autoComplete={fresh ? 'new-password' : 'current-password'}
                    required
                    minLength={fresh ? 12 : undefined}
                    maxLength={fresh ? 128 : 1024}
                    {...props}
                />
                <button
                    type="button"
                    disabled={props.disabled}
                    aria-label={`${visible ? 'Скрыть' : 'Показать'}: ${label}`}
                    aria-pressed={visible}
                    onClick={() => setVisible(!visible)}
                >
                    {visible ? 'Скрыть' : 'Показать'}
                </button>
            </div>
        </div>
    );
}
export function Submit({ pending, disabled, children }: { pending: boolean; disabled?: boolean; children: ReactNode }) {
    return (
        <button type="submit" className="button primary" disabled={pending || disabled}>
            {pending && <ArcInlineLoader label={null} />}
            {pending ? 'Подождите…' : children}
        </button>
    );
}
export function Feedback({ error, notice }: { error?: string | undefined; notice?: string | undefined }) {
    return (
        <>
            {error && (
                <p className="form-error" role="alert">
                    {error}
                </p>
            )}
            {notice && (
                <p className="inline-note" role="status">
                    {notice}
                </p>
            )}
        </>
    );
}
export function useAccountAction() {
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const locked = useRef(false);
    const beginRequest = useRequestSignal();
    async function run(action: (signal: AbortSignal) => Promise<void>, cleanup?: () => void) {
        if (locked.current) return;
        locked.current = true;
        setPending(true);
        setError('');
        setNotice('');
        const signal = beginRequest();
        try {
            await action(signal);
            signal.throwIfAborted();
        } catch (cause) {
            if (!signal.aborted && !(cause instanceof DOMException && cause.name === 'AbortError'))
                setError(
                    cause instanceof ApiError
                        ? cause.message
                        : cause instanceof ZodError
                          ? 'Проверьте формат заполненных полей или запросите новую ссылку.'
                          : cause instanceof Error && cause.name === 'FormError'
                            ? cause.message
                            : 'Не удалось выполнить запрос. Проверьте подключение и состояние операции перед повтором.',
                );
        } finally {
            cleanup?.();
            locked.current = false;
            if (!signal.aborted) setPending(false);
        }
    }
    return { pending, error, notice, setNotice, run };
}
export function formError(message: string): never {
    const error = new Error(message);
    error.name = 'FormError';
    throw error;
}
export function validatePassword(password: string, repeat: string) {
    if (password !== repeat) formError('Пароли не совпадают.');
    if (
        password.length < 12 ||
        password.length > 128 ||
        !/\p{Ll}/u.test(password) ||
        !/\p{Lu}/u.test(password) ||
        !/\p{N}/u.test(password) ||
        !/[^\p{L}\p{N}\s]/u.test(password)
    )
        formError(passwordHelp);
}
