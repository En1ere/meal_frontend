'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRuntime } from '../../app/providers.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { ApiError } from '../../shared/api/client.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import { Guard, useSession } from '../auth/session.js';
import { PersonalShell } from '../personalization/shell.js';
import styles from './pro-overview.module.css';

type Overview = Success<'GET /api/v1/pro/overview'>['data'];
type MissingField = Overview['missingFields'][number];

const fieldNames: Record<MissingField, string> = {
    nutrition_profile: 'Профиль питания',
    goal: 'Цель',
    energy_kcal: 'Энергия',
    protein_g: 'Белки',
    fat_g: 'Жиры',
    carbohydrate_g: 'Углеводы',
    fiber_g: 'Клетчатка',
};
const goalNames: Record<NonNullable<Overview['goal']>, string> = {
    maintain: 'Поддерживать вес',
    lose_weight: 'Снижать вес',
    gain_weight: 'Набирать вес',
    custom: 'Своя цель',
};
const date = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long' });

function Loading() {
    return (
        <section className={styles.loading} aria-busy="true">
            <ArcSkeleton variant="lines" lines={3} height="1.3rem" label="Загружаем обзор Pro" />
            <ArcSkeleton height="19rem" label={null} />
        </section>
    );
}

function Content() {
    const { api } = useRuntime();
    const session = useSession('user');
    const query = useQuery({
        queryKey: ['pro-overview', session.data?.id],
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/pro/overview', undefined, signal)).data,
    });

    if (query.isPending) return <Loading />;
    if (query.isError) {
        if (query.error instanceof ApiError && query.error.status === 403)
            return (
                <section className={styles.locked}>
                    <span className={styles.eyebrow}>Meal Planner Pro</span>
                    <h1>Персональная аналитика в Pro</h1>
                    <p>Дневник питания, личные финансы и расширенное планирование доступны на тарифе Pro.</p>
                    <div className={styles.buttons}>
                        <Link className="button primary" href="/pricing">
                            Посмотреть тарифы
                        </Link>
                        <Link className="button outline" href="/settings/subscription">
                            Управление подпиской
                        </Link>
                    </div>
                </section>
            );
        return (
            <section className={styles.error} role="alert">
                <h1>Обзор Pro не загрузился</h1>
                <p>Проверьте подключение и повторите запрос. Сохранённые данные не изменены.</p>
                <button className="button outline" onClick={() => void query.refetch()}>
                    Повторить
                </button>
            </section>
        );
    }

    const value = query.data;
    const readOnly = value.access.mode === 'read_only';
    return (
        <div className={styles.page}>
            <header className={styles.hero}>
                <div className={styles['hero-copy']}>
                    <span className={styles.eyebrow}>Meal Planner Pro</span>
                    <h1>Питание, покупки и план — в одной картине</h1>
                    <p>
                        Здесь собраны личные показатели. Мы показываем только сохранённые значения и отдельно отмечаем,
                        каких данных пока не хватает.
                    </p>
                    <div className={styles.buttons}>
                        <Link className="button primary" href="/ai">
                            Открыть AI-помощник
                        </Link>
                        <Link className="button outline" href="/settings/subscription">
                            Подписка и квоты
                        </Link>
                    </div>
                </div>
                <img src="/assets/food-162.webp" alt="Овощи и ингредиенты для планирования питания" />
            </header>

            <section className={readOnly ? styles['read-only'] : styles.active} aria-label="Статус доступа Pro">
                <div>
                    <strong>{readOnly ? 'История доступна только для чтения' : 'Pro активен'}</strong>
                    <p>
                        {readOnly
                            ? 'Подписка завершилась. Сохранённые записи остаются доступными, но новые изменения отключены.'
                            : 'Новые записи и расчёты будут доступны в соответствующих разделах Pro.'}
                    </p>
                </div>
                {value.access.periodEndsAt && (
                    <span>
                        {readOnly ? 'Доступ действовал до' : 'Текущий период до'}{' '}
                        {date.format(new Date(value.access.periodEndsAt))}
                    </span>
                )}
            </section>

            <section>
                <div className={styles['section-heading']}>
                    <div>
                        <span className={styles.eyebrow}>Быстрый обзор</span>
                        <h2>Ваши разделы Pro</h2>
                    </div>
                    <span className={styles.honest}>Без расчётов на неполных данных</span>
                </div>
                <div className={styles.cards}>
                    <article className={styles.card} id="diary">
                        <span className={styles.icon} aria-hidden="true">
                            ◷
                        </span>
                        <h3>Дневник питания</h3>
                        <strong>{value.diaryCount} записей</strong>
                        <p>Приёмы пищи, состав и подтверждение порций.</p>
                        <Link href="/diary">Открыть дневник</Link>
                    </article>
                    <article className={styles.card} id="finance">
                        <span className={styles.icon} aria-hidden="true">
                            ₽
                        </span>
                        <h3>Личные финансы</h3>
                        <strong>{value.expenseCount} расходов</strong>
                        <p>Бюджеты, чеки и динамика стоимости продуктов.</p>
                        <Link href="/finance">Открыть финансы</Link>
                    </article>
                    <article className={styles.card} id="analytics">
                        <span className={styles.icon} aria-hidden="true">
                            ✦
                        </span>
                        <h3>Питание и аналитика</h3>
                        <strong>{value.targets ? 'Цели заданы' : 'Нужны ручные цели'}</strong>
                        <p>КБЖУ, полнота дневника и история личных целей.</p>
                        <Link href="/diary/analytics">Открыть аналитику</Link>
                    </article>
                </div>
            </section>

            <div className={styles.columns}>
                <section className={styles.panel}>
                    <span className={styles.eyebrow}>Цель</span>
                    <h2>{value.goal ? goalNames[value.goal] : 'Пока не задана'}</h2>
                    <p>
                        {value.goal
                            ? 'Цель сохранена в личном профиле питания.'
                            : 'Задайте направление и числовые цели вручную в аналитике питания.'}
                    </p>
                </section>
                <section className={styles.panel}>
                    <span className={styles.eyebrow}>Полнота данных</span>
                    <h2>{value.missingFields.length ? 'Нужно уточнение' : 'Данные заполнены'}</h2>
                    {value.missingFields.length ? (
                        <ul className={styles.chips} aria-label="Недостающие поля">
                            {value.missingFields.map((field) => (
                                <li key={field}>{fieldNames[field]}</li>
                            ))}
                        </ul>
                    ) : (
                        <p>Все основные параметры для персональной аналитики сохранены.</p>
                    )}
                </section>
            </div>

            <section className={styles.disclaimer}>
                <strong>Важно</strong>
                <p>
                    Расчёты питания носят информационный характер и не заменяют рекомендации врача. Неизвестные значения
                    остаются пустыми и не участвуют в выводах.
                </p>
            </section>
        </div>
    );
}

export function ProOverviewPage() {
    return (
        <Guard context="user">
            <PersonalShell>
                <Content />
            </PersonalShell>
        </Guard>
    );
}
