'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { leaveRevokedSessions } from './revoked-session-navigation.js';
import { useRuntime } from '../../app/providers.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import {
    Feedback,
    Field,
    PasswordField,
    Submit,
    formError,
    passwordHelp,
    useAccountAction,
    validatePassword,
} from './form-parts.js';
import { MockMailLink } from './lifecycle-pages.js';
import { useSession } from './session.js';
import styles from './account.module.css';

function PasswordChange() {
    const runtime = useRuntime();
    const action = useAccountAction();
    const [currentPassword, setCurrent] = useState('');
    const [password, setPassword] = useState('');
    const [repeat, setRepeat] = useState('');
    return (
        <section className={styles.card}>
            <h2>Пароль</h2>
            <p>
                Смена пароля завершает все обычные и служебные сессии и отключает PIN на всех устройствах.
                Приложение-аутентификатор сохраняется.
            </p>
            <details>
                <summary>Изменить пароль</summary>
                <form
                    className={styles.stack}
                    aria-busy={action.pending}
                    onSubmit={(event) => {
                        event.preventDefault();
                        void action.run(
                            async (signal) => {
                                validatePassword(password, repeat);
                                await runtime.api!.request(
                                    'POST /api/v1/auth/password/change',
                                    { currentPassword, password },
                                    signal,
                                );
                                signal.throwIfAborted();
                                leaveRevokedSessions(runtime);
                            },
                            () => {
                                setCurrent('');
                                setPassword('');
                                setRepeat('');
                            },
                        );
                    }}
                >
                    <PasswordField
                        label="Текущий пароль"
                        value={currentPassword}
                        onChange={(e) => setCurrent(e.target.value)}
                        disabled={action.pending}
                    />
                    <PasswordField
                        label="Новый пароль"
                        fresh
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={action.pending}
                    />
                    <PasswordField
                        label="Повторите новый пароль"
                        fresh
                        value={repeat}
                        onChange={(e) => setRepeat(e.target.value)}
                        disabled={action.pending}
                    />
                    <p className={styles.muted}>{passwordHelp}</p>
                    <Submit pending={action.pending} disabled={!runtime.api}>
                        Изменить пароль и выйти
                    </Submit>
                    <Feedback error={action.error} notice={action.notice} />
                </form>
            </details>
        </section>
    );
}

type Security = Success<'GET /api/v1/auth/security'>['data'];
function EmailChange({ security, refresh }: { security: Security; refresh: () => Promise<void> }) {
    const runtime = useRuntime();
    const session = useSession('user');
    const profile = useQuery({
        queryKey: ['profile', 'own', session.data?.id],
        enabled: !!runtime.api && !!session.data,
        queryFn: async ({ signal }) =>
            (await runtime.api!.request('GET /api/v1/profile', undefined, signal)).data.profile,
    });
    const action = useAccountAction();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    return (
        <section className={styles.card}>
            <h2>Электронная почта</h2>
            {profile.isPending ? (
                <ArcSkeleton height="1.5em" label="Загружаем адрес…" />
            ) : profile.isError ? (
                <p>
                    Текущий адрес недоступен.{' '}
                    <button type="button" className="text-button" onClick={() => void profile.refetch()}>
                        Повторить
                    </button>
                </p>
            ) : (
                <p>
                    {profile.data.email?.trim() || 'Email недоступен'}
                    {profile.data.email ? (profile.data.emailVerified ? ' · Подтверждён' : ' · Не подтверждён') : ''}
                </p>
            )}
            <p>
                Подтвердите новый адрес. На прежний придёт ссылка отмены. После подтверждения нового адреса действует
                защитный период 24 часа, затем все сессии завершаются.
            </p>
            {security.pendingEmail && (
                <p role="status">
                    Ожидается смена на {security.pendingEmail.email}.{' '}
                    {security.pendingEmail.confirmed && security.pendingEmail.effectiveAt
                        ? `Вступит в силу ${new Date(security.pendingEmail.effectiveAt).toLocaleString('ru-RU')}.`
                        : 'Проверьте письмо на новом адресе.'}
                </p>
            )}
            <details>
                <summary>Изменить почту</summary>
                <form
                    className={styles.stack}
                    aria-busy={action.pending}
                    onSubmit={(event) => {
                        event.preventDefault();
                        void action.run(
                            async (signal) => {
                                await runtime.api!.request(
                                    'POST /api/v1/auth/email/change',
                                    { password, email },
                                    signal,
                                );
                                signal.throwIfAborted();
                                await refresh();
                                signal.throwIfAborted();
                                action.setNotice('Запрос принят. Проверьте письма на новом и прежнем адресах.');
                            },
                            () => setPassword(''),
                        );
                    }}
                >
                    <Field
                        label="Новая электронная почта"
                        type="email"
                        autoComplete="email"
                        required
                        maxLength={254}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={action.pending}
                    />
                    <PasswordField
                        label="Текущий пароль"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={action.pending}
                    />
                    <Submit pending={action.pending} disabled={!runtime.api}>
                        Запросить смену почты
                    </Submit>
                    <Feedback error={action.error} notice={action.notice} />
                </form>
            </details>
            <p className={styles.muted}>
                Если доступа к прежнему адресу нет, потребуется восстановление через поддержку.
            </p>
            <MockMailLink />
        </section>
    );
}

function PinSettings({ enabled, refresh }: { enabled: boolean; refresh: () => Promise<void> }) {
    const runtime = useRuntime();
    const action = useAccountAction();
    const [password, setPassword] = useState('');
    const [pin, setPin] = useState('');
    const [repeat, setRepeat] = useState('');
    return (
        <section className={styles.card}>
            <h2>PIN знакомого устройства</h2>
            <p>
                {enabled ? 'PIN настроен для этого браузера.' : 'PIN в этом браузере не настроен.'} Он действует только
                здесь. Пять неверных попыток отключают привязку.
            </p>
            <details>
                <summary>{enabled ? 'Заменить PIN' : 'Настроить PIN'}</summary>
                <form
                    className={styles.stack}
                    aria-busy={action.pending}
                    onSubmit={(event) => {
                        event.preventDefault();
                        void action.run(
                            async (signal) => {
                                if (pin !== repeat) formError('PIN-коды не совпадают.');
                                await runtime.api!.request('POST /api/v1/auth/pin/setup', { password, pin }, signal);
                                signal.throwIfAborted();
                                await refresh();
                                signal.throwIfAborted();
                                action.setNotice('PIN настроен для этого браузера.');
                            },
                            () => {
                                setPassword('');
                                setPin('');
                                setRepeat('');
                            },
                        );
                    }}
                >
                    <PasswordField
                        label="Пароль аккаунта"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={action.pending}
                    />
                    <Field
                        label="Новый PIN — 6 цифр"
                        type="password"
                        inputMode="numeric"
                        autoComplete="off"
                        pattern="[0-9]{6}"
                        minLength={6}
                        maxLength={6}
                        required
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        disabled={action.pending}
                    />
                    <Field
                        label="Повторите PIN"
                        type="password"
                        inputMode="numeric"
                        autoComplete="off"
                        pattern="[0-9]{6}"
                        minLength={6}
                        maxLength={6}
                        required
                        value={repeat}
                        onChange={(e) => setRepeat(e.target.value)}
                        disabled={action.pending}
                    />
                    <Submit pending={action.pending} disabled={!runtime.api}>
                        Сохранить PIN
                    </Submit>
                </form>
            </details>
            {enabled && (
                <button
                    type="button"
                    className="button outline"
                    disabled={action.pending || !runtime.api}
                    onClick={() =>
                        void action.run(async (signal) => {
                            await runtime.api!.request('POST /api/v1/auth/pin/revoke', {}, signal);
                            signal.throwIfAborted();
                            await refresh();
                            signal.throwIfAborted();
                            action.setNotice('PIN этого браузера отключён.');
                        })
                    }
                >
                    Отключить PIN этого браузера
                </button>
            )}
            <Feedback error={action.error} notice={action.notice} />
        </section>
    );
}

function FactorProof({
    method,
    code,
    setMethod,
    setCode,
    disabled,
}: {
    method: 'totp' | 'recovery';
    code: string;
    setMethod: (value: 'totp' | 'recovery') => void;
    setCode: (value: string) => void;
    disabled: boolean;
}) {
    return (
        <fieldset disabled={disabled}>
            <legend>Подтверждение действующим фактором</legend>
            <label>
                Способ подтверждения
                <select
                    value={method}
                    onChange={(e) => {
                        setMethod(e.target.value === 'recovery' ? 'recovery' : 'totp');
                        setCode('');
                    }}
                >
                    <option value="totp">Код из приложения</option>
                    <option value="recovery">Резервный код</option>
                </select>
            </label>
            <Field
                label={method === 'totp' ? 'Текущий код приложения' : 'Одноразовый резервный код'}
                autoComplete="one-time-code"
                inputMode={method === 'totp' ? 'numeric' : 'text'}
                required
                minLength={6}
                maxLength={method === 'totp' ? 6 : 64}
                value={code}
                onChange={(e) => setCode(e.target.value)}
            />
        </fieldset>
    );
}

function RecoveryCodes({ values, clear }: { values: string[]; clear: () => void }) {
    const [saved, setSaved] = useState(false);
    return (
        <section className={styles.stack}>
            <h3>Сохраните резервные коды</h3>
            <p>
                Каждый код одноразовый. Прежние коды больше не действуют. После закрытия этот набор повторно не
                показывается.
            </p>
            <div className="recovery-codes">
                {values.map((code) => (
                    <code key={code}>{code}</code>
                ))}
            </div>
            <label className="checkbox-label">
                <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />Я сохранил
                резервные коды
            </label>
            <button type="button" className="button primary" disabled={!saved} onClick={clear}>
                Закрыть коды
            </button>
        </section>
    );
}

function AuthenticatorSettings({ enabled, refresh }: { enabled: boolean; refresh: () => Promise<void> }) {
    const runtime = useRuntime();
    const action = useAccountAction();
    const [password, setPassword] = useState('');
    const [method, setMethod] = useState<'totp' | 'recovery'>('totp');
    const [proof, setProof] = useState('');
    const [code, setCode] = useState('');
    const [enrollment, setEnrollment] = useState<Success<'POST /api/v1/auth/authenticator/setup'>['data'] | null>(null);
    const [recovery, setRecovery] = useState<string[] | null>(null);
    const [expired, setExpired] = useState(false);
    useEffect(() => {
        if (!enrollment) return;
        const timeout = setTimeout(
            () => {
                setExpired(true);
                setEnrollment(null);
                setCode('');
            },
            Math.max(0, Date.parse(enrollment.expiresAt) - Date.now()),
        );
        return () => clearTimeout(timeout);
    }, [enrollment]);
    return (
        <section className={styles.card}>
            <h2>Приложение-аутентификатор</h2>
            <p>
                {enabled ? 'Приложение подключено.' : 'Приложение не подключено.'} Для обычного входа его код заменяет
                пароль. Служебный вход всегда требует пароль и второй фактор.
            </p>
            {recovery ? (
                <RecoveryCodes values={recovery} clear={() => setRecovery(null)} />
            ) : enrollment ? (
                <>
                    <p>
                        Добавьте ключ в Authy или другое приложение: TOTP, 6 цифр, 30 секунд. Подтвердите новый код в
                        течение 10 минут.
                    </p>
                    <code className={styles.secret}>{enrollment.enrollment.secret}</code>
                    <form
                        className={styles.stack}
                        aria-busy={action.pending}
                        onSubmit={(event) => {
                            event.preventDefault();
                            void action.run(
                                async (signal) => {
                                    const response = await runtime.api!.request(
                                        'POST /api/v1/auth/authenticator/confirm',
                                        { challenge: enrollment.challenge, code },
                                        signal,
                                    );
                                    signal.throwIfAborted();
                                    setEnrollment(null);
                                    setRecovery(response.data.recoveryCodes);
                                    await refresh();
                                    signal.throwIfAborted();
                                    runtime.broadcast();
                                },
                                () => setCode(''),
                            );
                        }}
                    >
                        <Field
                            label="Код нового приложения"
                            autoComplete="one-time-code"
                            inputMode="numeric"
                            pattern="[0-9]{6}"
                            required
                            minLength={6}
                            maxLength={6}
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            disabled={action.pending}
                        />
                        <Submit pending={action.pending} disabled={!runtime.api}>
                            Подтвердить приложение
                        </Submit>
                        <button
                            type="button"
                            className="text-button"
                            disabled={action.pending}
                            onClick={() => {
                                setEnrollment(null);
                                setCode('');
                            }}
                        >
                            Закрыть настройку
                        </button>
                    </form>
                </>
            ) : (
                <>
                    <details>
                        <summary>
                            {enabled ? 'Заменить приложение или резервные коды' : 'Подключить приложение'}
                        </summary>
                        <form
                            className={styles.stack}
                            aria-busy={action.pending}
                            onSubmit={(event) => {
                                event.preventDefault();
                                void action.run(
                                    async (signal) => {
                                        const response = await runtime.api!.request(
                                            'POST /api/v1/auth/authenticator/setup',
                                            { password, ...(enabled ? { proof: { method, code: proof } } : {}) },
                                            signal,
                                        );
                                        signal.throwIfAborted();
                                        setExpired(false);
                                        setEnrollment(response.data);
                                    },
                                    () => {
                                        setPassword('');
                                        setProof('');
                                    },
                                );
                            }}
                        >
                            <PasswordField
                                label="Пароль для управления аутентификатором"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={action.pending}
                            />
                            {enabled && (
                                <FactorProof
                                    method={method}
                                    code={proof}
                                    setMethod={setMethod}
                                    setCode={setProof}
                                    disabled={action.pending}
                                />
                            )}
                            <p className={styles.muted}>
                                {enabled
                                    ? 'При замене приложения служебные сессии будут отозваны. Одного пароля недостаточно — нужен действующий код.'
                                    : 'После подтверждения приложение станет доступно как способ обычного входа.'}
                            </p>
                            <Submit pending={action.pending} disabled={!runtime.api}>
                                {enabled ? 'Настроить новое приложение' : 'Начать настройку'}
                            </Submit>
                            {enabled && (
                                <button
                                    type="button"
                                    className="button outline"
                                    disabled={action.pending || !runtime.api || !password || !proof}
                                    onClick={() =>
                                        void action.run(
                                            async (signal) => {
                                                const response = await runtime.api!.request(
                                                    'POST /api/v1/auth/authenticator/recovery-codes',
                                                    { password, proof: { method, code: proof } },
                                                    signal,
                                                );
                                                signal.throwIfAborted();
                                                setRecovery(response.data.recoveryCodes);
                                                runtime.broadcast();
                                            },
                                            () => {
                                                setPassword('');
                                                setProof('');
                                            },
                                        )
                                    }
                                >
                                    Перевыпустить резервные коды
                                </button>
                            )}
                        </form>
                    </details>
                    {expired && <p role="alert">Время настройки истекло. Начните её заново.</p>}
                </>
            )}
            <Feedback error={action.error} notice={action.notice} />
            <p className={styles.muted}>
                Если потеряны и приложение, и резервные коды, восстановление выполняется через поддержку.
            </p>
        </section>
    );
}

export function AccountSecurity() {
    const runtime = useRuntime();
    const security = useQuery({
        queryKey: ['account', 'security'],
        enabled: !!runtime.api,
        queryFn: async ({ signal }) =>
            (await runtime.api!.request('GET /api/v1/auth/security', undefined, signal)).data,
    });
    async function refresh() {
        await runtime.queryClient.invalidateQueries({ queryKey: ['account', 'security'] });
    }
    if (security.isPending) return <ArcSkeleton variant="lines" lines={6} label="Загружаем настройки безопасности…" />;
    if (security.isError)
        return (
            <section className={styles.card} role="alert">
                <h2>Настройки недоступны</h2>
                <p>Не удалось загрузить состояние защиты аккаунта.</p>
                <button className="button outline" onClick={() => void security.refetch()}>
                    Повторить
                </button>
            </section>
        );
    return (
        <div className={styles.stack}>
            <EmailChange security={security.data} refresh={refresh} />
            <PasswordChange />
            <PinSettings enabled={security.data.pinEnabled} refresh={refresh} />
            <AuthenticatorSettings enabled={security.data.authenticatorEnabled} refresh={refresh} />
        </div>
    );
}
