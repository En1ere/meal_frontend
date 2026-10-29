'use client';

import Link from 'next/link';
import { Skeleton } from '@meal-planner/design-system';
import type { Success } from '../../shared/api/contracts.generated.js';
import { ApiError } from '../../shared/api/client.js';
import styles from './finance.module.css';

export type ExpenseList = Success<'GET /api/v1/finance/expenses'>['data'];

export type Category = ExpenseList['items'][number]['category'];

export const categories: { value: Category; label: string }[] = [
    { value: 'groceries', label: 'Продукты' },
    { value: 'delivery', label: 'Доставка' },
    { value: 'restaurant', label: 'Рестораны' },
    { value: 'prepared_food', label: 'Готовая еда' },
    { value: 'beverages', label: 'Напитки' },
    { value: 'other', label: 'Другое' },
];

export const categoryName = Object.fromEntries(categories.map((item) => [item.value, item.label])) as Record<
    Category,
    string
>;

export const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' });

export const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

export const pad = (value: number) => String(value).padStart(2, '0');

export const dateText = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const today = () => dateText(new Date());

export const monthStart = () => {
    const value = new Date();
    value.setDate(1);
    return dateText(value);
};

export const text = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value.trim() : '');

export const minor = (value: FormDataEntryValue | null) => {
    const normalized = text(value).replace(',', '.');
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
    const [whole, fraction = ''] = normalized.split('.');
    const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    return Number.isSafeInteger(result) && result > 0 ? result : null;
};

export const localIso = (value: string) => new Date(`${value}T12:00:00`).toISOString();

export function Frame({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}

export function Loading() {
    return (
        <section className={styles.loading}>
            <Skeleton variant="lines" lines={3} height="1.3rem" label="Загружаем финансы" />
            <Skeleton height="24rem" label={null} />
        </section>
    );
}

export function ErrorPanel({ error, retry }: { error: Error; retry: () => void }) {
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

export function AccessNotice({ access }: { access: ExpenseList['access'] }) {
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
