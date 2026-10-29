'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useRuntime } from '../../shared/runtime/index.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import { useSession } from '../../entities/session/client.js';
import { familyKeys } from '../../entities/family/model.js';
import styles from './subscription.module.css';

type Overview = Success<'GET /api/v1/settings/subscription'>['data'];
type PlanPreview = Success<'POST /api/v1/settings/subscription/plan/preview'>['data'];
type DowngradePreview = Success<'POST /api/v1/settings/subscription/downgrade/preview'>['data'];
type RenewalPreview = Success<'POST /api/v1/settings/subscription/renewal/preview'>['data'];
type CombinationPreview = Success<'POST /api/v1/settings/subscription/combination/preview'>['data'];
type Review =
    | { kind: 'plan'; value: PlanPreview }
    | { kind: 'downgrade'; value: DowngradePreview }
    | { kind: 'renewal'; value: RenewalPreview }
    | { kind: 'combination'; value: CombinationPreview };

const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long' });
const planNames = { free: 'Free', plus: 'Plus', pro: 'Pro' } as const;
const bucketNames = {
    subscription: 'Подписочные',
    transferred: 'Переданные',
    family_reserve: 'Резерв семьи',
    purchased: 'Купленные',
    trial: 'Пробные',
} as const;
const trialReasons: Record<NonNullable<Overview['trial']['reason']>, string> = {
    already_used: 'Пробный период уже был использован.',
    family_history: 'Пробный период недоступен, потому что аккаунт ранее состоял в семье.',
    active_subscription: 'Пробный период недоступен при действующем платном или семейном доступе.',
    account_inactive: 'Пробный период недоступен для этого аккаунта.',
};

function Content() {
    const params = useSearchParams();
    const { api, queryClient } = useRuntime();
    const session = useSession('user');
    const key = ['subscription-settings', session.data?.id] as const;
    const [period, setPeriod] = useState<'month' | 'year'>(params.get('period') === 'year' ? 'year' : 'month');
    const [review, setReview] = useState<Review | null>(null);
    const dialog = useRef<HTMLDialogElement>(null);
    const trialKey = useRef(crypto.randomUUID());
    const commitKey = useRef(crypto.randomUUID());
    const query = useQuery({
        queryKey: key,
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/settings/subscription', undefined, signal)).data,
    });
    const refreshRelated = (value: Overview) => {
        queryClient.setQueryData(key, value);
        void queryClient.invalidateQueries({ queryKey: ['ai-balance', session.data?.id] });
        void queryClient.invalidateQueries({ queryKey: familyKeys.context(session.data?.id) });
        void queryClient.invalidateQueries({ queryKey: ['meal-plan'] });
    };
    const recover = () => {
        setReview(null);
        dialog.current?.close();
        void query.refetch();
    };
    const trial = useMutation({
        mutationFn: async (version: number) =>
            (
                await api!.request('POST /api/v1/settings/subscription/trial/activate', {
                    expectedVersion: version,
                    idempotencyKey: trialKey.current,
                })
            ).data,
        onSuccess: (value) => {
            refreshRelated(value);
            trialKey.current = crypto.randomUUID();
        },
        onError: () => void query.refetch(),
    });
    const planPreview = useMutation({
        mutationFn: async ({
            version,
            targetPlan,
            timing,
        }: {
            version: number;
            targetPlan: 'plus' | 'pro';
            timing: 'now' | 'period_end';
        }) =>
            (
                await api!.request('POST /api/v1/settings/subscription/plan/preview', {
                    expectedVersion: version,
                    idempotencyKey: crypto.randomUUID(),
                    period,
                    targetPlan,
                    timing,
                    promotionOfferId: targetPlan === 'pro' ? (query.data?.promotion?.offerId ?? null) : null,
                })
            ).data,
        onSuccess: (value) => {
            commitKey.current = crypto.randomUUID();
            setReview({ kind: 'plan', value });
            queueMicrotask(() => dialog.current?.showModal());
        },
        onError: () => void query.refetch(),
    });
    const downgradePreview = useMutation({
        mutationFn: async ({ version, targetPlan }: { version: number; targetPlan: 'free' | 'plus' }) =>
            (
                await api!.request('POST /api/v1/settings/subscription/downgrade/preview', {
                    expectedVersion: version,
                    idempotencyKey: crypto.randomUUID(),
                    targetPlan,
                })
            ).data,
        onSuccess: (value) => {
            commitKey.current = crypto.randomUUID();
            setReview({ kind: 'downgrade', value });
            queueMicrotask(() => dialog.current?.showModal());
        },
        onError: () => void query.refetch(),
    });
    const renewalPreview = useMutation({
        mutationFn: async ({ version, enabled }: { version: number; enabled: boolean }) =>
            (
                await api!.request('POST /api/v1/settings/subscription/renewal/preview', {
                    expectedVersion: version,
                    idempotencyKey: crypto.randomUUID(),
                    enabled,
                })
            ).data,
        onSuccess: (value) => {
            commitKey.current = crypto.randomUUID();
            setReview({ kind: 'renewal', value });
            queueMicrotask(() => dialog.current?.showModal());
        },
        onError: () => void query.refetch(),
    });
    const combinationPreview = useMutation({
        mutationFn: async ({
            version,
            peerUserId,
            recipientId,
        }: {
            version: number;
            peerUserId: string;
            recipientId: string;
        }) =>
            (
                await api!.request('POST /api/v1/settings/subscription/combination/preview', {
                    expectedVersion: version,
                    idempotencyKey: crypto.randomUUID(),
                    peerUserId,
                    recipientId,
                })
            ).data,
        onSuccess: (value) => {
            commitKey.current = crypto.randomUUID();
            setReview({ kind: 'combination', value });
            queueMicrotask(() => dialog.current?.showModal());
        },
        onError: () => void query.refetch(),
    });
    const commit = useMutation({
        mutationFn: async () => {
            if (!review) throw new Error('Предпросмотр не выбран');
            const body = {
                previewId: review.value.previewId,
                expectedVersion: review.value.expectedVersion,
                idempotencyKey: commitKey.current,
            };
            if (review.kind === 'plan')
                return (await api!.request('POST /api/v1/settings/subscription/plan/commit', body)).data;
            if (review.kind === 'renewal')
                return (await api!.request('POST /api/v1/settings/subscription/renewal/commit', body)).data;
            if (review.kind === 'combination') {
                const result = (
                    await api!.request('POST /api/v1/settings/subscription/combination/consent', {
                        ...body,
                        combinationId: review.value.combinationId,
                    })
                ).data;
                return result.settings;
            }
            return (await api!.request('POST /api/v1/settings/subscription/downgrade/commit', body)).data;
        },
        onSuccess: (value) => {
            refreshRelated(value);
            dialog.current?.close();
            setReview(null);
            commitKey.current = crypto.randomUUID();
        },
        onError: recover,
    });
    const consentPending = useMutation({
        mutationFn: async ({ pending, version }: { pending: Overview['combination']['pending']; version: number }) => {
            if (!pending) throw new Error('Нет ожидающего объединения');
            return (
                await api!.request('POST /api/v1/settings/subscription/combination/consent', {
                    previewId: pending.previewId,
                    combinationId: pending.combinationId,
                    expectedVersion: version,
                    idempotencyKey: crypto.randomUUID(),
                })
            ).data;
        },
        onSuccess: (result) => refreshRelated(result.settings),
        onError: () => void query.refetch(),
    });

    if (query.isPending)
        return (
            <section className={styles.loading} aria-busy="true">
                <h1>Подписка и квоты</h1>
                <ArcSkeleton variant="lines" lines={4} height="1.25rem" label="Загружаем подписку" />
                <ArcSkeleton height="18rem" label={null} />
            </section>
        );
    if (query.isError)
        return (
            <section className={styles.error} role="alert">
                <h1>Подписка не загрузилась</h1>
                <p>Проверьте подключение и повторите запрос. Платёжные действия offline недоступны.</p>
                <button className="button outline" onClick={() => void query.refetch()}>
                    Повторить
                </button>
            </section>
        );

    const value = query.data;
    const subscriptionBuckets = value.ai.buckets.filter((bucket) => bucket.kind !== 'purchased');
    const purchased = value.ai.buckets.filter((bucket) => bucket.kind === 'purchased');
    const subscriptionAvailable = subscriptionBuckets.reduce((sum, bucket) => sum + bucket.available, 0);
    const purchasedAvailable = purchased.reduce((sum, bucket) => sum + bucket.available, 0);
    const currentIsOwnedPaid =
        (value.current.plan === 'plus' || value.current.plan === 'pro') && value.current.source === 'personal';
    const readonlyCoverage = value.current.source === 'family' || value.current.source === 'gift';
    const busy =
        trial.isPending ||
        planPreview.isPending ||
        downgradePreview.isPending ||
        renewalPreview.isPending ||
        combinationPreview.isPending ||
        consentPending.isPending ||
        commit.isPending;
    return (
        <div className={styles.page}>
            <header className={styles.heading}>
                <div>
                    <nav className={styles.breadcrumbs} aria-label="Хлебные крошки">
                        <Link href="/settings">Настройки</Link>
                        <span aria-hidden="true">/</span>
                        <span>Подписка и квоты</span>
                    </nav>
                    <h1>Подписка и квоты</h1>
                    <p>Выберите тариф и управляйте доступными AI-действиями.</p>
                </div>
                <span className={styles.simulation}>Тестовый режим оплаты</span>
            </header>

            <section className={styles.summary} aria-labelledby="current-plan-title">
                <div>
                    <span className={styles.label} id="current-plan-title">
                        Текущий тариф
                    </span>
                    <strong>{planNames[value.current.plan]}</strong>
                    <small>
                        {value.current.source === 'trial'
                            ? `Пробный период до ${date.format(new Date(value.current.endsAt!))}`
                            : value.current.source === 'family'
                              ? 'Доступ предоставляет семья'
                              : value.current.period
                                ? `Период: ${value.current.period === 'month' ? 'месяц' : 'год'}`
                                : 'Бесплатно'}
                    </small>
                </div>
                <div>
                    <span className={styles.label}>Подписочные AI-действия</span>
                    <strong>{subscriptionAvailable}</strong>
                    <small>{value.ai.reserved} зарезервировано</small>
                </div>
                <div>
                    <span className={styles.label}>Купленные AI-действия</span>
                    <strong>{purchasedAvailable}</strong>
                    <small>Не сгорают</small>
                </div>
            </section>

            {value.current.source !== 'trial' && value.current.plan === 'free' && (
                <section className={styles.trial} aria-labelledby="trial-title">
                    <div>
                        <span className={styles.eyebrow}>Без карты</span>
                        <h2 id="trial-title">Попробуйте Pro бесплатно</h2>
                        <p>7 дней Pro + 10 AI-действий.</p>
                        <p>После 7 дней — автоматический Free, списаний не будет.</p>
                    </div>
                    {value.trial.eligible ? (
                        <button className="button primary" disabled={busy} onClick={() => trial.mutate(value.version)}>
                            {trial.isPending ? 'Активируем…' : 'Начать пробный период'}
                        </button>
                    ) : (
                        <div className={styles.ineligible}>
                            <p>{trialReasons[value.trial.reason!]}</p>
                            <Link href="/support/new">Обратиться в поддержку</Link>
                        </div>
                    )}
                </section>
            )}

            {value.promotion && value.current.plan === 'free' && (
                <section className={styles.trial} aria-labelledby="promotion-title">
                    <div>
                        <span className={styles.eyebrow}>Персональное предложение</span>
                        <h2 id="promotion-title">Первый период Pro со скидкой 10%</h2>
                        <p>
                            {money.format(
                                value.promotion[period === 'month' ? 'monthAmountMinor' : 'yearAmountMinor'] / 100,
                            )}{' '}
                            за первый период, затем {money.format(value.prices.pro[period].amountMinor / 100)}.
                        </p>
                        <p>
                            Предложение действует до {date.format(new Date(value.promotion.expiresAt))} и не
                            перезапускается.
                        </p>
                    </div>
                </section>
            )}

            <fieldset className={styles.period}>
                <legend>Период оплаты</legend>
                <label>
                    <input
                        type="radio"
                        name="billing-period"
                        value="month"
                        checked={period === 'month'}
                        onChange={() => setPeriod('month')}
                    />
                    Месяц
                </label>
                <label>
                    <input
                        type="radio"
                        name="billing-period"
                        value="year"
                        checked={period === 'year'}
                        onChange={() => setPeriod('year')}
                    />
                    Год
                </label>
            </fieldset>

            <section className={styles.plans} aria-label="Сравнение тарифов">
                <article className={`${styles.plan} ${value.current.plan === 'free' ? styles.current : ''}`}>
                    <div className={styles['plan-title']}>
                        <div>
                            <h2>Free</h2>
                            <strong>0 ₽</strong>
                        </div>
                        {value.current.plan === 'free' && <span className={styles.badge}>Текущий тариф</span>}
                    </div>
                    <ul>
                        <li>Личные рецепты и планы</li>
                        <li>Базовое ведение запасов</li>
                        <li>Купленные AI-действия</li>
                    </ul>
                    {currentIsOwnedPaid && !value.current.downgradeToFreeAt ? (
                        <button
                            className="button outline"
                            disabled={busy}
                            onClick={() => downgradePreview.mutate({ version: value.version, targetPlan: 'free' })}
                        >
                            Перейти после оплаченного периода
                        </button>
                    ) : value.current.downgradeToFreeAt ? (
                        <p className={styles.scheduled}>
                            Free включится {date.format(new Date(value.current.downgradeToFreeAt))}
                        </p>
                    ) : null}
                </article>
                <article className={`${styles.plan} ${value.current.plan === 'plus' ? styles.current : styles.plus}`}>
                    <div className={styles['plan-title']}>
                        <div>
                            <h2>Plus</h2>
                            <strong>
                                {money.format(value.prices.plus[period].amountMinor / 100)} /{' '}
                                {period === 'month' ? 'месяц' : 'год'}
                            </strong>
                        </div>
                        {value.current.plan === 'plus' && <span className={styles.badge}>Текущий тариф</span>}
                    </div>
                    <ul>
                        <li>40 AI-действий в месяц</li>
                        <li>Семейный доступ до 4 аккаунтов</li>
                        <li>Семейные планы и заметки</li>
                        <li>Умные списки покупок</li>
                    </ul>
                    {value.current.plan === 'free' && !readonlyCoverage ? (
                        <button
                            className="button primary"
                            disabled={busy}
                            onClick={() =>
                                planPreview.mutate({ version: value.version, targetPlan: 'plus', timing: 'now' })
                            }
                        >
                            {planPreview.isPending ? 'Готовим расчёт…' : 'Перейти на Plus'}
                        </button>
                    ) : value.current.plan === 'pro' &&
                      value.current.source === 'personal' &&
                      value.current.scheduledPlan !== 'plus' ? (
                        <button
                            className="button outline"
                            disabled={busy}
                            onClick={() => downgradePreview.mutate({ version: value.version, targetPlan: 'plus' })}
                        >
                            Перейти на Plus после периода
                        </button>
                    ) : readonlyCoverage ? (
                        <p className={styles.scheduled}>Тарифом управляет владелец подписки.</p>
                    ) : null}
                </article>
                <article className={`${styles.plan} ${value.current.plan === 'pro' ? styles.current : styles.plus}`}>
                    <div className={styles['plan-title']}>
                        <div>
                            <h2>Pro</h2>
                            <strong>
                                {money.format(value.prices.pro[period].amountMinor / 100)} /{' '}
                                {period === 'month' ? 'месяц' : 'год'}
                            </strong>
                        </div>
                        {value.current.plan === 'pro' && <span className={styles.badge}>Текущий тариф</span>}
                    </div>
                    <ul>
                        <li>120 AI-действий в месяц</li>
                        <li>Календарь, финансы и дневник</li>
                        <li>Расширенная аналитика питания</li>
                        <li>Семейный Pro-доступ</li>
                    </ul>
                    {value.current.plan === 'free' && !readonlyCoverage ? (
                        <button
                            className="button primary"
                            disabled={busy}
                            onClick={() =>
                                planPreview.mutate({ version: value.version, targetPlan: 'pro', timing: 'now' })
                            }
                        >
                            Перейти на Pro
                        </button>
                    ) : value.current.plan === 'plus' && value.current.source === 'personal' ? (
                        <div className={styles['dialog-actions']}>
                            <button
                                className="button primary"
                                disabled={busy}
                                onClick={() =>
                                    planPreview.mutate({ version: value.version, targetPlan: 'pro', timing: 'now' })
                                }
                            >
                                Перейти сейчас
                            </button>
                            <button
                                className="button outline"
                                disabled={busy}
                                onClick={() =>
                                    planPreview.mutate({
                                        version: value.version,
                                        targetPlan: 'pro',
                                        timing: 'period_end',
                                    })
                                }
                            >
                                После периода
                            </button>
                        </div>
                    ) : null}
                </article>
            </section>

            {currentIsOwnedPaid && value.current.endsAt && value.current.period && (
                <section className={styles.notice} aria-labelledby="renewal-title">
                    <div>
                        <h2 id="renewal-title">Продление</h2>
                        <p>
                            {value.current.autoRenew ? 'Включено' : 'Выключено'} · следующая дата{' '}
                            {date.format(new Date(value.current.endsAt))} ·{' '}
                            {money.format(
                                value.prices[value.current.plan === 'pro' ? 'pro' : 'plus'][value.current.period]
                                    .amountMinor / 100,
                            )}
                        </p>
                    </div>
                    <button
                        className="button outline"
                        disabled={busy}
                        onClick={() =>
                            renewalPreview.mutate({ version: value.version, enabled: !value.current.autoRenew })
                        }
                    >
                        {value.current.autoRenew ? 'Отключить продление' : 'Включить продление'}
                    </button>
                </section>
            )}

            {(value.combination.eligible || value.combination.pending) && (
                <section className={styles.trial} aria-labelledby="combination-title">
                    <div>
                        <span className={styles.eyebrow}>Семейный Pro</span>
                        <h2 id="combination-title">Объединить две личные Plus</h2>
                        <p>
                            Бесплатно. Pro будет действовать до более поздней даты из двух подписок; сроки не
                            складываются.
                        </p>
                        {value.combination.pending && (
                            <p>
                                Получено согласий: {value.combination.pending.acceptedUserIds.length} из{' '}
                                {value.combination.pending.requiredUserIds.length}.
                            </p>
                        )}
                    </div>
                    {value.combination.pending ? (
                        <button
                            className="button primary"
                            disabled={busy || value.combination.pending.acceptedUserIds.includes(session.data!.id)}
                            onClick={() =>
                                consentPending.mutate({ pending: value.combination.pending, version: value.version })
                            }
                        >
                            {value.combination.pending.acceptedUserIds.includes(session.data!.id)
                                ? 'Согласие принято'
                                : 'Подтвердить объединение'}
                        </button>
                    ) : value.combination.candidates[0] ? (
                        <button
                            className="button primary"
                            disabled={busy}
                            onClick={() =>
                                combinationPreview.mutate({
                                    version: value.version,
                                    peerUserId: value.combination.candidates[0]!.userId,
                                    recipientId: session.data!.id,
                                })
                            }
                        >
                            Объединить с {value.combination.candidates[0].displayName}
                        </button>
                    ) : null}
                </section>
            )}

            <section className={styles.notice}>
                <div>
                    <h2>Перед изменением тарифа</h2>
                    <p>Мы покажем сумму, период, дату начала и последствия до подтверждения.</p>
                </div>
                <strong>Реального списания сейчас нет</strong>
            </section>

            <section className={styles.quota} id="quota">
                <div>
                    <h2>AI-квоты</h2>
                    <p>{value.ai.available} доступно всего</p>
                </div>
                <div className={styles['bucket-list']}>
                    {value.ai.buckets.map((bucket) => (
                        <div key={bucket.id}>
                            <span>{bucketNames[bucket.kind]}</span>
                            <strong>{bucket.available}</strong>
                            <small>
                                {bucket.expiresAt ? `до ${date.format(new Date(bucket.expiresAt))}` : 'не сгорают'}
                            </small>
                        </div>
                    ))}
                </div>
            </section>

            <nav className={styles.links} aria-label="Справка по подписке">
                <div>
                    <strong>История операций</strong>
                    <span>Появится после подключения платёжного провайдера</span>
                </div>
                <Link href="/support">
                    <strong>Поддержка</strong>
                    <span>Поможем с тарифом, trial и квотами</span>
                </Link>
            </nav>

            {(trial.isError ||
                planPreview.isError ||
                downgradePreview.isError ||
                renewalPreview.isError ||
                combinationPreview.isError ||
                consentPending.isError ||
                commit.isError) && (
                <p className={styles['action-error']} role="alert">
                    {commit.isError
                        ? 'Подтверждение не получено. Актуальное состояние загружено — проверьте тариф перед повтором.'
                        : 'Состояние изменилось или операция недоступна. Данные подписки обновлены — проверьте их и повторите.'}
                </p>
            )}
            {(trial.isSuccess || commit.isSuccess) && (
                <p className={styles.success} role="status">
                    Состояние подписки обновлено.
                </p>
            )}

            <dialog
                ref={dialog}
                className={styles.dialog}
                aria-labelledby="subscription-review-title"
                onClose={() => !commit.isPending && setReview(null)}
            >
                {review && (
                    <>
                        <h2 id="subscription-review-title">
                            {review.kind === 'plan'
                                ? `Подтвердите тестовый переход на ${planNames[review.value.targetPlan]}`
                                : review.kind === 'renewal'
                                  ? `${review.value.enabled ? 'Включить' : 'Отключить'} продление`
                                  : review.kind === 'combination'
                                    ? 'Подтвердите объединение Plus'
                                    : `Подтвердите переход на ${planNames[review.value.targetPlan]}`}
                        </h2>
                        {review.kind === 'plan' ? (
                            <dl>
                                <div>
                                    <dt>К оплате сейчас</dt>
                                    <dd>{money.format(review.value.amountMinor / 100)}</dd>
                                </div>
                                {review.value.creditMinor > 0 && (
                                    <div>
                                        <dt>Зачёт остатка Plus</dt>
                                        <dd>−{money.format(review.value.creditMinor / 100)}</dd>
                                    </div>
                                )}
                                <div>
                                    <dt>Период</dt>
                                    <dd>{review.value.period === 'month' ? 'Месяц' : 'Год'}</dd>
                                </div>
                                <div>
                                    <dt>Начало</dt>
                                    <dd>{date.format(new Date(review.value.startsAt))}</dd>
                                </div>
                                <div>
                                    <dt>Следующее продление</dt>
                                    <dd>
                                        {date.format(new Date(review.value.nextChargeAt))} ·{' '}
                                        {money.format(review.value.nextAmountMinor / 100)}
                                    </dd>
                                </div>
                            </dl>
                        ) : review.kind === 'downgrade' ? (
                            <div>
                                <p>
                                    {planNames[review.value.currentPlan]} останется активным до{' '}
                                    {date.format(new Date(review.value.effectiveAt))}. После этого платные данные
                                    сохранятся для просмотра и экспорта, но редактирование будет ограничено.
                                </p>
                                {review.value.targetPlan === 'plus' && (
                                    <p>
                                        Plus начнётся в эту дату: {money.format(review.value.amountMinor / 100)} за{' '}
                                        {review.value.period === 'year' ? 'год' : 'месяц'} (тестовый режим).
                                    </p>
                                )}
                            </div>
                        ) : review.kind === 'renewal' ? (
                            <p>
                                {review.value.enabled
                                    ? 'Следующее тестовое продление'
                                    : 'Доступ сохранится без продления до'}{' '}
                                {date.format(new Date(review.value.nextChargeAt))}. Сумма следующего периода —{' '}
                                {money.format(review.value.nextAmountMinor / 100)}.
                            </p>
                        ) : (
                            <p>
                                Объединение бесплатно. Оба Plus прекратятся, а семейный Pro будет действовать до{' '}
                                {date.format(new Date(review.value.resultEndsAt))}. Требуется согласие обоих владельцев.
                            </p>
                        )}
                        <p className={styles['preview-expiry']}>
                            Предпросмотр действует до {new Date(review.value.expiresAt).toLocaleTimeString('ru-RU')}.
                        </p>
                        <div className={styles['dialog-actions']}>
                            <button
                                className="button outline"
                                disabled={commit.isPending}
                                onClick={() => dialog.current?.close()}
                            >
                                Назад
                            </button>
                            <button
                                className="button primary"
                                disabled={commit.isPending}
                                onClick={() => commit.mutate()}
                            >
                                {commit.isPending ? 'Подтверждаем…' : 'Подтвердить'}
                            </button>
                        </div>
                    </>
                )}
            </dialog>
        </div>
    );
}

export function SubscriptionPage() {
    return (
        <>
            <Content />
        </>
    );
}
