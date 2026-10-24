'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { useRuntime } from '../../app/providers.js';
import { Guard, useSession } from '../auth/session.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { RecipeShell, RecipeLoading, RecipeError, recipeUnits } from './shared.js';
import { useRecipeCommand } from './use-command.js';
import { ApiError } from '../../shared/api/client.js';
import { useCookingAlert } from './use-cooking-alert.js';
import { RecipeCommunity } from './community.js';
import { CookingReminders } from './cooking-reminders.js';
import styles from './workspace.module.css';
import { readOfflineOwner } from '../offline/offline-store.js';
import { readOfflineSnapshotData, saveOfflineSnapshot } from '../offline/snapshots.js';
type Attempt = Success<'GET /api/v1/cooking-attempts/{id}'>['data'];
type StockBatch = Success<'GET /api/v1/cooking-attempts/stock-options'>['data']['items'][number];
type PreserveContainer = StockBatch['containers'][number];
type StockChoice = { key: string; batch: StockBatch; container: PreserveContainer | null };
const clock = (seconds: number) =>
    `${Math.floor(Math.max(0, seconds) / 60)
        .toString()
        .padStart(2, '0')}:${(Math.max(0, seconds) % 60).toString().padStart(2, '0')}`;
export function remainingSeconds(deadline: string | null, paused: number | null, now: number) {
    return deadline ? Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1000)) : (paused ?? 0);
}
function applyOfflineProgress(
    attempt: Attempt,
    input: {
        status: 'active' | 'paused' | 'cancelled';
        steps: { position: number; status: 'pending' | 'completed' | 'skipped'; privateNote: string | null }[];
        timer: {
            position: number;
            action: 'start' | 'pause' | 'resume' | 'reset' | 'adjust';
            seconds?: number;
        } | null;
        occurredAt: string;
    },
) {
    const next = structuredClone(attempt);
    const at = Date.parse(input.occurredAt);
    next.status = input.status;
    next.version++;
    for (const update of input.steps)
        Object.assign(
            next.steps.find((row) => row.position === update.position)!,
            update,
        );
    if (input.timer) {
        const target = next.steps.find((row) => row.position === input.timer!.position)!;
        const remaining = remainingSeconds(target.timerDeadline, target.timerPausedSeconds, at);
        if (input.timer.action === 'start' || input.timer.action === 'resume') {
            const seconds =
                input.timer.action === 'resume' ? remaining : (input.timer.seconds ?? target.durationSeconds ?? 0);
            for (const row of next.steps) {
                row.timerDeadline = null;
                row.timerPausedSeconds = null;
            }
            target.timerDeadline = new Date(at + seconds * 1000).toISOString();
        } else if (input.timer.action === 'pause') {
            target.timerDeadline = null;
            target.timerPausedSeconds = remaining;
        } else if (input.timer.action === 'reset') {
            target.timerDeadline = null;
            target.timerPausedSeconds = null;
        } else {
            const seconds = Math.max(0, remaining + (input.timer.seconds ?? 0));
            if (target.timerDeadline) target.timerDeadline = new Date(at + seconds * 1000).toISOString();
            else target.timerPausedSeconds = seconds;
        }
    }
    if (input.status === 'cancelled')
        for (const row of next.steps) {
            row.timerDeadline = null;
            row.timerPausedSeconds = null;
        }
    return next;
}
function FinalReview({ attempt, onDone }: { attempt: Attempt; onDone: () => void }) {
    const { api, queryClient } = useRuntime();
    const user = useSession('user');
    const command = useRecipeCommand();
    const [validation, setValidation] = useState('');
    const [outcome, setOutcome] = useState<'completed' | 'intermediate' | 'failed'>('completed'),
        [inputs, setInputs] = useState<Record<string, string>>({}),
        [output, setOutput] = useState(''),
        [unit, setUnit] = useState('g'),
        [location, setLocation] = useState(''),
        [expiry, setExpiry] = useState(''),
        [precision, setPrecision] = useState<'exact' | 'estimated'>('exact'),
        [portion, setPortion] = useState(''),
        [note, setNote] = useState('');
    const [placements, setPlacements] = useState<
        Array<{
            quantity: string;
            unit: string;
            locationId: string;
            expiryOn: string;
            precision: 'exact' | 'estimated';
            portionQuantity: string;
        }>
    >([]);
    const [duration, setDuration] = useState(() =>
        Math.max(0, Math.round((Date.now() - Date.parse(attempt.startedAt)) / 1000)),
    );
    const stocks = useQuery({
        queryKey: ['inventory', user.data?.id, 'cooking-review', attempt.id],
        enabled: !!api,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/cooking-attempts/stock-options', undefined, signal)).data,
    });
    const locations = useQuery({
        queryKey: ['inventory-locations', user.data?.id],
        enabled: !!api,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/inventory-locations', undefined, signal)).data,
    });
    const stockChoices = (stocks.data?.items ?? []).flatMap<StockChoice>((batch) =>
        batch.kind === 'preserve'
            ? batch.containers.map((container) => ({
                  key: `${batch.id}:${container.id}`,
                  batch,
                  container,
              }))
            : [{ key: batch.id, batch, container: null }],
    );
    async function finalize() {
        if (!stocks.data) return;
        if (Object.entries(inputs).some(([key, q]) => q !== '' && !stockChoices.some((row) => row.key === key))) {
            setValidation(
                'Часть выбранных партий больше недоступна. Удалите их из расхода и проверьте оставшиеся количества.',
            );
            return;
        }
        setValidation('');
        const result = await command.run(
            'POST /api/v1/cooking-attempts/{id}/finalize',
            {
                version: attempt.version,
                outcome,
                confirmedDuration: duration,
                privateNote: note || null,
                inputs: Object.entries(inputs)
                    .filter(([, q]) => q !== '')
                    .map(([key, quantity]) => {
                        const choice = stockChoices.find((row) => row.key === key)!;
                        return {
                            batchId: choice.batch.id,
                            quantity,
                            version: choice.batch.version,
                            ...(choice.container
                                ? {
                                      containerId: choice.container.id,
                                      containerVersion: choice.container.version,
                                  }
                                : {}),
                        };
                    }),
                outputs:
                    outcome === 'failed'
                        ? []
                        : [
                              {
                                  name: attempt.title,
                                  quantity: output,
                                  unit,
                                  locationId: location,
                                  expiryOn: expiry || null,
                                  precision,
                                  portionQuantity: portion || null,
                              },
                              ...placements.map((row) => ({
                                  ...row,
                                  name: attempt.title,
                                  expiryOn: row.expiryOn || null,
                                  portionQuantity: row.portionQuantity || null,
                              })),
                          ],
            },
            { id: attempt.id },
        );
        if (result) {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['cooking'] }),
                queryClient.invalidateQueries({ queryKey: ['inventory'] }),
                queryClient.invalidateQueries({ queryKey: ['preserves'] }),
                queryClient.invalidateQueries({ queryKey: ['recipes', 'personal'] }),
                queryClient.invalidateQueries({ queryKey: ['recipe-community'] }),
            ]);
            onDone();
        }
    }
    return (
        <section className={styles.panel}>
            <h2>Проверка фактического расхода</h2>
            {validation && <p role="alert">{validation}</p>}
            {Object.keys(inputs)
                .filter((key) => !stockChoices.some((row) => row.key === key))
                .map((key) => (
                    <p key={key}>
                        Недоступная партия или банка: {inputs[key]}{' '}
                        <button
                            onClick={() =>
                                setInputs((previous) => {
                                    const next = { ...previous };
                                    delete next[key];
                                    return next;
                                })
                            }
                        >
                            Убрать из расхода
                        </button>
                    </p>
                ))}
            <p>Списывается только указанное количество. Начало готовки и завершение таймера ничего не списывают.</p>
            {command.error && (
                <div role="alert">
                    <p>{command.error}</p>
                    <button
                        disabled={command.pending || command.unknown}
                        onClick={() =>
                            void Promise.all([
                                stocks.refetch(),
                                queryClient.invalidateQueries({ queryKey: ['cooking'] }),
                            ])
                        }
                    >
                        Обновить остатки и версию, сохранив ввод
                    </button>
                </div>
            )}
            <form
                className={styles.stack}
                onSubmit={(e) => {
                    e.preventDefault();
                    void finalize();
                }}
            >
                <fieldset disabled={command.pending || command.unknown} style={{ border: 0, padding: 0, minWidth: 0 }}>
                    <label>
                        Результат
                        <select value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>
                            <option value="completed">Готовое блюдо</option>
                            <option value="intermediate">Промежуточная заготовка</option>
                            <option value="failed">Не удалось — выбросили</option>
                        </select>
                    </label>
                    {stocks.isPending ? (
                        <RecipeLoading />
                    ) : stocks.isError ? (
                        <RecipeError error={stocks.error} retry={() => void stocks.refetch()} />
                    ) : (
                        <>
                            <h3>Использованные партии</h3>
                            {stockChoices.map(({ key, batch, container }) => (
                                <label key={key} className={styles.row}>
                                    <span>
                                        {batch.name}
                                        {container ? ` · ${container.label}` : ''} · остаток{' '}
                                        {container
                                            ? (container.quantity ?? 'неизвестен')
                                            : (batch.quantity ?? 'неизвестен')}{' '}
                                        {batch.unit ? (recipeUnits[batch.unit] ?? batch.unit) : 'единица неизвестна'}
                                    </span>
                                    <input
                                        aria-label={`Расход ${batch.name}${container ? `, ${container.label}` : ''}`}
                                        inputMode="decimal"
                                        value={inputs[key] ?? ''}
                                        placeholder={
                                            container?.quantity === null
                                                ? 'Сначала уточните остаток'
                                                : 'Не использовалось'
                                        }
                                        disabled={container?.quantity === null || container?.quantity === '0'}
                                        onChange={(e) => setInputs({ ...inputs, [key]: e.target.value })}
                                    />
                                </label>
                            ))}
                        </>
                    )}
                    {outcome !== 'failed' && (
                        <div className={styles.panel}>
                            <h3>Фактический выход</h3>
                            <label>
                                Количество
                                <input
                                    required
                                    inputMode="decimal"
                                    value={output}
                                    onChange={(e) => setOutput(e.target.value)}
                                />
                            </label>
                            <label>
                                Единица
                                <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                                    {Object.entries(recipeUnits).map(([v, l]) => (
                                        <option key={v} value={v}>
                                            {l}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                Место хранения
                                <select required value={location} onChange={(e) => setLocation(e.target.value)}>
                                    <option value="">Выберите место</option>
                                    {locations.data?.items.map((l) => (
                                        <option key={l.id} value={l.id}>
                                            {l.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            {locations.isError && (
                                <p role="alert">
                                    Не удалось загрузить места.{' '}
                                    <button type="button" onClick={() => void locations.refetch()}>
                                        Повторить
                                    </button>
                                </p>
                            )}
                            <label>
                                Срок годности
                                <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
                            </label>
                            <label>
                                Точность
                                <select
                                    value={precision}
                                    onChange={(e) => setPrecision(e.target.value as typeof precision)}
                                >
                                    <option value="exact">Точно измерено</option>
                                    <option value="estimated">Примерно</option>
                                </select>
                            </label>
                            <label>
                                Размер одной порции в выбранной единице
                                <input
                                    inputMode="decimal"
                                    value={portion}
                                    onChange={(e) => setPortion(e.target.value)}
                                    placeholder="Неизвестно"
                                />
                            </label>
                        </div>
                    )}
                    {outcome !== 'failed' && (
                        <section className={styles.stack}>
                            {placements.map((row, index) => (
                                <div className={styles.panel} key={index}>
                                    <h3>Размещение {index + 2}</h3>
                                    <label>
                                        Количество
                                        <input
                                            required
                                            value={row.quantity}
                                            inputMode="decimal"
                                            onChange={(e) =>
                                                setPlacements(
                                                    placements.map((p, i) =>
                                                        i === index ? { ...p, quantity: e.target.value } : p,
                                                    ),
                                                )
                                            }
                                        />
                                    </label>
                                    <label>
                                        Единица
                                        <select
                                            value={row.unit}
                                            onChange={(e) =>
                                                setPlacements(
                                                    placements.map((p, i) =>
                                                        i === index ? { ...p, unit: e.target.value } : p,
                                                    ),
                                                )
                                            }
                                        >
                                            {Object.entries(recipeUnits).map(([v, l]) => (
                                                <option key={v} value={v}>
                                                    {l}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        Место хранения
                                        <select
                                            required
                                            value={row.locationId}
                                            onChange={(e) =>
                                                setPlacements(
                                                    placements.map((p, i) =>
                                                        i === index ? { ...p, locationId: e.target.value } : p,
                                                    ),
                                                )
                                            }
                                        >
                                            <option value="">Выберите место</option>
                                            {locations.data?.items.map((l) => (
                                                <option key={l.id} value={l.id}>
                                                    {l.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        Срок годности
                                        <input
                                            type="date"
                                            value={row.expiryOn}
                                            onChange={(e) =>
                                                setPlacements(
                                                    placements.map((p, i) =>
                                                        i === index ? { ...p, expiryOn: e.target.value } : p,
                                                    ),
                                                )
                                            }
                                        />
                                    </label>
                                    <label>
                                        Точность
                                        <select
                                            value={row.precision}
                                            onChange={(e) =>
                                                setPlacements(
                                                    placements.map((p, i) =>
                                                        i === index
                                                            ? {
                                                                  ...p,
                                                                  precision: e.target.value as 'exact' | 'estimated',
                                                              }
                                                            : p,
                                                    ),
                                                )
                                            }
                                        >
                                            <option value="exact">Точно измерено</option>
                                            <option value="estimated">Примерно</option>
                                        </select>
                                    </label>
                                    <label>
                                        Размер порции
                                        <input
                                            value={row.portionQuantity}
                                            inputMode="decimal"
                                            onChange={(e) =>
                                                setPlacements(
                                                    placements.map((p, i) =>
                                                        i === index ? { ...p, portionQuantity: e.target.value } : p,
                                                    ),
                                                )
                                            }
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setPlacements(placements.filter((_, i) => i !== index))}
                                    >
                                        Удалить размещение
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                disabled={placements.length >= 49}
                                onClick={() =>
                                    setPlacements([
                                        ...placements,
                                        {
                                            quantity: '',
                                            unit,
                                            locationId: '',
                                            expiryOn: '',
                                            precision: 'exact',
                                            portionQuantity: '',
                                        },
                                    ])
                                }
                            >
                                + Добавить размещение готового блюда
                            </button>
                        </section>
                    )}
                    <label>
                        Фактическая длительность, секунд
                        <input
                            type="number"
                            min={0}
                            max={31536000}
                            value={duration}
                            onChange={(e) => setDuration(Number(e.target.value))}
                        />
                    </label>
                    <label>
                        Личная заметка
                        <textarea maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
                    </label>
                </fieldset>
                <button className="button" disabled={command.pending || !stocks.data}>
                    {command.pending
                        ? 'Подтверждаем…'
                        : command.unknown
                          ? 'Повторить подтверждение'
                          : 'Подтвердить расход и результат'}
                </button>
            </form>
        </section>
    );
}
function ActiveCooking({ attempt }: { attempt: Attempt }) {
    const { queryClient } = useRuntime();
    const command = useRecipeCommand();
    const search = useSearchParams();
    const router = useRouter();
    const [navigating, startTransition] = useTransition();
    const [now, setNow] = useState(() => Date.now()),
        [seconds, setSeconds] = useState(60),
        [privateNote, setPrivateNote] = useState('');
    const timer = useRef<HTMLDialogElement>(null);
    const review = search.get('review') === '1';
    const setReview = (value: boolean) => {
        const p = new URLSearchParams(search);
        if (value) p.set('review', '1');
        else p.delete('review');
        startTransition(() => router.replace(`/recipes/${attempt.recipeId}/cook?${p}`, { scroll: false }));
    };
    useEffect(() => {
        if (!['active', 'paused'].includes(attempt.status)) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [attempt.status]);
    const current = Math.max(0, Math.min(attempt.steps.length - 1, Number(search.get('step')) || 0));
    const step = attempt.steps[current];
    const finished = !['active', 'paused'].includes(attempt.status);
    const active = finished ? undefined : attempt.steps.find((s) => s.timerDeadline || s.timerPausedSeconds !== null);
    const alert = useCookingAlert(attempt.id, active?.timerDeadline ?? null);
    async function progress(
        kind: 'completed' | 'skipped' | 'pending' | null = null,
        timerAction: 'start' | 'pause' | 'resume' | 'reset' | 'adjust' | null = null,
        value?: number,
        status: 'active' | 'paused' | 'cancelled' = 'active',
    ) {
        const occurredAt = new Date().toISOString();
        const body = {
            version: attempt.version,
            occurredAt,
            status,
            steps: kind && step ? [{ position: step.position, status: kind, privateNote: privateNote || null }] : [],
            timer: timerAction
                ? {
                      position:
                          timerAction === 'start' ? (step?.position ?? 0) : (active?.position ?? step?.position ?? 0),
                      action: timerAction,
                      ...(value !== undefined ? { seconds: value } : {}),
                  }
                : null,
        };
        const result = await command.run('POST /api/v1/cooking-attempts/{id}/progress', body, { id: attempt.id });
        if (result || command.wasQueued()) {
            setPrivateNote('');
            if (result) await queryClient.invalidateQueries({ queryKey: ['cooking'] });
            else {
                const optimistic = applyOfflineProgress(attempt, body);
                queryClient.setQueriesData<Attempt>(
                    {
                        predicate: (query) => query.queryKey[0] === 'cooking' && query.queryKey[2] === attempt.id,
                    },
                    (current) => (current?.id === attempt.id ? optimistic : current),
                );
                const owner = readOfflineOwner();
                if (owner) await saveOfflineSnapshot(owner, `cooking:${attempt.id}`, optimistic);
            }
            if (kind) {
                const p = new URLSearchParams(search);
                p.set('step', String(Math.min(current + 1, attempt.steps.length - 1)));
                startTransition(() => router.replace(`/recipes/${attempt.recipeId}/cook?${p}`, { scroll: false }));
            }
        }
    }
    const timerStatus = active ? remainingSeconds(active.timerDeadline, active.timerPausedSeconds, now) : 0;
    return (
        <>
            <div className={styles.actions}>
                <h1>{attempt.title || 'Приготовление'}</h1>
                <span>{attempt.servings} порций · Только я</span>
                <span>
                    Общее время:{' '}
                    {clock(
                        Math.floor(
                            ((attempt.archivedAt
                                ? Date.parse(attempt.archivedAt)
                                : attempt.completedAt
                                  ? Date.parse(attempt.completedAt)
                                  : now) -
                                Date.parse(attempt.startedAt)) /
                                1000,
                        ),
                    )}
                </span>
            </div>
            {command.error && (
                <p role="alert">
                    {command.error}{' '}
                    <button onClick={() => void queryClient.invalidateQueries({ queryKey: ['cooking'] })}>
                        Обновить состояние
                    </button>
                </p>
            )}
            {finished ? (
                <section className={styles.panel}>
                    <h2>
                        {attempt.status === 'archived'
                            ? 'Незавершённое приготовление в архиве'
                            : attempt.status === 'completed'
                              ? 'Приготовление подтверждено'
                              : attempt.status === 'intermediate'
                                ? 'Заготовка сохранена'
                                : attempt.status === 'failed'
                                  ? 'Расход сохранён без готового блюда'
                                  : 'Приготовление отменено'}
                    </h2>
                    {attempt.status === 'archived' && (
                        <>
                            <p>
                                Приготовление архивировано автоматически. Продукты не списаны. Запись доступна только
                                для чтения; таймер остановлен: 00:00.
                            </p>
                            {attempt.archivedAt && (
                                <p>Дата архива: {new Date(attempt.archivedAt).toLocaleString('ru-RU')}</p>
                            )}
                            {attempt.hideAfter && (
                                <p>
                                    После {new Date(attempt.hideAfter).toLocaleDateString('ru-RU')} запись скрывается из
                                    обычного списка. Данные не удаляются.
                                </p>
                            )}
                            <ol>
                                {attempt.steps.map((s) => (
                                    <li key={s.position}>
                                        <p>{s.text}</p>
                                        <p>
                                            {s.status === 'completed'
                                                ? 'Выполнено'
                                                : s.status === 'skipped'
                                                  ? 'Пропущено'
                                                  : 'Не завершено'}
                                        </p>
                                        {s.privateNote && <p>Личная заметка: {s.privateNote}</p>}
                                    </li>
                                ))}
                            </ol>
                            <Link href={`/recipes/${attempt.recipeId}/cook?view=archive`}>К архиву приготовлений</Link>
                        </>
                    )}
                    {attempt.outputBatchIds.map((id) => (
                        <Link key={id} href={`/inventory/prepared?batch=${id}`}>
                            Открыть готовую партию
                        </Link>
                    ))}
                    {attempt.status !== 'archived' && (
                        <Link href={`/recipes/${attempt.recipeId}/cook?attempt=${attempt.id}&community=1`}>
                            К обсуждению и оценке рецепта
                        </Link>
                    )}
                    {attempt.status !== 'archived' && search.get('community') === '1' && (
                        <RecipeCommunity id={attempt.recipeId} />
                    )}
                </section>
            ) : (
                <>
                    <nav className={styles.actions} aria-label="Шаги приготовления">
                        {attempt.steps.map((item, index) => {
                            const p = new URLSearchParams(search);
                            p.set('step', String(index));
                            return (
                                <Link
                                    key={item.position}
                                    href={`/recipes/${attempt.recipeId}/cook?${p}`}
                                    aria-current={index === current ? 'step' : undefined}
                                >
                                    {index + 1}
                                    {item.status === 'completed' ? ' ✓' : item.status === 'skipped' ? ' —' : ''}
                                </Link>
                            );
                        })}
                    </nav>
                    <div className={styles.layout}>
                        <section className={styles.panel}>
                            <h2>
                                Шаг {current + 1} из {attempt.steps.length}
                            </h2>
                            <p>{step?.text || 'У рецепта пока нет шагов. Вернитесь в редактор.'}</p>
                            <label>
                                Личная заметка
                                <textarea
                                    value={privateNote}
                                    onChange={(e) => setPrivateNote(e.target.value)}
                                    disabled={command.pending || command.unknown}
                                />
                            </label>
                            <div className={styles.actions}>
                                <button disabled={!step || command.pending} onClick={() => void progress('completed')}>
                                    Шаг выполнен
                                </button>
                                <button disabled={!step || command.pending} onClick={() => void progress('skipped')}>
                                    Пропустить шаг
                                </button>
                                <button disabled={!step || command.pending} onClick={() => void progress('pending')}>
                                    Вернуть к выполнению
                                </button>
                            </div>
                        </section>
                        <aside className={styles.panel}>
                            <h2>Таймер шага</h2>
                            <button disabled={alert.enabled} onClick={() => void alert.enable()}>
                                Включить сигнал таймера
                            </button>
                            {alert.message && <p role="status">{alert.message}</p>}
                            <strong style={{ fontSize: '3rem' }}>{clock(timerStatus)}</strong>
                            {active && timerStatus === 0 && active.timerDeadline && (
                                <p role="status">Время закончилось. Проверьте блюдо; шаг не завершён автоматически.</p>
                            )}
                            <button
                                onClick={() => {
                                    setSeconds(step?.durationSeconds || 60);
                                    timer.current?.showModal();
                                }}
                            >
                                Настроить таймер
                            </button>
                            <p>Закрытие окна не останавливает таймер. Фоновая доставка зависит от браузера.</p>
                        </aside>
                    </div>
                    <div className={styles.actions}>
                        <button
                            disabled={command.pending}
                            onClick={() => void progress(null, null, undefined, 'paused')}
                        >
                            Продолжу позже
                        </button>
                        <button
                            disabled={command.pending}
                            onClick={() => void progress(null, null, undefined, 'cancelled')}
                        >
                            Отменить без списания
                        </button>
                        <button
                            className="button"
                            disabled={command.pending || navigating}
                            onClick={() => setReview(true)}
                        >
                            Готово — проверить расход
                        </button>
                    </div>
                    {attempt.status === 'paused' && (
                        <button onClick={() => void progress()}>Возобновить приготовление</button>
                    )}
                    {review && <FinalReview attempt={attempt} onDone={() => setReview(false)} />}
                </>
            )}
            {!finished && (
                <dialog ref={timer} className={styles.dialog} aria-label="Таймер шага">
                    <h2>Таймер шага {current + 1}</h2>
                    <strong style={{ fontSize: '3rem' }}>{clock(timerStatus)}</strong>
                    {command.error && <p role="alert">{command.error}</p>}
                    <label>
                        Длительность, секунд
                        <input
                            type="number"
                            min={1}
                            max={604800}
                            value={seconds}
                            onChange={(e) => setSeconds(Number(e.target.value))}
                        />
                    </label>
                    <div className={styles.actions}>
                        <button disabled={command.pending} onClick={() => void progress(null, 'start', seconds)}>
                            Запустить
                        </button>
                        <button
                            disabled={command.pending || !active?.timerDeadline}
                            onClick={() => void progress(null, 'pause')}
                        >
                            Пауза
                        </button>
                        <button
                            disabled={command.pending || !active || active.timerPausedSeconds === null}
                            onClick={() => void progress(null, 'resume')}
                        >
                            Возобновить
                        </button>
                        <button disabled={command.pending} onClick={() => void progress(null, 'reset')}>
                            Сбросить
                        </button>
                        {[-300, -60, 60, 300, 600].map((delta) => (
                            <button
                                key={delta}
                                disabled={command.pending}
                                onClick={() => void progress(null, 'adjust', delta)}
                            >
                                {delta > 0 ? '+' : ''}
                                {delta / 60} мин
                            </button>
                        ))}
                    </div>
                    <button onClick={() => timer.current?.close()}>Вернуться к шагу</button>
                </dialog>
            )}
        </>
    );
}
function CookingContent({ id }: { id: string }) {
    const { api, queryClient } = useRuntime();
    const user = useSession('user');
    const search = useSearchParams();
    const router = useRouter();
    const command = useRecipeCommand();
    const owner = user.data?.id ?? readOfflineOwner();
    const attemptId = search.get('attempt');
    const view = search.get('view') === 'archive' ? 'archive' : search.get('view') === 'all' ? 'all' : 'current';
    const attempts = useQuery({
        queryKey: ['cooking', owner, 'list', view],
        enabled: !!api && !!owner,
        refetchInterval: 60000,
        queryFn: async ({ signal }) => {
            const key = `cooking:list:${view}`;
            if (!navigator.onLine) {
                const cached = await readOfflineSnapshotData<Success<'GET /api/v1/cooking-attempts'>['data']>(
                    owner!,
                    key,
                );
                if (!cached) throw new Error('Список приготовлений не сохранён для offline-доступа.');
                return cached;
            }
            const data = (
                await api!.request('GET /api/v1/cooking-attempts', undefined, signal, undefined, { query: { view } })
            ).data;
            await saveOfflineSnapshot(owner!, key, data);
            return data;
        },
    });
    const attempt = useQuery({
        queryKey: ['cooking', owner, attemptId],
        enabled: !!api && !!owner && !!attemptId,
        refetchInterval: 60000,
        queryFn: async ({ signal }) => {
            const key = `cooking:${attemptId}`;
            if (!navigator.onLine) {
                const cached = await readOfflineSnapshotData<Attempt>(owner!, key);
                if (!cached) throw new Error('Это приготовление не сохранено для offline-доступа.');
                return cached;
            }
            const data = (
                await api!.request('GET /api/v1/cooking-attempts/{id}', undefined, signal, { id: attemptId! })
            ).data;
            await saveOfflineSnapshot(owner!, key, data);
            return data;
        },
    });
    const recipe = useQuery({
        queryKey: ['cooking', user.data?.id, 'recipe', id],
        enabled: !!api && !attemptId && view !== 'archive',
        queryFn: async ({ signal }) => {
            try {
                return (await api!.request('GET /api/v1/recipes/{id}', undefined, signal, { id })).data.recipe;
            } catch (error) {
                if (!(error instanceof ApiError) || error.status !== 404) throw error;
                const own = (await api!.request('GET /api/v1/recipe-workspace/{id}', undefined, signal, { id })).data
                    .recipe;
                return {
                    id: own.id,
                    revisionId: own.revisionId,
                    title: own.document.title,
                    baseServings: own.document.baseServings,
                };
            }
        },
    });
    async function start() {
        if (!recipe.data) return;
        const result = await command.run('POST /api/v1/cooking-attempts', {
            recipeId: id,
            revisionId: recipe.data.revisionId,
            servings: Math.max(1, Math.min(1000, Number(search.get('servings')) || recipe.data.baseServings)),
        });
        if (result) {
            await queryClient.invalidateQueries({ queryKey: ['cooking'] });
            router.replace(`/recipes/${id}/cook?attempt=${result.id}`);
        }
    }
    return (
        <>
            <Link href={`/recipes/${id}`}>← К рецепту</Link>
            <nav className={styles.actions} aria-label="Приготовления">
                <Link
                    href={`/recipes/${id}/cook?view=current`}
                    aria-current={view === 'current' && !attemptId ? 'page' : undefined}
                >
                    Текущие и завершённые
                </Link>
                <Link
                    href={`/recipes/${id}/cook?view=archive`}
                    aria-current={view === 'archive' && !attemptId ? 'page' : undefined}
                >
                    Архив
                </Link>
                <Link
                    href={`/recipes/${id}/cook?view=all`}
                    aria-current={view === 'all' && !attemptId ? 'page' : undefined}
                >
                    Все видимые записи
                </Link>
            </nav>
            <CookingReminders
                recipeId={id}
                reminders={
                    attempts.data?.reminders.filter((reminder) =>
                        attempts.data.items.some((row) => row.id === reminder.attemptId && row.recipeId === id),
                    ) ?? []
                }
            />
            {command.error && <p role="alert">{command.error}</p>}
            {attemptId ? (
                attempt.isPending ? (
                    <RecipeLoading />
                ) : attempt.isError ? (
                    <RecipeError error={attempt.error} retry={() => void attempt.refetch()} />
                ) : attempt.data.recipeId !== id ? (
                    <p role="alert">Приготовление относится к другому рецепту.</p>
                ) : (
                    <ActiveCooking attempt={attempt.data} />
                )
            ) : (
                <>
                    <h1>Приготовление</h1>
                    {view !== 'archive' &&
                        (recipe.isPending ? (
                            <RecipeLoading />
                        ) : recipe.isError ? (
                            <RecipeError error={recipe.error} retry={() => void recipe.refetch()} />
                        ) : (
                            <section className={styles.panel}>
                                <h2>{recipe.data.title}</h2>
                                <p>Личные запасы. Начало приготовления не списывает продукты.</p>
                                <button className="button" disabled={command.pending} onClick={() => void start()}>
                                    Начать новое приготовление
                                </button>
                            </section>
                        ))}
                    {attempts.isPending && <RecipeLoading />}
                    {attempts.isError && <RecipeError error={attempts.error} retry={() => void attempts.refetch()} />}
                    {attempts.data && !attempts.data.items.some((a) => a.recipeId === id) && (
                        <p>
                            {view === 'archive'
                                ? 'Видимый архив пуст. Через календарный месяц архивные записи скрываются из списков, но не удаляются.'
                                : 'Приготовлений пока нет.'}
                        </p>
                    )}
                    {attempts.data?.items
                        .filter((a) => a.recipeId === id)
                        .map((a) => (
                            <Link key={a.id} href={`/recipes/${id}/cook?attempt=${a.id}`}>
                                {a.title} ·{' '}
                                {
                                    {
                                        active: 'Готовится',
                                        paused: 'Отложено',
                                        completed: 'Завершено',
                                        intermediate: 'Заготовка',
                                        failed: 'Не удалось',
                                        cancelled: 'Отменено',
                                        archived: 'Архив',
                                    }[a.status]
                                }{' '}
                                · {new Date(a.startedAt).toLocaleString('ru-RU')}
                            </Link>
                        ))}
                </>
            )}
        </>
    );
}
export function RecipeCooking({ id }: { id: string }) {
    return (
        <Guard context="user" allowOffline>
            <RecipeShell>
                <CookingContent id={id} />
            </RecipeShell>
        </Guard>
    );
}
