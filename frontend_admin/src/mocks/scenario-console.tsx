import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Guard } from '../features/auth/session.js';
import { useRuntime } from '../app/providers.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import { InlineLoader as ArcInlineLoader } from '@meal-planner/design-system';
import { IndexedDbRepository } from './repository.js';
import { createAdminState } from './admin-model.js';
import { adminSources } from './admin-sources.js';
import { enrichAdminFixtures } from './scenario-data.js';
import fixture from '../../contracts/dev-users.json' with { type: 'json' };

type ScenarioMode = 'normal' | 'empty' | 'error' | 'conflict';
const modes: { value: ScenarioMode; label: string; description: string }[] = [
    { value: 'normal', label: 'Все данные', description: 'Рабочие примеры всех разделов и согласованных действий.' },
    {
        value: 'empty',
        label: 'Пустые списки',
        description: 'Проверка пустых состояний. Записи остаются в мок-хранилище.',
    },
    {
        value: 'error',
        label: 'Ошибка загрузки',
        description: 'Доменный API имитирует отказ. Авторизация и эта панель остаются доступны.',
    },
    {
        value: 'conflict',
        label: 'Конфликт изменений',
        description: 'Проверка реакции на конфликт версии при сохранении.',
    },
];

export function ScenarioConsole() {
    if (!import.meta.env.DEV || import.meta.env.VITE_API_MODE !== 'mock')
        return (
            <main id="main">
                <h1>Недоступно</h1>
                <p>Панель предназначена только для локальных моков.</p>
            </main>
        );
    return (
        <Guard context="admin">
            <ConsoleContent />
        </Guard>
    );
}
function ConsoleContent() {
    const { queryClient } = useRuntime();
    const repository = useRef(new IndexedDbRepository());
    const lock = useRef(false);
    const [busy, setBusy] = useState(false);
    const [confirmReset, setConfirmReset] = useState(false);
    const [message, setMessage] = useState('');
    const query = useQuery({
        queryKey: ['dev-scenarios'],
        queryFn: () =>
            repository.current.transaction((state) => ({
                mode: String(state.admin.tables.__scenario?.find((row) => row.id === 'mode')?.mode ?? 'normal'),
                records: Object.entries(adminSources).flatMap(([section, source]) =>
                    (state.admin.tables[source.table] ?? []).slice(0, 6).map((row) => ({
                        section,
                        id: String(row.id),
                        title: String(row[source.title] ?? row.id),
                        status: String(row[source.status ?? 'status'] ?? ''),
                    })),
                ),
            })),
    });
    async function change(mode?: ScenarioMode) {
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        setMessage('');
        try {
            await repository.current.transaction((state) => {
                if (mode === undefined) {
                    state.admin = createAdminState();
                    enrichAdminFixtures(state.admin);
                    state.notificationCenter = {};
                }
                state.admin.tables.__scenario = [{ id: 'mode', mode: mode ?? 'normal' }];
            });
            await queryClient.invalidateQueries();
            setConfirmReset(false);
            setMessage(
                mode === undefined
                    ? 'Демонстрационные данные восстановлены. Аккаунты, текущий вход и MFA сохранены.'
                    : 'Сценарий переключён. Откройте нужный раздел.',
            );
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Не удалось изменить моки.');
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }
    return (
        <main id="main" className="staff-home">
            <Link to="/admin">К обзору</Link>
            <h1>Сценарии разработки</h1>
            <p className="inline-note">
                Только синтетические данные локальной админки. PostgreSQL, реальные пользователи, письма и платежи не
                затрагиваются.
            </p>
            {query.isPending ? (
                <ArcSkeleton variant="lines" lines={4} />
            ) : query.isError ? (
                <div role="alert">
                    <p>{query.error.message}</p>
                    <button className="button outline" onClick={() => void query.refetch()}>
                        Повторить
                    </button>
                </div>
            ) : (
                <>
                    <fieldset className="sessions-panel" disabled={busy}>
                        <legend>Режим моков</legend>
                        {modes.map((mode) => (
                            <div key={mode.value}>
                                <label className="checkbox-label">
                                    <input
                                        type="radio"
                                        name="scenario"
                                        value={mode.value}
                                        checked={query.data.mode === mode.value}
                                        onChange={() => void change(mode.value)}
                                    />
                                    {mode.label}
                                </label>
                                <p className="inline-note">{mode.description}</p>
                            </div>
                        ))}
                    </fieldset>
                    <section className="sessions-panel">
                        <h2>Восстановление демонстрационных данных</h2>
                        <p>
                            Сбросит ваши локальные изменения новостей, обращений, санкций и остальных доменных примеров,
                            а также уведомления и их настройки. Вход, MFA и данные аккаунтов останутся.
                        </p>
                        {confirmReset ? (
                            <div className="actions">
                                <button className="button outline" disabled={busy} onClick={() => void change()}>
                                    Подтвердить сброс моков
                                </button>
                                <button
                                    className="button outline"
                                    disabled={busy}
                                    onClick={() => setConfirmReset(false)}
                                >
                                    Не сбрасывать
                                </button>
                            </div>
                        ) : (
                            <button className="button outline" disabled={busy} onClick={() => setConfirmReset(true)}>
                                Восстановить все примеры
                            </button>
                        )}
                    </section>
                    <section className="sessions-panel">
                        <h2>Тестовые аккаунты для поиска</h2>
                        <p>
                            Тестовый пароль: <code>{fixture.password}</code>. В админку входит только администратор с
                            собственным настроенным MFA. Остальные записи нужны для проверки поиска и действий.
                        </p>
                        {fixture.users.map((user) => (
                            <article key={user.id}>
                                <h3>
                                    {user.name} · <code>{user.login}</code>
                                </h3>
                                <p style={{ overflowWrap: 'anywhere' }}>
                                    <code>{user.id}</code>
                                </p>
                                <p className="inline-note">
                                    Тариф {user.plan}; роль {user.role ?? 'пользователь'}
                                </p>
                            </article>
                        ))}
                    </section>
                    <section className="sessions-panel">
                        <h2>Примеры карточек</h2>
                        <p>
                            Ссылки ведут в обычные экраны. В режимах ошибки и пустых данных сначала верните «Все
                            данные».
                        </p>
                        {query.data.records.map((record) => (
                            <p key={`${record.section}-${record.id}`} style={{ overflowWrap: 'anywhere' }}>
                                <Link to={`/admin/${record.section}/${encodeURIComponent(record.id)}`}>
                                    {record.section}: {record.title}
                                </Link>{' '}
                                · {record.status || 'Без статуса'}
                                <br />
                                <code>{record.id}</code>
                            </p>
                        ))}
                    </section>
                </>
            )}
            {busy && <ArcInlineLoader label="Обновляем моки…" />}
            {message && <p role="status">{message}</p>}
        </main>
    );
}
