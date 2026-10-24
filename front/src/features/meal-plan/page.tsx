'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRuntime, useUi } from '../../app/providers.js';
import { ApiError } from '../../shared/api/client.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { UserAppShell } from '../../ui/AppShell/UserAppShell.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import { InlineLoader as ArcInlineLoader } from '@meal-planner/design-system';
import { Guard, useSession } from '../auth/session.js';
import { PlanAutomation } from './automation.js';
import styles from './plan.module.css';
import { CostEstimateBadge } from '../finance/finance-page.js';

type Plan = Success<'GET /api/v1/meal-plan'>['data'];
type Entry = Plan['entries'][number];
type ChangePreview = Success<'POST /api/v1/meal-plan/change-preview'>['data'];
type ShoppingPreview = Success<'POST /api/v1/meal-plan/shopping-preview'>['data'];
type Family = Success<'GET /api/v1/family'>['data'];
type Portions = Success<'GET /api/v1/portions'>['data'];
type Member = NonNullable<Family['family']>['members'][number];
type Mutation =
    | {
          action: 'upsert';
          entryId: string | null;
          date: string;
          meal: Entry['meal'];
          portions: number;
          locked: boolean;
          slotState: Entry['slotState'];
          recipeId: string | null;
          revisionId: string | null;
          note: string | null;
          assignments?: Array<{ userId: string; portions: number }>;
      }
    | { action: 'remove'; entryId: string };

const meals: Array<[Entry['meal'], string]> = [
    ['breakfast', 'Завтрак'],
    ['lunch', 'Обед'],
    ['dinner', 'Ужин'],
    ['snack', 'Перекус'],
];
const states: Array<[Entry['slotState'], string]> = [
    ['recipe', 'Рецепт'],
    ['outside', 'Вне дома'],
    ['later', 'Решу позже'],
    ['unplanned', 'Без планов'],
];
const localDate = (date = new Date()) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};
const shift = (value: string, days: number) => {
    const date = new Date(`${value}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
};
const yearEnd = (value: string) => {
    const date = new Date(`${value}T12:00:00Z`);
    date.setUTCFullYear(date.getUTCFullYear() + 1);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
};
const shiftMonth = (value: string, months: number) => {
    const date = new Date(`${value}T12:00:00Z`);
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + months);
    return date.toISOString().slice(0, 10);
};
const displayDate = (value: string, weekday = false) =>
    new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
        ...(weekday ? { weekday: 'long' as const } : {}),
    }).format(new Date(`${value}T12:00:00Z`));
const errorText = (error: unknown) =>
    error instanceof ApiError ? error.message : 'Не удалось выполнить запрос. Попробуйте ещё раз.';

function PlanShell({ children, scope }: { children: ReactNode; scope: 'private' | 'family' }) {
    const setScope = useUi((state) => state.setScope);
    useEffect(() => setScope(scope === 'family' ? 'family' : 'personal'), [scope, setScope]);
    return (
        <Guard context="user">
            <UserAppShell scope={scope === 'family' ? 'family' : 'personal'} contentClassName={styles.main}>
                {children}
            </UserAppShell>
        </Guard>
    );
}

export function MealPlanLoading() {
    return <ArcSkeleton variant="lines" lines={7} label="Загружаем план питания" />;
}

function Editor({
    entry,
    date,
    pending,
    onPreview,
    onCancel,
    members,
}: {
    entry: Entry | null;
    date: string;
    pending: boolean;
    onPreview: (mutation: Mutation) => void;
    onCancel: () => void;
    members: Member[];
}) {
    const { api } = useRuntime();
    const user = useSession('user');
    const recipes = useQuery({
        queryKey: ['meal-plan', 'recipes', user.data?.id],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (
                await api!.request('GET /api/v1/recipes', undefined, signal, undefined, {
                    query: { q: '', tab: 'new', page: '1', limit: '100' },
                })
            ).data.items,
    });
    const [slotState, setSlotState] = useState<Entry['slotState']>(entry?.slotState ?? 'recipe');
    const [recipeId, setRecipeId] = useState(entry?.recipe?.id ?? '');
    const [meal, setMeal] = useState<Entry['meal']>(entry?.meal ?? 'dinner');
    const [portions, setPortions] = useState(entry?.portions ?? 1);
    const [locked, setLocked] = useState(entry?.locked ?? false);
    const [note, setNote] = useState(entry?.note ?? '');
    const [assignments, setAssignments] = useState<Record<string, number>>(
        Object.fromEntries(entry?.assignments.map((item) => [item.userId, item.portions]) ?? []),
    );
    const chosen = recipes.data?.find((recipe) => recipe.id === recipeId);
    function submit(event: FormEvent) {
        event.preventDefault();
        onPreview({
            action: 'upsert',
            entryId: entry?.id ?? null,
            date,
            meal,
            portions,
            locked,
            slotState,
            recipeId: slotState === 'recipe' ? (chosen?.id ?? null) : null,
            revisionId: slotState === 'recipe' ? (chosen?.revisionId ?? null) : null,
            note: note.trim() || null,
            ...(members.length
                ? {
                      assignments: members.flatMap((member) =>
                          assignments[member.userId]
                              ? [{ userId: member.userId, portions: assignments[member.userId]! }]
                              : [],
                      ),
                  }
                : {}),
        });
    }
    return (
        <form className={styles.panel} onSubmit={submit}>
            <div className={styles.heading}>
                <h2>{entry ? 'Изменить приём пищи' : 'Добавить в план'}</h2>
                <button type="button" onClick={onCancel}>
                    Закрыть
                </button>
            </div>
            <div className={styles.fields}>
                <label>
                    Дата
                    <input value={date} readOnly />
                </label>
                {!!members.length && (
                    <fieldset className={styles.wide}>
                        <legend>Распределить порции</legend>
                        <div className={styles.assignments}>
                            {members.map((member) => (
                                <label key={member.userId}>
                                    {member.displayName}
                                    <input
                                        type="number"
                                        min="0"
                                        max={portions}
                                        value={assignments[member.userId] ?? 0}
                                        onChange={(event) =>
                                            setAssignments((current) => ({
                                                ...current,
                                                [member.userId]: Number(event.target.value),
                                            }))
                                        }
                                    />
                                </label>
                            ))}
                        </div>
                    </fieldset>
                )}
                <label>
                    Приём пищи
                    <select autoFocus value={meal} onChange={(event) => setMeal(event.target.value as Entry['meal'])}>
                        {meals.map(([value, label]) => (
                            <option value={value} key={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    Что планируем
                    <select
                        value={slotState}
                        onChange={(event) => setSlotState(event.target.value as Entry['slotState'])}
                    >
                        {states.map(([value, label]) => (
                            <option value={value} key={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>
                {slotState === 'recipe' && (
                    <label>
                        Рецепт
                        <select required value={recipeId} onChange={(event) => setRecipeId(event.target.value)}>
                            <option value="">Выберите рецепт</option>
                            {recipes.data?.map((recipe) => (
                                <option value={recipe.id} key={recipe.revisionId}>
                                    {recipe.title}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                <label>
                    Порции
                    <input
                        type="number"
                        min="1"
                        max="1000"
                        value={portions}
                        onChange={(event) => setPortions(Number(event.target.value))}
                    />
                </label>
                <label className={styles.checkbox}>
                    <input type="checkbox" checked={locked} onChange={(event) => setLocked(event.target.checked)} />
                    Закрепить запись
                </label>
                <label className={styles.wide}>
                    Заметка
                    <textarea value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} />
                </label>
            </div>
            {recipes.isError && <p role="alert">Каталог рецептов временно недоступен.</p>}
            <button disabled={pending || (slotState === 'recipe' && (!chosen || recipes.isPending))}>
                {pending ? <ArcInlineLoader label="Считаем…" /> : 'Проверить изменения'}
            </button>
        </form>
    );
}

function Content({ scope }: { scope: 'private' | 'family' }) {
    const { api } = useRuntime();
    const user = useSession('user');
    const router = useRouter();
    const search = useSearchParams();
    const queryClient = useQueryClient();
    const entitlement = useQuery({
        queryKey: ['entitlements', user.data?.id],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/entitlements', undefined, signal)).data,
    });
    const plus = scope === 'family' || entitlement.data?.capabilities.planningRange === true;
    const smart = scope === 'family' || entitlement.data?.capabilities.smartShopping === true;
    const pro = entitlement.data?.capabilities.calendar === true;
    const view =
        search.get('view') === 'day'
            ? 'day'
            : search.get('view') === 'range' && plus
              ? 'range'
              : search.get('view') === 'calendar' && pro
                ? 'calendar'
                : 'week';
    const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(search.get('date') ?? '') ? search.get('date')! : localDate();
    const endDate = /^\d{4}-\d{2}-\d{2}$/.test(search.get('end') ?? '') ? search.get('end')! : shift(selectedDate, 13);
    const timezone = useMemo(() => {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow';
        } catch {
            return 'Europe/Moscow';
        }
    }, []);
    const [editing, setEditing] = useState<{ entry: Entry | null; date: string } | null>(null);
    const [mutation, setMutation] = useState<Mutation | null>(null);
    const [preview, setPreview] = useState<ChangePreview | null>(null);
    const [shopping, setShopping] = useState<ShoppingPreview | null>(null);
    const [shoppingTitle, setShoppingTitle] = useState('Покупки по плану');
    const [portionBatchId, setPortionBatchId] = useState('');
    const [portionRecipientId, setPortionRecipientId] = useState('');
    const [portionQuantity, setPortionQuantity] = useState('1');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const selection = useMemo(
        () => ({ scope, view, date: selectedDate, ...(view === 'range' ? { endDate } : {}), timezone }),
        [scope, view, selectedDate, endDate, timezone],
    );
    const family = useQuery({
        queryKey: ['family-context', user.data?.id],
        enabled: scope === 'family' && !!api && !!user.data,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/family', undefined, signal)).data,
    });
    const plan = useQuery({
        queryKey: ['meal-plan', user.data?.id, selection],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (
                await api!.request('GET /api/v1/meal-plan', undefined, signal, undefined, {
                    query: selection,
                })
            ).data,
    });
    const portions = useQuery<Portions>({
        queryKey: ['portions', scope, user.data?.id],
        enabled: scope === 'family' && !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/portions', undefined, signal, undefined, { query: { scope } })).data,
    });
    const dates = useMemo(() => {
        if (!plan.data) return [];
        const values: string[] = [];
        for (let value = plan.data.startsOn; value <= plan.data.endsOn; value = shift(value, 1)) values.push(value);
        return values;
    }, [plan.data]);
    const base = scope === 'family' ? '/family/plan' : '/plan';
    const href = (nextView: 'day' | 'week' | 'range' | 'calendar', date = selectedDate) =>
        `${base}?view=${nextView}&date=${date}${nextView === 'range' ? `&end=${endDate}` : ''}`;
    const rangeHref = (days: 14 | 30 | 90 | 180 | 'year') =>
        `${base}?view=range&date=${selectedDate}&end=${days === 'year' ? yearEnd(selectedDate) : shift(selectedDate, days - 1)}`;
    const navigationHref = (direction: -1 | 0 | 1) => {
        if (view === 'calendar') return href(view, direction === 0 ? localDate() : shiftMonth(selectedDate, direction));
        if (view === 'range') {
            const nextStart = direction === 0 ? localDate() : shift(selectedDate, direction * 14);
            const nextEnd = direction === 0 ? shift(nextStart, 13) : shift(endDate, direction * 14);
            return `${base}?view=range&date=${nextStart}&end=${nextEnd}`;
        }
        return href(view, direction === 0 ? localDate() : shift(selectedDate, direction * (view === 'day' ? 1 : 7)));
    };
    async function previewChange(next: Mutation) {
        if (!api || !plan.data) return;
        setBusy(true);
        setError(null);
        try {
            const result = await api.request('POST /api/v1/meal-plan/change-preview', {
                version: plan.data.version,
                selection,
                mutation: next,
            });
            setMutation(next);
            setPreview(result.data);
            setEditing(null);
        } catch (reason) {
            setError(errorText(reason));
        } finally {
            setBusy(false);
        }
    }
    async function commitChange() {
        if (!api || !plan.data || !preview || !mutation) return;
        setBusy(true);
        setError(null);
        try {
            await api.request('POST /api/v1/meal-plan/change-commit', {
                version: plan.data.version,
                selection,
                mutation,
                previewToken: preview.previewToken,
                idempotencyKey: crypto.randomUUID(),
            });
            setPreview(null);
            setMutation(null);
            await queryClient.invalidateQueries({ queryKey: ['meal-plan', user.data?.id] });
        } catch (reason) {
            setError(errorText(reason));
        } finally {
            setBusy(false);
        }
    }
    async function previewShopping() {
        if (!api || !plan.data) return;
        setBusy(true);
        setError(null);
        try {
            const result = await api.request('POST /api/v1/meal-plan/shopping-preview', {
                version: plan.data.version,
                selection,
            });
            setShopping(result.data);
        } catch (reason) {
            setError(errorText(reason));
        } finally {
            setBusy(false);
        }
    }
    async function commitShopping() {
        if (!api || !plan.data || !shopping) return;
        setBusy(true);
        setError(null);
        try {
            const result = await api.request('POST /api/v1/meal-plan/shopping-commit', {
                version: plan.data.version,
                selection,
                previewToken: shopping.previewToken,
                title: shoppingTitle,
                idempotencyKey: crypto.randomUUID(),
            });
            router.push(`${scope === 'family' ? '/family' : ''}/shopping/${result.data.listId}`);
        } catch (reason) {
            setError(errorText(reason));
        } finally {
            setBusy(false);
        }
    }
    async function assignPortion(event: FormEvent) {
        event.preventDefault();
        if (!api || !portionBatchId || !portionRecipientId) return;
        const source = portions.data?.prepared.find((item) => item.batchId === portionBatchId);
        if (!source) return;
        setBusy(true);
        setError(null);
        try {
            await api.request('POST /api/v1/portions/assign', {
                scope: 'family',
                batchId: source.batchId,
                recipientUserId: portionRecipientId,
                quantity: portionQuantity,
                expectedBatchVersion: source.version,
                idempotencyKey: crypto.randomUUID(),
            });
            await portions.refetch();
        } catch (reason) {
            setError(errorText(reason));
        } finally {
            setBusy(false);
        }
    }
    async function decidePortion(id: string, version: number, decision: 'confirmed' | 'refused' | 'cancelled') {
        if (!api) return;
        setBusy(true);
        setError(null);
        try {
            await api.request(
                'POST /api/v1/portions/{id}/decision',
                {
                    scope: 'family',
                    decision,
                    expectedVersion: version,
                    idempotencyKey: crypto.randomUUID(),
                },
                undefined,
                { id },
            );
            await portions.refetch();
        } catch (reason) {
            setError(errorText(reason));
        } finally {
            setBusy(false);
        }
    }
    return (
        <>
            <div className={styles.heading}>
                <div>
                    <h1>{scope === 'family' ? 'Семейный план питания' : 'План питания'}</h1>
                    <p>
                        {scope === 'family'
                            ? `Общий план · ${pro ? 'Pro' : 'Plus'}`
                            : `Личный план · ${pro ? 'Pro' : plus ? 'Plus' : 'Free'}`}{' '}
                        · время показано в вашем часовом поясе
                    </p>
                </div>
                <Link className={styles['link-button']} href={scope === 'family' ? '/family/shopping' : '/shopping'}>
                    К покупкам
                </Link>
            </div>
            {scope === 'private' && plan.data?.id && (
                <CostEstimateBadge route="GET /api/v1/finance/costs/meal-plans/{id}" id={plan.data.id} />
            )}
            <div className={styles.toolbar}>
                <nav className={styles.tabs} aria-label="Период плана">
                    <Link href={href('day')} aria-current={view === 'day' ? 'page' : undefined}>
                        День
                    </Link>
                    <Link href={href('week')} aria-current={view === 'week' ? 'page' : undefined}>
                        Неделя
                    </Link>
                    {plus ? (
                        <Link href={href('range')} aria-current={view === 'range' ? 'page' : undefined}>
                            Период
                        </Link>
                    ) : (
                        <button disabled title="Доступно в Plus">
                            Период · Plus
                        </button>
                    )}
                    {pro ? (
                        <Link href={href('calendar')} aria-current={view === 'calendar' ? 'page' : undefined}>
                            Календарь
                        </Link>
                    ) : (
                        <button disabled title="Доступно в Pro">
                            Календарь · Pro
                        </button>
                    )}
                </nav>
                <div className={styles.navigator}>
                    <Link href={navigationHref(-1)}>←</Link>
                    <Link href={navigationHref(0)}>Сегодня</Link>
                    <Link href={navigationHref(1)}>→</Link>
                </div>
                {view === 'range' && (
                    <nav className={styles['range-options']} aria-label="Горизонт планирования">
                        {[14, 30, 90, 180].map((days) => (
                            <Link key={days} href={rangeHref(days as 14 | 30 | 90 | 180)}>
                                {days} дней
                            </Link>
                        ))}
                        <Link href={rangeHref('year')}>Год</Link>
                    </nav>
                )}
            </div>
            {error && (
                <p role="alert" className={styles.error}>
                    {error}
                </p>
            )}
            {plan.isPending ? (
                <MealPlanLoading />
            ) : plan.isError ? (
                <section className={styles.panel} role="alert">
                    <p>Не удалось загрузить план.</p>
                    <button onClick={() => void plan.refetch()}>Повторить</button>
                </section>
            ) : (
                <>
                    <section
                        className={`${styles.days} ${view === 'calendar' ? styles.calendar : ''}`}
                        aria-label={view === 'calendar' ? 'Календарь плана' : 'Записи плана'}
                    >
                        {dates.map((date) => {
                            const entries = plan.data.entries.filter((entry) => entry.date === date);
                            return (
                                <article className={styles.day} key={date}>
                                    <div className={styles['day-heading']}>
                                        <div>
                                            <strong>{displayDate(date, true)}</strong>
                                            {date === localDate() && <span className={styles.badge}>Сегодня</span>}
                                        </div>
                                        <button onClick={() => setEditing({ entry: null, date })}>Добавить</button>
                                    </div>
                                    {entries.map((entry) => (
                                        <div className={styles.entry} key={entry.id}>
                                            <div>
                                                <span>{meals.find(([value]) => value === entry.meal)?.[1]}</span>
                                                <strong>
                                                    {entry.recipe?.title ??
                                                        states.find(([value]) => value === entry.slotState)?.[1]}
                                                </strong>
                                                <small>
                                                    {entry.portions} порц. {entry.locked ? '· закреплено' : ''}
                                                </small>
                                                {!!entry.assignments.length && (
                                                    <small>
                                                        {entry.assignments
                                                            .map((item) => `${item.displayName}: ${item.portions}`)
                                                            .join(' · ')}
                                                    </small>
                                                )}
                                                {entry.note && <small>{entry.note}</small>}
                                            </div>
                                            <div className={styles['row-actions']}>
                                                <button onClick={() => setEditing({ entry, date })}>Изменить</button>
                                                <button
                                                    onClick={() =>
                                                        void previewChange({ action: 'remove', entryId: entry.id })
                                                    }
                                                >
                                                    Убрать
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {!entries.length && (
                                        <p className={styles.muted}>На этот день пока ничего не запланировано.</p>
                                    )}
                                </article>
                            );
                        })}
                    </section>
                    <section className={styles.panel}>
                        <div className={styles.heading}>
                            <div>
                                <h2>Покупки по плану</h2>
                                <p>Сначала проверьте нехватку. Список создаётся только после подтверждения.</p>
                            </div>
                            <button
                                disabled={busy || !plan.data.entries.length || !smart}
                                onClick={() => void previewShopping()}
                            >
                                {smart ? 'Проверить покупки' : 'Умный список · Plus'}
                            </button>
                        </div>
                    </section>
                    {view === 'range' && smart && (
                        <PlanAutomation
                            selection={{ scope, view: 'range', date: selectedDate, endDate, timezone }}
                            version={plan.data.version}
                            members={scope === 'family' ? (family.data?.family?.members ?? []) : []}
                            pro={pro}
                            onCommitted={async () => {
                                await queryClient.invalidateQueries({ queryKey: ['meal-plan', user.data?.id] });
                            }}
                        />
                    )}
                    {scope === 'family' && (
                        <section className={styles.panel}>
                            <div className={styles.heading}>
                                <div>
                                    <h2>Готовая еда и порции</h2>
                                    <p>
                                        Количество списывается сразу. Без ответа назначение подтвердится через 24 часа.
                                    </p>
                                </div>
                            </div>
                            <form className={styles.fields} onSubmit={(event) => void assignPortion(event)}>
                                <label>
                                    Готовое блюдо
                                    <select
                                        required
                                        value={portionBatchId}
                                        onChange={(event) => setPortionBatchId(event.target.value)}
                                    >
                                        <option value="">Выберите</option>
                                        {portions.data?.prepared.map((item) => (
                                            <option key={item.batchId} value={item.batchId}>
                                                {item.name} · {item.quantity ?? 'неизвестно'} {item.unit}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    Получатель
                                    <select
                                        required
                                        value={portionRecipientId}
                                        onChange={(event) => setPortionRecipientId(event.target.value)}
                                    >
                                        <option value="">Выберите</option>
                                        {family.data?.family?.members.map((member) => (
                                            <option key={member.userId} value={member.userId}>
                                                {member.displayName}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    Количество
                                    <input
                                        required
                                        inputMode="decimal"
                                        value={portionQuantity}
                                        onChange={(event) => setPortionQuantity(event.target.value)}
                                    />
                                </label>
                                <button disabled={busy || !portionBatchId || !portionRecipientId}>
                                    Назначить порцию
                                </button>
                            </form>
                            <div className={styles.days}>
                                {portions.data?.proposals.map((proposal) => (
                                    <article className={styles.entry} key={proposal.id}>
                                        <div>
                                            <strong>{proposal.source.name}</strong>
                                            <small>
                                                {proposal.recipient.displayName} · {proposal.quantity} {proposal.unit}
                                            </small>
                                            <small>
                                                {proposal.state === 'pending'
                                                    ? `Ожидает до ${new Date(proposal.dueAt).toLocaleString('ru-RU')}`
                                                    : proposal.state}
                                            </small>
                                        </div>
                                        {proposal.recipient.userId === user.data?.id && (
                                            <div className={styles['row-actions']}>
                                                {proposal.state === 'pending' && (
                                                    <>
                                                        <button
                                                            disabled={busy}
                                                            onClick={() =>
                                                                void decidePortion(
                                                                    proposal.id,
                                                                    proposal.version,
                                                                    'confirmed',
                                                                )
                                                            }
                                                        >
                                                            Подтвердить
                                                        </button>
                                                        <button
                                                            disabled={busy}
                                                            onClick={() =>
                                                                void decidePortion(
                                                                    proposal.id,
                                                                    proposal.version,
                                                                    'refused',
                                                                )
                                                            }
                                                        >
                                                            Не ел
                                                        </button>
                                                    </>
                                                )}
                                                {proposal.state === 'auto_confirmed' && (
                                                    <button
                                                        disabled={busy}
                                                        onClick={() =>
                                                            void decidePortion(
                                                                proposal.id,
                                                                proposal.version,
                                                                'cancelled',
                                                            )
                                                        }
                                                    >
                                                        Отменить автоподтверждение
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </article>
                                ))}
                                {!portions.isPending && !portions.data?.proposals.length && (
                                    <p className={styles.muted}>Назначенных порций пока нет.</p>
                                )}
                            </div>
                        </section>
                    )}
                </>
            )}
            {editing && (
                <Editor
                    key={`${editing.entry?.id ?? 'new'}:${editing.date}`}
                    entry={editing.entry}
                    date={editing.date}
                    pending={busy}
                    onPreview={(next) => void previewChange(next)}
                    onCancel={() => setEditing(null)}
                    members={scope === 'family' ? (family.data?.family?.members ?? []) : []}
                />
            )}
            {preview && (
                <section className={styles.panel} aria-live="polite">
                    <h2>Проверка изменения</h2>
                    <p>
                        Запасы не списываются. После подтверждения нужное количество будет мягко зарезервировано для
                        плана.
                    </p>
                    <ul className={styles.impact}>
                        {preview.impact.items.map((item, index) => (
                            <li key={`${item.entryRef}:${item.ingredientId}:${index}`}>
                                <strong>{item.name}</strong>: нужно {item.requiredQuantity ?? 'уточнить'}{' '}
                                {item.unit ?? ''}, резерв {item.reservedQuantity ?? 'не определён'}, нехватка{' '}
                                {item.missingQuantity ?? 'не определена'}
                                {item.needsQuantityCheck && <span className={styles.badge}>Проверьте количество</span>}
                            </li>
                        ))}
                    </ul>
                    {!preview.impact.items.length && <p>Изменение не требует продуктов.</p>}
                    <p className={styles.muted}>Оценка стоимости пока недоступна.</p>
                    <div className={styles['row-actions']}>
                        <button disabled={busy} onClick={() => void commitChange()}>
                            {busy ? <ArcInlineLoader label="Сохраняем…" /> : 'Подтвердить изменение'}
                        </button>
                        <button
                            disabled={busy}
                            onClick={() => {
                                setPreview(null);
                                setMutation(null);
                            }}
                        >
                            Отмена
                        </button>
                    </div>
                </section>
            )}
            {shopping && (
                <section className={styles.panel} aria-live="polite">
                    <h2>Что добавить в покупки</h2>
                    {shopping.items.length ? (
                        <ul className={styles.impact}>
                            {shopping.items.map((item, index) => (
                                <li key={`${item.ingredientId}:${item.unit}:${index}`}>
                                    <strong>{item.name}</strong>: {item.quantity ?? 'количество нужно проверить'}{' '}
                                    {item.unit ?? ''}
                                    {item.needsQuantityCheck && <span className={styles.badge}>Проверить</span>}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>По текущему плану ничего покупать не нужно.</p>
                    )}
                    <label>
                        Название списка
                        <input
                            value={shoppingTitle}
                            maxLength={200}
                            onChange={(event) => setShoppingTitle(event.target.value)}
                        />
                    </label>
                    <p className={styles.muted}>Стоимость появится после подключения цен.</p>
                    <div className={styles['row-actions']}>
                        <button
                            disabled={busy || !shopping.items.length || !shoppingTitle.trim()}
                            onClick={() => void commitShopping()}
                        >
                            Создать список покупок
                        </button>
                        <button disabled={busy} onClick={() => setShopping(null)}>
                            Закрыть
                        </button>
                    </div>
                </section>
            )}
        </>
    );
}

export function MealPlanPage({ scope = 'private' }: { scope?: 'private' | 'family' }) {
    return (
        <PlanShell scope={scope}>
            <Content scope={scope} />
        </PlanShell>
    );
}
