'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { type FormEvent } from 'react';
import { useRuntime } from '../../shared/runtime/index.js';
import { useSession } from '../../entities/session/client.js';
import styles from './finance.module.css';
import type { Category } from './shared.js';
import {
    categories,
    money,
    dateFormat,
    text,
    minor,
    localIso,
    Frame,
    Loading,
    ErrorPanel,
    AccessNotice,
} from './shared.js';

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
