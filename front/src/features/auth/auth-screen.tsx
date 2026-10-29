'use client';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRuntime } from '../../shared/runtime/index.js';
import { ApiError } from '../../shared/api/client.js';
import { authRoutes, safeReturnTo, type AuthContext } from '../../shared/auth/routes.js';
import { AuthShell as DesignSystemAuthShell } from '@meal-planner/design-system';
import { Brand } from '../../shared/ui/brand.js';
import { ThemeControl } from '../../shared/ui/theme-control.js';
import { setUserSession, useSession } from '../../entities/session/client.js';
import { useRequestSignal } from '../../shared/api/use-request-signal.js';
import { InlineLoader as ArcInlineLoader } from '@meal-planner/design-system';

const neutralError = (error: unknown) =>
    error instanceof ApiError
        ? error.message
        : 'Не удалось связаться с сервисом. Проверьте подключение и попробуйте снова.';
export function AuthShell({ children, staff = false }: { children: ReactNode; staff?: boolean }) {
    return (
        <DesignSystemAuthShell
            service={staff}
            brand={<Brand large />}
            themeControl={<ThemeControl />}
            art={{
                src: staff ? '/assets/home-desktop-shell-botanical.webp' : '/assets/auth-cover-720x768.webp',
                alt: 'Уютная кухня с запасами и планом питания',
            }}
            artCaption={
                <p>
                    Планируйте вкусные блюда и экономьте
                    <br />
                    время каждый день.
                </p>
            }
        >
            {children}
        </DesignSystemAuthShell>
    );
}
export function SignIn({
    context = 'user',
    returnTo: requestedReturnTo,
    notice,
}: {
    context?: AuthContext;
    returnTo?: string | undefined;
    notice?: string | undefined;
}) {
    const runtime = useRuntime();
    const router = useRouter();
    const session = useSession(context);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [visible, setVisible] = useState(false);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const [method, setMethod] = useState<'password' | 'totp' | 'pin'>('password');
    const [methodsVisible, setMethodsVisible] = useState(false);
    const inFlight = useRef(false);
    const beginRequest = useRequestSignal();
    const errorRef = useRef<HTMLParagraphElement>(null);
    const returnTo = safeReturnTo(requestedReturnTo ?? null, context);
    useEffect(() => {
        if (session.data?.context === context) router.replace(returnTo);
    }, [session.data, context, router, returnTo]);
    useEffect(() => {
        if (error) errorRef.current?.focus();
    }, [error]);
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!runtime.api || inFlight.current) return;
        inFlight.current = true;
        setPending(true);
        setError('');
        const signal = beginRequest();
        try {
            if (context === 'user') {
                const response =
                    method === 'password'
                        ? await runtime.api.request('POST /api/v1/auth/login', { email, password }, signal)
                        : method === 'totp'
                          ? await runtime.api.request('POST /api/v1/auth/totp/login', { email, code: password }, signal)
                          : await runtime.api.request('POST /api/v1/auth/pin/login', { pin: password }, signal);
                signal.throwIfAborted();
                runtime.reset();
                setUserSession(runtime, response.data.user);
                runtime.broadcast();
            } else {
                const response = await runtime.api.request(
                    'POST /api/v1/staff/auth/login',
                    {
                        email,
                        password,
                        context,
                    },
                    signal,
                );
                signal.throwIfAborted();
                runtime.setMfa({ ...response.data, context, returnTo });
                router.push(authRoutes[context].mfa);
            }
        } catch (error) {
            if (!(error instanceof DOMException && error.name === 'AbortError')) setError(neutralError(error));
        } finally {
            setPassword('');
            setPending(false);
            inFlight.current = false;
        }
    }
    const title = context === 'user' ? 'С возвращением' : 'Вход модератора';
    const content = (
        <>
            <h1>{title}</h1>
            <p className="auth-subtitle">
                {context === 'user'
                    ? 'Войдите, чтобы продолжить планирование'
                    : 'Служебный доступ с двухфакторной проверкой'}
            </p>
            {context === 'user' && notice === 'password-changed' && (
                <p role="status" className="inline-note">
                    Пароль обновлён. Войдите с новым паролем. Все прежние сессии завершены.
                </p>
            )}
            <form onSubmit={(event) => void submit(event)} aria-busy={pending}>
                {method !== 'pin' && (
                    <>
                        <label htmlFor="email">Электронная почта</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="username"
                            required
                            maxLength={254}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="example@mail.ru"
                            disabled={pending}
                        />
                    </>
                )}
                <label htmlFor="password">
                    {method === 'password'
                        ? 'Пароль'
                        : method === 'totp'
                          ? 'Код из приложения'
                          : 'PIN этого устройства'}
                </label>
                <div className="password-field">
                    <input
                        id="password"
                        name="password"
                        type={visible ? 'text' : 'password'}
                        autoComplete={
                            method === 'password' ? 'current-password' : method === 'totp' ? 'one-time-code' : 'off'
                        }
                        inputMode={method === 'password' ? 'text' : 'numeric'}
                        pattern={method === 'password' ? undefined : '[0-9]{6}'}
                        required
                        maxLength={method === 'password' ? 1024 : 6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={method === 'password' ? 'Введите пароль' : '6 цифр'}
                        disabled={pending}
                    />
                    <button type="button" onClick={() => setVisible(!visible)} aria-pressed={visible}>
                        {visible ? 'Скрыть' : 'Показать'}
                    </button>
                </div>
                {(error || runtime.error) && (
                    <p className="form-error" tabIndex={-1} ref={errorRef} role="alert">
                        {error || runtime.error}
                    </p>
                )}
                <button className="button primary" type="submit" disabled={pending || !runtime.api}>
                    {pending && <ArcInlineLoader label={null} />}
                    {pending ? 'Проверяем…' : context === 'user' ? 'Войти' : 'Продолжить'}
                </button>
            </form>
            {context === 'user' && (
                <>
                    <button
                        type="button"
                        className="text-button"
                        disabled={pending}
                        aria-expanded={methodsVisible}
                        onClick={() => setMethodsVisible(!methodsVisible)}
                    >
                        Войти другим способом
                    </button>
                    {methodsVisible && (
                        <div className="actions" aria-label="Способ входа">
                            {(['password', 'totp', 'pin'] as const).map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    className="button outline"
                                    disabled={pending}
                                    aria-pressed={method === value}
                                    onClick={() => {
                                        setMethod(value);
                                        setPassword('');
                                        setError('');
                                    }}
                                >
                                    {value === 'password'
                                        ? 'Пароль'
                                        : value === 'totp'
                                          ? 'Приложение-аутентификатор'
                                          : 'PIN устройства'}
                                </button>
                            ))}
                        </div>
                    )}
                    {method !== 'password' && (
                        <p className="inline-note">
                            {method === 'pin'
                                ? 'PIN работает только в браузере, где вы ранее настроили его. После 5 неверных попыток привязка отключается.'
                                : 'Используйте ранее подключённое приложение. Для служебного доступа по-прежнему нужны пароль и MFA.'}
                        </p>
                    )}
                </>
            )}
            <div className="auth-divider">
                <img src="/assets/botanical-mark-96.webp" alt="" />
            </div>
            {context === 'user' ? (
                <>
                    <div className="auth-links">
                        <Link href="/auth/recovery">Забыли пароль?</Link>
                        <Link href="/auth/sign-up">Создать аккаунт</Link>
                    </div>
                </>
            ) : (
                <Link href="/about" className="back-link">
                    О сервисе
                </Link>
            )}
            {process.env.NEXT_PUBLIC_API_MODE === 'mock' && (
                <details className="developer-accounts">
                    <summary>Тестовые аккаунты</summary>
                    <p>
                        Пароль: <code>1</code>. Авторизация работает на локальных моках.
                    </p>
                    <div className="account-list">
                        {(context === 'user'
                            ? ['user1', 'user2', 'plus1', 'plus2', 'pro1', 'pro2', 'admin', 'moderator']
                            : [context]
                        ).map((login) => (
                            <button
                                type="button"
                                key={login}
                                disabled={pending}
                                onClick={() => setEmail(`${login}@meal-planner.test`)}
                            >
                                {login}@meal-planner.test
                            </button>
                        ))}
                    </div>
                    <nav aria-label="Служебные входы">
                        <Link href="/moderation/sign-in">Модератор</Link>
                    </nav>
                </details>
            )}
        </>
    );
    return <AuthShell staff={context !== 'user'}>{content}</AuthShell>;
}
export function MfaScreen({ context }: { context: 'moderator' }) {
    const runtime = useRuntime();
    const router = useRouter();
    const flow = runtime.mfa?.context === context ? runtime.mfa : null;
    const [code, setCode] = useState('');
    const [method, setMethod] = useState<'totp' | 'recovery'>('totp');
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const [recovery, setRecovery] = useState<string[] | null>(null);
    const [saved, setSaved] = useState(false);
    const [expired, setExpired] = useState(false);
    const inFlight = useRef(false);
    const beginRequest = useRequestSignal();
    useEffect(() => {
        if (!flow) return;
        const timeout = setTimeout(() => setExpired(true), Math.max(0, Date.parse(flow.expiresAt) - Date.now()));
        return () => clearTimeout(timeout);
    }, [flow]);
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!flow || !runtime.api || inFlight.current) return;
        inFlight.current = true;
        setPending(true);
        setError('');
        const signal = beginRequest();
        try {
            const response = await runtime.api.request(
                'POST /api/v1/staff/auth/mfa/verify',
                {
                    challenge: flow.challenge,
                    code,
                    method,
                },
                signal,
            );
            signal.throwIfAborted();
            runtime.api.invalidate();
            runtime.queryClient.clear();
            runtime.queryClient.setQueryData(['session', 'staff'], response.data.user);
            runtime.broadcast();
            if (response.data.recoveryCodes.length) setRecovery(response.data.recoveryCodes);
            else {
                runtime.setMfa(null);
                router.replace(flow.returnTo);
            }
        } catch (error) {
            if (!(error instanceof DOMException && error.name === 'AbortError')) setError(neutralError(error));
        } finally {
            setCode('');
            setPending(false);
            inFlight.current = false;
        }
    }
    return (
        <AuthShell staff>
            <h1>{recovery ? 'Сохраните резервные коды' : 'Подтвердите вход'}</h1>
            {recovery ? (
                <>
                    <p className="auth-subtitle">
                        Каждый код работает один раз. Сохраните их в надёжном месте: повторно они не показываются.
                    </p>
                    <div className="recovery-codes">
                        {recovery.map((value) => (
                            <code key={value}>{value}</code>
                        ))}
                    </div>
                    <label className="checkbox-label">
                        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />Я сохранил
                        резервные коды
                    </label>
                    <button
                        className="button primary"
                        disabled={!saved}
                        onClick={() => {
                            const target = flow?.returnTo ?? authRoutes[context].home;
                            setRecovery(null);
                            runtime.setMfa(null);
                            router.replace(target);
                        }}
                    >
                        Продолжить
                    </button>
                </>
            ) : !flow || expired ? (
                <>
                    <p className="auth-subtitle">
                        Начните вход заново. Проверка не сохраняется после перезагрузки и действует 10 минут.
                    </p>
                    <Link className="button primary" href={authRoutes[context].login}>
                        Вернуться ко входу
                    </Link>
                </>
            ) : (
                <>
                    <p className="auth-subtitle">
                        {flow.enrollment
                            ? 'Добавьте аккаунт в приложение-аутентификатор и введите шестизначный код.'
                            : 'Введите код из приложения или одноразовый резервный код.'}
                    </p>
                    {flow.enrollment && (
                        <section className="enrollment">
                            <p>Ключ для ручной настройки</p>
                            <code>{flow.enrollment.secret}</code>
                            <p>Meal Planner · TOTP · 6 цифр · 30 секунд</p>
                        </section>
                    )}
                    <form onSubmit={(event) => void submit(event)} aria-busy={pending}>
                        <label htmlFor="mfa-code">{method === 'totp' ? 'Код из приложения' : 'Резервный код'}</label>
                        <input
                            id="mfa-code"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            autoComplete="one-time-code"
                            inputMode={method === 'totp' ? 'numeric' : 'text'}
                            required
                            minLength={6}
                            maxLength={method === 'totp' ? 6 : 64}
                            disabled={pending}
                        />
                        {error && (
                            <p className="form-error" role="alert">
                                {error}
                            </p>
                        )}
                        <button className="button primary" disabled={pending || !runtime.api}>
                            {pending && <ArcInlineLoader label={null} />}
                            {pending ? 'Проверяем…' : 'Подтвердить'}
                        </button>
                    </form>
                    {!flow.enrollment && (
                        <button
                            className="text-button"
                            disabled={pending}
                            onClick={() => {
                                setMethod(method === 'totp' ? 'recovery' : 'totp');
                                setCode('');
                                setError('');
                            }}
                        >
                            {method === 'totp' ? 'Использовать резервный код' : 'Ввести код из приложения'}
                        </button>
                    )}
                    <p className="inline-note">
                        Если приложение и резервные коды потеряны, потребуется восстановление через поддержку.
                    </p>
                    <Link href={authRoutes[context].login} className="back-link" onClick={() => runtime.setMfa(null)}>
                        Начать вход заново
                    </Link>
                </>
            )}
        </AuthShell>
    );
}
