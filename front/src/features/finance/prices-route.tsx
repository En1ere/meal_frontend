'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useRuntime } from '../../shared/runtime/index.js';
import { useSession } from '../../entities/session/client.js';
import styles from './finance.module.css';
import { money, dateFormat, today, text, minor, localIso, Frame, Loading, ErrorPanel, AccessNotice } from './shared.js';

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
