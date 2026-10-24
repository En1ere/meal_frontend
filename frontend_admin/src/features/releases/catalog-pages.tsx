import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useRuntime } from '../../app/providers.js';
import { AdminShell } from '../admin/admin-shell.js';
import { Guard } from '../auth/session.js';
import { ApiError } from '../../shared/api/client.js';
import { PageLoader as ArcPageLoader } from '@meal-planner/design-system';
import { runReleaseCommand } from './api.js';
import { achievementIconUrl, checksum, groupLabels, releaseWorkspaceKey, useReleaseWorkspace } from './workspace.js';
import type {
    Achievement,
    AchievementClause,
    AchievementCondition,
    AchievementMetric,
    Release,
    ReleaseChange,
    ReputationRank,
} from './contracts.js';
import styles from './catalog.module.css';

const metricLabels: Record<AchievementMetric, string> = {
    cookCount: 'Завершённые готовки',
    distinctRecipes: 'Разные приготовленные рецепты',
    breakfastCount: 'Разные завтраки',
    soupCount: 'Разные супы',
    bakingCount: 'Рецепты выпечки',
    dessertCount: 'Разные десерты',
    vegetableCount: 'Овощные блюда',
    fishCount: 'Рыбные блюда',
    plantCount: 'Растительные блюда',
    cuisineCount: 'Разные кухни мира',
    leftoverCount: 'Готовки с остатками',
    earlyCount: 'Ранние готовки',
    nightCount: 'Ночные готовки',
    preciseCount: 'Готовки с точным числом порций',
    seasonalCount: 'Сезонные готовки',
    seasonalMonthCount: 'Сезонные готовки за месяц',
    batchCount: 'Подтверждённые партии',
    locatedBatchCount: 'Партии с местом хранения',
    activeBatchCount: 'Активные партии',
    activeInventoryDays: 'Дни активного ведения запасов',
    preserveCount: 'Домашние заготовки',
    planCount: 'Завершённые недельные планы',
    maxPlanDays: 'Максимум заполненных дней плана',
    shoppingCount: 'Завершённые списки покупок',
    familyShoppingCount: 'Семейные списки покупок',
    receiptCount: 'Подтверждённые чеки',
    publishedCount: 'Опубликованные авторские рецепты',
    completeRecipeCount: 'Полностью заполненные рецепты',
    maxIndependentCooks: 'Максимум независимых готовок рецепта',
    seriesCount: 'Рецепты в авторской серии',
    helpfulCount: 'Подтверждённые полезные комментарии',
    followerCount: 'Подписчики',
    followingCount: 'Подписки на авторов',
    correctionCount: 'Подтверждённые исправления',
    allergenCount: 'Подтверждённые аллергены',
    sourceCount: 'Подтверждённые источники',
    photoCount: 'Принятые фотографии',
    bookmarkCount: 'Сохранённые рецепты',
    familyCookCount: 'Семейные готовки',
    familyWeeklyCooks: 'Участники семьи с готовками за неделю',
    familyPlanDays: 'Дни семейного плана',
    holidayCount: 'Праздничные подборки',
    everythingUsedCount: 'Готовки без остатков ингредиентов',
    expiredActiveCount: 'Активные просроченные партии',
};

function ClauseEditor({
    clause,
    onChange,
}: {
    clause: AchievementClause;
    onChange: (value: AchievementClause) => void;
}) {
    return (
        <div className={styles['condition-row']}>
            <label>
                Метрика
                <select
                    value={clause.metric}
                    onChange={(event) => onChange({ ...clause, metric: event.target.value as AchievementMetric })}
                >
                    {Object.entries(metricLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label} · {value}
                        </option>
                    ))}
                </select>
            </label>
            <label>
                Оператор
                <select
                    value={clause.operator}
                    onChange={(event) => onChange({ ...clause, operator: event.target.value as 'gte' | 'eq' })}
                >
                    <option value="gte">Не меньше (gte)</option>
                    <option value="eq">Равно (eq)</option>
                </select>
            </label>
            <label>
                Порог
                <input
                    type="number"
                    min={0}
                    step={1}
                    value={clause.threshold}
                    onChange={(event) =>
                        onChange({ ...clause, threshold: Math.max(0, Math.trunc(Number(event.target.value))) })
                    }
                />
            </label>
        </div>
    );
}

function ConditionEditor({
    value,
    onChange,
}: {
    value: AchievementCondition;
    onChange: (value: AchievementCondition) => void;
}) {
    if (value.kind === 'legacy')
        return (
            <section className={styles['condition-blocker']} role="alert">
                <h3>Нужна ручная миграция условия</h3>
                <p>{value.reason}</p>
                <pre>{JSON.stringify(value.raw, null, 2)}</pre>
                <p>Исходный JSON сохраняется без изменений, но такое правило нельзя добавить в новый релиз.</p>
            </section>
        );
    if (value.kind === 'clause')
        return <ClauseEditor clause={value.clause} onChange={(clause) => onChange({ kind: 'clause', clause })} />;
    return (
        <section className={styles['condition-all']}>
            <h3>Все условия должны выполниться</h3>
            <p>Композиция all используется для правила, которому действительно нужны несколько независимых проверок.</p>
            {value.clauses.map((clause, index) => (
                <ClauseEditor
                    key={`${clause.metric}-${index}`}
                    clause={clause}
                    onChange={(next) =>
                        onChange({
                            kind: 'all',
                            clauses: value.clauses.map((item, itemIndex) => (itemIndex === index ? next : item)),
                        })
                    }
                />
            ))}
        </section>
    );
}

function DraftPicker({
    drafts,
    value,
    onChange,
}: {
    drafts: Release[];
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <label>
            Добавить в релиз
            <select value={value} onChange={(event) => onChange(event.target.value)}>
                <option value="">Выберите черновик</option>
                {drafts.map((draft) => (
                    <option key={draft.id} value={draft.id}>
                        {draft.title}
                    </option>
                ))}
            </select>
        </label>
    );
}

export function AchievementsPage() {
    const { id } = useParams();
    const workspace = useReleaseWorkspace();
    const { api, queryClient } = useRuntime();
    const [selectedId, setSelectedId] = useState(id ?? '');
    const [creating, setCreating] = useState(false);
    const [query, setQuery] = useState('');
    const [group, setGroup] = useState('all');
    const selected =
        workspace.data?.achievements.find((item) => item.id === (id ?? selectedId)) ??
        (!id ? workspace.data?.achievements[0] : undefined);
    const missingRequestedAchievement = !!id && workspace.isSuccess && !selected;
    const [draft, setDraft] = useState<Achievement | null>(null);
    const [releaseId, setReleaseId] = useState('');
    const [pending, setPending] = useState('');
    const [previewIcon, setPreviewIcon] = useState('');
    const [message, setMessage] = useState('');
    useEffect(() => {
        if ((!creating || id) && selected) {
            queueMicrotask(() => {
                setCreating(false);
                setSelectedId(selected.id);
                setDraft(structuredClone(selected));
                setPreviewIcon('');
            });
        }
    }, [creating, id, selected]);
    const visible = useMemo(
        () =>
            workspace.data?.achievements.filter(
                (item) =>
                    (group === 'all' || item.group === group) &&
                    `${item.title} ${item.description} ${item.code}`.toLowerCase().includes(query.trim().toLowerCase()),
            ) ?? [],
        [group, query, workspace.data],
    );
    const drafts = workspace.data?.releases.filter((item) => item.status !== 'published') ?? [];
    async function execute(changeType: 'add' | 'update' | 'retire' = creating ? 'add' : 'update') {
        if (!api || !draft || pending) return;
        if (draft.condition.kind === 'legacy') {
            setMessage('Условие нельзя добавить в релиз до ручной миграции на поддерживаемый формат.');
            return;
        }
        setPending('release');
        setMessage('');
        try {
            const release = drafts.find((item) => item.id === releaseId);
            if (!release) throw new Error('Выберите черновик');
            const version = draft.version;
            const achievement = {
                code: draft.code,
                title: draft.title,
                description: draft.description,
                group: draft.group,
                condition: draft.condition,
                secret: draft.secret,
                icon: draft.icon,
            };
            const change: ReleaseChange = {
                entityType: 'achievement',
                entityId: draft.id,
                label: draft.title,
                changeType,
                expectedVersion: version,
                achievement,
            };
            const changes = [
                ...release.changes.filter((item) => !(item.entityType === 'achievement' && item.entityId === draft.id)),
                change,
            ];
            const patch = { title: release.title, changes };
            const result = await runReleaseCommand(api, {
                action: 'save',
                releaseId: release.id,
                baseVersion: release.version,
                clientRevision: release.clientRevision + 1,
                checksum: await checksum({
                    name: patch.title,
                    patches: patch.changes,
                    clientRevision: release.clientRevision + 1,
                }),
                patch,
            });
            queryClient.setQueryData(releaseWorkspaceKey, result.workspace);
            setMessage(`Изменение добавлено в «${release.title}»`);
        } catch (failure) {
            setMessage(
                failure instanceof ApiError
                    ? failure.message
                    : failure instanceof Error
                      ? failure.message
                      : 'Не удалось сохранить.',
            );
        } finally {
            setPending('');
        }
    }
    function icon(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file || !draft) return;
        if (file.size > 1_048_576) {
            setMessage('Иконка должна быть меньше 1 МБ.');
            return;
        }
        if (!['image/png', 'image/webp'].includes(file.type)) {
            setMessage('Поддерживаются PNG и WebP.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' && setPreviewIcon(reader.result);
        reader.onerror = () => setMessage('Не удалось прочитать файл.');
        reader.readAsDataURL(file);
    }
    return (
        <Guard context="admin">
            <AdminShell active="catalog">
                <header className={styles.heading}>
                    <div>
                        <p>Каталог</p>
                        <h1>Достижения</h1>
                        <span>Все достижения публичны: они отображаются в профиле вместе с репутацией.</span>
                    </div>
                    <strong>{workspace.data?.achievements.length ?? 0} достижений</strong>
                </header>
                {workspace.isPending ? (
                    <ArcPageLoader label="Загружаем достижения…" />
                ) : workspace.isError ? (
                    <button className="button outline" onClick={() => void workspace.refetch()}>
                        Повторить
                    </button>
                ) : (
                    <div className={styles.layout}>
                        <aside className={styles['list-panel']}>
                            <button
                                className="button primary"
                                onClick={() => {
                                    const nextId = crypto.randomUUID();
                                    setCreating(true);
                                    setSelectedId('');
                                    setDraft({
                                        id: nextId,
                                        code: `achievement-${Date.now()}`,
                                        title: 'Новое достижение',
                                        description: 'Описание нового публичного достижения.',
                                        group: 'culinary',
                                        condition: {
                                            kind: 'clause',
                                            clause: { metric: 'cookCount', operator: 'gte', threshold: 1 },
                                        },
                                        secret: false,
                                        icon: {
                                            assetId: null,
                                            fallbackKey: 'medal-bronze-book',
                                            alt: 'Иконка нового достижения',
                                        },
                                        version: 0,
                                        updatedAt: new Date().toISOString(),
                                    });
                                    setPreviewIcon('');
                                }}
                            >
                                Создать достижение
                            </button>
                            <input
                                aria-label="Поиск достижений"
                                placeholder="Поиск"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                            />
                            <select
                                aria-label="Группа"
                                value={group}
                                onChange={(event) => setGroup(event.target.value)}
                            >
                                <option value="all">Все группы</option>
                                {Object.entries(groupLabels).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                            <div className={styles['achievement-list']}>
                                {visible.map((item) => (
                                    <button
                                        key={item.id}
                                        aria-current={!creating && item.id === selected?.id ? 'true' : undefined}
                                        onClick={() => {
                                            setCreating(false);
                                            setSelectedId(item.id);
                                        }}
                                    >
                                        <span className={styles['mini-icon']}>
                                            <img src={achievementIconUrl(item.icon)} width="43" height="43" alt="" />
                                        </span>
                                        <span>
                                            <strong>{item.title}</strong>
                                            <small>{groupLabels[item.group]}</small>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </aside>
                        {missingRequestedAchievement ? (
                            <main className={styles.editor}>
                                <p role="alert">Достижение с таким идентификатором не найдено.</p>
                                <Link className="button outline" to="/admin/catalog/achievements">
                                    К списку достижений
                                </Link>
                            </main>
                        ) : draft ? (
                            <main className={styles.editor}>
                                <div className={styles.preview}>
                                    <span className={styles['big-icon']}>
                                        <img
                                            src={previewIcon || achievementIconUrl(draft.icon)}
                                            width="80"
                                            height="80"
                                            alt={`Иконка достижения «${draft.title}»`}
                                        />
                                    </span>
                                    <div>
                                        <h2>{draft.title || 'Название достижения'}</h2>
                                        <p>{draft.description || 'Описание достижения'}</p>
                                        <small>Публично в профиле · + репутация по условию</small>
                                    </div>
                                </div>
                                {message && (
                                    <p role="status" className={styles.message}>
                                        {message}
                                    </p>
                                )}
                                <div className={styles['form-grid']}>
                                    <label>
                                        Заголовок
                                        <input
                                            value={draft.title}
                                            maxLength={120}
                                            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                                        />
                                    </label>
                                    <label>
                                        Стабильный код
                                        <input
                                            value={draft.code}
                                            maxLength={80}
                                            disabled={!creating}
                                            onChange={(event) => setDraft({ ...draft, code: event.target.value })}
                                        />
                                    </label>
                                    <label className={styles.full}>
                                        Описание
                                        <textarea
                                            value={draft.description}
                                            maxLength={500}
                                            onChange={(event) =>
                                                setDraft({ ...draft, description: event.target.value })
                                            }
                                        />
                                    </label>
                                    <label>
                                        Категория
                                        <select
                                            value={draft.group}
                                            onChange={(event) =>
                                                setDraft({
                                                    ...draft,
                                                    group: event.target.value as Achievement['group'],
                                                })
                                            }
                                        >
                                            {Object.entries(groupLabels).map(([value, label]) => (
                                                <option key={value} value={value}>
                                                    {label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        Иконка
                                        <label className="button outline">
                                            Предпросмотр PNG или WebP
                                            <input
                                                className={styles.file}
                                                type="file"
                                                accept="image/png,image/webp"
                                                disabled={
                                                    !(import.meta.env.DEV && import.meta.env.VITE_API_MODE === 'mock')
                                                }
                                                onChange={icon}
                                            />
                                        </label>
                                        <small>
                                            {import.meta.env.DEV && import.meta.env.VITE_API_MODE === 'mock'
                                                ? 'Файл используется только для локального предпросмотра. В релиз попадёт защищённая metadata иконки.'
                                                : 'Загрузка недоступна до подключения storage и scanner.'}
                                        </small>
                                    </label>
                                    <section className={styles.full} aria-labelledby="achievement-condition-title">
                                        <div className={styles['condition-heading']}>
                                            <h3 id="achievement-condition-title">Серверное условие</h3>
                                            <label>
                                                <input
                                                    type="checkbox"
                                                    checked={draft.secret}
                                                    onChange={(event) =>
                                                        setDraft({ ...draft, secret: event.target.checked })
                                                    }
                                                />
                                                Скрывать условие до получения
                                            </label>
                                        </div>
                                        <ConditionEditor
                                            value={draft.condition}
                                            onChange={(condition) => setDraft({ ...draft, condition })}
                                        />
                                    </section>
                                </div>
                                <section className={styles.actions}>
                                    <div>
                                        <h3>Подготовить в релизе</h3>
                                        <p>Изменение станет публичным только после проверки и публикации релиза.</p>
                                        <DraftPicker drafts={drafts} value={releaseId} onChange={setReleaseId} />
                                        <div className={styles['action-row']}>
                                            <button
                                                className="button primary"
                                                disabled={!!pending || !releaseId || draft.condition.kind === 'legacy'}
                                                onClick={() => void execute()}
                                            >
                                                {pending === 'release'
                                                    ? 'Добавляем…'
                                                    : creating
                                                      ? 'Создать в релизе'
                                                      : 'Добавить изменение'}
                                            </button>
                                            {!creating && (
                                                <button
                                                    className="button outline"
                                                    disabled={
                                                        !!pending || !releaseId || draft.condition.kind === 'legacy'
                                                    }
                                                    onClick={() => void execute('retire')}
                                                >
                                                    Снять через релиз
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </section>
                            </main>
                        ) : null}
                    </div>
                )}
            </AdminShell>
        </Guard>
    );
}

export function ReputationPage() {
    const workspace = useReleaseWorkspace();
    const { api, queryClient } = useRuntime();
    const [ranks, setRanks] = useState<ReputationRank[]>([]);
    const [points, setPoints] = useState(420);
    const [releaseId, setReleaseId] = useState('');
    const [pending, setPending] = useState('');
    const [message, setMessage] = useState('');
    useEffect(() => {
        if (workspace.data && !ranks.length) {
            const data = workspace.data;
            queueMicrotask(() => setRanks(structuredClone(data.ranks)));
        }
    }, [workspace.data, ranks.length]);
    const drafts = workspace.data?.releases.filter((item) => item.status !== 'published') ?? [];
    const active = ranks
        .toSorted((a, b) => a.minimum - b.minimum)
        .filter((rank) => rank.minimum <= points)
        .at(-1);
    async function save() {
        if (!api || ranks.length !== 10 || pending) return;
        setPending('release');
        setMessage('');
        try {
            const release = drafts.find((item) => item.id === releaseId);
            if (!release) throw new Error('Выберите черновик');
            const change: ReleaseChange = {
                entityType: 'reputation',
                entityId: '00000040-0000-4000-8000-000000000001',
                label: 'Шкала репутации',
                changeType: 'update',
                ranks,
            };
            const changes = [...release.changes.filter((item) => item.entityType !== 'reputation'), change];
            const patch = { title: release.title, changes };
            const result = await runReleaseCommand(api, {
                action: 'save',
                releaseId: release.id,
                baseVersion: release.version,
                clientRevision: release.clientRevision + 1,
                checksum: await checksum({
                    name: patch.title,
                    patches: patch.changes,
                    clientRevision: release.clientRevision + 1,
                }),
                patch,
            });
            queryClient.setQueryData(releaseWorkspaceKey, result.workspace);
            setMessage(`Шкала добавлена в «${release.title}»`);
        } catch (failure) {
            setMessage(
                failure instanceof ApiError
                    ? failure.message
                    : failure instanceof Error
                      ? failure.message
                      : 'Не удалось сохранить.',
            );
        } finally {
            setPending('');
        }
    }
    return (
        <Guard context="admin">
            <AdminShell active="catalog">
                <header className={styles.heading}>
                    <div>
                        <p>Каталог</p>
                        <h1>Звания репутации</h1>
                        <span>Публичный числовой рейтинг с десятью последовательными уровнями.</span>
                    </div>
                    <strong>10 званий</strong>
                </header>
                {workspace.isPending ? (
                    <ArcPageLoader label="Загружаем шкалу…" />
                ) : (
                    <div className={styles['rank-layout']}>
                        <section className={styles['rank-editor']}>
                            {ranks.map((rank, index) => (
                                <div className={styles['rank-row']} key={rank.id}>
                                    <b>{index + 1}</b>
                                    <label>
                                        От
                                        <input
                                            type="number"
                                            min={0}
                                            value={rank.minimum}
                                            onChange={(event) =>
                                                setRanks((items) =>
                                                    items.map((item, i) =>
                                                        i === index
                                                            ? { ...item, minimum: Number(event.target.value) }
                                                            : item,
                                                    ),
                                                )
                                            }
                                        />
                                    </label>
                                    <label>
                                        Звание
                                        <input
                                            value={rank.title}
                                            maxLength={80}
                                            onChange={(event) =>
                                                setRanks((items) =>
                                                    items.map((item, i) =>
                                                        i === index ? { ...item, title: event.target.value } : item,
                                                    ),
                                                )
                                            }
                                        />
                                    </label>
                                </div>
                            ))}
                        </section>
                        <aside className={styles['rank-preview']}>
                            <h2>Предпросмотр профиля</h2>
                            <label>
                                Репутация
                                <input
                                    type="number"
                                    min={0}
                                    value={points}
                                    onChange={(event) => setPoints(Number(event.target.value))}
                                />
                            </label>
                            <div className={styles.score}>
                                <strong>{points}</strong>
                                <span className={styles['score-title']}>{active?.title ?? 'Новичок'}</span>
                            </div>
                            <p>
                                Следующее звание:{' '}
                                {ranks.find((rank) => rank.minimum > points)?.title ?? 'максимальный уровень'}
                            </p>
                            {message && (
                                <p role="status" className={styles.message}>
                                    {message}
                                </p>
                            )}
                            <p>Изменения публикуются только в составе релиза.</p>
                            <DraftPicker drafts={drafts} value={releaseId} onChange={setReleaseId} />
                            <button
                                className="button primary"
                                disabled={!!pending || !releaseId}
                                onClick={() => void save()}
                            >
                                {pending === 'release' ? 'Добавляем…' : 'Добавить в релиз'}
                            </button>
                        </aside>
                    </div>
                )}
            </AdminShell>
        </Guard>
    );
}
