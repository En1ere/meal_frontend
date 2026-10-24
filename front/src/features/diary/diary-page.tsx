'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRuntime } from '../../app/providers.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { ApiError } from '../../shared/api/client.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import { Guard, useSession } from '../auth/session.js';
import { PersonalShell } from '../personalization/shell.js';
import styles from './diary.module.css';
import { isConsentRequiredError, useConsent } from '../legal/consent-state.js';

type Day = Success<'GET /api/v1/diary'>['data'];
type Entry = Day['items'][number];
type PortionProposal = Day['proposals'][number];
type Source = Success<'GET /api/v1/diary/sources'>['data']['items'][number];
type Meal = Entry['meal'];
type Unit = Entry['components'][number]['unit'];
type ComponentDraft = {
    id: string;
    source:
        | { type: 'manual'; name: string }
        | { type: 'ingredient'; ingredientId: string }
        | { type: 'inventory_batch'; batchId: string; batchVersion: number }
        | { type: 'recipe'; recipeId: string };
    name: string;
    quantity: string;
    unit: Unit;
};

const meals: { value: Meal; label: string; icon: string }[] = [
    { value: 'breakfast', label: 'Завтрак', icon: '☀' },
    { value: 'snack', label: 'Перекус', icon: '◌' },
    { value: 'lunch', label: 'Обед', icon: '◐' },
    { value: 'dinner', label: 'Ужин', icon: '☾' },
    { value: 'other', label: 'Другое', icon: '＋' },
];
const units: Unit[] = ['g', 'kg', 'ml', 'l', 'pcs', 'pack', 'serv'];
const labels = {
    energyKcal: 'ккал',
    proteinG: 'Белки',
    fatG: 'Жиры',
    carbohydrateG: 'Углеводы',
    fiberG: 'Клетчатка',
} as const;
const pad = (value: number) => String(value).padStart(2, '0');
const localDate = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const localDateTime = () => {
    const now = new Date();
    return `${localDate(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
};
const localInputFromIso = (value: string) => {
    const date = new Date(value);
    return `${localDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const formatDate = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
const formatTime = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

function Nutrition({ value }: { value: Entry['nutrition'] }) {
    return (
        <dl className={styles.nutrition}>
            {Object.entries(labels).map(([key, label]) => (
                <div key={key}>
                    <dt>{label}</dt>
                    <dd>{value[key as keyof typeof value] ?? 'Нет данных'}</dd>
                </div>
            ))}
        </dl>
    );
}

function Content() {
    const { api } = useRuntime();
    const session = useSession('user');
    const cache = useQueryClient();
    const [date, setDate] = useState(localDate);
    const [composer, setComposer] = useState(false);
    const [meal, setMeal] = useState<Meal>('breakfast');
    const [eatenAt, setEatenAt] = useState(localDateTime);
    const [note, setNote] = useState('');
    const editDialog = useRef<HTMLDialogElement>(null);
    const [sourceType, setSourceType] = useState<'manual' | 'ingredient' | 'inventory_batch' | 'recipe'>('manual');
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Source | null>(null);
    const [quantity, setQuantity] = useState('1');
    const [unit, setUnit] = useState<Unit>('g');
    const [components, setComponents] = useState<ComponentDraft[]>([]);
    const [editing, setEditing] = useState<Entry | null>(null);
    const healthConsent = useConsent('special_category');

    const day = useQuery({
        queryKey: ['diary', session.data?.id, date],
        enabled: !!api && !!session.data && healthConsent.enabled,
        queryFn: ({ signal }) =>
            api!
                .request('GET /api/v1/diary', undefined, signal, undefined, { query: { date } })
                .then((response) => response.data),
    });
    const sources = useQuery({
        queryKey: ['diary-sources', sourceType, search],
        enabled: !!api && composer && sourceType !== 'manual',
        queryFn: ({ signal }) =>
            api!
                .request('GET /api/v1/diary/sources', undefined, signal, undefined, {
                    query: { type: sourceType, q: search, limit: '20' },
                })
                .then((response) => response.data.items),
    });
    const refresh = async () => {
        await Promise.all([
            cache.invalidateQueries({ queryKey: ['diary'] }),
            cache.invalidateQueries({ queryKey: ['pro-overview'] }),
            cache.invalidateQueries({ queryKey: ['inventory'] }),
        ]);
    };
    const create = useMutation({
        mutationFn: () =>
            api!.request('POST /api/v1/diary', {
                eatenAt: new Date(eatenAt).toISOString(),
                meal,
                note: note.trim() || null,
                components: components.map(({ id, source, quantity: amount, unit: componentUnit }) => ({
                    id,
                    source,
                    quantity: amount,
                    unit: componentUnit,
                })),
                idempotencyKey: crypto.randomUUID(),
            }),
        onSuccess: async () => {
            setComposer(false);
            setComponents([]);
            setNote('');
            await refresh();
        },
    });
    const archive = useMutation({
        mutationFn: (entry: Entry) =>
            api!.request(
                'POST /api/v1/diary/{id}/archive',
                {
                    archived: entry.state !== 'archived',
                    expectedVersion: entry.version,
                    idempotencyKey: crypto.randomUUID(),
                },
                undefined,
                { id: entry.id },
                { ifMatch: entry.version },
            ),
        onSuccess: refresh,
    });
    const update = useMutation({
        mutationFn: (entry: Entry) =>
            api!.request(
                'PUT /api/v1/diary/{id}',
                {
                    eatenAt: entry.eatenAt,
                    meal: entry.meal,
                    note: entry.note,
                    expectedVersion: entry.version,
                    idempotencyKey: crypto.randomUUID(),
                },
                undefined,
                { id: entry.id },
                { ifMatch: entry.version },
            ),
        onSuccess: async () => {
            setEditing(null);
            await refresh();
        },
    });
    const decidePortion = useMutation({
        mutationFn: ({
            proposal,
            decision,
        }: {
            proposal: PortionProposal;
            decision: 'confirmed' | 'refused' | 'cancelled';
        }) =>
            api!.request(
                'POST /api/v1/diary/portions/{id}/decision',
                { decision, expectedVersion: proposal.version, idempotencyKey: crypto.randomUUID() },
                undefined,
                { id: proposal.id },
                { ifMatch: proposal.version },
            ),
        onSuccess: refresh,
    });
    const grouped = useMemo(
        () =>
            Object.fromEntries(
                meals.map(({ value }) => [value, day.data?.items.filter((entry) => entry.meal === value) ?? []]),
            ) as Record<Meal, Entry[]>,
        [day.data],
    );
    const readOnly = day.data?.access.mode === 'read_only';
    const consentMutationError = [create.error, archive.error, update.error, decidePortion.error].find(
        isConsentRequiredError,
    );

    const moveDate = (days: number) => {
        const next = new Date(`${date}T12:00:00`);
        next.setDate(next.getDate() + days);
        setDate(localDate(next));
    };
    const addComponent = () => {
        if (!/^\d+(\.\d{1,8})?$/.test(quantity) || Number(quantity) <= 0) return;
        if (sourceType === 'manual') {
            if (!search.trim()) return;
            setComponents((current) => [
                ...current,
                {
                    id: crypto.randomUUID(),
                    source: { type: 'manual', name: search.trim() },
                    name: search.trim(),
                    quantity,
                    unit,
                },
            ]);
        } else if (selected) {
            const source =
                selected.type === 'ingredient'
                    ? { type: 'ingredient' as const, ingredientId: selected.id }
                    : selected.type === 'inventory_batch'
                      ? { type: 'inventory_batch' as const, batchId: selected.id, batchVersion: selected.version! }
                      : { type: 'recipe' as const, recipeId: selected.id };
            setComponents((current) => [
                ...current,
                { id: crypto.randomUUID(), source, name: selected.name, quantity, unit: selected.unit },
            ]);
        }
        setSearch('');
        setSelected(null);
        setQuantity('1');
    };
    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (components.length) create.mutate();
    };

    if (healthConsent.isPending)
        return (
            <section className={styles.loading}>
                <ArcSkeleton variant="lines" lines={3} label="Проверяем доступ к дневнику" />
            </section>
        );
    if (healthConsent.isError || !healthConsent.enabled)
        return (
            <section className={styles.locked} role="status">
                <span className={styles.eyebrow}>Данные о здоровье и питании</span>
                <h1>Дневник заблокирован настройкой согласия</h1>
                <p>
                    Ознакомьтесь с документом и разрешите обработку этих данных. После отзыва дневник снова блокируется.
                </p>
                <Link className="button primary" href="/settings/privacy?consent=special_category&returnTo=/diary">
                    Открыть документы и согласия
                </Link>
            </section>
        );
    if (day.isPending)
        return (
            <section className={styles.loading}>
                <ArcSkeleton variant="lines" lines={4} height="1.4rem" label="Загружаем дневник" />
                <ArcSkeleton height="24rem" label={null} />
            </section>
        );
    if (day.isError) {
        if (isConsentRequiredError(day.error))
            return (
                <section className={styles.locked} role="alert">
                    <h1>Доступ к дневнику отозван</h1>
                    <Link className="button primary" href="/settings/privacy?consent=special_category&returnTo=/diary">
                        Проверить согласие
                    </Link>
                </section>
            );
        if (day.error instanceof ApiError && day.error.status === 403)
            return (
                <section className={styles.locked}>
                    <span className={styles.eyebrow}>Meal Planner Pro</span>
                    <h1>Личный дневник доступен в Pro</h1>
                    <p>Здесь можно собирать тарелку из каталога, рецептов и личных остатков.</p>
                    <a className="button primary" href="/pricing">
                        Посмотреть тарифы
                    </a>
                </section>
            );
        return (
            <section className={styles.error} role="alert">
                <h1>Дневник не загрузился</h1>
                <p>Сохранённые записи не изменены.</p>
                <button className="button outline" onClick={() => void day.refetch()}>
                    Повторить
                </button>
            </section>
        );
    }

    return (
        <div className={styles.page}>
            {consentMutationError && (
                <section className={styles.locked} role="alert">
                    <h2>Действие заблокировано после отзыва согласия</h2>
                    <p>Изменения не сохранены. Ознакомьтесь с документом и подтвердите согласие заново.</p>
                    <Link className="button primary" href="/settings/privacy?consent=special_category&returnTo=/diary">
                        Ознакомиться и согласиться
                    </Link>
                </section>
            )}
            <header className={styles.header}>
                <div>
                    <span className={styles.eyebrow}>Только вы</span>
                    <h1>Дневник питания</h1>
                    <p>Фиксируйте фактические приёмы пищи. Неизвестные значения не заменяются нулями.</p>
                </div>
                <div className={styles['header-actions']}>
                    <a className="button outline" href="/diary/analytics">
                        КБЖУ и цели
                    </a>
                    {!readOnly && (
                        <button className="button primary" onClick={() => setComposer((value) => !value)}>
                            {composer ? 'Закрыть форму' : 'Добавить приём пищи'}
                        </button>
                    )}
                </div>
            </header>
            {readOnly && (
                <section className={styles.readonly}>
                    <strong>Режим чтения</strong>
                    <span>Pro завершился: история сохранена, новые изменения отключены.</span>
                </section>
            )}
            <nav className={styles.datebar} aria-label="Выбор дня">
                <button onClick={() => moveDate(-1)} aria-label="Предыдущий день">
                    ←
                </button>
                <button className={styles.current} onClick={() => setDate(localDate())}>
                    {formatDate.format(new Date(`${date}T12:00:00`))}
                </button>
                <button onClick={() => moveDate(1)} aria-label="Следующий день">
                    →
                </button>
            </nav>
            {day.data.proposals.some(
                (proposal) => proposal.state === 'pending' || proposal.state === 'auto_confirmed',
            ) && (
                <section className={styles.proposals} aria-labelledby="portion-proposals-title">
                    <div className={styles['proposal-heading']}>
                        <div>
                            <span className={styles.eyebrow}>Семейное приготовление</span>
                            <h2 id="portion-proposals-title">Предложенные порции</h2>
                        </div>
                        <p>Выдача уже списана из готового остатка и не повторится при подтверждении.</p>
                    </div>
                    <div className={styles['proposal-list']}>
                        {day.data.proposals
                            .filter((proposal) => ['pending', 'auto_confirmed'].includes(proposal.state))
                            .map((proposal) => (
                                <article className={styles.proposal} key={proposal.id}>
                                    <div className={styles['proposal-title']}>
                                        <strong>{proposal.source.name}</strong>
                                        <span>
                                            {proposal.quantity} {proposal.unit}
                                        </span>
                                    </div>
                                    {proposal.state === 'pending' ? (
                                        <>
                                            <p>
                                                Подтвердите до {formatTime.format(new Date(proposal.dueAt))}. Затем
                                                запись будет добавлена автоматически.
                                            </p>
                                            <div className={styles['proposal-actions']}>
                                                <button
                                                    className="button primary"
                                                    disabled={!proposal.actions.canConfirm || decidePortion.isPending}
                                                    onClick={() =>
                                                        decidePortion.mutate({ proposal, decision: 'confirmed' })
                                                    }
                                                >
                                                    Подтвердить
                                                </button>
                                                <button
                                                    className="button outline"
                                                    disabled={!proposal.actions.canRefuse || decidePortion.isPending}
                                                    onClick={() =>
                                                        decidePortion.mutate({ proposal, decision: 'refused' })
                                                    }
                                                >
                                                    Отказаться
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <p className={styles['auto-confirmed']}>✓ Подтверждено автоматически</p>
                                            <button
                                                className="button outline"
                                                disabled={!proposal.actions.canCancel || decidePortion.isPending}
                                                onClick={() =>
                                                    decidePortion.mutate({ proposal, decision: 'cancelled' })
                                                }
                                            >
                                                Отменить автоподтверждение
                                            </button>
                                        </>
                                    )}
                                </article>
                            ))}
                    </div>
                    {decidePortion.isError && (
                        <p className={styles['form-error']} role="alert">
                            Порция уже могла измениться. Обновите дневник и повторите действие.
                        </p>
                    )}
                </section>
            )}
            <div className={styles.layout}>
                <section className={styles.timeline} aria-label="Приёмы пищи">
                    {meals.map(({ value, label, icon }) => (
                        <article className={styles.meal} key={value}>
                            <div className={styles['meal-title']}>
                                <span aria-hidden="true">{icon}</span>
                                <h2>{label}</h2>
                                <small>{grouped[value].filter((entry) => entry.state !== 'archived').length}</small>
                            </div>
                            {grouped[value].length ? (
                                <div className={styles.entries}>
                                    {grouped[value].map((entry) => (
                                        <div
                                            className={`${styles.entry} ${entry.state === 'archived' ? styles.archived : ''}`}
                                            key={entry.id}
                                        >
                                            <div className={styles['entry-top']}>
                                                <div>
                                                    <strong>
                                                        {entry.components
                                                            .map((component) => component.source.name)
                                                            .join(', ')}
                                                    </strong>
                                                    <span>
                                                        {formatTime.format(new Date(entry.eatenAt))}
                                                        {entry.note ? ` · ${entry.note}` : ''}
                                                    </span>
                                                    {entry.confirmationMethod === 'timeout' && (
                                                        <em className={styles['auto-badge']}>
                                                            Подтверждено автоматически
                                                        </em>
                                                    )}
                                                </div>
                                                <span>
                                                    {entry.nutrition.energyKcal
                                                        ? `${entry.nutrition.energyKcal} ккал`
                                                        : 'КБЖУ неизвестны'}
                                                </span>
                                            </div>
                                            <ul>
                                                {entry.components.map((component) => (
                                                    <li key={component.id}>
                                                        {component.quantity} {component.unit} · {component.source.name}
                                                    </li>
                                                ))}
                                            </ul>
                                            {!readOnly && !entry.proposalId && (
                                                <div className={styles.actions}>
                                                    <button onClick={() => setEditing(entry)}>Изменить</button>
                                                    <button onClick={() => archive.mutate(entry)}>
                                                        {entry.state === 'archived' ? 'Вернуть' : 'В архив'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className={styles.empty}>Пока ничего не записано</p>
                            )}
                        </article>
                    ))}
                </section>
                <aside className={styles.side}>
                    <section className={styles.summary}>
                        <span className={styles.eyebrow}>Итог дня</span>
                        <strong>{day.data.summary.entryCount} приёмов пищи</strong>
                        <Nutrition value={day.data.summary.nutrition} />
                        <p>
                            «Нет данных» означает, что состав продукта не указан или единицы нельзя надёжно сопоставить.
                        </p>
                    </section>
                    {composer && !readOnly && (
                        <form className={styles.composer} onSubmit={submit}>
                            <h2>Собрать тарелку</h2>
                            <label>
                                Приём пищи
                                <select value={meal} onChange={(event) => setMeal(event.target.value as Meal)}>
                                    {meals.map((item) => (
                                        <option key={item.value} value={item.value}>
                                            {item.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                Дата и время
                                <input
                                    type="datetime-local"
                                    value={eatenAt}
                                    onChange={(event) => setEatenAt(event.target.value)}
                                    required
                                />
                            </label>
                            <fieldset>
                                <legend>Источник</legend>
                                {(['manual', 'inventory_batch', 'ingredient', 'recipe'] as const).map((value) => (
                                    <label className={styles.radio} key={value}>
                                        <input
                                            type="radio"
                                            checked={sourceType === value}
                                            onChange={() => {
                                                setSourceType(value);
                                                setSelected(null);
                                                setSearch('');
                                            }}
                                        />
                                        {
                                            {
                                                manual: 'Вручную',
                                                inventory_batch: 'Мои продукты',
                                                ingredient: 'Каталог',
                                                recipe: 'Рецепт',
                                            }[value]
                                        }
                                    </label>
                                ))}
                            </fieldset>
                            <label>
                                {sourceType === 'manual' ? 'Название' : 'Поиск'}
                                <input
                                    value={search}
                                    onChange={(event) => {
                                        setSearch(event.target.value);
                                        setSelected(null);
                                    }}
                                    placeholder={
                                        sourceType === 'manual' ? 'Например, домашний салат' : 'Введите название'
                                    }
                                />
                            </label>
                            {sourceType !== 'manual' && (
                                <div className={styles.sources}>
                                    {sources.isFetching && <span>Ищем…</span>}
                                    {sources.data?.map((source) => (
                                        <button
                                            type="button"
                                            className={selected?.id === source.id ? styles.selected : ''}
                                            key={source.id}
                                            onClick={() => {
                                                setSelected(source);
                                                setUnit(source.unit);
                                            }}
                                        >
                                            {source.name}
                                            <small>
                                                {source.availableQuantity
                                                    ? `${source.availableQuantity} ${source.unit}`
                                                    : source.unit}
                                            </small>
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className={styles.amount}>
                                <label>
                                    Количество
                                    <input
                                        inputMode="decimal"
                                        value={quantity}
                                        onChange={(event) => setQuantity(event.target.value)}
                                    />
                                </label>
                                <label>
                                    Единица
                                    <select
                                        value={unit}
                                        disabled={!!selected}
                                        onChange={(event) => setUnit(event.target.value as Unit)}
                                    >
                                        {units.map((value) => (
                                            <option key={value}>{value}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                            <button className="button outline" type="button" onClick={addComponent}>
                                Добавить компонент
                            </button>
                            {components.length > 0 && (
                                <ul className={styles.plate}>
                                    {components.map((component) => (
                                        <li key={component.id}>
                                            <span>
                                                {component.name} · {component.quantity} {component.unit}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setComponents((current) =>
                                                        current.filter((item) => item.id !== component.id),
                                                    )
                                                }
                                            >
                                                Убрать
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <label>
                                Заметка
                                <textarea
                                    value={note}
                                    onChange={(event) => setNote(event.target.value)}
                                    maxLength={2000}
                                />
                            </label>
                            <div className={styles.media} role="status">
                                <span aria-hidden="true">▧</span>
                                <div>
                                    <strong>Фото временно недоступно</strong>
                                    <p>{day.data.media.reason}. Запись сохранится без файла.</p>
                                </div>
                            </div>
                            {create.isError && (
                                <p className={styles['form-error']} role="alert">
                                    {isConsentRequiredError(create.error)
                                        ? 'Согласие отозвано — запись не сохранена.'
                                        : 'Не удалось сохранить. Проверьте остаток и повторите.'}
                                </p>
                            )}
                            <button className="button primary" disabled={!components.length || create.isPending}>
                                {create.isPending ? 'Сохраняем…' : 'Сохранить приём пищи'}
                            </button>
                        </form>
                    )}
                </aside>
            </div>
            {editing && (
                <EditEntryDialog
                    dialogRef={editDialog}
                    editing={editing}
                    pending={update.isPending}
                    onChange={setEditing}
                    onClose={() => setEditing(null)}
                    onSubmit={() => update.mutate(editing)}
                />
            )}
        </div>
    );
}

function EditEntryDialog({
    dialogRef,
    editing,
    pending,
    onChange,
    onClose,
    onSubmit,
}: {
    dialogRef: React.RefObject<HTMLDialogElement | null>;
    editing: Entry;
    pending: boolean;
    onChange: (entry: Entry) => void;
    onClose: () => void;
    onSubmit: () => void;
}) {
    useEffect(() => {
        const node = dialogRef.current;
        if (node && !node.open) node.showModal();
    }, [dialogRef]);
    return (
        <dialog ref={dialogRef} className={styles.modal} aria-labelledby="edit-title" onClose={onClose}>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    onSubmit();
                }}
            >
                <h2 id="edit-title">Изменить запись</h2>
                <p>Состав уже зафиксирован снимком. Здесь можно поправить время, тип приёма пищи и заметку.</p>
                <label>
                    Приём пищи
                    <select
                        value={editing.meal}
                        onChange={(event) => onChange({ ...editing, meal: event.target.value as Meal })}
                    >
                        {meals.map((item) => (
                            <option key={item.value} value={item.value}>
                                {item.label}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    Дата и время
                    <input
                        type="datetime-local"
                        value={localInputFromIso(editing.eatenAt)}
                        onChange={(event) =>
                            onChange({ ...editing, eatenAt: new Date(event.target.value).toISOString() })
                        }
                    />
                </label>
                <label>
                    Заметка
                    <textarea
                        value={editing.note ?? ''}
                        onChange={(event) => onChange({ ...editing, note: event.target.value || null })}
                    />
                </label>
                <div className={styles['modal-actions']}>
                    <button type="button" className="button outline" onClick={() => dialogRef.current?.close()}>
                        Отмена
                    </button>
                    <button className="button primary" disabled={pending}>
                        Сохранить
                    </button>
                </div>
            </form>
        </dialog>
    );
}

export function DiaryPage() {
    return (
        <Guard context="user">
            <PersonalShell>
                <Content />
            </PersonalShell>
        </Guard>
    );
}
