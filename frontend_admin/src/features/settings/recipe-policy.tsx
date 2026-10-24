import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../app/providers.js';
import { Guard, useSession } from '../auth/session.js';
import { useRequestSignal } from '../auth/use-request-signal.js';
import { CriticalConfirmation } from '../auth/critical-confirmation.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import { InlineLoader as ArcInlineLoader } from '@meal-planner/design-system';
import type { Success } from '../../shared/api/contracts.generated.js';
type Policy = Success<'GET /api/v1/admin/settings/recipe-policy'>['data'];
export function RecipePolicyPage() {
    return (
        <Guard context="admin">
            <RecipePolicyContent />
        </Guard>
    );
}
function RecipePolicyContent() {
    const { api } = useRuntime();
    const session = useSession('admin');
    const query = useQuery({
        queryKey: ['recipe-policy', session.data?.id],
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/admin/settings/recipe-policy', undefined, signal)).data,
    });
    return (
        <main id="main" className="staff-home">
            <nav className="actions" aria-label="Вкладки настроек">
                <Link to="/admin">К обзору</Link>
                <Link to="/settings/notifications">Уведомления</Link>
                <Link to="/settings/recipes" aria-current="page">
                    Рецепты и антиспам
                </Link>
            </nav>
            <h1>Рецепты и антиспам</h1>
            <p>
                Общие ограничения на один аккаунт. Сутки — последние 24 часа, час — последние 60 минут. Уменьшение
                лимита учитывает уже совершённые действия.
            </p>
            <CriticalConfirmation />
            {query.isPending ? (
                <ArcSkeleton variant="lines" lines={3} label="Загружаем ограничения…" />
            ) : query.isError ? (
                <p role="alert">
                    Не удалось загрузить ограничения. <button onClick={() => void query.refetch()}>Повторить</button>
                </p>
            ) : (
                <PolicyForm key={query.data.version} initial={query.data} refresh={() => query.refetch()} />
            )}
        </main>
    );
}
function PolicyForm({ initial, refresh }: { initial: Policy; refresh: () => Promise<unknown> }) {
    const { api } = useRuntime();
    const [values, setValues] = useState({
        submissionDailyLimit: String(initial.submissionDailyLimit),
        commentHourlyLimit: String(initial.commentHourlyLimit),
        reportDailyLimit: String(initial.reportDailyLimit),
    });
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const locked = useRef(false);
    const begin = useRequestSignal();
    async function save(event: FormEvent) {
        event.preventDefault();
        if (locked.current || !api) return;
        locked.current = true;
        setBusy(true);
        setMessage('');
        const signal = begin();
        try {
            await api.request(
                'PUT /api/v1/admin/settings/recipe-policy',
                {
                    expectedVersion: initial.version,
                    submissionDailyLimit: Number(values.submissionDailyLimit),
                    commentHourlyLimit: Number(values.commentHourlyLimit),
                    reportDailyLimit: Number(values.reportDailyLimit),
                },
                signal,
            );
            signal.throwIfAborted();
            await refresh();
        } catch (error) {
            if (!signal.aborted)
                setMessage(
                    `${error instanceof Error ? error.message : 'Не удалось сохранить.'} При конфликте или неизвестном результате сначала перечитайте настройки.`,
                );
        } finally {
            locked.current = false;
            setBusy(false);
        }
    }
    return (
        <section className="sessions-panel">
            <h2>Лимиты действий</h2>
            <p role="status">Загружена сохранённая версия {initial.version}.</p>
            <form onSubmit={(event) => void save(event)} aria-busy={busy}>
                {(
                    [
                        ['submissionDailyLimit', 'Отправок рецептов на модерацию за 24 часа'],
                        ['commentHourlyLimit', 'Новых комментариев и ответов за час'],
                        ['reportDailyLimit', 'Жалоб за 24 часа'],
                    ] as const
                ).map(([key, label]) => (
                    <label key={key} style={{ display: 'grid', gap: '0.5rem', marginBlock: '1rem' }}>
                        {label}
                        <input
                            type="number"
                            min={1}
                            max={10000}
                            step={1}
                            required
                            value={values[key]}
                            disabled={busy}
                            onChange={(event) => setValues({ ...values, [key]: event.target.value })}
                        />
                    </label>
                ))}
                <p>
                    Значения от 1 до 10 000. Публикация по-прежнему требует ручной модерации. Повтор уже выполненной
                    команды не расходует лимит ещё раз.
                </p>
                <div className="actions">
                    <button className="button primary" disabled={busy}>
                        {busy && <ArcInlineLoader label={null} />}Сохранить ограничения
                    </button>
                    <button className="button outline" type="button" disabled={busy} onClick={() => void refresh()}>
                        Перечитать настройки
                    </button>
                </div>
                {message && <p role="alert">{message}</p>}
            </form>
        </section>
    );
}
