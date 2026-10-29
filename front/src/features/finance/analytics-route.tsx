'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useRuntime } from '../../shared/runtime/index.js';
import { useSession } from '../../entities/session/client.js';
import styles from './finance.module.css';
import type { Category } from './shared.js';
import {
    categories,
    categoryName,
    money,
    dateText,
    today,
    Frame,
    Loading,
    ErrorPanel,
    AccessNotice,
} from './shared.js';

export function FinanceAnalyticsPage() {
    return (
        <Frame>
            <FinanceAnalyticsContent />
        </Frame>
    );
}

function FinanceAnalyticsContent() {
    const { api } = useRuntime();
    const session = useSession('user');
    const [from, setFrom] = useState(() => {
        const value = new Date();
        value.setDate(value.getDate() - 89);
        return dateText(value);
    });
    const [to, setTo] = useState(today);
    const [category, setCategory] = useState<Category | ''>('');
    const analytics = useQuery({
        queryKey: ['finance-analytics', session.data?.id, from, to, category],
        enabled: !!api && !!session.data && from <= to,
        queryFn: ({ signal }) =>
            api!
                .request('GET /api/v1/finance/analytics', undefined, signal, undefined, {
                    query: { from, to, ...(category ? { category } : {}) },
                })
                .then((response) => response.data),
    });
    if (analytics.isPending) return <Loading />;
    if (analytics.isError) return <ErrorPanel error={analytics.error} retry={() => void analytics.refetch()} />;
    const value = analytics.data;
    return (
        <div className={styles.page}>
            <nav className={styles.breadcrumbs}>
                <Link href="/finance">Финансы</Link>
                <span>›</span>
                <span>Аналитика</span>
            </nav>
            <header className={styles.header}>
                <div>
                    <span className={styles.eyebrow}>Подтверждённые данные · Pro</span>
                    <h1>Финансовая аналитика</h1>
                    <p>Расходы, чеки и экономия с явной полнотой исходных данных.</p>
                </div>
                <Link className="button outline" href="/finance/expenses">
                    Открыть расходы
                </Link>
            </header>
            <AccessNotice access={value.access} />
            <section className={styles.period} aria-label="Фильтры аналитики">
                <label>
                    С<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
                </label>
                <label>
                    По
                    <input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
                </label>
                <label>
                    Категория
                    <select value={category} onChange={(event) => setCategory(event.target.value as Category | '')}>
                        <option value="">Все</option>
                        {categories.map((item) => (
                            <option key={item.value} value={item.value}>
                                {item.label}
                            </option>
                        ))}
                    </select>
                </label>
            </section>
            <section className={styles.metrics} aria-label="Ключевые показатели">
                <article>
                    <span>Расходы</span>
                    <strong>
                        {value.totals.expenseCount
                            ? money.format(value.totals.expenseMinor / 100)
                            : 'Недостаточно данных'}
                    </strong>
                    <small>{value.totals.expenseCount} записей</small>
                </article>
                <article>
                    <span>Средний чек</span>
                    <strong>
                        {value.totals.averageReceiptMinor === null
                            ? 'Недостаточно данных'
                            : money.format(value.totals.averageReceiptMinor / 100)}
                    </strong>
                    <small>{value.totals.receiptCount} подтверждённых чеков</small>
                </article>
                <article>
                    <span>Подтверждённая экономия</span>
                    <strong>
                        {value.totals.confirmedSavingsMinor === null
                            ? 'Недостаточно данных'
                            : money.format(value.totals.confirmedSavingsMinor / 100)}
                    </strong>
                    <small>
                        Покрытие исходной ценой:{' '}
                        {value.completeness.savingsCoveragePercent === null
                            ? 'нет данных'
                            : `${value.completeness.savingsCoveragePercent}%`}
                    </small>
                </article>
            </section>
            <div className={styles.columns}>
                <section className={styles.panel}>
                    <h2>Категории</h2>
                    {value.categories.length ? (
                        value.categories.map((item) => (
                            <p key={item.category}>
                                <strong>{categoryName[item.category]}</strong> · {money.format(item.amountMinor / 100)}{' '}
                                · {item.count}
                            </p>
                        ))
                    ) : (
                        <p>За период нет расходов.</p>
                    )}
                </section>
                <section className={styles.panel}>
                    <h2>Магазины</h2>
                    {value.stores.length ? (
                        value.stores.map((item) => (
                            <p key={item.storeName ?? 'unknown'}>
                                <strong>{item.storeName ?? 'Магазин не указан'}</strong> ·{' '}
                                {money.format(item.amountMinor / 100)} · {item.receiptCount} чек.
                            </p>
                        ))
                    ) : (
                        <p>Магазины появятся после подтверждения финансовых чеков.</p>
                    )}
                </section>
            </div>
            <section className={styles.panel}>
                <h2>Прогноз на 30 дней</h2>
                {value.forecast.available && value.forecast.projected30DayMinor !== null ? (
                    <p className={styles.total}>
                        <strong>{money.format(value.forecast.projected30DayMinor / 100)}</strong>
                        <span>линейная оценка по {value.forecast.basisDays} дням, не гарантия будущих расходов</span>
                    </p>
                ) : (
                    <p>Недостаточно истории: нужен период не короче 28 дней и минимум три расхода.</p>
                )}
            </section>
        </div>
    );
}
