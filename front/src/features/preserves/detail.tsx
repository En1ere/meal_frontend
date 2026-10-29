'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRuntime } from '../../shared/runtime/index.js';
import { useSession } from '../../entities/session/client.js';
import { useRequestSignal } from '../../shared/api/use-request-signal.js';
import { ApiError } from '../../shared/api/client.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { units } from '../../entities/measurement/model.js';
import { localDate } from '../../shared/lib/date.js';
import { RecipeImage } from '../../entities/recipe/client.js';
import { PreserveShell, PreserveLoading, expiryLabel, dayText } from './shared.js';
import { PreserveForm } from './form.js';
import { preserveTypes, type Preserve } from './types.js';
import { usePreserveCommand } from './use-command.js';
import { PreserveQrLabel } from './qr-label.js';
import styles from './preserves.module.css';
type Mode = 'consume' | 'open' | 'quantity' | 'archive' | 'restore';
function Operation({
    preserve,
    mode,
    onDone,
    scope,
}: {
    preserve: Preserve;
    mode: Mode;
    onDone: () => void;
    scope: 'private' | 'family';
}) {
    const { api } = useRuntime();
    const cmd = usePreserveCommand(scope);
    const requestSignal = useRequestSignal();
    const [current, setCurrent] = useState(preserve);
    const [containerId, setContainerId] = useState(preserve.containers[0]?.id ?? '');
    const [quantity, setQuantity] = useState('');
    const [openedAt, setOpenedAt] = useState(`${localDate()}T12:00`);
    const [preview, setPreview] = useState<Success<'POST /api/v1/preserves/{id}/consume-preview'>['data'] | null>(null);
    const [previewing, setPreviewing] = useState(false);
    const [error, setError] = useState('');
    const container = current.containers.find((c) => c.id === containerId);
    const unit = current.unit ? units[current.unit] : '';
    async function reread() {
        try {
            const result = await api!.request(
                'GET /api/v1/preserves/{id}',
                undefined,
                requestSignal(),
                { id: current.id },
                { query: { scope } },
            );
            setCurrent(result.data.preserve);
            setPreview(null);
            setError('Карточка обновлена. Ввод сохранён; проверьте остаток и повторите предпросмотр.');
        } catch (e) {
            setError(e instanceof ApiError ? e.message : 'Не удалось обновить карточку.');
        }
    }
    async function submit() {
        if (!api) return;
        setError('');
        const base = { version: current.version };
        let result: unknown;
        if (mode === 'archive' || mode === 'restore') {
            result =
                mode === 'archive'
                    ? await cmd.run('POST /api/v1/preserves/{id}/archive', base, { id: current.id })
                    : await cmd.run('POST /api/v1/preserves/{id}/restore', base, { id: current.id });
        } else if (!container) {
            setError('Выберите конкретную упаковку.');
            return;
        } else if (mode === 'consume') {
            const body = { ...base, containerId, containerVersion: container.version, quantity, scope };
            if (!preview) {
                setPreviewing(true);
                try {
                    const response = await api.request(
                        'POST /api/v1/preserves/{id}/consume-preview',
                        body,
                        requestSignal(),
                        { id: current.id },
                    );
                    setPreview(response.data);
                } catch (e) {
                    setError(e instanceof ApiError ? e.message : 'Не удалось получить предпросмотр.');
                } finally {
                    setPreviewing(false);
                }
                return;
            }
            result = await cmd.run(
                'POST /api/v1/preserves/{id}/consume',
                { ...body, previewToken: preview.previewToken },
                { id: current.id },
            );
        } else if (mode === 'quantity') {
            result = await cmd.run(
                'POST /api/v1/preserves/{id}/containers/{containerId}/quantity',
                { ...base, containerVersion: container.version, quantity: quantity || null },
                { id: current.id, containerId },
            );
        } else {
            const date = new Date(openedAt);
            if (!Number.isFinite(date.getTime())) {
                setError('Укажите дату и время открытия.');
                return;
            }
            result = await cmd.run(
                'POST /api/v1/preserves/{id}/containers/{containerId}/open',
                {
                    ...base,
                    containerVersion: container.version,
                    openedAt: date.toISOString(),
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                },
                { id: current.id, containerId },
            );
        }
        if (result) onDone();
    }
    const title = {
        consume: 'Использовать заготовку',
        open: 'Отметить открытой',
        quantity: 'Уточнить количество',
        archive: 'Перенести в архив',
        restore: 'Восстановить из архива',
    }[mode];
    return (
        <form
            className={styles.panel}
            onSubmit={(e) => {
                e.preventDefault();
                void submit();
            }}
        >
            <h2>{title}</h2>
            {mode === 'archive' || mode === 'restore' ? (
                <p>
                    {mode === 'archive'
                        ? 'Карточка и история сохранятся. Подтвердите перенос в архив.'
                        : 'Заготовка вернётся в активные записи. Исчерпанное количество не восстановится.'}
                </p>
            ) : (
                <fieldset disabled={cmd.pending || cmd.unknown || previewing}>
                    <label className={styles.field}>
                        Конкретная банка или упаковка
                        <select
                            value={containerId}
                            onChange={(e) => {
                                setContainerId(e.target.value);
                                setPreview(null);
                            }}
                        >
                            {current.containers.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.label} ·{' '}
                                    {c.remainingQuantity === null
                                        ? 'Количество не указано'
                                        : `${c.remainingQuantity} ${unit}`}
                                    {c.openedAt ? ' · открыта' : ''}
                                </option>
                            ))}
                        </select>
                    </label>
                    {mode === 'open' ? (
                        <>
                            <label className={styles.field}>
                                Дата и время открытия (местное время)
                                <input
                                    required
                                    type="datetime-local"
                                    value={openedAt}
                                    onChange={(e) => setOpenedAt(e.target.value)}
                                />
                            </label>
                            {container?.openedAt && (
                                <p>
                                    Эта банка уже открыта {new Date(container.openedAt).toLocaleString('ru-RU')}.
                                    Исходная дата неизменяема.
                                </p>
                            )}
                            <p>Срок после открытия автоматически не изменяется.</p>
                        </>
                    ) : (
                        <>
                            <label className={styles.field}>
                                {mode === 'consume' ? 'Использовать' : 'Текущее количество'} {unit}
                                <input
                                    required={mode === 'consume'}
                                    inputMode="decimal"
                                    value={quantity}
                                    onChange={(e) => {
                                        setQuantity(e.target.value);
                                        setPreview(null);
                                    }}
                                />
                            </label>
                            {mode === 'consume' && (
                                <>
                                    <button
                                        type="button"
                                        disabled={
                                            container?.remainingQuantity === null ||
                                            container?.remainingQuantity === '0'
                                        }
                                        onClick={() => {
                                            setQuantity(container?.remainingQuantity ?? '');
                                            setPreview(null);
                                        }}
                                    >
                                        Использовать всю выбранную упаковку
                                    </button>
                                    {container?.remainingQuantity === null && (
                                        <p>Сначала уточните количество этой упаковки.</p>
                                    )}
                                </>
                            )}
                            {mode === 'quantity' && <p>Пустое поле означает неизвестное количество, а не ноль.</p>}
                        </>
                    )}
                </fieldset>
            )}
            {preview && (
                <p className={styles.notice}>
                    Было {preview.before} {unit}. После расхода останется {preview.after} {unit}. Подтвердите списание.
                </p>
            )}
            {(error || cmd.error) && <p role="alert">{error || cmd.error}</p>}
            <div className={styles.actions}>
                <button
                    disabled={
                        cmd.pending ||
                        previewing ||
                        (mode === 'open' && !!container?.openedAt) ||
                        (mode === 'consume' &&
                            (container?.remainingQuantity === null || container?.remainingQuantity === '0'))
                    }
                    type="submit"
                >
                    {cmd.pending
                        ? 'Сохраняем…'
                        : previewing
                          ? 'Рассчитываем…'
                          : cmd.unknown
                            ? 'Повторить сохранённый запрос'
                            : mode === 'consume' && !preview
                              ? 'Показать остаток'
                              : 'Подтвердить'}
                </button>
                <button disabled={cmd.pending || cmd.unknown || previewing} type="button" onClick={onDone}>
                    Отмена
                </button>
                <button disabled={cmd.pending || cmd.unknown || previewing} type="button" onClick={() => void reread()}>
                    Перечитать, сохранив ввод
                </button>
            </div>
        </form>
    );
}
function Content({ id, scope }: { id: string; scope: 'private' | 'family' }) {
    const { api } = useRuntime();
    const user = useSession('user');
    const search = useSearchParams();
    const router = useRouter();
    const cmd = usePreserveCommand(scope);
    const [mode, setMode] = useState<Mode | null>(null);
    const [edit, setEdit] = useState(false);
    const [historyPage, setHistoryPage] = useState(1);
    const [tab, setTab] = useState('ingredients');
    const detail = useQuery({
        queryKey: ['preserves', user.data?.id, scope, id],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/preserves/{id}', undefined, signal, { id }, { query: { scope } })).data,
    });
    const history = useQuery({
        queryKey: ['preserves', user.data?.id, scope, id, 'history', historyPage],
        enabled: !!api && !!user.data && !!detail.data,
        queryFn: async ({ signal }) =>
            (
                await api!.request(
                    'GET /api/v1/preserves/{id}/history',
                    undefined,
                    signal,
                    { id },
                    { query: { page: String(historyPage), limit: '20', scope } },
                )
            ).data,
    });
    const locations = useQuery({
        queryKey: ['inventory-locations', user.data?.id, scope],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/inventory-locations', undefined, signal, undefined, { query: { scope } }))
                .data,
    });
    const returnTo = search.get('returnTo');
    const base = scope === 'family' ? '/family/preserves' : '/preserves';
    const back =
        returnTo && (scope === 'family' ? /^\/family\/preserves(?:\?|$)/ : /^\/preserves(?:\?|$)/).test(returnTo)
            ? returnTo
            : base;
    if (detail.isPending) return <PreserveLoading />;
    if (detail.isError || !detail.data)
        return (
            <section className={styles.panel} role="alert">
                <h1>Заготовка недоступна</h1>
                <p>{detail.error instanceof ApiError ? detail.error.message : 'Не удалось загрузить карточку.'}</p>
                <button onClick={() => void detail.refetch()}>Повторить</button>
                <Link href={back}>Назад к заготовкам</Link>
            </section>
        );
    const p = detail.data.preserve;
    const unit = p.unit ? units[p.unit] : '';
    const depleted = p.quantity === '0';
    const actions = {
        create: 'Создана',
        edit: 'Изменена',
        open: 'Открыта упаковка',
        quantity: 'Уточнено количество',
        consume: 'Использована',
        archive: 'Архивирована',
        restore: 'Восстановлена',
    } as Record<string, string>;
    return (
        <>
            <Link href={back}>← {scope === 'family' ? 'Заготовки семьи' : 'Мои заготовки'}</Link>
            <div className={styles.heading}>
                <div>
                    <h1>{p.name}</h1>
                    <p>
                        {preserveTypes[p.type]} · {scope === 'family' ? 'Доступна семье' : 'Только мне'} ·{' '}
                        {p.archivedAt ? 'В архиве' : depleted ? 'Полностью использована' : 'Активна'}
                    </p>
                </div>
                <div className={styles.actions}>
                    <button disabled={!!p.archivedAt || depleted || !!mode || edit} onClick={() => setMode('consume')}>
                        Использовать
                    </button>
                    <button disabled={!!p.archivedAt || !!mode || edit} onClick={() => setEdit(true)}>
                        Изменить
                    </button>
                    <button disabled={!!mode || edit} onClick={() => setMode(p.archivedAt ? 'restore' : 'archive')}>
                        {p.archivedAt ? 'Восстановить' : 'В архив'}
                    </button>
                </div>
            </div>
            {edit && (
                <PreserveForm
                    value={p}
                    scope={scope}
                    onSaved={() => {
                        setEdit(false);
                        void detail.refetch();
                    }}
                    onCancel={() => setEdit(false)}
                />
            )}{' '}
            {mode && (
                <Operation
                    key={mode}
                    preserve={p}
                    mode={mode}
                    scope={scope}
                    onDone={() => {
                        setMode(null);
                        void detail.refetch();
                    }}
                />
            )}
            <div className={styles.detail}>
                <div className={styles.stack}>
                    <section className={styles.panel}>
                        <RecipeImage src={p.imageUrl} alt={p.name} className={styles.hero} />
                        <div className={styles.facts}>
                            <div>
                                Текущее количество
                                <strong>
                                    {p.quantity === null ? 'Количество не указано' : `${p.quantity} ${unit}`}
                                </strong>
                            </div>
                            <div>
                                Приготовлено<strong>{dayText(p.createdOn)}</strong>
                            </div>
                            <div>
                                Срок<strong>{expiryLabel(p.expiryOn, localDate())}</strong>
                            </div>
                            <div>
                                Хранение
                                <strong>
                                    {locations.data?.items.find((l) => l.id === p.locationId)?.name ??
                                        'Место не указано'}
                                </strong>
                            </div>
                        </div>
                        {p.shelfLifeDays && <p>Указанный срок хранения: {p.shelfLifeDays} дней</p>}
                        {p.volumePerUnit && <p>Объём единицы: {p.volumePerUnit}</p>}
                        {depleted && (
                            <p className={styles.notice}>
                                Заготовка полностью использована. История сохранена; списание больше недоступно.
                            </p>
                        )}
                    </section>
                    <section className={styles.panel}>
                        <h2>Банки и упаковки</h2>
                        {p.containers.map((c) => (
                            <div className={styles.jar} key={c.id}>
                                <strong>{c.label}</strong>
                                <span>
                                    {c.remainingQuantity === null
                                        ? 'Количество не указано'
                                        : `${c.remainingQuantity} ${unit}`}
                                </span>
                                <span>
                                    {c.openedAt
                                        ? `Открыта ${new Date(c.openedAt).toLocaleString('ru-RU')}`
                                        : 'Не открыта'}
                                    {c.depletedAt ? ' · Исчерпана' : ''}
                                </span>
                            </div>
                        ))}
                        <div className={styles.actions}>
                            <button
                                disabled={!!p.archivedAt || !!mode || edit || p.containers.every((c) => !!c.openedAt)}
                                onClick={() => setMode('open')}
                            >
                                Отметить банку открытой
                            </button>
                            <button disabled={!!p.archivedAt || !!mode || edit} onClick={() => setMode('quantity')}>
                                Уточнить количество
                            </button>
                        </div>
                    </section>
                    <section className={styles.panel}>
                        <nav className={styles.tabs} aria-label="Сведения о заготовке">
                            {[
                                ['ingredients', 'Состав'],
                                ['origin', 'Происхождение'],
                                ['notes', 'Заметки'],
                            ].map(([k, label]) => (
                                <button key={k} aria-pressed={tab === k} onClick={() => setTab(k!)}>
                                    {label}
                                </button>
                            ))}
                        </nav>
                        {tab === 'ingredients' ? (
                            <>
                                <h2>Ингредиенты</h2>
                                {p.ingredients.length ? (
                                    <ul>
                                        {p.ingredients.map((i, n) => (
                                            <li key={n}>
                                                {i.name}
                                                {i.quantity ? ` — ${i.quantity} ${i.unit ? units[i.unit] : ''}` : ''}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p>Состав не указан</p>
                                )}
                            </>
                        ) : tab === 'notes' ? (
                            <>
                                <p>{p.notes ?? 'Заметок пока нет'}</p>
                                <p>{p.tags.length ? p.tags.join(' · ') : 'Теги не указаны'}</p>
                            </>
                        ) : (
                            <>
                                <p>{p.recipeTitle ?? 'Создана вручную'}</p>
                                {p.recipeId && <SourceRecipeLink id={p.recipeId} />}
                                {!p.recipeId && (
                                    <button
                                        disabled={cmd.pending || !!p.archivedAt}
                                        onClick={() => {
                                            void (async () => {
                                                const result = await cmd.run(
                                                    'POST /api/v1/preserves/{id}/recipe-base',
                                                    { version: p.version },
                                                    { id: p.id },
                                                );
                                                if (result) router.push(`/recipes/${result.recipeId}/edit`);
                                            })();
                                        }}
                                    >
                                        Создать черновик рецепта из состава
                                    </button>
                                )}
                                {cmd.error && <p role="alert">{cmd.error}</p>}
                            </>
                        )}
                    </section>
                </div>
                <aside className={styles.stack}>
                    <section className={styles.panel}>
                        <h2>История</h2>
                        {history.isPending ? (
                            <PreserveLoading />
                        ) : history.isError ? (
                            <>
                                <p role="alert">Не удалось загрузить историю</p>
                                <button onClick={() => void history.refetch()}>Повторить</button>
                            </>
                        ) : (
                            <>
                                <ol className={styles.history}>
                                    {history.data.items.map((event) => (
                                        <li key={event.id}>
                                            <strong>
                                                {actions[
                                                    event.action
                                                        .replace('preserve.', '')
                                                        .replace('created', 'create')
                                                        .replace('edited', 'edit')
                                                        .replace('opened', 'open')
                                                        .replace('quantity-adjusted', 'quantity')
                                                        .replace('consumed', 'consume')
                                                        .replace('archived', 'archive')
                                                        .replace('restored', 'restore')
                                                ] ?? 'Изменение заготовки'}
                                            </strong>
                                            <br />
                                            <time dateTime={event.recordedAt}>
                                                {new Date(event.recordedAt).toLocaleString('ru-RU')}
                                            </time>
                                            {event.details.containerId && (
                                                <p>
                                                    {p.containers.find((j) => j.id === event.details.containerId)
                                                        ?.label ?? 'Упаковка'}
                                                </p>
                                            )}
                                            {event.details.before !== undefined && (
                                                <p>
                                                    Было: {event.details.before ?? 'Количество не указано'} {unit}
                                                </p>
                                            )}
                                            {event.details.after !== undefined && (
                                                <p>
                                                    Стало: {event.details.after ?? 'Количество не указано'} {unit}
                                                </p>
                                            )}
                                        </li>
                                    ))}
                                </ol>
                                {!history.data.items.length && <p>История пуста</p>}
                                <div className={styles.actions}>
                                    <button disabled={historyPage === 1} onClick={() => setHistoryPage((v) => v - 1)}>
                                        Ранее
                                    </button>
                                    <span>{historyPage}</span>
                                    <button
                                        disabled={historyPage * history.data.limit >= history.data.total}
                                        onClick={() => setHistoryPage((v) => v + 1)}
                                    >
                                        Далее
                                    </button>
                                </div>
                            </>
                        )}
                    </section>
                    <section className={styles.panel}>
                        <h2>QR и печать · Plus / Pro</h2>
                        <PreserveQrLabel preserve={p} scope={scope} />
                    </section>
                </aside>
            </div>
        </>
    );
}
export function PreserveDetailPage({ id, scope = 'private' }: { id: string; scope?: 'private' | 'family' }) {
    return (
        <PreserveShell scope={scope}>
            <Content id={id} scope={scope} />
        </PreserveShell>
    );
}
function SourceRecipeLink({ id }: { id: string }) {
    const { api } = useRuntime();
    const router = useRouter();
    const signal = useRequestSignal();
    const [pending, setPending] = useState(false),
        [error, setError] = useState('');
    async function open() {
        if (!api || pending) return;
        setPending(true);
        setError('');
        const abort = signal();
        try {
            await api.request('GET /api/v1/recipe-workspace/{id}', undefined, abort, { id });
            if (!abort.aborted) router.push(`/recipes/${id}/edit`);
        } catch (e) {
            if (abort.aborted) return;
            if (e instanceof ApiError && e.status === 404) router.push(`/recipes/${id}`);
            else setError(e instanceof ApiError ? e.message : 'Не удалось открыть источник.');
        } finally {
            if (!abort.aborted) setPending(false);
        }
    }
    return (
        <>
            <button disabled={pending} onClick={() => void open()}>
                {pending ? 'Открываем…' : 'Открыть рецепт-источник'}
            </button>
            {error && <p role="alert">{error}</p>}
        </>
    );
}
