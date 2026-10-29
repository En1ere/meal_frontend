'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { leaveRevokedSessions } from './revoked-session-navigation.js';
import { useQuery } from '@tanstack/react-query';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import { ApiError } from '../../shared/api/client.js';
import { useRuntime } from '../../shared/runtime/index.js';
import { AuthShell } from './auth-screen.js';
import {
    Field,
    PasswordField,
    Submit,
    Feedback,
    useAccountAction,
    passwordHelp,
    validatePassword,
    formError,
} from './form-parts.js';
import styles from './account.module.css';
import { getPublicLegalManifest, hasPublishedRegistrationDocuments } from '../../shared/legal/mock-legal.js';

const acceptedMessage =
    'Запрос принят. Если действие доступно для указанного адреса, будет подготовлено письмо. Принятие запроса не подтверждает доставку.';
export function MockMailLink() {
    return process.env.NEXT_PUBLIC_API_MODE === 'mock' ? (
        <p className="inline-note">
            Локальный тестовый режим: письма не отправляются. <Link href="/dev/mailbox">Открыть тестовую почту</Link>
        </p>
    ) : null;
}
function BackToLogin() {
    return (
        <p className="inline-note">
            <Link href="/auth">Вернуться ко входу</Link>
        </p>
    );
}

export function SignUpPage() {
    const runtime = useRuntime();
    const action = useAccountAction();
    const [username, setUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [repeat, setRepeat] = useState('');
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
    const [accepted, setAccepted] = useState(false);
    const legal = useQuery({
        queryKey: ['public-legal-manifest'],
        retry: false,
        enabled: !!runtime.api,
        queryFn: ({ signal }) => getPublicLegalManifest(runtime.api!, signal),
    });
    const terms = legal.data?.find((item) => item.id === 'offer');
    const privacy = legal.data?.find((item) => item.id === 'privacy_notice');
    const legalReady = hasPublishedRegistrationDocuments(legal.data, {
        allowDemonstration: process.env.NEXT_PUBLIC_API_MODE === 'mock',
    });
    return (
        <AuthShell>
            <h1>{accepted ? 'Подтвердите почту' : 'Создайте аккаунт'}</h1>
            <p className="auth-subtitle">
                {accepted ? acceptedMessage : 'Начните планировать питание вместе с Meal Planner'}
            </p>
            {accepted ? (
                <>
                    <Field label="Электронная почта" value={email} readOnly />
                    <button
                        className="button primary"
                        disabled={action.pending || !runtime.api}
                        onClick={() =>
                            void action.run(async (signal) => {
                                await runtime.api!.request('POST /api/v1/auth/email/resend', { email }, signal);
                                signal.throwIfAborted();
                                action.setNotice(acceptedMessage);
                            })
                        }
                    >
                        Отправить письмо ещё раз
                    </button>
                </>
            ) : (
                <form
                    className={styles.stack}
                    aria-busy={action.pending}
                    onSubmit={(event) => {
                        event.preventDefault();
                        void action.run(
                            async (signal) => {
                                validatePassword(password, repeat);
                                if (!legalReady)
                                    formError('Регистрация временно недоступна: документы не опубликованы.');
                                if (!termsAccepted) formError('Примите условия использования.');
                                if (!privacyAcknowledged)
                                    formError('Подтвердите ознакомление с политикой конфиденциальности.');
                                if (!/^[a-z0-9_]{3,30}$/i.test(username))
                                    formError('Логин: от 3 до 30 латинских букв, цифр или _.');
                                try {
                                    await runtime.api!.request(
                                        'POST /api/v1/auth/register/v2',
                                        {
                                            username,
                                            displayName,
                                            email,
                                            password,
                                            legal: {
                                                offerAcceptance: { accepted: true, document: terms!.document },
                                                privacyAcknowledgement: {
                                                    acknowledged: true,
                                                    document: privacy!.document,
                                                },
                                            },
                                        },
                                        signal,
                                    );
                                } catch (cause) {
                                    if (cause instanceof ApiError && cause.code === 'LEGAL_DOCUMENT_STALE') {
                                        setTermsAccepted(false);
                                        setPrivacyAcknowledged(false);
                                        await legal.refetch();
                                        formError(
                                            'Документы обновились. Ознакомьтесь с актуальными версиями и отметьте обе галочки снова.',
                                        );
                                    }
                                    throw cause;
                                }
                                signal.throwIfAborted();
                                setAccepted(true);
                            },
                            () => {
                                setPassword('');
                                setRepeat('');
                            },
                        );
                    }}
                >
                    <Field
                        label="Имя (видно только вам)"
                        name="name"
                        autoComplete="name"
                        required
                        maxLength={100}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        disabled={action.pending}
                    />
                    <Field
                        label="Публичный логин"
                        name="username"
                        autoComplete="username"
                        required
                        minLength={3}
                        maxLength={30}
                        pattern="[a-zA-Z0-9_]{3,30}"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={action.pending}
                    />
                    <p className={styles.muted}>
                        Логин уникален, регистр букв не учитывается. После регистрации его нельзя изменить.
                    </p>
                    <Field
                        label="Электронная почта"
                        name="email"
                        autoComplete="email"
                        type="email"
                        required
                        maxLength={254}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={action.pending}
                    />
                    <PasswordField
                        fresh
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={action.pending}
                    />
                    <PasswordField
                        label="Повторите пароль"
                        fresh
                        value={repeat}
                        onChange={(e) => setRepeat(e.target.value)}
                        disabled={action.pending}
                    />
                    <p className={styles.muted}>{passwordHelp}</p>
                    <div className="checkbox-label">
                        <input
                            id="terms-accepted"
                            type="checkbox"
                            required
                            checked={termsAccepted}
                            onChange={(e) => setTermsAccepted(e.target.checked)}
                            disabled={action.pending || !legalReady}
                        />
                        <span>
                            <label htmlFor="terms-accepted">Я принимаю</label>{' '}
                            <Link
                                href={terms?.href ?? '/legal/terms'}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Условия использования (откроются в новой вкладке)"
                            >
                                условия использования
                            </Link>
                            {terms ? `, версия ${terms.version}` : ''}.
                        </span>
                    </div>
                    <div className="checkbox-label">
                        <input
                            id="privacy-acknowledged"
                            type="checkbox"
                            required
                            checked={privacyAcknowledged}
                            onChange={(e) => setPrivacyAcknowledged(e.target.checked)}
                            disabled={action.pending || !legalReady}
                        />
                        <span>
                            <label htmlFor="privacy-acknowledged">Я ознакомился с</label>{' '}
                            <Link
                                href={privacy?.href ?? '/legal/privacy'}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Политика конфиденциальности (откроется в новой вкладке)"
                            >
                                политикой конфиденциальности
                            </Link>
                            {privacy ? `, версия ${privacy.version}` : ''}.
                        </span>
                    </div>
                    <p className={styles.muted}>
                        Это демонстрационные версии документов для проверки сценария. Они не являются production-
                        юридическими текстами.
                    </p>
                    {legal.isPending && <p role="status">Проверяем доступность документов…</p>}
                    {legal.isError && (
                        <p role="alert">Документы недоступны. Регистрация заблокирована до их загрузки.</p>
                    )}
                    <Submit
                        pending={action.pending}
                        disabled={
                            !runtime.api ||
                            process.env.NEXT_PUBLIC_API_MODE !== 'mock' ||
                            !legalReady ||
                            !termsAccepted ||
                            !privacyAcknowledged
                        }
                    >
                        Создать аккаунт
                    </Submit>
                </form>
            )}
            <Feedback error={action.error || runtime.error || undefined} notice={action.notice} />
            <MockMailLink />
            <BackToLogin />
        </AuthShell>
    );
}

export function RecoveryPage() {
    const runtime = useRuntime();
    const action = useAccountAction();
    const [email, setEmail] = useState('');
    return (
        <AuthShell>
            <h1>Восстановление доступа</h1>
            <p className="auth-subtitle">Укажите почту для запроса ссылки на создание нового пароля.</p>
            <form
                className={styles.stack}
                aria-busy={action.pending}
                onSubmit={(event) => {
                    event.preventDefault();
                    void action.run(async (signal) => {
                        await runtime.api!.request('POST /api/v1/auth/password/recovery', { email }, signal);
                        signal.throwIfAborted();
                        action.setNotice(acceptedMessage);
                    });
                }}
            >
                <Field
                    label="Электронная почта"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={action.pending}
                />
                <Submit pending={action.pending} disabled={!runtime.api}>
                    Отправить ссылку
                </Submit>
            </form>
            <Feedback error={action.error || runtime.error || undefined} notice={action.notice} />
            <MockMailLink />
            <BackToLogin />
        </AuthShell>
    );
}

export function EmailLinkPage({ mode }: { mode: 'verify' | 'confirm' | 'cancel' }) {
    const runtime = useRuntime();
    const params = useSearchParams();
    const token = params.get('token') ?? '';
    const action = useAccountAction();
    const [done, setDone] = useState(false);
    const title =
        mode === 'verify'
            ? 'Подтвердите почту'
            : mode === 'confirm'
              ? 'Подтвердите новую почту'
              : 'Отмените смену почты';
    return (
        <AuthShell>
            <h1>{title}</h1>
            <p className="auth-subtitle">
                {mode === 'confirm'
                    ? 'После подтверждения начнётся защитный период 24 часа. На прежний адрес отправлена ссылка отмены.'
                    : mode === 'cancel'
                      ? 'Если вы не запрашивали смену адреса, отмените её и смените пароль аккаунта.'
                      : 'Подтверждение адреса не выполняет вход в аккаунт.'}
            </p>
            {!token && !done ? (
                <p role="alert">
                    Откройте одноразовую ссылку из письма. Для повторного запроса пройдите регистрацию с тем же адресом.
                </p>
            ) : (
                !done && (
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            void action.run(async (signal) => {
                                if (mode === 'verify') {
                                    await runtime.api!.request('POST /api/v1/auth/email/verify', { token }, signal);
                                    signal.throwIfAborted();
                                    action.setNotice('Почта подтверждена. Теперь можно войти в аккаунт.');
                                } else if (mode === 'confirm') {
                                    const result = await runtime.api!.request(
                                        'POST /api/v1/auth/email/change/confirm',
                                        { token },
                                        signal,
                                    );
                                    signal.throwIfAborted();
                                    action.setNotice(
                                        `Новый адрес подтверждён. Изменение вступит в силу ${new Date(result.data.effectiveAt).toLocaleString('ru-RU')}. Все сессии будут завершены.`,
                                    );
                                } else {
                                    await runtime.api!.request(
                                        'POST /api/v1/auth/email/change/cancel',
                                        { token },
                                        signal,
                                    );
                                    signal.throwIfAborted();
                                    action.setNotice('Смена почты отменена.');
                                }
                                setDone(true);
                                window.history.replaceState(null, '', window.location.pathname);
                                runtime.broadcast();
                            });
                        }}
                    >
                        <Submit pending={action.pending} disabled={!runtime.api}>
                            {mode === 'cancel' ? 'Отменить смену адреса' : 'Подтвердить'}
                        </Submit>
                    </form>
                )
            )}
            <Feedback error={action.error || runtime.error || undefined} notice={action.notice} />
            <MockMailLink />
            <BackToLogin />
        </AuthShell>
    );
}

export function ResetPasswordPage() {
    const runtime = useRuntime();
    const params = useSearchParams();
    const token = params.get('token') ?? '';
    const action = useAccountAction();
    const [password, setPassword] = useState('');
    const [repeat, setRepeat] = useState('');
    const check = useQuery({
        queryKey: ['reset-link', token],
        enabled: !!runtime.api && !!token,
        gcTime: 0,
        retry: false,
        queryFn: async ({ signal }) =>
            (await runtime.api!.request('POST /api/v1/auth/password/reset/check', { token }, signal)).data,
    });
    return (
        <AuthShell>
            <h1>Задайте новый пароль</h1>
            <p className="auth-subtitle">
                После сохранения все обычные и служебные сессии и PIN-привязки будут отозваны. Аутентификатор
                сохранится.
            </p>
            {!token ? (
                <p role="alert">
                    В ссылке отсутствует код. <Link href="/auth/recovery">Запросить новую ссылку</Link>
                </p>
            ) : runtime.error ? (
                <p role="alert">{runtime.error}</p>
            ) : check.isPending ? (
                <ArcSkeleton variant="lines" lines={3} label="Проверяем ссылку…" />
            ) : check.isError ? (
                <section role="alert">
                    <p>
                        {check.error instanceof ApiError
                            ? check.error.message
                            : 'Не удалось проверить ссылку. Это не означает, что она недействительна.'}
                    </p>
                    <button type="button" className="text-button" onClick={() => void check.refetch()}>
                        Проверить снова
                    </button>
                    <p>
                        <Link href="/auth/recovery">Запросить новую ссылку</Link>
                    </p>
                </section>
            ) : (
                <form
                    className={styles.stack}
                    aria-busy={action.pending}
                    onSubmit={(event) => {
                        event.preventDefault();
                        void action.run(
                            async (signal) => {
                                validatePassword(password, repeat);
                                await runtime.api!.request(
                                    'POST /api/v1/auth/password/reset',
                                    { token, password },
                                    signal,
                                );
                                signal.throwIfAborted();
                                leaveRevokedSessions(runtime);
                            },
                            () => {
                                setPassword('');
                                setRepeat('');
                            },
                        );
                    }}
                >
                    <PasswordField
                        label="Новый пароль"
                        fresh
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={action.pending}
                    />
                    <PasswordField
                        label="Повторите пароль"
                        fresh
                        value={repeat}
                        onChange={(e) => setRepeat(e.target.value)}
                        disabled={action.pending}
                    />
                    <p className={styles.muted}>{passwordHelp}</p>
                    <Submit pending={action.pending} disabled={!runtime.api}>
                        Сохранить новый пароль
                    </Submit>
                </form>
            )}
            <Feedback error={action.error || runtime.error || undefined} notice={action.notice} />
            <BackToLogin />
        </AuthShell>
    );
}
