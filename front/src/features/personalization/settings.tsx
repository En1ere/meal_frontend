'use client';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useRuntime } from '../../shared/runtime/index.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { useSession } from '../../entities/session/client.js';
import styles from './personalization.module.css';
import { useConsent } from '../../entities/consent/client.js';
import { ApiError } from '../../shared/api/client.js';

export function SettingsPage() {
    return (
        <>
            <h1>Настройки</h1>
            <p>Управляйте профилем, питанием, безопасностью и данными на устройстве.</p>
            <div className={styles.cards}>
                <Link className={styles.card} href="/settings/preferences">
                    <h2>Питание</h2>
                    <p>Рацион, аллергены, исключения, техника и цели.</p>
                </Link>
                <Link className={styles.card} href="/settings/account">
                    <h2>Аккаунт</h2>
                    <p>Пароль, PIN, почта и активные сессии.</p>
                </Link>
                <Link className={styles.card} href="/settings/offline">
                    <h2>Offline</h2>
                    <p>Данные на устройстве и очередь синхронизации.</p>
                </Link>
                <Link className={styles.card} href="/settings/privacy">
                    <h2>Документы и согласия</h2>
                    <p>Документы, отдельные согласия, отзыв и история изменений.</p>
                </Link>
                <Link className={styles.card} href="/settings/notifications">
                    <h2>Уведомления</h2>
                    <p>Категории, Web Push, email и тихие часы.</p>
                </Link>
                <Link className={styles.card} href="/settings/subscription">
                    <h2>Подписка и квоты</h2>
                    <p>Текущий тариф, trial и доступные AI-действия.</p>
                </Link>
                <Link className={styles.card} href="/support">
                    <h2>Поддержка</h2>
                    <p>Обращения, ответы и история переписки.</p>
                </Link>
                <Link className={styles.card} href="/exports">
                    <h2>Экспорт</h2>
                    <p>Проверка состава, история запросов и защищённое скачивание.</p>
                </Link>
                <Link className={styles.card} href="/settings/account/lifecycle">
                    <h2>Управление аккаунтом</h2>
                    <p>Готовность, архивирование и безопасный запрос на удаление.</p>
                </Link>
            </div>
        </>
    );
}

function PreferencesContent() {
    const { api, queryClient } = useRuntime();
    const session = useSession('user');
    const healthConsent = useConsent('special_category');
    const query = useQuery({
        queryKey: ['personalization', session.data?.id],
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/personalization', undefined, signal)).data,
    });
    type Preference = Success<'GET /api/v1/personalization'>['data']['preferences'];
    const [draft, setDraft] = useState<Preference | null>(null);
    const mutation = useMutation({
        mutationFn: async (value: NonNullable<typeof draft>) =>
            (
                await api!.request('PUT /api/v1/personalization/preferences', {
                    diets: value.diets,
                    allergens: value.allergens,
                    dislikes: value.dislikes,
                    allergenMode: value.allergenMode,
                    equipment: value.equipment,
                    goals: value.goals,
                    expectedVersion: value.version,
                    idempotencyKey: crypto.randomUUID(),
                })
            ).data,
        onSuccess: (value) => {
            queryClient.setQueryData(['personalization', session.data?.id], (old: typeof query.data) =>
                old ? { ...old, preferences: value } : old,
            );
            setDraft(value);
        },
        onError: (error) => {
            if (error instanceof ApiError && error.status === 412) {
                setDraft(null);
                void query.refetch();
            }
        },
    });
    if (query.isPending) return <p role="status">Загружаем предпочтения…</p>;
    if (query.isError)
        return (
            <section role="alert" className={styles.panel}>
                <h1>Настройки не загрузились</h1>
                <button className="button outline" onClick={() => void query.refetch()}>
                    Повторить
                </button>
            </section>
        );
    const value = draft ?? query.data.preferences;
    const toggle = (field: 'diets' | 'allergens' | 'goals', code: string) =>
        setDraft({
            ...value,
            [field]: value[field].includes(code) ? value[field].filter((x) => x !== code) : [...value[field], code],
        });
    return (
        <>
            <h1>Питание и рекомендации</h1>
            <p>
                Эти параметры влияют на фильтрацию и будущую персонализацию. Аллергены всегда остаются явным правилом.
            </p>
            <form
                className={styles.form}
                onSubmit={(e) => {
                    e.preventDefault();
                    mutation.mutate(value);
                }}
            >
                <fieldset className={styles.group}>
                    <legend>Рацион</legend>
                    <div className={styles.choices}>
                        {query.data.catalog.diets.map((x) => (
                            <label className={styles.choice} key={x.code}>
                                <input
                                    type="checkbox"
                                    checked={value.diets.includes(x.code)}
                                    onChange={() => toggle('diets', x.code)}
                                />
                                {x.name}
                            </label>
                        ))}
                    </div>
                </fieldset>
                <fieldset className={styles.group} disabled={!healthConsent.enabled}>
                    <legend>Аллергены</legend>
                    {!healthConsent.enabled && (
                        <p role="status">
                            Настройка аллергенов заблокирована до отдельного согласия на данные о здоровье.{' '}
                            <Link href="/settings/privacy?consent=special_category&returnTo=/settings/preferences">
                                Ознакомиться и согласиться
                            </Link>
                        </p>
                    )}
                    <div className={styles.choices}>
                        {query.data.catalog.allergens.map((x) => (
                            <label className={styles.choice} key={x.code}>
                                <input
                                    type="checkbox"
                                    checked={value.allergens.includes(x.code)}
                                    onChange={() => toggle('allergens', x.code)}
                                />
                                {x.name}
                            </label>
                        ))}
                    </div>
                    <label>
                        Как показывать несовместимые рецепты
                        <select
                            value={value.allergenMode}
                            onChange={(e) => setDraft({ ...value, allergenMode: e.target.value as 'warn' | 'hide' })}
                        >
                            <option value="warn">Показывать с предупреждением</option>
                            <option value="hide">Скрывать</option>
                        </select>
                    </label>
                </fieldset>
                <fieldset className={styles.group}>
                    <legend>Не люблю</legend>
                    <label>
                        Продукты и вкусы
                        <input
                            value={value.dislikes.join(', ')}
                            maxLength={1000}
                            placeholder="Например: кинза, оливки"
                            onChange={(e) =>
                                setDraft({
                                    ...value,
                                    dislikes: e.target.value
                                        .split(',')
                                        .map((x) => x.trim())
                                        .filter(Boolean)
                                        .slice(0, 50),
                                })
                            }
                        />
                    </label>
                </fieldset>
                <fieldset className={styles.group}>
                    <legend>Кухонная техника</legend>
                    {query.data.catalog.equipment.map((x) => (
                        <label className={styles.equipment} key={x.code}>
                            <span>{x.name}</span>
                            <select
                                value={value.equipment[x.code] ?? 'unknown'}
                                onChange={(e) =>
                                    setDraft({
                                        ...value,
                                        equipment: {
                                            ...value.equipment,
                                            [x.code]: e.target.value as 'yes' | 'no' | 'unknown',
                                        },
                                    })
                                }
                            >
                                <option value="yes">Есть</option>
                                <option value="no">Нет</option>
                                <option value="unknown">Не указано</option>
                            </select>
                        </label>
                    ))}
                </fieldset>
                <fieldset className={styles.group}>
                    <legend>Цели</legend>
                    <div className={styles.choices}>
                        {query.data.catalog.goals.map((x) => (
                            <label className={styles.choice} key={x.code}>
                                <input
                                    type="checkbox"
                                    checked={value.goals.includes(x.code)}
                                    onChange={() => toggle('goals', x.code)}
                                />
                                {x.name}
                            </label>
                        ))}
                    </div>
                </fieldset>
                {mutation.isError && (
                    <p role="alert">
                        {mutation.error instanceof ApiError && mutation.error.status === 412
                            ? 'Настройки изменились в другом окне. Проверьте обновлённые значения перед повторным сохранением.'
                            : 'Не удалось сохранить. Введённые значения сохранены в форме — повторите попытку.'}
                    </p>
                )}
                {mutation.isSuccess && <p role="status">Настройки сохранены.</p>}
                <div className={styles.footer}>
                    <button className="button primary" disabled={mutation.isPending}>
                        Сохранить
                    </button>
                    <Link href="/settings">Назад к настройкам</Link>
                </div>
            </form>
        </>
    );
}
export function PreferencesPage() {
    return (
        <>
            <PreferencesContent />
        </>
    );
}
