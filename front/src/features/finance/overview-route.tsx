'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRuntime } from '../../shared/runtime/index.js';
import { useSession } from '../../entities/session/client.js';
import styles from './finance.module.css';
import { money, today, monthStart, text, minor, Frame, Loading, ErrorPanel, AccessNotice } from './shared.js';

export function FinanceOverviewPage() {
    return (
        <Frame>
            <FinanceOverviewContent />
        </Frame>
    );
}

function FinanceOverviewContent() {
    const { api } = useRuntime();
    const session = useSession('user');
    const cache = useQueryClient();
    const [from, setFrom] = useState(monthStart);
    const [to, setTo] = useState(today);
    const [budgetOpen, setBudgetOpen] = useState(false);
    const overview = useQuery({
        queryKey: ['finance-overview', session.data?.id, from, to],
        enabled: !!api && !!session.data && from <= to,
        queryFn: ({ signal }) =>
            api!
                .request('GET /api/v1/finance/overview', undefined, signal, undefined, { query: { from, to } })
                .then((response) => response.data),
    });
    const budgets = useQuery({
        queryKey: ['finance-budgets', session.data?.id],
        enabled: !!api && !!session.data,
        queryFn: ({ signal }) =>
            api!.request('GET /api/v1/finance/budgets', undefined, signal).then((response) => response.data),
    });
    const saveBudget = useMutation({
        mutationFn: (form: FormData) => {
            const amountMinor = minor(form.get('amount'));
            const startsOn = text(form.get('startsOn'));
            const endsOn = text(form.get('endsOn'));
            if (!amountMinor || !startsOn || !endsOn || startsOn > endsOn)
                throw new Error('Проверьте сумму и период бюджета');
            const current = budgets.data?.items.find((item) => item.startsOn <= endsOn && item.endsOn >= startsOn);
            return current
                ? api!.request(
                      'PUT /api/v1/finance/budgets/{id}',
                      {
                          amountMinor,
                          startsOn,
                          endsOn,
                          category: null,
                          expectedVersion: current.version,
                          idempotencyKey: crypto.randomUUID(),
                      },
                      undefined,
                      { id: current.id },
                      { ifMatch: current.version },
                  )
                : api!.request('POST /api/v1/finance/budgets', {
                      amountMinor,
                      startsOn,
                      endsOn,
                      category: null,
                      idempotencyKey: crypto.randomUUID(),
                  });
        },
        onSuccess: async () => {
            setBudgetOpen(false);
            await Promise.all([
                cache.invalidateQueries({ queryKey: ['finance-overview'] }),
                cache.invalidateQueries({ queryKey: ['finance-budgets'] }),
            ]);
        },
    });
    if (overview.isPending || budgets.isPending) return <Loading />;
    if (overview.isError) return <ErrorPanel error={overview.error} retry={() => void overview.refetch()} />;
    const value = overview.data;
    const readOnly = value.access.mode === 'read_only';
    return (
        <div className={styles.page}>
            <nav className={styles.breadcrumbs}>
                <Link href="/pro">Ваш Pro</Link>
                <span>›</span>
                <span>Финансы</span>
            </nav>
            <header className={styles.header}>
                <div>
                    <span className={styles.eyebrow}>Личный учёт · Pro</span>
                    <h1>Финансы</h1>
                    <p>
                        Контролируйте расходы на питание и планируйте общий бюджет без смешивания с семейными данными.
                    </p>
                </div>
                <div className={styles.actions}>
                    <Link className="button outline" href="/finance/prices">
                        Цены
                    </Link>
                    <Link className="button outline" href="/finance/analytics">
                        Аналитика
                    </Link>
                    <Link className="button primary" href="/finance/expenses">
                        Расходы
                    </Link>
                </div>
            </header>
            <AccessNotice access={value.access} />
            <section className={styles.period} aria-label="Период">
                <label>
                    С<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
                </label>
                <label>
                    По
                    <input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
                </label>
            </section>
            <section className={styles.metrics} aria-label="Итоги периода">
                <article>
                    <span>Расходы</span>
                    <strong>{value.expenseCount ? money.format(value.totalMinor / 100) : 'Недостаточно данных'}</strong>
                    <small>{value.expenseCount} записей</small>
                </article>
                <article>
                    <span>Бюджет</span>
                    <strong>{value.budget ? money.format(value.budget.amountMinor / 100) : 'Не задан'}</strong>
                    <small>
                        {value.budget ? `${value.budget.startsOn} — ${value.budget.endsOn}` : 'Общий личный бюджет'}
                    </small>
                </article>
                <article>
                    <span>Остаток</span>
                    <strong>
                        {value.budgetRemainingMinor === null
                            ? 'Недостаточно данных'
                            : money.format(value.budgetRemainingMinor / 100)}
                    </strong>
                    <small>Прогноз пока не рассчитывается</small>
                </article>
            </section>
            <div className={styles.columns}>
                <section className={styles.panel}>
                    <div className={styles['panel-heading']}>
                        <div>
                            <span className={styles.eyebrow}>Динамика расходов</span>
                            <h2>{value.expenseCount ? 'Сохранённые траты' : 'Недостаточно данных'}</h2>
                        </div>
                        <Link href="/finance/expenses">Открыть список →</Link>
                    </div>
                    {value.expenseCount ? (
                        <div className={styles.total}>
                            <strong>{money.format(value.totalMinor / 100)}</strong>
                            <span>за выбранный период</span>
                        </div>
                    ) : (
                        <div className={styles.empty}>
                            <span aria-hidden="true">₽</span>
                            <p>
                                Добавьте первый расход — категории и итоги появятся здесь. Неизвестные суммы не
                                считаются нулями.
                            </p>
                            <Link className="button primary" href="/finance/expenses">
                                Добавить расход
                            </Link>
                        </div>
                    )}
                </section>
                <section className={styles.panel}>
                    <div className={styles['panel-heading']}>
                        <div>
                            <span className={styles.eyebrow}>Бюджет</span>
                            <h2>Лимит на период</h2>
                        </div>
                        {!readOnly && (
                            <button className="button outline" onClick={() => setBudgetOpen((value) => !value)}>
                                {value.budget ? 'Изменить' : 'Задать'}
                            </button>
                        )}
                    </div>
                    {budgetOpen && !readOnly ? (
                        <form
                            className={styles.form}
                            onSubmit={(event: FormEvent<HTMLFormElement>) => {
                                event.preventDefault();
                                saveBudget.mutate(new FormData(event.currentTarget));
                            }}
                        >
                            <label>
                                Лимит, ₽
                                <input
                                    name="amount"
                                    inputMode="decimal"
                                    defaultValue={value.budget ? (value.budget.amountMinor / 100).toFixed(2) : ''}
                                    required
                                />
                            </label>
                            <div className={styles['form-row']}>
                                <label>
                                    Начало
                                    <input
                                        name="startsOn"
                                        type="date"
                                        defaultValue={value.budget?.startsOn ?? from}
                                        required
                                    />
                                </label>
                                <label>
                                    Окончание
                                    <input
                                        name="endsOn"
                                        type="date"
                                        defaultValue={value.budget?.endsOn ?? to}
                                        required
                                    />
                                </label>
                            </div>
                            {saveBudget.error && (
                                <p className={styles['form-error']} role="alert">
                                    {saveBudget.error.message}
                                </p>
                            )}
                            <button className="button primary" disabled={saveBudget.isPending}>
                                {saveBudget.isPending ? 'Сохраняем…' : 'Сохранить бюджет'}
                            </button>
                        </form>
                    ) : (
                        <div className={styles['budget-copy']}>
                            <p>
                                {value.budget
                                    ? `Потрачено ${money.format((value.budgetSpentMinor ?? 0) / 100)} из ${money.format(value.budget.amountMinor / 100)}.`
                                    : 'Задайте общий лимит на неделю, месяц или свой период.'}
                            </p>
                            <small>Категорийные бюджеты появятся в отдельной итерации.</small>
                        </div>
                    )}
                </section>
            </div>
            <section className={styles.note}>
                <strong>Что входит в этот этап</strong>
                <p>
                    Личные расходы, общий бюджет и ручная история цен. Чеки, семейные финансы, возвраты и отчёты
                    подключаются отдельно.
                </p>
            </section>
        </div>
    );
}
