'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRuntime } from '../../shared/runtime/index.js';
import { useSession } from '../../entities/session/client.js';
import styles from './finance.module.css';
import type { Category } from './shared.js';
import {
    categories,
    categoryName,
    money,
    dateFormat,
    today,
    monthStart,
    text,
    minor,
    localIso,
    Frame,
    Loading,
    ErrorPanel,
    AccessNotice,
} from './shared.js';

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
