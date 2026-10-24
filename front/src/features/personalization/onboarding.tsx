'use client';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../app/providers.js';
import { Guard, useSession } from '../auth/session.js';
import { PersonalShell } from './shell.js';
import styles from './personalization.module.css';
const flows = {
    quick: {
        name: 'Быстрый старт',
        text: 'Три шага, чтобы сразу перейти к продуктам и рецептам.',
        steps: ['Познакомимся с запасами', 'Покажем каталог рецептов', 'Соберём первый план'],
    },
    detailed: {
        name: 'Подробная настройка',
        text: 'Пять шагов с предпочтениями и основными разделами.',
        steps: ['Определим цели', 'Настроим питание', 'Познакомимся с запасами', 'Покажем рецепты', 'Соберём план'],
    },
    demo: {
        name: 'Демонстрация',
        text: 'Семь коротких экранов без изменения ваших данных.',
        steps: ['Главная', 'Продукты', 'Рецепты', 'План', 'Покупки', 'Профиль', 'Готово'],
    },
} as const;
function Content() {
    const { api, queryClient } = useRuntime();
    const session = useSession('user');
    const query = useQuery({
        queryKey: ['personalization', session.data?.id],
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/personalization', undefined, signal)).data,
    });
    const mutation = useMutation({
        mutationFn: async (next: {
            flow: keyof typeof flows | null;
            status: 'not_started' | 'in_progress' | 'completed' | 'skipped';
            step: number;
            expectedVersion: number;
        }) =>
            (
                await api!.request('PUT /api/v1/personalization/onboarding', {
                    ...next,
                    idempotencyKey: crypto.randomUUID(),
                })
            ).data,
        onSuccess: (value) =>
            queryClient.setQueryData(['personalization', session.data?.id], (old: typeof query.data) =>
                old ? { ...old, onboarding: value } : old,
            ),
        onError: () => void query.refetch(),
    });
    if (query.isPending) return <p role="status">Загружаем старт…</p>;
    if (query.isError) return <p role="alert">Не удалось загрузить онбординг.</p>;
    const state = query.data.onboarding;
    const save = (flow: keyof typeof flows | null, status: typeof state.status, step: number) =>
        mutation.mutate({ flow, status, step, expectedVersion: state.version });
    if (state.status === 'completed')
        return (
            <section className={styles.success}>
                <h1>Добро пожаловать в Meal Planner!</h1>
                <p>Желаем приятного планирования и вкусных блюд.</p>
                <p>Наша поддержка всегда доступна, если понадобится помощь.</p>
                <p>
                    Некоторые возможности ещё развиваются — над сервисом пока работает один разработчик, поэтому
                    обновления могут выходить не сразу.
                </p>
                <Link className="button primary" href="/">
                    Перейти на главную
                </Link>
                <button className="button outline" onClick={() => save(null, 'not_started', 0)}>
                    Пройти заново
                </button>
            </section>
        );
    if (state.status === 'in_progress' && state.flow) {
        const flow = flows[state.flow];
        const last = state.step === flow.steps.length;
        return (
            <>
                <p>
                    Шаг {state.step} из {flow.steps.length}
                </p>
                <div className={styles.progress}>
                    <span style={{ width: `${(state.step / flow.steps.length) * 100}%` }} />
                </div>
                <section className={styles.panel}>
                    <h1>{flow.steps[state.step - 1]}</h1>
                    <p>
                        {state.flow === 'demo'
                            ? 'Посмотрите, как этот раздел помогает вести питание. Демо не создаёт и не меняет данные.'
                            : 'Этот шаг знакомит с возможностью. Заполнить реальные данные можно в соответствующем разделе в любое время.'}
                    </p>
                </section>
                <div className={styles.footer}>
                    {state.step > 1 && (
                        <button
                            className="button outline"
                            disabled={mutation.isPending}
                            onClick={() => save(state.flow, 'in_progress', state.step - 1)}
                        >
                            Назад
                        </button>
                    )}
                    <button
                        className="button primary"
                        disabled={mutation.isPending}
                        onClick={() =>
                            save(
                                state.flow,
                                last ? 'completed' : 'in_progress',
                                last ? flow.steps.length : state.step + 1,
                            )
                        }
                    >
                        {last ? 'Завершить' : 'Далее'}
                    </button>
                    <button
                        className="text-button"
                        disabled={mutation.isPending}
                        onClick={() => save(state.flow, 'skipped', 0)}
                    >
                        Пропустить
                    </button>
                </div>
            </>
        );
    }
    return (
        <>
            <h1>Как хотите начать?</h1>
            <p>Сценарий можно сменить или пройти снова позже.</p>
            <div className={styles['flow-grid']}>
                {(Object.keys(flows) as (keyof typeof flows)[]).map((code) => (
                    <button
                        className={styles.flow}
                        key={code}
                        onClick={() => save(code, 'in_progress', 1)}
                        disabled={mutation.isPending}
                    >
                        <h2>{flows[code].name}</h2>
                        <p>{flows[code].text}</p>
                        <strong>{flows[code].steps.length} шагов</strong>
                    </button>
                ))}
            </div>
            <button className="text-button" disabled={mutation.isPending} onClick={() => save(null, 'skipped', 0)}>
                Пропустить настройку
            </button>
            {mutation.isError && <p role="alert">Не удалось сохранить выбор. Повторите.</p>}
        </>
    );
}
export function OnboardingPage() {
    return (
        <Guard context="user">
            <PersonalShell>
                <Content />
            </PersonalShell>
        </Guard>
    );
}
