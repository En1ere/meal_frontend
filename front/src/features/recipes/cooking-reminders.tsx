'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../app/providers.js';
import { useSession } from '../auth/session.js';
import { useRecipeCommand } from './use-command.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import styles from './workspace.module.css';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
export type CookingReminder = Success<'GET /api/v1/cooking-attempts'>['data']['reminders'][number];
function deviceTimezone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
        return undefined;
    }
}
export function CookingReminders({ recipeId, reminders }: { recipeId: string; reminders: CookingReminder[] }) {
    const { api, queryClient } = useRuntime();
    const user = useSession('user');
    const command = useRecipeCommand();
    const preferences = useQuery({
        queryKey: ['cooking', user.data?.id, 'reminder-preferences'],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/cooking-attempts/reminder-preferences', undefined, signal)).data,
    });
    async function save(enabled: boolean, useDevice = false) {
        const timezone = useDevice ? deviceTimezone() : (preferences.data?.timezone ?? deviceTimezone());
        const result = await command.run('POST /api/v1/cooking-attempts/reminder-preferences', {
            enabled,
            ...(timezone ? { timezone } : {}),
        });
        if (result) await queryClient.invalidateQueries({ queryKey: ['cooking'] });
    }
    return (
        <section className={styles.panel}>
            <h2>Напоминания о незавершённой готовке</h2>
            <p>
                Два напоминания: через 2 и 4 дня. Новые напоминания не доставляются с 22:00 до 09:00 в выбранном часовом
                поясе; уже доступные остаются видимыми. На шестой день незавершённая готовка уходит в архив независимо
                от этой настройки.
            </p>
            {preferences.isPending ? (
                <ArcSkeleton variant="lines" lines={3} label="Загружаем настройки напоминаний" />
            ) : preferences.isError ? (
                <p role="alert">
                    Не удалось загрузить настройки.{' '}
                    <button onClick={() => void preferences.refetch()}>Повторить</button>
                </p>
            ) : (
                <>
                    <p>Часовой пояс: {preferences.data.timezone ?? 'Не указан'}</p>
                    {!preferences.data.timezone && <p>Укажите часовой пояс, чтобы получать напоминания.</p>}
                    <div className={styles.actions}>
                        <button
                            role="switch"
                            aria-checked={preferences.data.enabled}
                            disabled={command.pending}
                            onClick={() => void save(!preferences.data.enabled)}
                        >
                            {preferences.data.enabled ? 'Выключить напоминания' : 'Включить напоминания'}
                        </button>
                        <button disabled={command.pending} onClick={() => void save(preferences.data.enabled, true)}>
                            {preferences.data.timezone
                                ? 'Использовать часовой пояс этого устройства'
                                : 'Указать часовой пояс этого устройства'}
                        </button>
                    </div>
                </>
            )}
            {command.error && <p role="alert">{command.error}</p>}
            {reminders.map((reminder) => (
                <article className={styles.notice} key={reminder.id}>
                    <h3>
                        {reminder.sequence === 1 ? 'Продолжим приготовление?' : 'Приготовление всё ещё не завершено'}
                    </h3>
                    <p>
                        {reminder.sequence === 1
                            ? 'Вы можете продолжить с сохранённого шага.'
                            : 'На шестой день незавершённое приготовление будет архивировано.'}
                    </p>
                    <Link className="button outline" href={`/recipes/${recipeId}/cook?attempt=${reminder.attemptId}`}>
                        Вернуться к приготовлению
                    </Link>
                </article>
            ))}
            <p>Напоминания показываются при открытом приложении. Доставка вне приложения пока недоступна.</p>
        </section>
    );
}
