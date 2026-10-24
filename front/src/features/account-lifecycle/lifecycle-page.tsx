'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRuntime } from '../../app/providers.js';
import { ApiError } from '../../shared/api/client.js';
import { Guard, useSession } from '../auth/session.js';
import { PersonalShell } from '../personalization/shell.js';
import { CriticalReauthDialog, type ReauthResult } from './critical-reauth.js';
import styles from './lifecycle.module.css';

type Action = 'archive' | 'request' | 'cancel' | 'finalize';
type ReauthAction = Action | 'verify';

const dateTime = (value: string | null) =>
    value ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value)) : null;

function Status({ tone, children }: { tone: 'ready' | 'warning' | 'muted'; children: ReactNode }) {
    return <span className={`${styles.status} ${styles[tone]}`}>{children}</span>;
}

function LifecycleContent() {
    const runtime = useRuntime();
    const queryClient = useQueryClient();
    const session = useSession('user');
    const [reauthAction, setReauthAction] = useState<ReauthAction | null>(null);
    const [verified, setVerified] = useState<ReauthResult | null>(null);
    const [clock, setClock] = useState(() => Date.now());
    const [confirmAction, setConfirmAction] = useState<Action | null>(null);
    const confirmation = useRef<HTMLDialogElement>(null);
    const idempotency = useRef<Record<'archive' | 'request', string | null>>({ archive: null, request: null });

    const lifecycle = useQuery({
        queryKey: ['account-lifecycle', session.data?.id],
        enabled: !!runtime.api && !!session.data,
        queryFn: async ({ signal }) =>
            (await runtime.api!.request('GET /api/v1/account/lifecycle', undefined, signal)).data,
    });
    const readiness = useQuery({
        queryKey: ['account-deletion-preview', session.data?.id],
        enabled: !!runtime.api && !!session.data,
        queryFn: async ({ signal }) =>
            (await runtime.api!.request('GET /api/v1/account/deletion/preview', undefined, signal)).data,
    });
    const exportsQuery = useQuery({
        queryKey: ['exports', session.data?.id, 'lifecycle'],
        enabled: !!runtime.api && !!session.data,
        queryFn: async ({ signal }) =>
            (
                await runtime.api!.request('GET /api/v1/exports', undefined, signal, undefined, {
                    query: { limit: '20' },
                })
            ).data,
    });
    const refresh = async () => {
        await Promise.all([lifecycle.refetch(), readiness.refetch(), exportsQuery.refetch()]);
    };
    const currentDeletion = lifecycle.data?.deletion ?? null;
    const latestExport = exportsQuery.data?.items[0] ?? null;
    useEffect(() => {
        if (!latestExport?.expiresAt || latestExport.status !== 'ready') return;
        const delay = Math.max(0, Date.parse(latestExport.expiresAt) - Date.now());
        const timeout = window.setTimeout(() => setClock(Date.now()), Math.min(delay + 1, 2_147_483_647));
        return () => window.clearTimeout(timeout);
    }, [latestExport?.expiresAt, latestExport?.status]);
    const exportReady =
        !!latestExport &&
        latestExport.status === 'ready' &&
        !!latestExport.expiresAt &&
        Date.parse(latestExport.expiresAt) > clock;
    const blockers = readiness.data?.blockers ?? [];
    const familyBlocked = blockers.some((item) => item.code === 'family_owner');
    const subscriptionBlocked = blockers.some((item) => item.code === 'active_subscription');
    const identityVerified = !!verified;
    const requestReady =
        !!readiness.data?.canRequest && exportReady && !familyBlocked && !subscriptionBlocked && identityVerified;

    const finishSession = (reason: 'archived' | 'deleted') => {
        runtime.broadcast();
        window.location.replace(`/auth?${reason}=1`);
    };
    const action = useMutation({
        mutationFn: async ({ kind, reauth }: { kind: Action; reauth: ReauthResult }) => {
            if (Date.parse(reauth.expiresAt) <= Date.now())
                throw new ApiError(401, 'REAUTH_EXPIRED', 'Подтверждение истекло', crypto.randomUUID());
            if (kind === 'archive') {
                idempotency.current.archive ??= crypto.randomUUID();
                return {
                    kind,
                    data: (
                        await runtime.api!.request('POST /api/v1/account/archive', {
                            reauthToken: reauth.token,
                            idempotencyKey: idempotency.current.archive,
                        })
                    ).data,
                } as const;
            }
            if (kind === 'request') {
                if (
                    !latestExport ||
                    latestExport.status !== 'ready' ||
                    !latestExport.expiresAt ||
                    Date.parse(latestExport.expiresAt) <= Date.now()
                )
                    throw new ApiError(409, 'EXPORT_REQUIRED', 'Срок готового экспорта истёк', crypto.randomUUID());
                idempotency.current.request ??= crypto.randomUUID();
                return {
                    kind,
                    data: (
                        await runtime.api!.request('POST /api/v1/account/deletion', {
                            reauthToken: reauth.token,
                            idempotencyKey: idempotency.current.request,
                            acknowledgement: true,
                        })
                    ).data,
                } as const;
            }
            if (!currentDeletion) throw new Error('Deletion state missing');
            const route =
                kind === 'cancel' ? 'POST /api/v1/account/deletion/cancel' : 'POST /api/v1/account/deletion/finalize';
            return {
                kind,
                data: (
                    await runtime.api!.request(route, {
                        reauthToken: reauth.token,
                        expectedVersion: currentDeletion.version,
                    })
                ).data,
            } as const;
        },
        onSuccess: async (result) => {
            setReauthAction(null);
            setVerified(null);
            if (result.kind === 'archive') return finishSession('archived');
            if (result.kind === 'finalize' && 'status' in result.data && result.data.status === 'finalized')
                return finishSession('deleted');
            idempotency.current.request = null;
            await queryClient.invalidateQueries({ queryKey: ['account-lifecycle', session.data?.id] });
            await refresh();
        },
        onError: async () => {
            setReauthAction(null);
            setVerified(null);
            await refresh();
        },
    });
    const begin = (kind: Action) => {
        setConfirmAction(kind);
        confirmation.current?.showModal();
    };
    const confirmed = () => {
        const value = confirmAction;
        confirmation.current?.close();
        setConfirmAction(null);
        if (!value) return;
        if (value === 'request' && identityVerified) action.mutate({ kind: value, reauth: verified });
        else setReauthAction(value);
    };
    const deletionLabel = useMemo(() => {
        if (!currentDeletion) return null;
        return {
            requested: 'Запрос принят',
            retention_wait: 'Идёт период отмены',
            ready: 'Готово к финальному подтверждению',
            cancelled: 'Запрос отменён',
            rejected: 'Запрос отклонён',
            finalized: 'Удаление подтверждено сервером',
            blocked: 'Запрос заблокирован предусловиями',
        }[currentDeletion.status];
    }, [currentDeletion]);

    if (lifecycle.isPending || readiness.isPending || exportsQuery.isPending)
        return (
            <section className={styles.loading} role="status">
                <h1>Управление аккаунтом</h1>
                <p>Проверяем готовность и актуальные ограничения…</p>
            </section>
        );
    if (lifecycle.isError || readiness.isError || exportsQuery.isError)
        return (
            <section className={styles.panel} role="alert">
                <h1>Не удалось проверить готовность</h1>
                <p>Действия заблокированы до успешной проверки сервера.</p>
                <button className="button outline" onClick={() => void refresh()}>
                    Повторить
                </button>
            </section>
        );

    const conflict = action.error instanceof ApiError && [409, 412].includes(action.error.status);
    const reauthExpired = action.error instanceof ApiError && action.error.code === 'REAUTH_EXPIRED';
    const unknown =
        (action.isError && !(action.error instanceof ApiError)) ||
        (action.error instanceof ApiError && action.error.status >= 500);
    const cancellable =
        currentDeletion && ['requested', 'retention_wait', 'ready', 'blocked'].includes(currentDeletion.status);
    const finalizable = currentDeletion?.status === 'ready' && readiness.data.canFinalize;

    return (
        <>
            <nav className={styles.breadcrumbs} aria-label="Хлебные крошки">
                <Link href="/profile">Профиль</Link>
                <span>/</span>
                <Link href="/settings">Настройки</Link>
                <span>/</span>
                <span>Управление аккаунтом</span>
            </nav>
            <header className={styles.header}>
                <h1>Управление аккаунтом</h1>
                <p>Безопасный маршрут к архивированию или удалению аккаунта</p>
            </header>
            <ol className={styles.steps}>
                <li className={styles.active}>
                    <strong>1</strong>
                    <span>Экспорт данных</span>
                </li>
                <li>
                    <strong>2</strong>
                    <span>Архивирование</span>
                </li>
                <li>
                    <strong>3</strong>
                    <span>Удаление</span>
                </li>
            </ol>
            {currentDeletion && (
                <section className={styles['request-state']} aria-live="polite">
                    <div>
                        <h2>{deletionLabel}</h2>
                        <p>Запрошено: {dateTime(currentDeletion.requestedAt)}</p>
                        {currentDeletion.cancelUntil && (
                            <p>Отменить можно до: {dateTime(currentDeletion.cancelUntil)}</p>
                        )}
                        {currentDeletion.finalizationNotBefore && (
                            <p>Финализация не раньше: {dateTime(currentDeletion.finalizationNotBefore)}</p>
                        )}
                    </div>
                    {cancellable && (
                        <button className="button outline" disabled={action.isPending} onClick={() => begin('cancel')}>
                            Отменить запрос
                        </button>
                    )}
                </section>
            )}
            <div className={styles.columns}>
                <section className={styles.panel}>
                    <h2>Перед удалением</h2>
                    <p className={styles.intro}>Выполните все шаги, чтобы безопасно управлять аккаунтом.</p>
                    <ul className={styles.checklist}>
                        <li>
                            <img src="/assets/food-014.webp" alt="" />
                            <div>
                                <h3>Экспорт данных</h3>
                                <p>
                                    {latestExport
                                        ? `Последний экспорт: ${latestExport.status}.`
                                        : 'Создайте копию доступных данных.'}
                                </p>
                            </div>
                            <div>
                                {exportReady ? (
                                    <Status tone="ready">Готово</Status>
                                ) : (
                                    <Status tone="warning">Требуется</Status>
                                )}
                                <Link className="button outline" href="/exports">
                                    {exportReady ? 'Скачать данные' : 'Создать экспорт'}
                                </Link>
                            </div>
                        </li>
                        <li>
                            <img src="/assets/food-016.webp" alt="" />
                            <div>
                                <h3>Владелец семьи</h3>
                                <p>
                                    {familyBlocked
                                        ? 'Передайте права владельца другому участнику.'
                                        : 'Передача владения не требуется.'}
                                </p>
                            </div>
                            <div>
                                <Status tone={familyBlocked ? 'warning' : 'ready'}>
                                    {familyBlocked ? 'Требуется' : 'Готово'}
                                </Status>
                                {familyBlocked && (
                                    <Link className="button outline" href="/family/ownership">
                                        Передать
                                    </Link>
                                )}
                            </div>
                        </li>
                        <li>
                            <img src="/assets/food-021.webp" alt="" />
                            <div>
                                <h3>Активная подписка</h3>
                                <p>
                                    {subscriptionBlocked
                                        ? 'Завершите личную подписку перед удалением.'
                                        : 'Активная личная подписка не блокирует действие.'}
                                </p>
                            </div>
                            <div>
                                <Status tone={subscriptionBlocked ? 'warning' : 'ready'}>
                                    {subscriptionBlocked ? 'Требуется' : 'Готово'}
                                </Status>
                                {subscriptionBlocked && (
                                    <Link className="button outline" href="/settings/subscription">
                                        Управлять
                                    </Link>
                                )}
                            </div>
                        </li>
                        <li>
                            <img src="/assets/food-160.webp" alt="" />
                            <div>
                                <h3>Повторная проверка личности</h3>
                                <p>Одноразовое подтверждение паролем и MFA, если он включён.</p>
                            </div>
                            <div>
                                <Status tone={identityVerified ? 'ready' : 'warning'}>
                                    {identityVerified ? 'Готово' : 'Требуется'}
                                </Status>
                                <button
                                    className="button primary"
                                    disabled={action.isPending || identityVerified}
                                    onClick={() => setReauthAction('verify')}
                                >
                                    {identityVerified ? 'Подтверждено' : 'Подтвердить'}
                                </button>
                            </div>
                        </li>
                    </ul>
                    {action.isError && (
                        <div className={styles.error} role="alert">
                            <strong>
                                {conflict
                                    ? 'Состояние изменилось'
                                    : reauthExpired
                                      ? 'Подтверждение истекло'
                                      : unknown
                                        ? 'Исход операции не подтверждён'
                                        : 'Операция не выполнена'}
                            </strong>
                            <p>
                                {unknown
                                    ? 'Мы повторно проверили состояние. Не запускайте действие повторно, пока статус не станет понятен.'
                                    : 'Обновите данные и повторите безопасный шаг.'}
                            </p>
                        </div>
                    )}
                    <button
                        className={styles.destructive}
                        disabled={
                            !requestReady ||
                            action.isPending ||
                            (!!currentDeletion && currentDeletion.status !== 'cancelled')
                        }
                        onClick={() => begin('request')}
                    >
                        Продолжить удаление
                    </button>
                    <p className={styles.hint}>
                        {requestReady
                            ? 'Финальное удаление потребует отдельного подтверждения после серверного периода отмены.'
                            : 'Сначала выполните обязательные шаги выше.'}
                    </p>
                    <div className={styles.divider}>
                        <span>или</span>
                    </div>
                    <button className={styles.archive} disabled={action.isPending} onClick={() => begin('archive')}>
                        Архивировать вместо удаления
                    </button>
                    <p className={styles.hint}>
                        Архивирование обратимо: следующий успешный вход восстанавливает аккаунт.
                    </p>
                    {finalizable && (
                        <button
                            className={styles.destructive}
                            disabled={action.isPending}
                            onClick={() => begin('finalize')}
                        >
                            Подтвердить окончательное удаление
                        </button>
                    )}
                </section>
                <aside className={styles.panel}>
                    <h2>Что произойдёт</h2>
                    <p className={styles.intro}>Последствия берутся из текущей серверной policy.</p>
                    <ul className={styles.consequences}>
                        <li>
                            <img src="/assets/food-122-illustration.webp" alt="" />
                            <div>
                                <h3>Все сессии будут завершены</h3>
                                <p>После архивирования или финального удаления потребуется новый вход.</p>
                            </div>
                        </li>
                        <li>
                            <img src="/assets/food-161.webp" alt="" />
                            <div>
                                <h3>Профиль станет недоступен</h3>
                                <p>Архив скрывает профиль и личные данные до восстановления.</p>
                            </div>
                        </li>
                        <li>
                            <img src="/assets/achievements/medal-bronze-book.png" alt="" />
                            <div>
                                <h3>Авторство сохраняется по policy</h3>
                                <p>Опубликованный контент не считается автоматически удалённым вместе с аккаунтом.</p>
                            </div>
                        </li>
                        <li>
                            <img src="/assets/food-160.webp" alt="" />
                            <div>
                                <h3>Срок определяет сервер</h3>
                                <p>
                                    {readiness.data.policyVersion
                                        ? `Policy: ${readiness.data.policyVersion}.`
                                        : 'Юридический срок не опубликован — финализация заблокирована.'}
                                </p>
                            </div>
                        </li>
                    </ul>
                    <div className={styles.policy}>
                        <strong>Архивирование — безопасная альтернатива</strong>
                        <p>Оно не обещает окончательного удаления и позволяет восстановить аккаунт.</p>
                        <Link href="/support/new">Уточнить ограничения в поддержке</Link>
                    </div>
                </aside>
            </div>
            <dialog
                ref={confirmation}
                className={styles.dialog}
                aria-labelledby="lifecycle-confirm-title"
                onClose={() => setConfirmAction(null)}
            >
                <div className={styles['dialog-body']}>
                    <h2 id="lifecycle-confirm-title">
                        {confirmAction === 'archive'
                            ? 'Архивировать аккаунт?'
                            : confirmAction === 'cancel'
                              ? 'Отменить запрос на удаление?'
                              : confirmAction === 'finalize'
                                ? 'Окончательно удалить аккаунт?'
                                : 'Запросить удаление аккаунта?'}
                    </h2>
                    <p>
                        {confirmAction === 'archive'
                            ? 'Все текущие сессии завершатся. Архив можно восстановить новым входом.'
                            : confirmAction === 'cancel'
                              ? 'Запрос будет отменён по его текущей серверной версии.'
                              : confirmAction === 'finalize'
                                ? 'Это финальное необратимое подтверждение. Доступ будет немедленно завершён.'
                                : 'Сервер создаст запрос и покажет действующие сроки, статусы и ограничения.'}
                    </p>
                </div>
                <div className={styles['dialog-actions']}>
                    <button className="button outline" autoFocus onClick={() => confirmation.current?.close()}>
                        Вернуться
                    </button>
                    <button
                        className={confirmAction === 'finalize' ? styles.destructive : 'button primary'}
                        onClick={confirmed}
                    >
                        Продолжить
                    </button>
                </div>
            </dialog>
            <CriticalReauthDialog
                open={reauthAction !== null}
                purpose="account_lifecycle"
                onCancel={() => setReauthAction(null)}
                onSuccess={(reauth) => {
                    const kind = reauthAction;
                    if (kind === 'verify') {
                        setVerified(reauth);
                        setReauthAction(null);
                    } else if (kind) action.mutate({ kind, reauth });
                }}
            />
        </>
    );
}

export function AccountLifecyclePage() {
    return (
        <Guard context="user">
            <PersonalShell>
                <LifecycleContent />
            </PersonalShell>
        </Guard>
    );
}
