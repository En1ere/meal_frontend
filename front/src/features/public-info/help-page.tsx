'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PublicShell } from './public-shell.js';
import styles from './public-info.module.css';

interface Article {
    title: string;
    body: string;
}

interface Category {
    id: string;
    title: string;
    summary: string;
    articles: Article[];
}

const categories: Category[] = [
    {
        id: 'start',
        title: 'Начало работы',
        summary: 'Аккаунт, первый рецепт и базовый цикл.',
        articles: [
            {
                title: 'Как начать работу с Meal Planner',
                body: 'Создайте аккаунт, добавьте продукты в личные запасы, выберите рецепт и перенесите недостающие позиции в список покупок. После приготовления подтвердите фактический расход — приготовление само по себе не означает, что блюдо было съедено.',
            },
            {
                title: 'Как добавить первый рецепт',
                body: 'Откройте раздел рецептов и выберите создание рецепта. Заполните название, порции, ингредиенты и шаги. Черновик можно сохранить до публикации.',
            },
            {
                title: 'Что доступно в Free',
                body: 'Free включает личные рецепты, запасы, план питания, покупки и публичное сообщество. Подписочные AI-действия не начисляются; отдельные AI-действия можно приобрести пакетом.',
            },
        ],
    },
    {
        id: 'inventory',
        title: 'Запасы и OCR',
        summary: 'Продукты, чеки и ручная проверка распознавания.',
        articles: [
            {
                title: 'Как добавить продукты в запасы',
                body: 'Добавляйте партии вручную или через импорт. Для каждой партии можно указать количество, единицу, место хранения и срок годности. Неизвестное количество отмечается отдельно и требует проверки.',
            },
            {
                title: 'Как работает распознавание чека',
                body: 'Фото чека создаёт черновик распознавания. Перед добавлением продуктов обязательно проверьте названия, количества и возможные дубли. Development-режим использует симуляцию и не является реальным OCR-провайдером.',
            },
            {
                title: 'Что делать, если чек не распознан',
                body: 'Повторите снимок при хорошем освещении или внесите позиции вручную. Нераспознанные строки не добавляются в запасы автоматически.',
            },
        ],
    },
    {
        id: 'ai',
        title: 'AI-помощник',
        summary: 'Стоимость, подтверждение и ограничения AI-действий.',
        articles: [
            {
                title: 'Сколько AI-действий доступно',
                body: 'Free не включает подписочные действия. Plus включает 40 AI-действий в месяц. Пакет из 40 купленных действий доступен отдельно и не открывает функции Plus.',
            },
            {
                title: 'Почему AI-действие не выполняется',
                body: 'Перед запуском проверьте доступный баланс и предварительную стоимость. Действие списывается только после явного подтверждения. При неизвестном исходе сначала обновите историю, не запускайте операцию повторно вслепую.',
            },
            {
                title: 'Как получить другие варианты рецептов',
                body: 'Откройте AI-помощник, проверьте входные данные и стоимость, затем подтвердите запуск. Результат остаётся предложением: ингредиенты, аллергены и количества нужно проверить перед использованием.',
            },
        ],
    },
    {
        id: 'offline',
        title: 'Offline и синхронизация',
        summary: 'Локальное чтение, очередь и восстановление данных.',
        articles: [
            {
                title: 'Что работает без интернета',
                body: 'В offline-режиме доступны ранее сохранённые рецепты и оболочка приложения. Приватные API-ответы не кешируются. Изменения, для которых нет подтверждённой очереди синхронизации, не показываются как отправленные.',
            },
            {
                title: 'Почему данные не синхронизируются',
                body: 'Проверьте соединение и статус offline-раздела. Если исход команды неизвестен, сначала обновите данные на сервере. Очистка локальных данных блокируется при незавершённой очереди.',
            },
            {
                title: 'Как восстановить рецепт или покупку',
                body: 'Проверьте сохранённые offline-рецепты и историю соответствующего раздела. Если данных нет, создайте обращение в поддержку и укажите, после какого действия они пропали.',
            },
        ],
    },
];

export function HelpPage() {
    const [query, setQuery] = useState('');
    const [active, setActive] = useState<string>('all');
    const normalized = query.trim().toLocaleLowerCase('ru');
    const matches = useMemo(
        () =>
            categories
                .filter((category) => active === 'all' || category.id === active)
                .map((category) => ({
                    ...category,
                    articles: category.articles.filter((article) =>
                        `${article.title} ${article.body}`.toLocaleLowerCase('ru').includes(normalized),
                    ),
                }))
                .filter((category) => !normalized || category.articles.length > 0),
        [active, normalized],
    );
    const popular = categories.flatMap((category) => category.articles).slice(0, 5);
    return (
        <PublicShell current="help">
            <section className={styles.hero}>
                <p className={styles.eyebrow}>Центр помощи Meal Planner</p>
                <h1>Чем помочь?</h1>
                <p>Найдите ответы, инструкции и решения по возможностям, которые уже доступны в приложении.</p>
                <form className={styles.search} role="search" onSubmit={(event) => event.preventDefault()}>
                    <label htmlFor="help-search">Поиск по справке</label>
                    <input
                        id="help-search"
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Например: как добавить рецепт, OCR, offline"
                    />
                    <button className="button primary" type="submit">
                        Найти
                    </button>
                </form>
            </section>

            <nav className={styles['category-filter']} aria-label="Категории справки">
                <button aria-pressed={active === 'all'} onClick={() => setActive('all')}>
                    Все темы
                </button>
                {categories.map((category) => (
                    <button
                        key={category.id}
                        aria-pressed={active === category.id}
                        onClick={() => setActive(category.id)}
                    >
                        {category.title}
                    </button>
                ))}
            </nav>

            {matches.length ? (
                <section className={styles['help-grid']} aria-label="Статьи справки">
                    {matches.map((category) => (
                        <article className={styles['help-card']} key={category.id}>
                            <h2>{category.title}</h2>
                            <p>{category.summary}</p>
                            <div>
                                {category.articles.map((article) => (
                                    <details key={article.title} open={normalized.length > 0}>
                                        <summary>{article.title}</summary>
                                        <p>{article.body}</p>
                                    </details>
                                ))}
                            </div>
                        </article>
                    ))}
                </section>
            ) : (
                <section className={styles.empty} role="status">
                    <h2>Ничего не нашли</h2>
                    <p>Измените запрос или напишите в поддержку — контекст поиска останется только в браузере.</p>
                </section>
            )}

            {!normalized && active === 'all' && (
                <section className={styles.popular}>
                    <div>
                        <p className={styles.eyebrow}>Часто ищут</p>
                        <h2>Популярные статьи</h2>
                    </div>
                    <ul>
                        {popular.map((article) => (
                            <li key={article.title}>{article.title}</li>
                        ))}
                    </ul>
                </section>
            )}

            <section className={styles.support}>
                <div>
                    <p className={styles.eyebrow}>Не нашли ответ?</p>
                    <h2>Напишите нам — постараемся помочь</h2>
                    <p>Для обращения потребуется безопасный вход. Личные данные не прикладываются автоматически.</p>
                </div>
                <div className={styles.actions}>
                    <Link className="button primary" href="/auth?returnTo=%2Fsupport%2Fnew">
                        Войти и обратиться
                    </Link>
                    <Link className="button outline" href="/support">
                        Мои обращения
                    </Link>
                </div>
            </section>
        </PublicShell>
    );
}
