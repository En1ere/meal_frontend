'use client';

import Link from 'next/link';
import { useState } from 'react';
import styles from './public-info.module.css';

// Mirrors the current subscription-settings source. The authenticated preview remains the source of the final charge.
const planPrices = {
    plus: { month: 399, year: 3899 },
    pro: { month: 599, year: 5899 },
} as const;

export function PricingPage() {
    const [period, setPeriod] = useState<'month' | 'year'>('month');
    const plusPrice = planPrices.plus[period];
    const proPrice = planPrices.pro[period];
    const suffix = period === 'month' ? 'в месяц' : 'в год';
    const previewHref = `/settings/subscription?period=${period}`;
    return (
        <>
            <section className={styles.hero}>
                <p className={styles.eyebrow}>Планируйте · готовьте · живите вкуснее</p>
                <h1>Выберите подходящий тариф</h1>
                <p>Сравните Free, Plus и Pro. Точную будущую сумму приложение покажет до подтверждения.</p>
                <fieldset className={styles.period}>
                    <legend>Период оплаты</legend>
                    <label>
                        <input
                            type="radio"
                            name="period"
                            checked={period === 'month'}
                            onChange={() => setPeriod('month')}
                        />
                        Месяц
                    </label>
                    <label>
                        <input
                            type="radio"
                            name="period"
                            checked={period === 'year'}
                            onChange={() => setPeriod('year')}
                        />
                        Год
                    </label>
                </fieldset>
            </section>

            <section className={styles['pricing-grid']} aria-label="Тарифы">
                <article className={styles['price-card']}>
                    <div>
                        <p className={styles.eyebrow}>Для личного старта</p>
                        <h2>Free</h2>
                        <p className={styles.price}>
                            0 ₽ <small>навсегда</small>
                        </p>
                    </div>
                    <ul>
                        <li>Личные рецепты и планы питания</li>
                        <li>Базовое ведение запасов</li>
                        <li>Списки покупок и история</li>
                        <li>Публичное сообщество</li>
                        <li>Покупные AI-действия</li>
                    </ul>
                    <Link className="button outline" href="/auth/sign-up">
                        Начать бесплатно
                    </Link>
                </article>
                <article className={`${styles['price-card']} ${styles.featured}`}>
                    <div>
                        <span className={styles.badge}>Для семьи</span>
                        <h2>Plus</h2>
                        <p className={styles.price}>
                            {plusPrice.toLocaleString('ru-RU')} ₽ <small>{suffix}</small>
                        </p>
                        {period === 'year' && (
                            <p className={styles.saving}>Экономия 889 ₽ относительно помесячной оплаты</p>
                        )}
                    </div>
                    <ul>
                        <li>Всё из Free</li>
                        <li>40 AI-действий в месяц</li>
                        <li>Семейный доступ — до 4 аккаунтов</li>
                        <li>Общие планы, запасы и покупки</li>
                        <li>Семейные рецепты и заметки</li>
                    </ul>
                    <Link className="button primary" href={previewHref}>
                        Посмотреть точную сумму
                    </Link>
                </article>
                <article className={`${styles['price-card']} ${styles.pro}`}>
                    <div>
                        <span className={styles.badge}>Максимум возможностей</span>
                        <h2>Pro</h2>
                        <p className={styles.price}>
                            {proPrice.toLocaleString('ru-RU')} ₽ <small>{suffix}</small>
                        </p>
                    </div>
                    <ul>
                        <li>Всё из Plus</li>
                        <li>120 AI-действий в месяц</li>
                        <li>Дневник и цели питания</li>
                        <li>Календарь и напоминания</li>
                        <li>Расширенная аналитика питания</li>
                    </ul>
                    <Link className="button outline" href="/pro">
                        Подробнее о Pro
                    </Link>
                </article>
            </section>

            <section className={styles['ai-pack']}>
                <div>
                    <p className={styles.eyebrow}>На любом тарифе</p>
                    <h2>40 AI-действий — 199 ₽</h2>
                    <p>Купленные действия не сгорают и не открывают функции Plus.</p>
                </div>
                <Link className="button outline" href="/ai/balance">
                    Перейти к предпросмотру
                </Link>
            </section>

            <section className={styles.trial}>
                <div>
                    <p className={styles.eyebrow}>Один раз для подходящего профиля</p>
                    <h2>7 дней Pro без карты + 10 AI-действий</h2>
                    <p>Перед запуском приложение проверит доступность пробного периода для аккаунта.</p>
                </div>
                <Link className="button primary" href="/settings/subscription">
                    Проверить доступность
                </Link>
            </section>

            <section className={styles.notice}>
                <h2>Перед изменением тарифа</h2>
                <p>
                    В защищённом preview будут показаны сумма, период, дата начала и последствия. Реальный платёжный
                    провайдер пока не подключён: доступный сценарий явно помечен как тестовый.
                </p>
            </section>
        </>
    );
}
