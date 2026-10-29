'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Skeleton } from '@meal-planner/design-system';
import { useRuntime } from '../../shared/runtime/index.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { ApiError } from '../../shared/api/client.js';
import { useSession } from '../../entities/session/client.js';
import styles from './finance.module.css';

type ExpenseList = Success<'GET /api/v1/finance/expenses'>['data'];
type Category = ExpenseList['items'][number]['category'];

const categories: { value: Category; label: string }[] = [
    { value: 'groceries', label: 'Продукты' },
    { value: 'delivery', label: 'Доставка' },
    { value: 'restaurant', label: 'Рестораны' },
    { value: 'prepared_food', label: 'Готовая еда' },
    { value: 'beverages', label: 'Напитки' },
    { value: 'other', label: 'Другое' },
];
const categoryName = Object.fromEntries(categories.map((item) => [item.value, item.label])) as Record<Category, string>;
const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' });
const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const pad = (value: number) => String(value).padStart(2, '0');
const dateText = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const today = () => dateText(new Date());
const monthStart = () => {
    const value = new Date();
    value.setDate(1);
    return dateText(value);
};
const text = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value.trim() : '');
const minor = (value: FormDataEntryValue | null) => {
    const normalized = text(value).replace(',', '.');
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
    const [whole, fraction = ''] = normalized.split('.');
    const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    return Number.isSafeInteger(result) && result > 0 ? result : null;
};
const localIso = (value: string) => new Date(`${value}T12:00:00`).toISOString();

function Frame({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}

function Loading() {
    return (
        <section className={styles.loading}>
            <Skeleton variant="lines" lines={3} height="1.3rem" label="Загружаем финансы" />
            <Skeleton height="24rem" label={null} />
        </section>
    );
}

function ErrorPanel({ error, retry }: { error: Error; retry: () => void }) {
    const locked = error instanceof ApiError && error.status === 403;
    return (
        <section className={styles.error} role="alert">
            <h1>{locked ? 'Финансы доступны в Pro' : 'Финансы не загрузились'}</h1>
            <p>
                {locked
                    ? 'Подключите Pro, чтобы вести личные расходы и бюджет.'
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

function AccessNotice({ access }: { access: ExpenseList['access'] }) {
    return (
        <section className={access.mode === 'read_only' ? styles['read-only'] : styles.active}>
            <div>
                <strong>
                    {access.mode === 'read_only' ? 'История только для чтения' : 'Личные финансы · Pro активен'}
                </strong>
                <p>
                    {access.mode === 'read_only'
                        ? 'Сохранённые расходы доступны, новые записи и изменения отключены.'
                        : 'Данные видны только вам. Семейная область не подключена на этом этапе.'}
                </p>
            </div>
            {access.periodEndsAt && <span>Период до {dateFormat.format(new Date(access.periodEndsAt))}</span>}
        </section>
    );
}

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

export function FinanceExpensesPage() {
    return (
        <Frame>
            <FinanceExpensesContent />
        </Frame>
    );
}

function FinanceExpensesContent() {
    const { api } = useRuntime();
    const session = useSession('user');
    const cache = useQueryClient();
    const [from, setFrom] = useState(monthStart);
    const [to, setTo] = useState(today);
    const [category, setCategory] = useState<Category | ''>('');
    const [open, setOpen] = useState(false);
    const query = useQuery({
        queryKey: ['finance-expenses', session.data?.id, from, to, category],
        enabled: !!api && !!session.data && from <= to,
        queryFn: ({ signal }) =>
            api!
                .request('GET /api/v1/finance/expenses', undefined, signal, undefined, {
                    query: { from, to, ...(category ? { category } : {}) },
                })
                .then((response) => response.data),
    });
    const create = useMutation({
        mutationFn: (form: FormData) => {
            const amountMinor = minor(form.get('amount'));
            const occurredOn = text(form.get('occurredOn'));
            const nextCategory = text(form.get('category')) as Category;
            if (!amountMinor || !occurredOn) throw new Error('Проверьте сумму и дату');
            return api!.request('POST /api/v1/finance/expenses', {
                amountMinor,
                occurredAt: localIso(occurredOn),
                category: nextCategory,
                financeConsent: true,
                idempotencyKey: crypto.randomUUID(),
            });
        },
        onSuccess: async () => {
            setOpen(false);
            await Promise.all([
                cache.invalidateQueries({ queryKey: ['finance-expenses'] }),
                cache.invalidateQueries({ queryKey: ['finance-overview'] }),
                cache.invalidateQueries({ queryKey: ['pro-overview'] }),
            ]);
        },
    });
    if (query.isPending) return <Loading />;
    if (query.isError) return <ErrorPanel error={query.error} retry={() => void query.refetch()} />;
    const value = query.data;
    const readOnly = value.access.mode === 'read_only';
    return (
        <div className={styles.page}>
            <nav className={styles.breadcrumbs}>
                <Link href="/pro">Ваш Pro</Link>
                <span>›</span>
                <Link href="/finance">Финансы</Link>
                <span>›</span>
                <span>Расходы</span>
            </nav>
            <header className={styles.header}>
                <div>
                    <span className={styles.eyebrow}>Личный раздел · только вы</span>
                    <h1>Расходы</h1>
                    <p>
                        Точные оплаченные суммы в рублях. Ручная запись не означает импорт чека или банковскую операцию.
                    </p>
                </div>
                {!readOnly && (
                    <button className="button primary" onClick={() => setOpen((value) => !value)}>
                        ＋ Добавить расход
                    </button>
                )}
            </header>
            <AccessNotice access={value.access} />
            <section className={styles.filters}>
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
                            <option value={item.value} key={item.value}>
                                {item.label}
                            </option>
                        ))}
                    </select>
                </label>
                <strong>{money.format(value.totalMinor / 100)}</strong>
            </section>
            {open && !readOnly && (
                <form
                    className={styles['create-form']}
                    onSubmit={(event: FormEvent<HTMLFormElement>) => {
                        event.preventDefault();
                        create.mutate(new FormData(event.currentTarget));
                    }}
                >
                    <div>
                        <span className={styles.eyebrow}>Новая запись</span>
                        <h2>Добавить расход</h2>
                    </div>
                    <label>
                        Сумма, ₽<input name="amount" inputMode="decimal" placeholder="0,00" required autoFocus />
                    </label>
                    <label>
                        Дата
                        <input name="occurredOn" type="date" defaultValue={today()} required />
                    </label>
                    <label>
                        Категория
                        <select name="category" defaultValue="groceries">
                            {categories.map((item) => (
                                <option value={item.value} key={item.value}>
                                    {item.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className={styles.consent}>
                        <input type="checkbox" required />Я согласен сохранить сумму в личной финансовой истории Pro.
                    </label>
                    {create.error && (
                        <p className={styles['form-error']} role="alert">
                            {create.error.message}
                        </p>
                    )}
                    <div className={styles.actions}>
                        <button className="button primary" disabled={create.isPending}>
                            {create.isPending ? 'Сохраняем…' : 'Сохранить'}
                        </button>
                        <button className="button outline" type="button" onClick={() => setOpen(false)}>
                            Отмена
                        </button>
                    </div>
                </form>
            )}
            <section className={styles['table-panel']}>
                <div className={styles['table-header']}>
                    <span>Дата</span>
                    <span>Категория</span>
                    <span>Источник</span>
                    <span>Сумма</span>
                </div>
                {value.items.length ? (
                    <div className={styles.rows}>
                        {value.items.map((item) => (
                            <Link className={styles.row} href={`/finance/expenses/${item.id}`} key={item.id}>
                                <span data-label="Дата">{dateFormat.format(new Date(item.occurredAt))}</span>
                                <span data-label="Категория">{categoryName[item.category]}</span>
                                <span data-label="Источник">Ручной ввод</span>
                                <strong data-label="Сумма">{money.format(item.amountMinor / 100)}</strong>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className={styles.empty}>
                        <span aria-hidden="true">≡</span>
                        <h2>За выбранный период расходов нет</h2>
                        <p>Измените период или добавьте точную оплаченную сумму вручную.</p>
                        {!readOnly && (
                            <button className="button primary" onClick={() => setOpen(true)}>
                                Добавить расход
                            </button>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
}

export function FinanceExpenseDetailPage({ id }: { id: string }) {
    return (
        <Frame>
            <FinanceExpenseDetailContent id={id} />
        </Frame>
    );
}
function FinanceExpenseDetailContent({ id }: { id: string }) {
    const { api } = useRuntime();
    const session = useSession('user');
    const cache = useQueryClient();
    const query = useQuery({
        queryKey: ['finance-expense', session.data?.id, id],
        enabled: !!api && !!session.data,
        queryFn: ({ signal }) =>
            api!
                .request('GET /api/v1/finance/expenses/{id}', undefined, signal, { id })
                .then((response) => response.data),
    });
    const update = useMutation({
        mutationFn: (form: FormData) => {
            if (!query.data) throw new Error('Расход не загружен');
            const amountMinor = minor(form.get('amount'));
            const occurredOn = text(form.get('occurredOn'));
            const category = text(form.get('category')) as Category;
            if (!amountMinor || !occurredOn) throw new Error('Проверьте сумму и дату');
            return api!.request(
                'PUT /api/v1/finance/expenses/{id}',
                {
                    amountMinor,
                    occurredAt: localIso(occurredOn),
                    category,
                    expectedVersion: query.data.expense.version,
                    idempotencyKey: crypto.randomUUID(),
                },
                undefined,
                { id },
                { ifMatch: query.data.expense.version },
            );
        },
        onSuccess: async () => {
            await Promise.all([
                cache.invalidateQueries({ queryKey: ['finance-expense'] }),
                cache.invalidateQueries({ queryKey: ['finance-expenses'] }),
                cache.invalidateQueries({ queryKey: ['finance-overview'] }),
            ]);
        },
    });
    if (query.isPending) return <Loading />;
    if (query.isError) return <ErrorPanel error={query.error} retry={() => void query.refetch()} />;
    const item = query.data.expense;
    const readOnly = query.data.access.mode === 'read_only';
    return (
        <div className={styles.page}>
            <nav className={styles.breadcrumbs}>
                <Link href="/finance">Финансы</Link>
                <span>›</span>
                <Link href="/finance/expenses">Расходы</Link>
                <span>›</span>
                <span>Карточка</span>
            </nav>
            <header className={styles.header}>
                <div>
                    <span className={styles.eyebrow}>Ручной расход</span>
                    <h1>{money.format(item.amountMinor / 100)}</h1>
                    <p>Личная запись. Связь с чеком, возвраты и история исправлений появятся в следующих этапах.</p>
                </div>
                <Link className="button outline" href="/finance/expenses">
                    ← К расходам
                </Link>
            </header>
            {readOnly && <AccessNotice access={query.data.access} />}
            <form
                className={styles.detail}
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                    event.preventDefault();
                    update.mutate(new FormData(event.currentTarget));
                }}
            >
                <label>
                    Сумма, ₽
                    <input
                        name="amount"
                        inputMode="decimal"
                        defaultValue={(item.amountMinor / 100).toFixed(2)}
                        disabled={readOnly}
                        required
                    />
                </label>
                <label>
                    Дата
                    <input
                        name="occurredOn"
                        type="date"
                        defaultValue={item.occurredAt.slice(0, 10)}
                        disabled={readOnly}
                        required
                    />
                </label>
                <label>
                    Категория
                    <select name="category" defaultValue={item.category} disabled={readOnly}>
                        {categories.map((category) => (
                            <option value={category.value} key={category.value}>
                                {category.label}
                            </option>
                        ))}
                    </select>
                </label>
                <dl>
                    <div>
                        <dt>Источник</dt>
                        <dd>Ручной ввод</dd>
                    </div>
                    <div>
                        <dt>Согласие зафиксировано</dt>
                        <dd>{dateFormat.format(new Date(item.consentedAt))}</dd>
                    </div>
                    <div>
                        <dt>Версия</dt>
                        <dd>{item.version}</dd>
                    </div>
                </dl>
                {update.error && (
                    <p className={styles['form-error']} role="alert">
                        {update.error.message}
                    </p>
                )}
                {!readOnly && (
                    <button className="button primary" disabled={update.isPending}>
                        {update.isPending ? 'Сохраняем…' : 'Сохранить изменения'}
                    </button>
                )}
            </form>
        </div>
    );
}

export function FinancePricesPage() {
    return (
        <Frame>
            <FinancePricesContent />
        </Frame>
    );
}

function FinancePricesContent() {
    const { api } = useRuntime();
    const session = useSession('user');
    const cache = useQueryClient();
    const [open, setOpen] = useState(false);
    const prices = useQuery({
        queryKey: ['finance-prices', session.data?.id],
        enabled: !!api && !!session.data,
        queryFn: ({ signal }) => api!.request('GET /api/v1/finance/prices', undefined, signal).then((r) => r.data),
    });
    const catalog = useQuery({
        queryKey: ['finance-price-catalog', session.data?.id],
        enabled: !!api && !!session.data,
        queryFn: ({ signal }) =>
            api!.request('GET /api/v1/finance/prices/catalog', undefined, signal).then((r) => r.data),
    });
    const create = useMutation({
        mutationFn: (form: FormData) => {
            const amountMinor = minor(form.get('amount'));
            const ingredientId = text(form.get('ingredientId'));
            const quantity = text(form.get('quantity'));
            const observedOn = text(form.get('observedOn'));
            const unit = text(form.get('unit'));
            if (
                !amountMinor ||
                !ingredientId ||
                !unit ||
                !observedOn ||
                !/^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(quantity) ||
                Number(quantity) <= 0
            )
                throw new Error('Проверьте цену и количество');
            return api!.request('POST /api/v1/finance/prices', {
                ingredientId,
                unit,
                quantity,
                amountMinor,
                observedAt: localIso(observedOn),
                financeConsent: true,
                idempotencyKey: crypto.randomUUID(),
            });
        },
        onSuccess: async () => {
            setOpen(false);
            await cache.invalidateQueries({ queryKey: ['finance-prices'] });
        },
    });
    if (prices.isPending || catalog.isPending) return <Loading />;
    if (prices.isError) return <ErrorPanel error={prices.error} retry={() => void prices.refetch()} />;
    if (catalog.isError) return <ErrorPanel error={catalog.error} retry={() => void catalog.refetch()} />;
    const value = prices.data;
    const readOnly = value.access.mode === 'read_only';
    return (
        <div className={styles.page}>
            <nav className={styles.breadcrumbs}>
                <Link href="/pro">Ваш Pro</Link>
                <span>›</span>
                <Link href="/finance">Финансы</Link>
                <span>›</span>
                <span>Цены</span>
            </nav>
            <header className={styles.header}>
                <div>
                    <span className={styles.eyebrow}>Личная история · только вы</span>
                    <h1>Цены продуктов</h1>
                    <p>
                        Сохраняйте цену упаковки или количества. Оценки рецептов, списков и планов используют последний
                        подходящий источник.
                    </p>
                </div>
                {!readOnly && (
                    <button className="button primary" onClick={() => setOpen((v) => !v)}>
                        ＋ Добавить цену
                    </button>
                )}
            </header>
            <AccessNotice access={value.access} />
            <section className={styles.note}>
                <strong>Всегда приблизительно</strong>
                <p>{value.disclaimer} Личные записи не попадают в общий агрегат автоматически.</p>
            </section>
            {open && !readOnly && (
                <form
                    className={styles['price-form']}
                    onSubmit={(event) => {
                        event.preventDefault();
                        create.mutate(new FormData(event.currentTarget));
                    }}
                >
                    <label>
                        Ингредиент
                        <select
                            name="ingredientId"
                            required
                            onChange={(event) => {
                                const selected = catalog.data.items.find(
                                    (item) => item.ingredientId === event.target.value,
                                );
                                const form = event.currentTarget.form;
                                if (selected && form)
                                    (form.elements.namedItem('unit') as HTMLInputElement).value = selected.unit;
                            }}
                        >
                            <option value="">Выберите</option>
                            {catalog.data.items.map((item) => (
                                <option key={item.ingredientId} value={item.ingredientId}>
                                    {item.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Количество
                        <input name="quantity" inputMode="decimal" placeholder="500" required />
                    </label>
                    <label>
                        Единица
                        <input name="unit" placeholder="g" required />
                    </label>
                    <label>
                        Цена, ₽<input name="amount" inputMode="decimal" placeholder="129,90" required />
                    </label>
                    <label>
                        Дата
                        <input name="observedOn" type="date" defaultValue={today()} required />
                    </label>
                    <label className={styles.consent}>
                        <input type="checkbox" required />Я согласен сохранить цену в личной истории Pro.
                    </label>
                    {create.error && (
                        <p className={styles['form-error']} role="alert">
                            {create.error.message}
                        </p>
                    )}
                    <div className={styles.actions}>
                        <button className="button primary" disabled={create.isPending}>
                            {create.isPending ? 'Сохраняем…' : 'Сохранить'}
                        </button>
                        <button className="button outline" type="button" onClick={() => setOpen(false)}>
                            Отмена
                        </button>
                    </div>
                </form>
            )}
            <section className={styles['price-grid']}>
                {value.resolved.length ? (
                    value.resolved.map((item) => (
                        <article key={`${item.ingredientId}:${item.unit}`}>
                            <span>{item.ingredientName}</span>
                            <strong>
                                {money.format(item.amountMinor / 100)} / {item.unit}
                            </strong>
                            <small>
                                {item.source === 'personal_latest'
                                    ? 'Последняя личная цена'
                                    : `Системная медиана · ${item.sampleCount} источников`}
                            </small>
                        </article>
                    ))
                ) : (
                    <div className={styles.empty}>
                        <span aria-hidden="true">₽</span>
                        <h2>Истории цен пока нет</h2>
                        <p>Добавьте фактическую цену — неизвестные позиции останутся незаполненными, а не нулевыми.</p>
                    </div>
                )}
            </section>
            {!!value.items.length && (
                <section className={styles['table-panel']}>
                    <div className={styles['price-table-header']}>
                        <span>Дата</span>
                        <span>Продукт</span>
                        <span>Количество</span>
                        <span>Цена</span>
                    </div>
                    {value.items.map((item) => (
                        <div className={styles['price-row']} key={item.id}>
                            <span data-label="Дата">{dateFormat.format(new Date(item.observedAt))}</span>
                            <span data-label="Продукт">{item.ingredientName}</span>
                            <span data-label="Количество">
                                {item.quantity} {item.unit}
                            </span>
                            <strong data-label="Цена">{money.format(item.amountMinor / 100)}</strong>
                        </div>
                    ))}
                </section>
            )}
        </div>
    );
}
