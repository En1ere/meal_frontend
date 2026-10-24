import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRuntime } from '../../app/providers.js';
import { AdminShell } from '../admin/admin-shell.js';
import { Guard } from '../auth/session.js';
import { CriticalConfirmation } from '../auth/critical-confirmation.js';
import { ApiError } from '../../shared/api/client.js';
import { PageLoader as ArcPageLoader } from '@meal-planner/design-system';
import { runReleaseCommand, serializeChanges, stableUuid } from './api.js';
import { achievementIconUrl, checksum, groupLabels, releaseWorkspaceKey, useReleaseWorkspace } from './workspace.js';
import {
    contentDocumentSchema,
    dictionaryEntrySchema,
    type ContentDocument,
    type DictionaryEntry,
    type Release,
    type ReleaseChange,
} from './contracts.js';
import styles from './releases.module.css';
import { adminReleaseDraftKey } from '../../shared/storage/private-cache.js';

type Cache = {
    releaseId: string;
    baseVersion: number;
    clientRevision: number;
    checksum: string;
    patch: { title: string; changes: ReleaseChange[] };
};
const statusLabel = { draft: 'Черновик', ready: 'Готов к публикации', published: 'Опубликован' } as const;
const namespaceLabels: Record<ContentDocument['namespace'], string> = {
    help: 'Справка',
    pricing: 'Тарифы',
    onboarding: 'Онбординг',
    notification_template: 'Шаблон уведомления',
    feature_copy: 'Текст функции',
};
const dictionaryLabels: Record<DictionaryEntry['dictionary'], string> = {
    category: 'Категории',
    unit: 'Единицы измерения',
    allergen: 'Аллергены',
};
const blankDocument = (namespace: ContentDocument['namespace'], base?: ContentDocument): ContentDocument => {
    const common = {
        locale: base?.locale ?? 'ru-RU',
        title: base?.title ?? 'Новый контентный документ',
        body: base?.body ?? 'Текст документа.',
    };
    if (namespace === 'help')
        return { ...common, namespace, metadata: { schemaVersion: 1, slug: 'new-help', audience: 'all' } };
    if (namespace === 'pricing')
        return { ...common, namespace, metadata: { schemaVersion: 1, plan: 'free', billingPeriod: 'none' } };
    if (namespace === 'onboarding')
        return { ...common, namespace, metadata: { schemaVersion: 1, flow: 'main', step: 1 } };
    if (namespace === 'notification_template')
        return {
            ...common,
            namespace,
            metadata: { schemaVersion: 1, channel: 'in_app', templateKey: 'new-template', variables: [] },
        };
    return {
        ...common,
        namespace,
        metadata: { schemaVersion: 1, featureKey: 'new-feature', placement: 'default' },
    };
};
const blankDictionaryEntry: DictionaryEntry = {
    schemaVersion: 1,
    dictionary: 'category',
    code: 'new-entry',
    label: 'Новая запись',
    description: null,
    icon: { assetId: null, fallbackKey: 'food-014', alt: 'Иконка записи справочника' },
    sortOrder: 100,
    enabled: true,
};
const changedFields = (before: object | undefined, after: object) => {
    if (!before) return ['новый ресурс'];
    const previous = before as Record<string, unknown>;
    const next = after as Record<string, unknown>;
    return Object.keys(next).filter((key) => JSON.stringify(previous[key]) !== JSON.stringify(next[key]));
};

function readCache(release: Release): Cache | null {
    try {
        const raw = sessionStorage.getItem(adminReleaseDraftKey);
        if (!raw) return null;
        const value = JSON.parse(raw) as Partial<Cache>;
        if (
            value.releaseId !== release.id ||
            typeof value.baseVersion !== 'number' ||
            typeof value.clientRevision !== 'number' ||
            typeof value.checksum !== 'string' ||
            !value.patch ||
            typeof value.patch.title !== 'string' ||
            !Array.isArray(value.patch.changes)
        )
            return null;
        return value as Cache;
    } catch {
        return null;
    }
}

function Summary({ release }: { release: Release }) {
    const counts = release.changes.reduce<Record<string, number>>((result, change) => {
        result[change.entityType] = (result[change.entityType] ?? 0) + 1;
        return result;
    }, {});
    return (
        <dl className={styles.summary}>
            <div className={styles['summary-item']}>
                <dt>Изменений</dt>
                <dd>{release.changes.length}</dd>
            </div>
            <div className={styles['summary-item']}>
                <dt>Достижения</dt>
                <dd>{counts.achievement ?? 0}</dd>
            </div>
            <div className={styles['summary-item']}>
                <dt>Звания</dt>
                <dd>{counts.reputation ?? 0}</dd>
            </div>
            <div className={styles['summary-item']}>
                <dt>Документы</dt>
                <dd>{counts.content_document ?? 0}</dd>
            </div>
            <div className={styles['summary-item']}>
                <dt>Справочники</dt>
                <dd>{counts.dictionary_entry ?? 0}</dd>
            </div>
            <div className={styles['summary-item']}>
                <dt>Версия</dt>
                <dd>{release.version}</dd>
            </div>
        </dl>
    );
}

export function ReleasesPage() {
    const workspace = useReleaseWorkspace();
    const { api, queryClient } = useRuntime();
    const navigate = useNavigate();
    const [tab, setTab] = useState<'drafts' | 'history'>('drafts');
    const [name, setName] = useState('');
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const releases = workspace.data?.releases.filter((release) =>
        tab === 'drafts'
            ? release.status !== 'published'
            : release.status === 'published' || release.events.some((e) => e.kind === 'rolled_back'),
    );
    async function create(event: FormEvent) {
        event.preventDefault();
        if (!api || pending || !name.trim()) return;
        setPending(true);
        setError('');
        try {
            const result = await runReleaseCommand(api, {
                action: 'create',
                title: name.trim(),
                idempotencyKey: crypto.randomUUID(),
            });
            queryClient.setQueryData(releaseWorkspaceKey, result.workspace);
            const created = result.workspace.releases[0];
            if (created) void navigate(`/admin/releases/${created.id}`);
        } catch (failure) {
            setError(failure instanceof ApiError ? failure.message : 'Не удалось создать релиз.');
        } finally {
            setPending(false);
        }
    }
    return (
        <Guard context="admin">
            <AdminShell active="releases">
                <header className={styles['page-heading']}>
                    <div className={styles['conflict-actions']}>
                        <p className={styles.eyebrow}>Контент</p>
                        <h1>Релизы</h1>
                        <p>Пакеты изменений публикуются атомарно после проверки.</p>
                    </div>
                    <form onSubmit={(event) => void create(event)} className={styles['create-form']}>
                        <label>
                            Название нового релиза
                            <input
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                maxLength={160}
                                placeholder="Например, Осеннее обновление"
                            />
                        </label>
                        <button className="button primary" disabled={pending || !name.trim()}>
                            {pending ? 'Создаём…' : 'Создать релиз'}
                        </button>
                    </form>
                </header>
                {error && (
                    <p role="alert" className={styles.error}>
                        {error}
                    </p>
                )}
                <div className={styles.tabs} role="tablist" aria-label="Релизы">
                    <button role="tab" aria-selected={tab === 'drafts'} onClick={() => setTab('drafts')}>
                        В работе
                    </button>
                    <button role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')}>
                        История
                    </button>
                </div>
                {workspace.isPending ? (
                    <ArcPageLoader label="Загружаем релизы…" />
                ) : workspace.isError ? (
                    <button className="button outline" onClick={() => void workspace.refetch()}>
                        Повторить загрузку
                    </button>
                ) : !releases?.length ? (
                    <section className={styles.empty}>
                        <h2>{tab === 'drafts' ? 'Черновиков пока нет' : 'История пока пуста'}</h2>
                        <p>Создайте релиз и соберите в нём изменения каталога.</p>
                    </section>
                ) : (
                    <div className={styles['release-grid']}>
                        {releases.map((release) => (
                            <button
                                key={release.id}
                                className={styles['release-card']}
                                onClick={() => void navigate(`/admin/releases/${release.id}`)}
                            >
                                <span className={styles.status}>{statusLabel[release.status]}</span>
                                <h2>{release.title}</h2>
                                <p>
                                    {release.changes.length} изменений · обновлён{' '}
                                    {new Date(release.updatedAt).toLocaleString('ru-RU')}
                                </p>
                                <Summary release={release} />
                            </button>
                        ))}
                    </div>
                )}
            </AdminShell>
        </Guard>
    );
}

export function ReleaseDetailPage() {
    const { id } = useParams();
    const workspace = useReleaseWorkspace();
    const { api, queryClient } = useRuntime();
    const navigate = useNavigate();
    const server = workspace.data?.releases.find((item) => item.id === id);
    const [title, setTitle] = useState('');
    const [changes, setChanges] = useState<ReleaseChange[]>([]);
    const [baseVersion, setBaseVersion] = useState(0);
    const [clientRevision, setClientRevision] = useState(0);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'local' | 'saving' | 'saved' | 'conflict'>('idle');
    const [error, setError] = useState('');
    const [pendingAction, setPendingAction] = useState('');
    const [legalKey, setLegalKey] = useState('');
    const [legalContent, setLegalContent] = useState('');
    const [legalEffectiveAt, setLegalEffectiveAt] = useState('');
    const [productId, setProductId] = useState('');
    const [productDescription, setProductDescription] = useState('');
    const [documentKey, setDocumentKey] = useState('');
    const [documentDraft, setDocumentDraft] = useState<ContentDocument>(() => blankDocument('help'));
    const [dictionaryKey, setDictionaryKey] = useState('');
    const [dictionaryDraft, setDictionaryDraft] = useState<DictionaryEntry>(() =>
        structuredClone(blankDictionaryEntry),
    );
    const [dictionaryIconPreview, setDictionaryIconPreview] = useState('');
    const initialized = useRef('');
    const [hydratedRevision, setHydratedRevision] = useState('');
    const serverRevision = server ? `${server.id}:${server.version}:${server.clientRevision}` : '';
    useEffect(() => {
        if (!server) return;
        const revision = serverRevision;
        if (initialized.current === revision) return;
        if (initialized.current && ['local', 'saving', 'conflict'].includes(saveStatus)) return;
        initialized.current = revision;
        const cached = readCache(server);
        setTitle(cached?.patch.title ?? server.title);
        setChanges(cached?.patch.changes ?? server.changes);
        setBaseVersion(cached?.baseVersion ?? server.version);
        setClientRevision(cached?.clientRevision ?? server.clientRevision);
        setSaveStatus(cached ? 'local' : 'saved');
        setHydratedRevision(revision);
    }, [saveStatus, server, serverRevision]);
    const patch = useMemo(() => ({ title, changes }), [title, changes]);
    const dirty =
        !!server &&
        JSON.stringify({ title: patch.title, patches: serializeChanges(patch.changes) }) !==
            JSON.stringify({ title: server.title, patches: serializeChanges(server.changes) });
    useEffect(() => {
        if (
            !server ||
            hydratedRevision !== serverRevision ||
            server.status === 'published' ||
            !dirty ||
            saveStatus === 'conflict'
        )
            return;
        const nextRevision = clientRevision + 1;
        let timer = 0;
        let cancelled = false;
        void (async () => {
            const sum = await checksum({
                name: patch.title,
                patches: serializeChanges(patch.changes),
                clientRevision: nextRevision,
            });
            if (cancelled) return;
            const cached: Cache = {
                releaseId: server.id,
                baseVersion,
                clientRevision: nextRevision,
                checksum: sum,
                patch,
            };
            try {
                sessionStorage.setItem(adminReleaseDraftKey, JSON.stringify(cached));
            } catch {
                /* optional safety cache */
            }
            setSaveStatus('local');
            timer = window.setTimeout(
                () =>
                    void (async () => {
                        if (!api) return;
                        setSaveStatus('saving');
                        try {
                            const result = await runReleaseCommand(api, { action: 'save', ...cached });
                            queryClient.setQueryData(releaseWorkspaceKey, result.workspace);
                            if (result.ack?.clientRevision === nextRevision && result.ack.checksum === sum) {
                                try {
                                    sessionStorage.removeItem(adminReleaseDraftKey);
                                } catch {
                                    /* optional safety cache */
                                }
                                setBaseVersion(result.ack.baseVersion);
                                setClientRevision(nextRevision);
                                setSaveStatus('saved');
                            }
                        } catch (failure) {
                            if (failure instanceof ApiError && failure.status === 409) setSaveStatus('conflict');
                            else {
                                setSaveStatus('local');
                                setError(
                                    failure instanceof ApiError
                                        ? failure.message
                                        : 'Автосохранение не удалось. Локальная копия сохранена.',
                                );
                            }
                        }
                    })(),
                900,
            );
        })();
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [
        api,
        baseVersion,
        clientRevision,
        dirty,
        hydratedRevision,
        patch,
        queryClient,
        saveStatus,
        server,
        serverRevision,
    ]);
    async function action(kind: 'validate' | 'publish' | 'rollback' | 'reopen') {
        if (!api || !server || dirty || pendingAction) return;
        setPendingAction(kind);
        setError('');
        try {
            const result = await runReleaseCommand(api, {
                action: kind,
                releaseId: server.id,
                expectedVersion: server.version,
                ...(kind === 'publish' || kind === 'rollback' ? { idempotencyKey: crypto.randomUUID() } : {}),
            } as Parameters<typeof runReleaseCommand>[1]);
            queryClient.setQueryData(releaseWorkspaceKey, result.workspace);
            if (kind === 'reopen') void navigate(`/admin/releases/${result.workspace.releases[0]!.id}`);
        } catch (failure) {
            setError(failure instanceof ApiError ? failure.message : 'Команда не выполнена.');
        } finally {
            setPendingAction('');
        }
    }
    async function loadServerVersion() {
        try {
            sessionStorage.removeItem(adminReleaseDraftKey);
        } catch {
            /* optional safety cache */
        }
        const result = await workspace.refetch();
        const latest = result.data?.releases.find((item) => item.id === id);
        if (!latest) {
            setError('Не удалось загрузить серверную версию.');
            return;
        }
        initialized.current = `${latest.id}:${latest.version}:${latest.clientRevision}`;
        setHydratedRevision(initialized.current);
        setTitle(latest.title);
        setChanges(latest.changes);
        setBaseVersion(latest.version);
        setClientRevision(latest.clientRevision);
        setSaveStatus('saved');
        setError('');
    }
    if (workspace.isPending) return <ArcPageLoader label="Загружаем релиз…" />;
    if (!server)
        return (
            <Guard context="admin">
                <AdminShell active="releases">
                    <h1>Релиз не найден</h1>
                </AdminShell>
            </Guard>
        );
    const stagedIds = new Set(changes.filter((item) => item.entityType === 'achievement').map((item) => item.entityId));
    const addAchievement = (achievementId: string) => {
        const item = workspace.data?.achievements.find((achievement) => achievement.id === achievementId);
        if (!item || stagedIds.has(item.id)) return;
        const version = item.version;
        const achievement = {
            code: item.code,
            title: item.title,
            description: item.description,
            group: item.group,
            condition: item.condition,
            secret: item.secret,
            icon: item.icon,
        };
        setChanges((value) => [
            ...value,
            {
                entityType: 'achievement',
                entityId: item.id,
                label: item.title,
                changeType: 'update',
                expectedVersion: version,
                achievement,
            },
        ]);
    };
    const addLegal = () => {
        const source = workspace.data?.legalTexts.find((item) => item.key === legalKey);
        const key = legalKey.trim();
        if (!key || !legalContent.trim() || !legalEffectiveAt) return;
        const change: ReleaseChange = {
            entityType: 'legal_text',
            entityId: stableUuid(`document-${key}`),
            label: key,
            changeType: source ? 'update' : 'add',
            expectedVersion: source?.version ?? 0,
            summary: legalContent.trim(),
            effectiveAt: new Date(legalEffectiveAt).toISOString(),
        };
        setChanges((items) => [
            ...items.filter((item) => !(item.entityType === 'legal_text' && item.label === key)),
            change,
        ]);
    };
    const addProduct = () => {
        const source = workspace.data?.products.find((item) => item.id === productId);
        if (!source || !productDescription.trim()) return;
        const change: ReleaseChange = {
            entityType: 'product_description',
            entityId: source.id,
            label: source.name,
            changeType: source.description ? 'update' : 'add',
            expectedVersion: source.version,
            summary: productDescription.trim(),
        };
        setChanges((items) => [
            ...items.filter((item) => !(item.entityType === 'product_description' && item.entityId === source.id)),
            change,
        ]);
    };
    const selectDocument = (key: string) => {
        setDocumentKey(key);
        const source = workspace.data?.contentDocuments.find((item) => item.key === key);
        if (source) setDocumentDraft(structuredClone(source.value));
    };
    const stageDocument = (changeType?: 'retire') => {
        setError('');
        const key = documentKey.trim();
        const source = workspace.data?.contentDocuments.find((item) => item.key === key);
        if (!key || (changeType === 'retire' && !source)) return;
        if (key.length > 160) {
            setError('Ключ документа не может быть длиннее 160 символов.');
            return;
        }
        const documentPrefix = `${documentDraft.namespace}:${documentDraft.locale}:`;
        if (changeType !== 'retire' && (!key.startsWith(documentPrefix) || key.length === documentPrefix.length)) {
            setError(`Ключ документа должен иметь вид ${documentPrefix}<id>.`);
            return;
        }
        const parsed = contentDocumentSchema.safeParse(
            source && changeType === 'retire' ? source.value : documentDraft,
        );
        if (!parsed.success) {
            setError('Проверьте локаль, обязательные поля и metadata документа.');
            return;
        }
        const change: ReleaseChange = {
            entityType: 'content_document',
            entityId: stableUuid(`dictionary-${key}`),
            resourceKey: key,
            label: documentDraft.title,
            changeType: changeType ?? (source && !source.retired ? 'update' : 'add'),
            expectedVersion: source?.version ?? 0,
            document: parsed.data,
        };
        setChanges((items) => [
            ...items.filter(
                (item) => !(item.entityType === 'content_document' && item.resourceKey === change.resourceKey),
            ),
            change,
        ]);
    };
    const selectDictionaryEntry = (key: string) => {
        setDictionaryKey(key);
        const source = workspace.data?.dictionaryEntries.find((item) => item.key === key);
        if (source) {
            setDictionaryDraft(structuredClone(source.value));
            setDictionaryIconPreview('');
        }
    };
    const stageDictionaryEntry = (changeType?: 'retire') => {
        setError('');
        const key = dictionaryKey.trim();
        const source = workspace.data?.dictionaryEntries.find((item) => item.key === key);
        if (!key || (changeType === 'retire' && !source)) return;
        if (key.length > 160) {
            setError('Ключ записи не может быть длиннее 160 символов.');
            return;
        }
        const expectedKey = `${dictionaryDraft.dictionary}:${dictionaryDraft.code}`;
        if (changeType !== 'retire' && key !== expectedKey) {
            setError(`Ключ записи должен совпадать с ${expectedKey}.`);
            return;
        }
        const parsed = dictionaryEntrySchema.safeParse(
            source && changeType === 'retire' ? source.value : dictionaryDraft,
        );
        if (!parsed.success) {
            setError('Проверьте код, обязательные поля, порядок и metadata иконки записи.');
            return;
        }
        const change: ReleaseChange = {
            entityType: 'dictionary_entry',
            entityId: crypto.randomUUID(),
            resourceKey: key,
            label: dictionaryDraft.label,
            changeType: changeType ?? (source && !source.retired ? 'update' : 'add'),
            expectedVersion: source?.version ?? 0,
            entry: parsed.data,
        };
        setChanges((items) => [
            ...items.filter(
                (item) => !(item.entityType === 'dictionary_entry' && item.resourceKey === change.resourceKey),
            ),
            change,
        ]);
    };
    const previewDictionaryIcon = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > 1_048_576) {
            setError('Иконка справочника должна быть меньше 1 МБ.');
            return;
        }
        if (!['image/png', 'image/webp'].includes(file.type)) {
            setError('Для иконки справочника поддерживаются только PNG и WebP.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' && setDictionaryIconPreview(reader.result);
        reader.onerror = () => setError('Не удалось прочитать иконку.');
        reader.readAsDataURL(file);
    };
    return (
        <Guard context="admin">
            <AdminShell active="releases">
                <header className={styles['detail-heading']}>
                    <div>
                        <button className="text-button" onClick={() => void navigate('/admin/releases')}>
                            Контент / Релизы
                        </button>
                        <div className={styles['title-line']}>
                            <input
                                aria-label="Название релиза"
                                value={title}
                                disabled={server.status === 'published'}
                                onChange={(event) => setTitle(event.target.value)}
                            />
                            <span className={styles.status}>{statusLabel[server.status]}</span>
                        </div>
                        <p>Набор изменений контента, готовый к проверке и публикации.</p>
                    </div>
                    <div className={styles['save-state']} aria-live="polite">
                        {
                            {
                                idle: '',
                                local: 'Локальная копия обновлена',
                                saving: 'Сохраняем на сервере…',
                                saved: `Сохранено ${new Date(server.updatedAt).toLocaleTimeString('ru-RU')}`,
                                conflict: 'Конфликт версий',
                            }[saveStatus]
                        }
                    </div>
                </header>
                <ol className={styles.steps}>
                    <li className={server.status === 'draft' ? styles.current : ''}>
                        <b>1</b> Состав
                    </li>
                    <li className={server.status === 'ready' ? styles.current : ''}>
                        <b>2</b> Проверка
                    </li>
                    <li className={server.status === 'published' ? styles.current : ''}>
                        <b>3</b> Публикация
                    </li>
                </ol>
                {error && (
                    <p className={styles.error} role="alert">
                        {error}
                    </p>
                )}
                {saveStatus === 'conflict' && (
                    <section className={styles.conflict} role="alert">
                        <h2>Черновик изменён на сервере</h2>
                        <p>Локальная копия сохранена. Выберите, какую версию продолжить.</p>
                        <div>
                            <button className="button outline" onClick={() => void loadServerVersion()}>
                                Загрузить серверную
                            </button>
                            <button
                                className="button outline"
                                onClick={() => {
                                    setBaseVersion(server.version);
                                    setSaveStatus('local');
                                }}
                            >
                                Применить локальную поверх новой
                            </button>
                        </div>
                    </section>
                )}
                <div className={styles.composition}>
                    <section>
                        <div className={styles['section-heading']}>
                            <div>
                                <h2>Состав релиза</h2>
                                <p>Можно менять до проверки. Публикация применит весь набор атомарно.</p>
                            </div>
                        </div>
                        <details className={styles.bucket} open>
                            <summary>
                                <img src="/assets/achievements/medal-gold-chef.png" width="36" height="36" alt="" />
                                <strong>
                                    Достижения · {changes.filter((item) => item.entityType === 'achievement').length}
                                </strong>
                                <small>
                                    {changes.filter((item) => item.entityType === 'achievement').length} изменений
                                </small>
                            </summary>
                            <div className={styles['bucket-body']}>
                                {changes
                                    .filter(
                                        (item): item is Extract<ReleaseChange, { entityType: 'achievement' }> =>
                                            item.entityType === 'achievement',
                                    )
                                    .map((change) => (
                                        <article className={styles['change-row']} key={change.entityId}>
                                            <span className={styles.icon}>
                                                <img
                                                    src={achievementIconUrl(change.achievement.icon)}
                                                    width="48"
                                                    height="48"
                                                    alt=""
                                                />
                                            </span>
                                            <div className={styles['change-copy']}>
                                                <strong>{change.achievement.title}</strong>
                                                <p>{change.achievement.description}</p>
                                            </div>
                                            <button
                                                className="button outline"
                                                disabled={server.status === 'published'}
                                                onClick={() =>
                                                    setChanges((items) => items.filter((item) => item !== change))
                                                }
                                            >
                                                Убрать
                                            </button>
                                        </article>
                                    ))}
                                <label>
                                    Добавить из каталога
                                    <select
                                        value=""
                                        disabled={server.status === 'published'}
                                        onChange={(event) => addAchievement(event.target.value)}
                                    >
                                        <option value="">Выберите достижение</option>
                                        {workspace.data?.achievements
                                            .filter((item) => !stagedIds.has(item.id))
                                            .map((item) => (
                                                <option key={item.id} value={item.id}>
                                                    {groupLabels[item.group]} · {item.title}
                                                </option>
                                            ))}
                                    </select>
                                </label>
                            </div>
                        </details>
                        <details className={styles.bucket}>
                            <summary>
                                <img src="/assets/achievements/medal-silver-dialog.png" width="36" height="36" alt="" />
                                <strong>
                                    Звания репутации ·{' '}
                                    {changes.some((item) => item.entityType === 'reputation') ? 10 : 0}
                                </strong>
                                <small>
                                    {changes.some((item) => item.entityType === 'reputation')
                                        ? '10 изменений'
                                        : 'Без изменений'}
                                </small>
                            </summary>
                            <div className={styles['bucket-body']}>
                                <p>В релиз попадёт полная шкала из 10 званий.</p>
                                <button
                                    className="button outline"
                                    disabled={
                                        server.status === 'published' ||
                                        changes.some((item) => item.entityType === 'reputation')
                                    }
                                    onClick={() =>
                                        setChanges((items) => [
                                            ...items,
                                            {
                                                entityType: 'reputation',
                                                entityId: '00000040-0000-4000-8000-000000000001',
                                                label: 'Шкала репутации',
                                                changeType: 'update',
                                                ranks: workspace.data!.ranks,
                                            },
                                        ])
                                    }
                                >
                                    Добавить актуальную шкалу
                                </button>
                            </div>
                        </details>
                        <details className={styles.bucket}>
                            <summary>
                                <img src="/assets/achievements/food-020.png" width="36" height="36" alt="" />
                                <strong>
                                    Описания продуктов ·{' '}
                                    {changes.filter((item) => item.entityType === 'product_description').length}
                                </strong>
                                <small>
                                    {changes.filter((item) => item.entityType === 'product_description').length}{' '}
                                    изменений
                                </small>
                            </summary>
                            <div className={styles['bucket-body']}>
                                {changes
                                    .filter((item) => item.entityType === 'product_description')
                                    .map((item) => (
                                        <article className={styles['change-row']} key={item.entityId}>
                                            <div className={styles['change-copy']}>
                                                <strong>{item.label}</strong>
                                                <p>{item.summary}</p>
                                            </div>
                                            <button
                                                className="button outline"
                                                onClick={() =>
                                                    setChanges((all) => all.filter((value) => value !== item))
                                                }
                                            >
                                                Убрать
                                            </button>
                                        </article>
                                    ))}
                                <label>
                                    Продукт
                                    <select
                                        value={productId}
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            setProductId(value);
                                            setProductDescription(
                                                workspace.data?.products.find((item) => item.id === value)
                                                    ?.description ?? '',
                                            );
                                        }}
                                    >
                                        <option value="">Выберите продукт</option>
                                        {workspace.data?.products.map((item) => (
                                            <option key={item.id} value={item.id}>
                                                {item.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    Описание
                                    <textarea
                                        value={productDescription}
                                        onChange={(event) => setProductDescription(event.target.value)}
                                    />
                                </label>
                                <button
                                    className="button outline"
                                    disabled={!productId || !productDescription.trim()}
                                    onClick={addProduct}
                                >
                                    Добавить изменение
                                </button>
                            </div>
                        </details>
                        <details className={styles.bucket}>
                            <summary>
                                <img src="/assets/achievements/document.png" width="36" height="36" alt="" />
                                <strong>
                                    Контентные документы ·{' '}
                                    {changes.filter((item) => item.entityType === 'content_document').length}
                                </strong>
                                <small>
                                    {changes.filter((item) => item.entityType === 'content_document').length} изменений
                                </small>
                            </summary>
                            <div className={styles['bucket-body']}>
                                {changes
                                    .filter(
                                        (item): item is Extract<ReleaseChange, { entityType: 'content_document' }> =>
                                            item.entityType === 'content_document',
                                    )
                                    .map((item) => (
                                        <article className={styles['change-row']} key={item.resourceKey}>
                                            <div className={styles['change-copy']}>
                                                <strong>{item.label}</strong>
                                                <p>
                                                    {item.changeType === 'retire' ? 'Снять' : 'Записать'} ·{' '}
                                                    {namespaceLabels[item.document.namespace]} · {item.document.locale}{' '}
                                                    · {item.resourceKey}
                                                </p>
                                                <p>
                                                    Было:{' '}
                                                    {workspace.data?.contentDocuments.find(
                                                        (source) => source.key === item.resourceKey,
                                                    )?.value.title ?? 'новый ресурс'}{' '}
                                                    → Станет:{' '}
                                                    {item.changeType === 'retire' ? 'снят' : item.document.title} · v
                                                    {item.expectedVersion}
                                                </p>
                                                <p>
                                                    {item.changeType === 'retire'
                                                        ? 'Diff: ресурс будет снят'
                                                        : `Diff: ${changedFields(
                                                              workspace.data?.contentDocuments.find(
                                                                  (source) => source.key === item.resourceKey,
                                                              )?.value,
                                                              item.document,
                                                          ).join(', ')}`}
                                                </p>
                                            </div>
                                            <button
                                                className="button outline"
                                                disabled={server.status === 'published'}
                                                onClick={() =>
                                                    setChanges((all) => all.filter((value) => value !== item))
                                                }
                                            >
                                                Убрать
                                            </button>
                                        </article>
                                    ))}
                                <div className={styles['editor-grid']}>
                                    <label className={styles['wide-field']}>
                                        Ключ документа
                                        <input
                                            list="content-document-keys"
                                            value={documentKey}
                                            disabled={server.status === 'published'}
                                            onChange={(event) => selectDocument(event.target.value)}
                                            placeholder="help:ru-RU:sample-page"
                                        />
                                        <datalist id="content-document-keys">
                                            {workspace.data?.contentDocuments.map((item) => (
                                                <option key={item.key} value={item.key}>
                                                    {item.value.title}
                                                    {item.retired ? ' · снят' : ''}
                                                </option>
                                            ))}
                                        </datalist>
                                    </label>
                                    <label>
                                        Раздел
                                        <select
                                            value={documentDraft.namespace}
                                            disabled={server.status === 'published'}
                                            onChange={(event) =>
                                                setDocumentDraft(
                                                    blankDocument(
                                                        event.target.value as ContentDocument['namespace'],
                                                        documentDraft,
                                                    ),
                                                )
                                            }
                                        >
                                            {Object.entries(namespaceLabels).map(([value, label]) => (
                                                <option value={value} key={value}>
                                                    {label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        Локаль
                                        <input
                                            value={documentDraft.locale}
                                            pattern="[a-z]{2}(-[A-Z]{2})?"
                                            disabled={server.status === 'published'}
                                            onChange={(event) =>
                                                setDocumentDraft({ ...documentDraft, locale: event.target.value })
                                            }
                                        />
                                    </label>
                                    <label className={styles['wide-field']}>
                                        Заголовок
                                        <input
                                            value={documentDraft.title}
                                            maxLength={160}
                                            disabled={server.status === 'published'}
                                            onChange={(event) =>
                                                setDocumentDraft({ ...documentDraft, title: event.target.value })
                                            }
                                        />
                                    </label>
                                    {documentDraft.namespace === 'help' && (
                                        <>
                                            <label>
                                                Slug
                                                <input
                                                    value={documentDraft.metadata.slug}
                                                    disabled={server.status === 'published'}
                                                    onChange={(event) =>
                                                        setDocumentDraft({
                                                            ...documentDraft,
                                                            metadata: {
                                                                ...documentDraft.metadata,
                                                                slug: event.target.value,
                                                            },
                                                        })
                                                    }
                                                />
                                            </label>
                                            <label>
                                                Аудитория
                                                <select
                                                    value={documentDraft.metadata.audience}
                                                    disabled={server.status === 'published'}
                                                    onChange={(event) =>
                                                        setDocumentDraft({
                                                            ...documentDraft,
                                                            metadata: {
                                                                ...documentDraft.metadata,
                                                                audience: event.target.value as
                                                                    'all' | 'user' | 'admin',
                                                            },
                                                        })
                                                    }
                                                >
                                                    <option value="all">Все</option>
                                                    <option value="user">Пользователи</option>
                                                    <option value="admin">Администраторы</option>
                                                </select>
                                            </label>
                                        </>
                                    )}
                                    {documentDraft.namespace === 'pricing' && (
                                        <>
                                            <label>
                                                Тариф
                                                <select
                                                    value={documentDraft.metadata.plan}
                                                    disabled={server.status === 'published'}
                                                    onChange={(event) =>
                                                        setDocumentDraft({
                                                            ...documentDraft,
                                                            metadata: {
                                                                ...documentDraft.metadata,
                                                                plan: event.target.value as 'free' | 'plus',
                                                            },
                                                        })
                                                    }
                                                >
                                                    <option value="free">Free</option>
                                                    <option value="plus">Plus</option>
                                                </select>
                                            </label>
                                            <label>
                                                Период оплаты
                                                <select
                                                    value={documentDraft.metadata.billingPeriod}
                                                    disabled={server.status === 'published'}
                                                    onChange={(event) =>
                                                        setDocumentDraft({
                                                            ...documentDraft,
                                                            metadata: {
                                                                ...documentDraft.metadata,
                                                                billingPeriod: event.target.value as
                                                                    'none' | 'month' | 'year',
                                                            },
                                                        })
                                                    }
                                                >
                                                    <option value="none">Без периода</option>
                                                    <option value="month">Месяц</option>
                                                    <option value="year">Год</option>
                                                </select>
                                            </label>
                                        </>
                                    )}
                                    {documentDraft.namespace === 'onboarding' && (
                                        <>
                                            <label>
                                                Flow
                                                <input
                                                    value={documentDraft.metadata.flow}
                                                    disabled={server.status === 'published'}
                                                    onChange={(event) =>
                                                        setDocumentDraft({
                                                            ...documentDraft,
                                                            metadata: {
                                                                ...documentDraft.metadata,
                                                                flow: event.target.value,
                                                            },
                                                        })
                                                    }
                                                />
                                            </label>
                                            <label>
                                                Шаг
                                                <input
                                                    type="number"
                                                    min={1}
                                                    step={1}
                                                    value={documentDraft.metadata.step}
                                                    disabled={server.status === 'published'}
                                                    onChange={(event) =>
                                                        setDocumentDraft({
                                                            ...documentDraft,
                                                            metadata: {
                                                                ...documentDraft.metadata,
                                                                step: Math.max(
                                                                    1,
                                                                    Math.trunc(Number(event.target.value)),
                                                                ),
                                                            },
                                                        })
                                                    }
                                                />
                                            </label>
                                        </>
                                    )}
                                    {documentDraft.namespace === 'notification_template' && (
                                        <>
                                            <label>
                                                Канал
                                                <select
                                                    value={documentDraft.metadata.channel}
                                                    disabled={server.status === 'published'}
                                                    onChange={(event) =>
                                                        setDocumentDraft({
                                                            ...documentDraft,
                                                            metadata: {
                                                                ...documentDraft.metadata,
                                                                channel: event.target.value as
                                                                    'in_app' | 'email' | 'push',
                                                            },
                                                        })
                                                    }
                                                >
                                                    <option value="in_app">In-app</option>
                                                    <option value="email">Email</option>
                                                    <option value="push">Push</option>
                                                </select>
                                            </label>
                                            <label>
                                                Ключ шаблона
                                                <input
                                                    value={documentDraft.metadata.templateKey}
                                                    disabled={server.status === 'published'}
                                                    onChange={(event) =>
                                                        setDocumentDraft({
                                                            ...documentDraft,
                                                            metadata: {
                                                                ...documentDraft.metadata,
                                                                templateKey: event.target.value,
                                                            },
                                                        })
                                                    }
                                                />
                                            </label>
                                            <label className={styles['wide-field']}>
                                                Переменные через запятую
                                                <input
                                                    value={documentDraft.metadata.variables.join(', ')}
                                                    disabled={server.status === 'published'}
                                                    onChange={(event) =>
                                                        setDocumentDraft({
                                                            ...documentDraft,
                                                            metadata: {
                                                                ...documentDraft.metadata,
                                                                variables: event.target.value
                                                                    .split(',')
                                                                    .map((value) => value.trim())
                                                                    .filter(Boolean),
                                                            },
                                                        })
                                                    }
                                                />
                                            </label>
                                        </>
                                    )}
                                    {documentDraft.namespace === 'feature_copy' && (
                                        <>
                                            <label>
                                                Ключ функции
                                                <input
                                                    value={documentDraft.metadata.featureKey}
                                                    disabled={server.status === 'published'}
                                                    onChange={(event) =>
                                                        setDocumentDraft({
                                                            ...documentDraft,
                                                            metadata: {
                                                                ...documentDraft.metadata,
                                                                featureKey: event.target.value,
                                                            },
                                                        })
                                                    }
                                                />
                                            </label>
                                            <label>
                                                Размещение
                                                <input
                                                    value={documentDraft.metadata.placement}
                                                    disabled={server.status === 'published'}
                                                    onChange={(event) =>
                                                        setDocumentDraft({
                                                            ...documentDraft,
                                                            metadata: {
                                                                ...documentDraft.metadata,
                                                                placement: event.target.value,
                                                            },
                                                        })
                                                    }
                                                />
                                            </label>
                                        </>
                                    )}
                                    <label className={styles['wide-field']}>
                                        Текст документа
                                        <textarea
                                            value={documentDraft.body}
                                            maxLength={200000}
                                            disabled={server.status === 'published'}
                                            onChange={(event) =>
                                                setDocumentDraft({ ...documentDraft, body: event.target.value })
                                            }
                                        />
                                    </label>
                                </div>
                                <div className={styles['conflict-actions']}>
                                    <button
                                        className="button outline"
                                        disabled={
                                            server.status === 'published' ||
                                            !documentKey.trim() ||
                                            !documentDraft.title.trim() ||
                                            !documentDraft.body.trim()
                                        }
                                        onClick={() => stageDocument()}
                                    >
                                        Добавить изменение
                                    </button>
                                    <button
                                        className="button outline"
                                        disabled={
                                            server.status === 'published' ||
                                            !workspace.data?.contentDocuments.some(
                                                (item) => item.key === documentKey && !item.retired,
                                            )
                                        }
                                        onClick={() => stageDocument('retire')}
                                    >
                                        Снять через релиз
                                    </button>
                                </div>
                            </div>
                        </details>
                        <details className={styles.bucket}>
                            <summary>
                                <img src="/assets/achievements/food-087.png" width="36" height="36" alt="" />
                                <strong>
                                    Справочники ·{' '}
                                    {changes.filter((item) => item.entityType === 'dictionary_entry').length}
                                </strong>
                                <small>
                                    {changes.filter((item) => item.entityType === 'dictionary_entry').length} изменений
                                </small>
                            </summary>
                            <div className={styles['bucket-body']}>
                                {changes
                                    .filter(
                                        (item): item is Extract<ReleaseChange, { entityType: 'dictionary_entry' }> =>
                                            item.entityType === 'dictionary_entry',
                                    )
                                    .map((item) => (
                                        <article className={styles['change-row']} key={item.resourceKey}>
                                            <span className={styles.icon}>
                                                <img
                                                    src={achievementIconUrl(item.entry.icon)}
                                                    width="48"
                                                    height="48"
                                                    alt=""
                                                />
                                            </span>
                                            <div className={styles['change-copy']}>
                                                <strong>{item.entry.label}</strong>
                                                <p>
                                                    {item.changeType === 'retire' ? 'Снять' : 'Записать'} ·{' '}
                                                    {dictionaryLabels[item.entry.dictionary]} · {item.resourceKey}
                                                </p>
                                                <p>
                                                    Было:{' '}
                                                    {workspace.data?.dictionaryEntries.find(
                                                        (source) => source.key === item.resourceKey,
                                                    )?.value.label ?? 'новый ресурс'}{' '}
                                                    → Станет:{' '}
                                                    {item.changeType === 'retire' ? 'снята' : item.entry.label} · v
                                                    {item.expectedVersion}
                                                </p>
                                                <p>
                                                    {item.changeType === 'retire'
                                                        ? 'Diff: запись будет снята'
                                                        : `Diff: ${changedFields(
                                                              workspace.data?.dictionaryEntries.find(
                                                                  (source) => source.key === item.resourceKey,
                                                              )?.value,
                                                              item.entry,
                                                          ).join(', ')}`}
                                                </p>
                                            </div>
                                            <button
                                                className="button outline"
                                                disabled={server.status === 'published'}
                                                onClick={() =>
                                                    setChanges((all) => all.filter((value) => value !== item))
                                                }
                                            >
                                                Убрать
                                            </button>
                                        </article>
                                    ))}
                                <div className={styles['editor-grid']}>
                                    <label className={styles['wide-field']}>
                                        Ключ записи
                                        <input
                                            list="dictionary-entry-keys"
                                            value={dictionaryKey}
                                            disabled={server.status === 'published'}
                                            onChange={(event) => selectDictionaryEntry(event.target.value)}
                                            placeholder="category:sample"
                                        />
                                        <datalist id="dictionary-entry-keys">
                                            {workspace.data?.dictionaryEntries.map((item) => (
                                                <option key={item.key} value={item.key}>
                                                    {item.value.label}
                                                    {item.retired ? ' · снята' : ''}
                                                </option>
                                            ))}
                                        </datalist>
                                    </label>
                                    <label>
                                        Справочник
                                        <select
                                            value={dictionaryDraft.dictionary}
                                            disabled={server.status === 'published'}
                                            onChange={(event) =>
                                                setDictionaryDraft({
                                                    ...dictionaryDraft,
                                                    dictionary: event.target.value as DictionaryEntry['dictionary'],
                                                })
                                            }
                                        >
                                            {Object.entries(dictionaryLabels).map(([value, label]) => (
                                                <option key={value} value={value}>
                                                    {label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        Код
                                        <input
                                            value={dictionaryDraft.code}
                                            maxLength={120}
                                            pattern="[a-z0-9]+([._-][a-z0-9]+)*"
                                            disabled={server.status === 'published'}
                                            onChange={(event) =>
                                                setDictionaryDraft({ ...dictionaryDraft, code: event.target.value })
                                            }
                                        />
                                    </label>
                                    <label>
                                        Название
                                        <input
                                            value={dictionaryDraft.label}
                                            maxLength={160}
                                            disabled={server.status === 'published'}
                                            onChange={(event) =>
                                                setDictionaryDraft({ ...dictionaryDraft, label: event.target.value })
                                            }
                                        />
                                    </label>
                                    <label>
                                        Порядок
                                        <input
                                            type="number"
                                            min={0}
                                            max={1000000}
                                            step={1}
                                            value={dictionaryDraft.sortOrder}
                                            disabled={server.status === 'published'}
                                            onChange={(event) =>
                                                setDictionaryDraft({
                                                    ...dictionaryDraft,
                                                    sortOrder: Math.max(0, Math.trunc(Number(event.target.value))),
                                                })
                                            }
                                        />
                                    </label>
                                    <label className={styles['wide-field']}>
                                        Описание
                                        <textarea
                                            value={dictionaryDraft.description ?? ''}
                                            maxLength={2000}
                                            disabled={server.status === 'published'}
                                            onChange={(event) =>
                                                setDictionaryDraft({
                                                    ...dictionaryDraft,
                                                    description: event.target.value || null,
                                                })
                                            }
                                        />
                                    </label>
                                    <label>
                                        Fallback-иконка
                                        <input
                                            value={dictionaryDraft.icon.fallbackKey}
                                            maxLength={80}
                                            disabled={server.status === 'published'}
                                            onChange={(event) =>
                                                setDictionaryDraft({
                                                    ...dictionaryDraft,
                                                    icon: {
                                                        ...dictionaryDraft.icon,
                                                        fallbackKey: event.target.value,
                                                    },
                                                })
                                            }
                                        />
                                    </label>
                                    <label>
                                        Alt иконки
                                        <input
                                            value={dictionaryDraft.icon.alt}
                                            maxLength={200}
                                            disabled={server.status === 'published'}
                                            onChange={(event) =>
                                                setDictionaryDraft({
                                                    ...dictionaryDraft,
                                                    icon: { ...dictionaryDraft.icon, alt: event.target.value },
                                                })
                                            }
                                        />
                                    </label>
                                    <div className={styles['icon-preview']}>
                                        <img
                                            src={dictionaryIconPreview || achievementIconUrl(dictionaryDraft.icon)}
                                            width="64"
                                            height="64"
                                            alt={`Предпросмотр: ${dictionaryDraft.icon.alt}`}
                                        />
                                        <label className="button outline">
                                            Предпросмотр PNG/WebP
                                            <input
                                                className={styles['file-input']}
                                                type="file"
                                                accept="image/png,image/webp"
                                                disabled={
                                                    server.status === 'published' ||
                                                    !(import.meta.env.DEV && import.meta.env.VITE_API_MODE === 'mock')
                                                }
                                                onChange={previewDictionaryIcon}
                                            />
                                        </label>
                                        <small className={styles['icon-preview-note']}>
                                            {import.meta.env.DEV && import.meta.env.VITE_API_MODE === 'mock'
                                                ? 'Файл используется только для локального предпросмотра.'
                                                : 'Upload недоступен до подключения storage и scanner.'}
                                        </small>
                                    </div>
                                    <label className={styles['toggle-field']}>
                                        <input
                                            className={styles['toggle-control']}
                                            type="checkbox"
                                            checked={dictionaryDraft.enabled}
                                            disabled={server.status === 'published'}
                                            onChange={(event) =>
                                                setDictionaryDraft({
                                                    ...dictionaryDraft,
                                                    enabled: event.target.checked,
                                                })
                                            }
                                        />
                                        Запись включена
                                    </label>
                                </div>
                                <div className={styles['conflict-actions']}>
                                    <button
                                        className="button outline"
                                        disabled={
                                            server.status === 'published' ||
                                            !dictionaryKey.trim() ||
                                            !dictionaryDraft.code ||
                                            !dictionaryDraft.label.trim()
                                        }
                                        onClick={() => stageDictionaryEntry()}
                                    >
                                        Добавить изменение
                                    </button>
                                    <button
                                        className="button outline"
                                        disabled={
                                            server.status === 'published' ||
                                            !workspace.data?.dictionaryEntries.some(
                                                (item) => item.key === dictionaryKey && !item.retired,
                                            )
                                        }
                                        onClick={() => stageDictionaryEntry('retire')}
                                    >
                                        Снять через релиз
                                    </button>
                                </div>
                            </div>
                        </details>
                        <details className={styles.bucket}>
                            <summary>
                                <img src="/assets/achievements/document.png" width="36" height="36" alt="" />
                                <strong>
                                    Юридические тексты ·{' '}
                                    {changes.filter((item) => item.entityType === 'legal_text').length}
                                </strong>
                                <small>
                                    {changes.filter((item) => item.entityType === 'legal_text').length} изменений
                                </small>
                            </summary>
                            <div className={styles['bucket-body']}>
                                {changes
                                    .filter((item) => item.entityType === 'legal_text')
                                    .map((item) => (
                                        <article className={styles['change-row']} key={item.entityId}>
                                            <div className={styles['change-copy']}>
                                                <strong>{item.label}</strong>
                                                <p>Вступает {new Date(item.effectiveAt).toLocaleString('ru-RU')}</p>
                                            </div>
                                            <button
                                                className="button outline"
                                                onClick={() =>
                                                    setChanges((all) => all.filter((value) => value !== item))
                                                }
                                            >
                                                Убрать
                                            </button>
                                        </article>
                                    ))}
                                <label>
                                    Тип документа
                                    <input
                                        list="legal-source-keys"
                                        value={legalKey}
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            setLegalKey(value);
                                            const source = workspace.data?.legalTexts.find(
                                                (item) => item.key === value,
                                            );
                                            setLegalContent(source?.content ?? '');
                                        }}
                                    />
                                    <datalist id="legal-source-keys">
                                        {workspace.data?.legalTexts.map((item) => (
                                            <option key={item.key} value={item.key} />
                                        ))}
                                    </datalist>
                                </label>
                                <label>
                                    Текст
                                    <textarea
                                        value={legalContent}
                                        onChange={(event) => setLegalContent(event.target.value)}
                                    />
                                </label>
                                <label>
                                    Дата вступления (локальное время администратора)
                                    <input
                                        type="datetime-local"
                                        value={legalEffectiveAt}
                                        onChange={(event) => setLegalEffectiveAt(event.target.value)}
                                    />
                                </label>
                                {legalEffectiveAt && (
                                    <p className={styles.muted}>
                                        Будет сохранено в UTC: {new Date(legalEffectiveAt).toISOString()}
                                    </p>
                                )}
                                <button
                                    className="button outline"
                                    disabled={!legalKey.trim() || !legalContent.trim() || !legalEffectiveAt}
                                    onClick={addLegal}
                                >
                                    Добавить изменение
                                </button>
                            </div>
                        </details>
                    </section>
                    <aside className={styles['sidebar-card']}>
                        <h2>Итоги релиза</h2>
                        <Summary release={{ ...server, changes }} />
                        <hr />
                        <button
                            className="button outline"
                            disabled={dirty || !!pendingAction || server.status === 'published'}
                            onClick={() => void action('validate')}
                        >
                            {pendingAction === 'validate' ? 'Проверяем…' : 'Проверить релиз'}
                        </button>
                        {server.validation.errors.map((item) => (
                            <p className={styles.error} key={item}>
                                ● {item}
                            </p>
                        ))}
                        {server.validation.warnings.map((item) => (
                            <p className={styles.warning} key={item}>
                                ▲ {item}
                            </p>
                        ))}
                        {server.status === 'ready' && (
                            <>
                                <CriticalConfirmation />
                                <button
                                    className="button primary"
                                    disabled={dirty || !!pendingAction}
                                    onClick={() => void action('publish')}
                                >
                                    {pendingAction === 'publish' ? 'Публикуем…' : 'Опубликовать релиз'}
                                </button>
                            </>
                        )}
                        {server.status === 'published' && (
                            <>
                                <CriticalConfirmation />
                                <button
                                    className="button outline"
                                    disabled={!!pendingAction}
                                    onClick={() => void action('rollback')}
                                >
                                    {pendingAction === 'rollback' ? 'Откатываем…' : 'Откатить в черновик'}
                                </button>
                                <button
                                    className="button outline"
                                    disabled={!!pendingAction}
                                    onClick={() => void action('reopen')}
                                >
                                    Изменить как новую редакцию
                                </button>
                            </>
                        )}
                        <hr />
                        <h3>История</h3>
                        {server.events.toReversed().map((entry) => (
                            <p key={entry.id} className={styles.event}>
                                {new Date(entry.at).toLocaleString('ru-RU')} · {entry.kind} · v{entry.version}
                            </p>
                        ))}
                    </aside>
                </div>
            </AdminShell>
        </Guard>
    );
}
