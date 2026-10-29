'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useRuntime } from '../../shared/runtime/index.js';
import { ApiError } from '../../shared/api/client.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { useSession } from '../../entities/session/client.js';
import { CriticalReauthDialog } from '../../entities/account-security/client.js';
import styles from './exports.module.css';

type Preview = Success<'POST /api/v1/exports/preview'>['data'];
type Job = Success<'GET /api/v1/exports'>['data']['items'][number];
type Scope = 'private' | 'family';
type Domain = 'personal_data' | 'diary' | 'finance' | 'nutrition' | 'all_pro_data';
type Format = 'csv' | 'pdf' | 'json';

const domainOptions: Array<{ value: Domain; label: string; detail: string; pro: boolean }> = [
    {
        value: 'personal_data',
        label: 'Основные данные',
        detail: 'Аккаунт, запасы, рецепты и другие доступные данные',
        pro: false,
    },
    { value: 'diary', label: 'Дневник', detail: 'Записи дневника и порции', pro: true },
    { value: 'finance', label: 'Финансы', detail: 'Расходы, бюджеты, цены и чеки', pro: true },
    { value: 'nutrition', label: 'Питание', detail: 'Профиль, цели и КБЖУ', pro: true },
    {
        value: 'all_pro_data',
        label: 'Все данные Pro',
        detail: 'Дневник, финансы и питание в одном manifest',
        pro: true,
    },
];

const domainLabels: Record<Domain, string> = Object.fromEntries(
    domainOptions.map((option) => [option.value, option.label]),
) as Record<Domain, string>;

const statusLabels: Record<Job['status'], string> = {
    queued: 'В очереди',
    processing: 'Подготавливаем',
    ready: 'Готов к скачиванию',
    failed: 'Не удалось подготовить',
    expired: 'Срок скачивания истёк',
};

const dateTime = (value: string | null) =>
    value ? new Date(value).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }) : 'Не указано';

const period = (job: Job) => {
    const { startsOn, endsOn } = job.manifest.selection;
    if (!startsOn && !endsOn) return 'Весь доступный период';
    return `${startsOn ?? 'с начала'} — ${endsOn ?? 'по текущую дату'}`;
};

function HistoryCard({ job }: { job: Job }) {
    const { api } = useRuntime();
    const [expiredAt, setExpiredAt] = useState<string | null>(null);
    useEffect(() => {
        if (job.status !== 'ready' || !job.expiresAt) return;
        const remaining = Date.parse(job.expiresAt) - Date.now();
        const currentExpiry = job.expiresAt;
        const timer = window.setTimeout(
            () => setExpiredAt(currentExpiry),
            Math.min(Math.max(remaining, 0), 2_147_483_647),
        );
        return () => window.clearTimeout(timer);
    }, [job.expiresAt, job.status]);
    const expiredByClock = job.status === 'ready' && !!job.expiresAt && expiredAt === job.expiresAt;
    const status = expiredByClock ? 'expired' : job.status;
    const download = useMutation({
        mutationFn: async () =>
            (await api!.request('GET /api/v1/exports/{id}/download-content', undefined, undefined, { id: job.id }))
                .data,
        onSuccess: (file) => {
            const url = URL.createObjectURL(new Blob([file.content], { type: file.mediaType }));
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = file.fileName;
            anchor.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 0);
        },
    });
    return (
        <article className={styles.job}>
            <div className={styles['job-heading']}>
                <div>
                    <p className={styles.eyebrow}>
                        {job.manifest.selection.scope === 'family' ? 'Семейный' : 'Личный'} экспорт ·{' '}
                        {job.manifest.selection.format.toUpperCase()}
                    </p>
                    <h3>{domainLabels[job.manifest.selection.domain]}</h3>
                </div>
                <span className={`${styles.status} ${styles[status]}`}>{statusLabels[status]}</span>
            </div>
            <dl>
                <div>
                    <dt>Запрошен</dt>
                    <dd>{dateTime(job.requestedAt)}</dd>
                </div>
                <div>
                    <dt>Период</dt>
                    <dd>{period(job)}</dd>
                </div>
                <div>
                    <dt>Скачать до</dt>
                    <dd>{status === 'ready' ? dateTime(job.expiresAt) : 'Недоступно'}</dd>
                </div>
            </dl>
            {(status === 'queued' || status === 'processing') && (
                <p className={styles.muted}>Файл ещё не готов. Статус обновится автоматически.</p>
            )}
            {status === 'expired' && (
                <>
                    <p className={styles.muted}>
                        Файл удалён, но история запроса сохранена. Новая job требует повторной проверки состава.
                    </p>
                    <a className="button outline" href="#new-export-title">
                        Проверить состав заново
                    </a>
                </>
            )}
            {status === 'failed' && (
                <p role="alert">
                    {job.failureCode === 'storage_unavailable'
                        ? 'Защищённое хранилище ещё не подключено. Состав сохранён, но файл не создан.'
                        : job.failureCode === 'access_revoked'
                          ? 'Доступ изменился до сборки файла. Чужие или более недоступные данные не выданы.'
                          : 'Подготовка подтверждённо завершилась ошибкой. Создайте новый запрос после проверки.'}
                </p>
            )}
            {download.isError && (
                <p role="alert">
                    {download.error instanceof ApiError && download.error.status === 503
                        ? 'Защищённое скачивание пока недоступно.'
                        : 'Не удалось скачать файл. Обновите статус и повторите попытку.'}
                </p>
            )}
            <button
                className="button outline"
                disabled={status !== 'ready' || download.isPending}
                onClick={() => {
                    if (job.expiresAt && Date.parse(job.expiresAt) <= Date.now()) {
                        setExpiredAt(job.expiresAt);
                        return;
                    }
                    download.mutate();
                }}
            >
                {download.isPending ? 'Готовим скачивание…' : `Скачать ${job.manifest.selection.format.toUpperCase()}`}
            </button>
        </article>
    );
}

function ExportHistory() {
    const { api } = useRuntime();
    const session = useSession('user');
    const history = useInfiniteQuery({
        queryKey: ['exports', session.data?.id],
        enabled: !!api && !!session.data,
        initialPageParam: null as string | null,
        queryFn: async ({ pageParam, signal }) =>
            (
                await api!.request('GET /api/v1/exports', undefined, signal, undefined, {
                    query: { limit: '20', ...(pageParam ? { cursor: pageParam } : {}) },
                })
            ).data,
        getNextPageParam: (page) => page.nextCursor ?? undefined,
        refetchInterval: (query) => {
            const pages = query.state.data?.pages ?? [];
            return pages.some((page) =>
                page.items.some((job) => job.status === 'queued' || job.status === 'processing'),
            )
                ? 1000
                : false;
        },
    });
    const items = history.data?.pages.flatMap((page) => page.items) ?? [];
    return (
        <section className={styles.history} aria-labelledby="export-history-title">
            <div className={styles['section-heading']}>
                <h2 id="export-history-title">Мои экспорты</h2>
                <button className="button outline" disabled={history.isFetching} onClick={() => void history.refetch()}>
                    Проверить статус
                </button>
            </div>
            {history.isPending && <p role="status">Загружаем историю…</p>}
            {history.isError && !history.data && (
                <div className={styles.state} role="alert">
                    <p>Не удалось загрузить историю. Это не означает, что запросов нет.</p>
                    <button className="button outline" onClick={() => void history.refetch()}>
                        Повторить
                    </button>
                </div>
            )}
            {history.isSuccess && items.length === 0 && (
                <p className={styles.muted}>Вы ещё не создавали доступных экспортов.</p>
            )}
            <div className={styles.jobs}>
                {items.map((job) => (
                    <HistoryCard key={job.id} job={job} />
                ))}
            </div>
            {history.isFetchNextPageError && <p role="alert">Не удалось загрузить следующую часть истории.</p>}
            {history.hasNextPage && (
                <button
                    className="button outline"
                    disabled={history.isFetchingNextPage}
                    onClick={() => void history.fetchNextPage()}
                >
                    {history.isFetchingNextPage ? 'Загружаем…' : 'Показать ещё'}
                </button>
            )}
        </section>
    );
}

function ExportComposer() {
    const { api, queryClient } = useRuntime();
    const search = useSearchParams();
    const session = useSession('user');
    const [scope, setScope] = useState<Scope>(search.get('scope') === 'family' ? 'family' : 'private');
    const requestedDomain = search.get('domain');
    const [domain, setDomain] = useState<Domain>(
        domainOptions.some((option) => option.value === requestedDomain)
            ? (requestedDomain as Domain)
            : 'personal_data',
    );
    const requestedFormat = search.get('format');
    const [format, setFormat] = useState<Format>(
        requestedFormat === 'csv' || requestedFormat === 'pdf' || requestedFormat === 'json' ? requestedFormat : 'json',
    );
    const [startsOn, setStartsOn] = useState('');
    const [endsOn, setEndsOn] = useState('');
    const [preview, setPreview] = useState<Preview | null>(null);
    const [reauthOpen, setReauthOpen] = useState(false);
    const idempotencyKey = useRef<string | null>(null);
    const resetPreview = () => {
        setPreview(null);
        idempotencyKey.current = null;
    };
    const review = useMutation({
        mutationFn: async () =>
            (
                await api!.request('POST /api/v1/exports/preview', {
                    scope,
                    domain,
                    format,
                    startsOn: startsOn || null,
                    endsOn: endsOn || null,
                })
            ).data,
        onSuccess: (value) => {
            setPreview(value);
            idempotencyKey.current = null;
        },
    });
    const create = useMutation({
        mutationFn: async (reauthToken: string) => {
            idempotencyKey.current ??= crypto.randomUUID();
            return (
                await api!.request('POST /api/v1/exports', {
                    previewId: preview!.previewId,
                    idempotencyKey: idempotencyKey.current,
                    reauthToken,
                })
            ).data.job;
        },
        onSuccess: async () => {
            idempotencyKey.current = null;
            setPreview(null);
            await queryClient.invalidateQueries({ queryKey: ['exports', session.data?.id] });
        },
    });
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        review.mutate();
    };
    return (
        <section className={styles.composer} aria-labelledby="new-export-title">
            <h2 id="new-export-title">Новый экспорт</h2>
            <p className={styles.muted}>Личный экспорт · только доступные вам данные.</p>
            <p role="note">
                Предпросмотр и история запросов работают. До подключения защищённого хранилища job завершится ошибкой
                без создания файла.
            </p>
            <form onSubmit={submit}>
                <fieldset className={styles.choices}>
                    <legend>Какие данные экспортировать?</legend>
                    {domainOptions.map((option) => (
                        <label className={styles.choice} key={option.value}>
                            <input
                                type="radio"
                                name="domain"
                                value={option.value}
                                checked={domain === option.value}
                                onChange={() => {
                                    setDomain(option.value);
                                    if (option.pro) setScope('private');
                                    if (!option.pro) setFormat('json');
                                    resetPreview();
                                }}
                            />
                            <span>
                                <strong>
                                    {option.label}
                                    {option.pro && <small className={styles.pro}>Pro</small>}
                                </strong>
                                <small>{option.detail}</small>
                            </span>
                        </label>
                    ))}
                </fieldset>
                {domain === 'personal_data' && (
                    <fieldset>
                        <legend>Область данных</legend>
                        <label>
                            <input
                                type="radio"
                                name="scope"
                                value="private"
                                checked={scope === 'private'}
                                onChange={() => {
                                    setScope('private');
                                    resetPreview();
                                }}
                            />
                            Личные данные
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="scope"
                                value="family"
                                checked={scope === 'family'}
                                onChange={() => {
                                    setScope('family');
                                    resetPreview();
                                }}
                            />
                            Семейные данные
                        </label>
                    </fieldset>
                )}
                {domain !== 'personal_data' && (
                    <p className={styles.fixed}>
                        <strong>Личный Pro-экспорт</strong>
                        <span>Семейные и чужие приватные данные не включаются.</span>
                    </p>
                )}
                <fieldset className={styles.formats}>
                    <legend>Формат файла</legend>
                    {(['csv', 'pdf', 'json'] as const).map((value) => {
                        const disabled = domain === 'personal_data' && value !== 'json';
                        return (
                            <label key={value}>
                                <input
                                    type="radio"
                                    name="format"
                                    value={value}
                                    checked={format === value}
                                    disabled={disabled}
                                    onChange={() => {
                                        setFormat(value);
                                        resetPreview();
                                    }}
                                />
                                {value.toUpperCase()}
                            </label>
                        );
                    })}
                </fieldset>
                <fieldset className={styles.period}>
                    <legend>Период данных (необязательно)</legend>
                    <label>
                        С даты
                        <input
                            type="date"
                            value={startsOn}
                            onChange={(event) => {
                                setStartsOn(event.target.value);
                                resetPreview();
                            }}
                        />
                    </label>
                    <label>
                        По дату
                        <input
                            type="date"
                            value={endsOn}
                            min={startsOn || undefined}
                            onChange={(event) => {
                                setEndsOn(event.target.value);
                                resetPreview();
                            }}
                        />
                    </label>
                </fieldset>
                {review.isError && <p role="alert">Не удалось проверить состав. Повторите запрос.</p>}
                <button className="button" disabled={review.isPending || !api} type="submit">
                    {review.isPending ? 'Проверяем…' : 'Проверить состав'}
                </button>
            </form>

            {preview && (
                <div className={styles.preview}>
                    <div className={styles['section-heading']}>
                        <h3>Состав экспорта</h3>
                        <span>Проверен до {dateTime(preview.expiresAt)}</span>
                    </div>
                    {preview.manifest && preview.manifest.sections.length > 0 && (
                        <ul>
                            {preview.manifest.sections.map((section) => (
                                <li key={section.code}>
                                    <strong>{section.label}</strong>
                                    <span>{section.detail}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                    {preview.manifest?.proAccess && (
                        <p className={styles.muted}>
                            Pro-доступ проверен. Данные включаются по{' '}
                            {new Date(`${preview.manifest.proAccess.dataThrough}T00:00:00`).toLocaleDateString('ru-RU')}
                            .
                        </p>
                    )}
                    {preview.blockers.map((blocker) => (
                        <div className={styles.blocker} role="status" key={blocker.code}>
                            <strong>Создание недоступно</strong>
                            <span>{blocker.message}</span>
                            {blocker.code === 'family_membership_required' && <Link href="/support">В поддержку</Link>}
                            {blocker.code === 'active_pro_required' && <Link href="/pricing">Перейти к тарифам</Link>}
                        </div>
                    ))}
                    {create.isError && (
                        <div className={styles.blocker} role="alert">
                            <strong>Результат создания не подтверждён</strong>
                            <span>
                                {create.error instanceof ApiError && create.error.status === 503
                                    ? 'Сервис защищённого экспорта пока не подключён.'
                                    : 'Сначала проверьте историю. Повтор использует тот же ключ запроса и не создаст дубль.'}
                            </span>
                        </div>
                    )}
                    <button
                        className="button"
                        disabled={!preview.canCreate || create.isPending}
                        onClick={() => setReauthOpen(true)}
                    >
                        {create.isPending ? 'Создаём…' : 'Создать экспорт'}
                    </button>
                    <CriticalReauthDialog
                        open={reauthOpen}
                        purpose="export"
                        onCancel={() => setReauthOpen(false)}
                        onSuccess={(reauth) => {
                            setReauthOpen(false);
                            create.mutate(reauth.token);
                        }}
                    />
                </div>
            )}
        </section>
    );
}

function ExportsContent() {
    return (
        <div className={styles.page}>
            <header className={styles.heading}>
                <div>
                    <p className={styles.eyebrow}>Настройки аккаунта</p>
                    <h1>Экспорт данных</h1>
                    <p>Проверьте фактический состав и скачайте готовый файл через защищённое действие.</p>
                </div>
            </header>
            <div className={styles.layout}>
                <ExportComposer />
                <ExportHistory />
            </div>
            <aside className={styles.note}>
                <strong>Личный экспорт доступен без продления подписки.</strong>
                <span>Срок готового файла не определяет срок хранения истории запроса.</span>
            </aside>
        </div>
    );
}

export function ExportsPage() {
    return (
        <>
            <ExportsContent />
        </>
    );
}
