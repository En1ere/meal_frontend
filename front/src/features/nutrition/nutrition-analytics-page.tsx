'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState, type FormEvent } from 'react';
import { useRuntime } from '../../shared/runtime/index.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { ApiError } from '../../shared/api/client.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import { useSession } from '../../entities/session/client.js';
import styles from './nutrition-analytics.module.css';
import { useConsent } from '../../entities/consent/client.js';

type Settings = Success<'GET /api/v1/nutrition/settings'>['data'];
type Analytics = Success<'GET /api/v1/nutrition/analytics'>['data'];
type Nutrient = keyof Analytics['days'][number]['nutrition'];
type Goal = NonNullable<Settings['profile']>['goal'];

const nutrients: { key: Nutrient; label: string; unit: string }[] = [
    { key: 'energyKcal', label: 'Энергия', unit: 'ккал' },
    { key: 'proteinG', label: 'Белки', unit: 'г' },
    { key: 'fatG', label: 'Жиры', unit: 'г' },
    { key: 'carbohydrateG', label: 'Углеводы', unit: 'г' },
    { key: 'fiberG', label: 'Клетчатка', unit: 'г' },
];
const goals: { value: Exclude<Goal, null>; label: string }[] = [
    { value: 'maintain', label: 'Поддерживать вес' },
    { value: 'lose_weight', label: 'Снижать вес' },
    { value: 'gain_weight', label: 'Набирать вес' },
    { value: 'custom', label: 'Своя цель' },
];
const pad = (value: number) => String(value).padStart(2, '0');
const dateText = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const today = () => dateText(new Date());
const daysAgo = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return dateText(date);
};
const dayAfter = (value: string) => {
    const date = new Date(`${value}T12:00:00`);
    date.setDate(date.getDate() + 1);
    return dateText(date);
};
const dateLabel = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });

function ErrorPanel({ error, retry }: { error: Error; retry: () => void }) {
    const locked = error instanceof ApiError && error.status === 403;
    return (
        <section className={styles.error} role="alert">
            <h1>{locked ? 'Аналитика доступна в Pro' : 'Не удалось загрузить аналитику'}</h1>
            <p>
                {locked
                    ? 'Подключите Pro, чтобы настроить личные цели и видеть динамику дневника.'
                    : 'Проверьте подключение. Сохранённые данные не изменились.'}
            </p>
            {locked ? (
                <Link className="button primary" href="/pricing">
                    Посмотреть тарифы
                </Link>
            ) : (
                <button className="button outline" onClick={retry}>
                    Повторить
                </button>
            )}
        </section>
    );
}

function Content() {
    const { api } = useRuntime();
    const session = useSession('user');
    const cache = useQueryClient();
    const [from, setFrom] = useState(() => daysAgo(6));
    const [to, setTo] = useState(today);
    const [goal, setGoal] = useState<Exclude<Goal, null> | null>(null);
    const [effectiveFrom, setEffectiveFrom] = useState('');
    const [targets, setTargets] = useState<Record<Nutrient, string>>({
        energyKcal: '',
        proteinG: '',
        fatG: '',
        carbohydrateG: '',
        fiberG: '',
    });
    const healthConsent = useConsent('special_category');
    const settings = useQuery({
        queryKey: ['nutrition-settings', session.data?.id],
        enabled: !!api && !!session.data && healthConsent.enabled,
        queryFn: ({ signal }) =>
            api!.request('GET /api/v1/nutrition/settings', undefined, signal).then((response) => response.data),
    });
    const analytics = useQuery({
        queryKey: ['nutrition-analytics', session.data?.id, from, to],
        enabled: !!api && !!session.data && healthConsent.enabled && from <= to,
        queryFn: ({ signal }) =>
            api!
                .request('GET /api/v1/nutrition/analytics', undefined, signal, undefined, { query: { from, to } })
                .then((response) => response.data),
    });
    const refresh = async () => {
        await Promise.all([
            cache.invalidateQueries({ queryKey: ['nutrition-settings'] }),
            cache.invalidateQueries({ queryKey: ['nutrition-analytics'] }),
            cache.invalidateQueries({ queryKey: ['pro-overview'] }),
        ]);
    };
    const saveProfile = useMutation({
        mutationFn: () =>
            api!.request(
                'PUT /api/v1/nutrition/profile',
                {
                    goal: goal ?? settings.data?.profile?.goal ?? 'maintain',
                    expectedVersion: settings.data?.profile?.version ?? null,
                    idempotencyKey: crypto.randomUUID(),
                },
                undefined,
                undefined,
                settings.data?.profile ? { ifMatch: settings.data.profile.version } : undefined,
            ),
        onSuccess: refresh,
    });
    const saveTarget = useMutation({
        mutationFn: () => {
            const profile = settings.data?.profile;
            if (!profile) throw new Error('Сначала сохраните профиль питания');
            return api!.request(
                'POST /api/v1/nutrition/targets',
                {
                    effectiveFrom:
                        effectiveFrom ||
                        (settings.data?.currentTarget ? dayAfter(settings.data.currentTarget.effectiveFrom) : today()),
                    energyKcal: targets.energyKcal || null,
                    proteinG: targets.proteinG || null,
                    fatG: targets.fatG || null,
                    carbohydrateG: targets.carbohydrateG || null,
                    fiberG: targets.fiberG || null,
                    expectedProfileVersion: profile.version,
                    idempotencyKey: crypto.randomUUID(),
                },
                undefined,
                undefined,
                { ifMatch: profile.version },
            );
        },
        onSuccess: refresh,
    });
    const average = useMemo(
        () =>
            Object.fromEntries(
                nutrients.map(({ key }) => {
                    const values = analytics.data?.days.flatMap((day) =>
                        day.nutrition[key] === null ? [] : [Number(day.nutrition[key])],
                    );
                    return [key, values?.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null];
                }),
            ) as Record<Nutrient, number | null>,
        [analytics.data],
    );

    if (healthConsent.isPending) return <ArcSkeleton variant="lines" lines={4} label="Проверяем доступ к аналитике" />;
    if (healthConsent.isError || !healthConsent.enabled)
        return (
            <section className={styles.error} role="status">
                <h1>Аналитика дневника заблокирована настройкой согласия</h1>
                <p>Ознакомьтесь с документом и разрешите обработку данных о здоровье и питании.</p>
                <Link
                    className="button primary"
                    href="/settings/privacy?consent=special_category&returnTo=/diary/analytics"
                >
                    Открыть документы и согласия
                </Link>
            </section>
        );
    if (settings.isPending || analytics.isPending)
        return (
            <section className={styles.loading} aria-busy="true">
                <ArcSkeleton variant="lines" lines={3} height="1.3rem" label="Загружаем аналитику питания" />
                <ArcSkeleton height="22rem" label={null} />
            </section>
        );
    if (settings.isError) return <ErrorPanel error={settings.error} retry={() => void settings.refetch()} />;
    if (analytics.isError) return <ErrorPanel error={analytics.error} retry={() => void analytics.refetch()} />;

    const readOnly = settings.data.access.mode === 'read_only';
    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <span className={styles.eyebrow}>Личная аналитика · Pro</span>
                    <h1>КБЖУ и цели</h1>
                    <p>Только сохранённые значения дневника. Пропуски отмечаются и не считаются нулями.</p>
                </div>
                <Link className="button outline" href="/diary">
                    ← К дневнику
                </Link>
            </header>

            {readOnly && (
                <section className={styles['read-only']}>
                    <strong>История только для чтения</strong>
                    <span>Показываем данные, сохранённые до {analytics.data.period.dataThrough}.</span>
                </section>
            )}

            <section className={styles.filters} aria-label="Период аналитики">
                <label>
                    С
                    <input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
                </label>
                <label>
                    По
                    <input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
                </label>
                <span>До 92 дней</span>
            </section>

            <section className={styles.metrics} aria-label="Средние значения по дням с данными">
                {nutrients.map(({ key, label, unit }) => (
                    <article key={key}>
                        <span>{label}</span>
                        <strong>{average[key] === null ? 'Нет данных' : `${average[key].toFixed(1)} ${unit}`}</strong>
                        <small>среднее по заполненным дням</small>
                    </article>
                ))}
            </section>

            <section className={styles.panel}>
                <div className={styles['section-heading']}>
                    <div>
                        <span className={styles.eyebrow}>Динамика</span>
                        <h2>Энергия по дням</h2>
                    </div>
                    <span>{analytics.data.summary.entryCount} записей</span>
                </div>
                {analytics.data.days.length === 0 ? (
                    <div className={styles.empty}>
                        <strong>Пока нет данных за этот период</strong>
                        <p>Добавьте приём пищи в дневник. Пустой график не подменяется нулевыми значениями.</p>
                        <Link href="/diary">Открыть дневник</Link>
                    </div>
                ) : (
                    <div className={styles.chart} role="img" aria-label="Энергия по дням относительно ручной цели">
                        {analytics.data.days.map((day) => {
                            const percent = day.progressPercent.energyKcal;
                            return (
                                <div className={styles['bar-column']} key={day.date}>
                                    <span>{day.nutrition.energyKcal ?? '—'}</span>
                                    <div className={styles.track}>
                                        {percent !== null && (
                                            <i style={{ height: `${Math.min(100, Math.max(4, percent))}%` }} />
                                        )}
                                    </div>
                                    <small>{dateLabel.format(new Date(`${day.date}T12:00:00`))}</small>
                                </div>
                            );
                        })}
                    </div>
                )}
                <p className={styles.coverage}>
                    Полных дней: {analytics.data.summary.completeDays}; с пропусками:{' '}
                    {analytics.data.summary.partialDays}; без КБЖУ: {analytics.data.summary.unknownDays}.
                </p>
            </section>

            <div className={styles.columns}>
                <form
                    className={styles.panel}
                    onSubmit={(event: FormEvent) => {
                        event.preventDefault();
                        saveProfile.mutate();
                    }}
                >
                    <span className={styles.eyebrow}>Профиль питания</span>
                    <h2>Личная цель</h2>
                    <label>
                        Направление
                        <select
                            value={goal ?? settings.data.profile?.goal ?? 'maintain'}
                            disabled={readOnly}
                            onChange={(event) => setGoal(event.target.value as Exclude<Goal, null>)}
                        >
                            {goals.map((item) => (
                                <option value={item.value} key={item.value}>
                                    {item.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <p>Вы задаёте направление сами. Мы не рассчитываем медицинскую норму и не ставим диагнозов.</p>
                    {!readOnly && (
                        <button className="button primary" disabled={saveProfile.isPending}>
                            {saveProfile.isPending ? 'Сохраняем…' : 'Сохранить профиль'}
                        </button>
                    )}
                    {saveProfile.isError && <span className={styles['form-error']}>{saveProfile.error.message}</span>}
                </form>

                <form
                    className={styles.panel}
                    onSubmit={(event: FormEvent) => {
                        event.preventDefault();
                        saveTarget.mutate();
                    }}
                >
                    <span className={styles.eyebrow}>Ручные цели</span>
                    <h2>С какого дня применять</h2>
                    <label>
                        Дата начала
                        <input
                            type="date"
                            value={
                                effectiveFrom ||
                                (settings.data.currentTarget
                                    ? dayAfter(settings.data.currentTarget.effectiveFrom)
                                    : today())
                            }
                            disabled={readOnly}
                            onChange={(event) => setEffectiveFrom(event.target.value)}
                        />
                    </label>
                    <div className={styles['target-grid']}>
                        {nutrients.map(({ key, label, unit }) => (
                            <label key={key}>
                                {label}, {unit}
                                <input
                                    inputMode="decimal"
                                    placeholder="Не задано"
                                    value={targets[key]}
                                    disabled={readOnly}
                                    onChange={(event) =>
                                        setTargets((current) => ({ ...current, [key]: event.target.value }))
                                    }
                                />
                            </label>
                        ))}
                    </div>
                    {!readOnly && (
                        <button className="button primary" disabled={!settings.data.profile || saveTarget.isPending}>
                            {saveTarget.isPending ? 'Сохраняем…' : 'Добавить версию целей'}
                        </button>
                    )}
                    {!settings.data.profile && !readOnly && <p>Сначала сохраните профиль питания.</p>}
                    {saveTarget.isError && <span className={styles['form-error']}>{saveTarget.error.message}</span>}
                </form>
            </div>

            <section className={styles.history}>
                <div className={styles['section-heading']}>
                    <div>
                        <span className={styles.eyebrow}>История</span>
                        <h2>Версии целей</h2>
                    </div>
                    <span>{settings.data.targetHistory.length}</span>
                </div>
                {settings.data.targetHistory.length === 0 ? (
                    <p>Цели ещё не задавались.</p>
                ) : (
                    <ul>
                        {settings.data.targetHistory.map((target) => (
                            <li key={target.id}>
                                <strong>
                                    с {target.effectiveFrom}
                                    {target.effectiveTo ? ` по ${target.effectiveTo}` : ' · текущая'}
                                </strong>
                                <span>
                                    {nutrients
                                        .flatMap(({ key, label, unit }) =>
                                            target.values[key] === null
                                                ? []
                                                : [`${label}: ${target.values[key]} ${unit}`],
                                        )
                                        .join(' · ')}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className={styles.disclaimer}>
                <strong>Информационный режим</strong>
                <p>
                    Цели задаются вручную и не заменяют консультацию врача. Автоматический медицинский расчёт отключён.
                </p>
            </section>
        </div>
    );
}

export function NutritionAnalyticsPage() {
    return (
        <>
            <Content />
        </>
    );
}
