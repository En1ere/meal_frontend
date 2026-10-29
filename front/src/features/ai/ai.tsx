'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useRuntime } from '../../shared/runtime/index.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { useSession } from '../../entities/session/client.js';
import styles from './ai.module.css';
import { isConsentRequiredError, useConsent } from '../../entities/consent/client.js';
const statusLabels = {
    preview: 'Предпросмотр',
    processing: 'В работе',
    completed: 'Готово',
    failed: 'Ошибка',
    refunded: 'Возвращено',
} as const;
const taskClassLabels = { standard: 'обычная', advanced: 'расширенная', heavy: 'тяжёлая' } as const;
const priorityLabels = { normal: 'обычный', pro: 'Pro' } as const;
const actionLabel = (cost: number) => (cost === 1 ? 'AI-действие' : cost < 5 ? 'AI-действия' : 'AI-действий');
function Frame({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
export function AiPage() {
    return (
        <Frame>
            <AiContent />
        </Frame>
    );
}
function AiContent() {
    const { api, queryClient } = useRuntime(),
        router = useRouter(),
        session = useSession('user'),
        [taskType, setTaskType] = useState('culinary_question'),
        [prompt, setPrompt] = useState(''),
        [personal, setPersonal] = useState(false),
        [agreement, setAgreement] = useState(false),
        [familyReserveAccepted, setFamilyReserveAccepted] = useState(false),
        [preview, setPreview] = useState<Success<'POST /api/v1/ai/preview'>['data'] | null>(null),
        [result, setResult] = useState<string | null>(null);
    const capabilities = useQuery({
        queryKey: ['ai-capabilities'],
        enabled: !!api,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/ai/capabilities', undefined, signal)).data,
    });
    const aiConsent = useConsent('ai_data_access');
    const balance = useQuery({
        queryKey: ['ai-balance', session.data?.id],
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/ai/balance', undefined, signal)).data,
    });
    const quote = useMutation({
        mutationFn: async () =>
            (
                await api!.request('POST /api/v1/ai/preview', {
                    taskType,
                    prompt,
                    usePersonalData: personal,
                    agreementAccepted: true,
                })
            ).data,
        onSuccess: (value) => {
            setPreview(value);
            setFamilyReserveAccepted(false);
        },
    });
    const run = useMutation({
        mutationFn: async () =>
            (
                await api!.request('POST /api/v1/ai/run', {
                    previewId: preview!.previewId,
                    idempotencyKey: crypto.randomUUID(),
                    familyReserveAccepted,
                })
            ).data,
        onSuccess: (value) => {
            setResult(value.item.result);
            setPreview(null);
            setFamilyReserveAccepted(false);
            setPrompt('');
            void queryClient.invalidateQueries({ queryKey: ['ai-balance', session.data?.id] });
            void queryClient.invalidateQueries({ queryKey: ['ai-history', session.data?.id] });
            router.push(`/ai/${value.item.id}`);
        },
    });
    const submit = (e: FormEvent) => {
        e.preventDefault();
        setResult(null);
        quote.mutate();
    };
    return (
        <>
            <header className={styles.heading}>
                <div>
                    <h1>AI-помощник</h1>
                    <p>Стоимость зависит от класса задачи и заранее фиксируется в предпросмотре.</p>
                </div>
                <div className={styles.actions}>
                    <Link href="/ai/history">История</Link>
                    <Link href="/ai/appeals">Апелляции</Link>
                    <Link href="/ai/balance">Баланс: {balance.data?.available ?? '—'}</Link>
                </div>
            </header>
            {capabilities.data && !capabilities.data.executionAvailable && (
                <section className={styles.notice}>
                    <strong>AI-провайдер ещё не подключён</strong>
                    <p>
                        Интерфейс и контракты готовы. Запуск станет доступен после настройки серверного URL, токена и
                        модели.
                    </p>
                </section>
            )}
            {capabilities.isError && (
                <section className={styles.notice} role="alert">
                    <strong>Не удалось загрузить возможности AI</strong>
                    <p>Запуск заблокирован, пока сервер не подтвердит доступные задачи, их стоимость и лимиты.</p>
                    <button type="button" onClick={() => void capabilities.refetch()}>
                        Повторить
                    </button>
                </section>
            )}
            <form className={styles.form} onSubmit={submit}>
                <label>
                    Задача
                    <select
                        value={taskType}
                        onChange={(e) => {
                            setTaskType(e.target.value);
                            setPreview(null);
                        }}
                    >
                        {(capabilities.data?.taskTypes ?? []).map((x) => (
                            <option key={x.code} value={x.code}>
                                {x.label} · {x.cost} {actionLabel(x.cost)}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    Запрос
                    <textarea
                        rows={8}
                        required
                        minLength={3}
                        maxLength={4000}
                        value={prompt}
                        onChange={(e) => {
                            setPrompt(e.target.value);
                            setPreview(null);
                        }}
                        placeholder="Например: чем заменить сливки в грибном соусе?"
                    />
                </label>
                <label className={styles.check}>
                    <input
                        type="checkbox"
                        checked={personal}
                        disabled={!aiConsent.enabled}
                        onChange={(e) => {
                            setPersonal(e.target.checked);
                            setPreview(null);
                        }}
                    />
                    Использовать разрешённые данные профиля и личных запасов
                </label>
                {!aiConsent.enabled && (
                    <section className={styles.notice} role="status">
                        <strong>Личные данные для AI заблокированы</strong>
                        <p>
                            Обычный запрос без данных профиля доступен. Чтобы использовать профиль и запасы,
                            ознакомьтесь с документом и выдайте отдельное согласие.
                        </p>
                        <Link href="/settings/privacy?consent=ai_data_access&returnTo=/ai">
                            Открыть документы и согласия
                        </Link>
                    </section>
                )}
                <label className={styles.check}>
                    <input
                        type="checkbox"
                        required
                        checked={agreement}
                        onChange={(e) => setAgreement(e.target.checked)}
                    />
                    Я принимаю правила использования и списания AI-действий
                </label>
                <button
                    className="button primary"
                    disabled={
                        !agreement ||
                        quote.isPending ||
                        !capabilities.data?.executionAvailable ||
                        (personal && !aiConsent.enabled)
                    }
                >
                    Рассчитать стоимость
                </button>
            </form>
            {quote.isError && (
                <p role="alert">
                    {isConsentRequiredError(quote.error)
                        ? 'Доступ к личным данным отозван. Откройте документы и согласия и подтвердите доступ заново.'
                        : 'Предпросмотр недоступен. Проверьте баланс и подключение AI.'}
                </p>
            )}
            {preview && (
                <section className={styles.preview}>
                    <h2>Подтвердите запуск</h2>
                    <dl>
                        <div>
                            <dt>Стоимость</dt>
                            <dd>
                                {preview.cost} {actionLabel(preview.cost)}
                            </dd>
                        </div>
                        <div>
                            <dt>Баланс</dt>
                            <dd>
                                {preview.balanceBefore} → {preview.balanceAfter}
                            </dd>
                        </div>
                        <div>
                            <dt>Цена действует до</dt>
                            <dd>{new Date(preview.expiresAt).toLocaleTimeString('ru')}</dd>
                        </div>
                        <div>
                            <dt>Класс и приоритет</dt>
                            <dd>
                                {taskClassLabels[preview.orchestration.taskClass]} ·{' '}
                                {priorityLabels[preview.orchestration.priority]}
                            </dd>
                        </div>
                        <div>
                            <dt>Лимит модели</dt>
                            <dd>
                                до {preview.orchestration.tokenBudget.maxInputTokens.toLocaleString('ru')} входных и{' '}
                                {preview.orchestration.tokenBudget.maxOutputTokens.toLocaleString('ru')} выходных
                                токенов
                            </dd>
                        </div>
                    </dl>
                    <p>Источники: {preview.sources.join(', ')}.</p>
                    <p>
                        Целевой контур: {preview.orchestration.target.model}, Responses API, reasoning low. При ошибке
                        провайдера резерв AI-действий освобождается; внутренние повторы не тарифицируются.
                    </p>
                    {preview.familyReserveRequired > 0 && (
                        <label className={styles.check}>
                            <input
                                type="checkbox"
                                checked={familyReserveAccepted}
                                onChange={(event) => setFamilyReserveAccepted(event.target.checked)}
                            />
                            Разрешить списать {preview.familyReserveRequired} AI-действие из общего резерва семьи для
                            этого запуска
                        </label>
                    )}
                    <button
                        className="button primary"
                        disabled={run.isPending || (preview.familyReserveRequired > 0 && !familyReserveAccepted)}
                        onClick={() => run.mutate()}
                    >
                        Подтвердить и запустить
                    </button>
                    {run.isError && (
                        <div role="alert">
                            <p>
                                {isConsentRequiredError(run.error)
                                    ? 'Согласие было отозвано после предпросмотра. Запуск заблокирован, AI-действия не списаны.'
                                    : 'Запуск не выполнен. Предпросмотр сохранён — проверьте подключение и повторите.'}
                            </p>
                            {isConsentRequiredError(run.error) && (
                                <Link href="/settings/privacy?consent=ai_data_access&returnTo=/ai">
                                    Ознакомиться и согласиться
                                </Link>
                            )}
                        </div>
                    )}
                </section>
            )}
            {result && (
                <section className={styles.result}>
                    <h2>Результат</h2>
                    <p>{result}</p>
                    <small>{capabilities.data?.disclaimer}</small>
                </section>
            )}
        </>
    );
}
export function AiBalancePage() {
    return (
        <Frame>
            <BalanceContent />
        </Frame>
    );
}
function BalanceContent() {
    const { api, queryClient } = useRuntime(),
        session = useSession('user'),
        [donorId, setDonorId] = useState(''),
        [amount, setAmount] = useState(1);
    const query = useQuery({
        queryKey: ['ai-balance', session.data?.id],
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/ai/balance', undefined, signal)).data,
    });
    const purchase = useMutation({
        mutationFn: async () =>
            (
                await api!.request('POST /api/v1/ai/package/purchase', {
                    acceptedAmountMinor: 19900,
                    idempotencyKey: crypto.randomUUID(),
                })
            ).data,
        onSuccess: (value) => queryClient.setQueryData(['ai-balance', session.data?.id], value.balance),
    });
    const sharing = useQuery({
        queryKey: ['ai-family-sharing', session.data?.id],
        enabled: !!api && !!session.data,
        retry: false,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/ai/family-sharing', undefined, signal)).data,
    });
    const refreshSharing = () => {
        void queryClient.invalidateQueries({ queryKey: ['ai-family-sharing', session.data?.id] });
        void queryClient.invalidateQueries({ queryKey: ['ai-balance', session.data?.id] });
    };
    const requestTransfer = useMutation({
        mutationFn: async () =>
            (
                await api!.request('POST /api/v1/ai/transfers', {
                    donorId,
                    amount,
                    idempotencyKey: crypto.randomUUID(),
                })
            ).data,
        onSuccess: refreshSharing,
    });
    const decideTransfer = useMutation({
        mutationFn: async (input: { id: string; expectedVersion: number; decision: 'accept' | 'reject' }) =>
            (
                await api!.request(
                    'POST /api/v1/ai/transfers/{id}/decision',
                    {
                        expectedVersion: input.expectedVersion,
                        decision: input.decision,
                        idempotencyKey: crypto.randomUUID(),
                    },
                    undefined,
                    { id: input.id },
                )
            ).data,
        onSuccess: refreshSharing,
    });
    const ownShare = sharing.data?.members.find((member) => member.currentUser),
        donors = sharing.data?.members.filter((member) => !member.currentUser && member.availableToTransfer > 0) ?? [];
    return (
        <>
            <header className={styles.heading}>
                <div>
                    <h1>Баланс AI</h1>
                    <p>Доступный и зарезервированный остаток показаны отдельно.</p>
                </div>
                <Link href="/ai">К помощнику</Link>
            </header>
            {query.isPending ? (
                <p role="status">Загружаем баланс…</p>
            ) : query.isError ? (
                <p role="alert">Баланс недоступен.</p>
            ) : (
                <>
                    <section className={styles.balance}>
                        <strong>{query.data.available}</strong>
                        <span>доступно</span>
                        <small>
                            {query.data.reserved} зарезервировано · {query.data.total} всего
                        </small>
                    </section>
                    <div className={styles.grid}>
                        {query.data.buckets.map((x) => (
                            <article className={styles.card} key={x.id}>
                                <h2>
                                    {x.kind === 'purchased'
                                        ? 'Купленные'
                                        : x.kind === 'subscription'
                                          ? 'Подписка'
                                          : x.kind === 'family_reserve'
                                            ? 'Резерв семьи'
                                            : x.kind === 'transferred'
                                              ? 'Переданные'
                                              : x.kind}
                                </h2>
                                <p>
                                    {x.available} доступно из {x.granted}
                                </p>
                                <small>
                                    {x.expiresAt ? `До ${new Date(x.expiresAt).toLocaleString('ru')}` : 'Не сгорает'}
                                    {x.requiresConfirmation ? ' · требуется подтверждение перед списанием' : ''}
                                </small>
                            </article>
                        ))}
                    </div>
                    <section className={styles.card}>
                        <h2>Пакет 40 AI-действий</h2>
                        <p>
                            {query.data.packageOffer.amountMinor / 100} ₽ · не меняет тариф и не открывает платные
                            функции.
                        </p>
                        <button
                            className="button primary"
                            disabled={purchase.isPending || query.data.packageOffer.purchaseMode === 'unavailable'}
                            onClick={() => purchase.mutate()}
                        >
                            {query.data.packageOffer.purchaseMode === 'simulation'
                                ? 'Провести тестовую покупку'
                                : 'Покупка пока недоступна'}
                        </button>
                        {purchase.isSuccess && (
                            <p role="status">Тестовый пакет начислен. Реального списания денег не было.</p>
                        )}
                    </section>
                    {sharing.isSuccess && (
                        <section className={styles.card}>
                            <h2>Передача AI-действий в семье</h2>
                            <p>
                                Когда личная доля исчерпана, можно запросить целое число действий у другого участника.
                                Списание произойдёт только после подтверждения донора.
                            </p>
                            <form
                                className={styles.form}
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    requestTransfer.mutate();
                                }}
                            >
                                <label>
                                    Участник-донор
                                    <select
                                        value={donorId}
                                        onChange={(event) => setDonorId(event.target.value)}
                                        required
                                    >
                                        <option value="">Выберите участника</option>
                                        {donors.map((member) => (
                                            <option key={member.userId} value={member.userId}>
                                                {member.displayName} · доступно {member.availableToTransfer}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    Количество действий
                                    <input
                                        type="number"
                                        min={1}
                                        step={1}
                                        value={amount}
                                        onChange={(event) => setAmount(event.target.valueAsNumber)}
                                        required
                                    />
                                </label>
                                <button
                                    className="button primary"
                                    disabled={
                                        requestTransfer.isPending ||
                                        !donorId ||
                                        !Number.isInteger(amount) ||
                                        amount < 1 ||
                                        (ownShare?.availableToTransfer ?? 0) > 0
                                    }
                                >
                                    Запросить передачу
                                </button>
                                {(ownShare?.availableToTransfer ?? 0) > 0 && (
                                    <small>Сначала используйте оставшиеся действия своей подписочной доли.</small>
                                )}
                                {requestTransfer.isSuccess && <p role="status">Запрос отправлен донору.</p>}
                                {requestTransfer.isError && <p role="alert">Не удалось отправить запрос.</p>}
                            </form>
                            {sharing.data.transfers.length > 0 && (
                                <div className={styles.list}>
                                    {sharing.data.transfers.map((transfer) => (
                                        <article className={styles.notice} key={transfer.id}>
                                            <strong>
                                                {transfer.recipientId === session.data?.id
                                                    ? `Вы запросили ${transfer.amount} у ${transfer.donorName}`
                                                    : `${transfer.recipientName} просит ${transfer.amount}`}
                                            </strong>
                                            <p>
                                                Статус:{' '}
                                                {transfer.status === 'pending'
                                                    ? 'ожидает решения'
                                                    : transfer.status === 'accepted'
                                                      ? 'передано'
                                                      : transfer.status === 'rejected'
                                                        ? 'отклонено'
                                                        : 'истекло'}
                                            </p>
                                            {transfer.donorId === session.data?.id && transfer.status === 'pending' && (
                                                <div className={styles.actions}>
                                                    <button
                                                        className="button primary"
                                                        disabled={decideTransfer.isPending}
                                                        onClick={() =>
                                                            decideTransfer.mutate({
                                                                id: transfer.id,
                                                                expectedVersion: transfer.version,
                                                                decision: 'accept',
                                                            })
                                                        }
                                                    >
                                                        Передать
                                                    </button>
                                                    <button
                                                        className="button secondary"
                                                        disabled={decideTransfer.isPending}
                                                        onClick={() =>
                                                            decideTransfer.mutate({
                                                                id: transfer.id,
                                                                expectedVersion: transfer.version,
                                                                decision: 'reject',
                                                            })
                                                        }
                                                    >
                                                        Отклонить
                                                    </button>
                                                </div>
                                            )}
                                        </article>
                                    ))}
                                </div>
                            )}
                            {decideTransfer.isError && <p role="alert">Запрос уже изменился или недоступен.</p>}
                        </section>
                    )}
                    <section className={styles.notice}>
                        <strong>Порядок списания</strong>
                        <p>Подписка → переданные действия → семейный резерв → купленные действия.</p>
                    </section>
                </>
            )}
        </>
    );
}
export function AiHistoryPage() {
    return (
        <Frame>
            <HistoryContent />
        </Frame>
    );
}
function HistoryContent() {
    const { api, queryClient } = useRuntime(),
        session = useSession('user'),
        [archived, setArchived] = useState<'active' | 'archived' | 'all'>('active');
    const query = useInfiniteQuery({
        queryKey: ['ai-history', session.data?.id, archived],
        enabled: !!api && !!session.data,
        initialPageParam: null as string | null,
        queryFn: async ({ signal, pageParam }) =>
            (
                await api!.request('GET /api/v1/ai/history', undefined, signal, undefined, {
                    query: {
                        archived,
                        limit: '20',
                        ...(pageParam ? { cursor: pageParam } : {}),
                    },
                })
            ).data,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    });
    const transition = useMutation({
        mutationFn: async (item: { id: string; archived: boolean; version: number }) =>
            (
                await api!.request(
                    'PUT /api/v1/ai/history/{id}/archive',
                    {
                        archived: !item.archived,
                        expectedVersion: item.version,
                        idempotencyKey: crypto.randomUUID(),
                    },
                    undefined,
                    { id: item.id },
                )
            ).data,
        onSuccess: (value) => {
            void queryClient.invalidateQueries({ queryKey: ['ai-history', session.data?.id] });
            void queryClient.invalidateQueries({ queryKey: ['ai-conversation', session.data?.id, value.item.id] });
        },
    });
    const items = query.data?.pages.flatMap((page) => page.items) ?? [];
    const total = query.data?.pages[0]?.total ?? 0;
    return (
        <>
            <header className={styles.heading}>
                <div>
                    <h1>История AI</h1>
                    <p>Повторное чтение сохранённого результата не списывает действия.</p>
                </div>
                <Link href="/ai">Новая задача</Link>
            </header>
            <section className={styles.card} aria-label="Фильтр истории">
                <label>
                    Показывать
                    <select value={archived} onChange={(event) => setArchived(event.target.value as typeof archived)}>
                        <option value="active">Активные</option>
                        <option value="archived">Архив</option>
                        <option value="all">Все</option>
                    </select>
                </label>
                {!query.isPending && !query.isError && <p>Найдено: {total}</p>}
            </section>
            {query.isPending ? (
                <p role="status">Загружаем историю…</p>
            ) : query.isError ? (
                <section className={styles.card}>
                    <p role="alert">История недоступна.</p>
                    <button type="button" onClick={() => void query.refetch()}>
                        Проверить статус
                    </button>
                </section>
            ) : items.length === 0 ? (
                <section className={styles.card}>
                    <h2>{archived === 'archived' ? 'Архив пуст' : 'История пуста'}</h2>
                </section>
            ) : (
                <>
                    {transition.isError && (
                        <section className={styles.notice} role="alert">
                            <p>Не удалось подтвердить изменение архива. Проверьте актуальное состояние истории.</p>
                            <button type="button" onClick={() => void query.refetch()}>
                                Проверить статус
                            </button>
                        </section>
                    )}
                    <div className={styles.list}>
                        {items.map((item) => (
                            <article className={styles.card} key={item.id}>
                                <header>
                                    <div>
                                        <small>
                                            {new Date(item.createdAt).toLocaleString('ru')} · {item.cost} действие
                                        </small>
                                        <h2>{item.title}</h2>
                                    </div>
                                    <strong>{statusLabels[item.status]}</strong>
                                </header>
                                {item.result && <p>{item.result}</p>}
                                {item.status === 'refunded' && <p>Списание возвращено в исходный bucket.</p>}
                                <div className={styles.actions}>
                                    <Link href={`/ai/${item.id}`}>Открыть беседу</Link>
                                    <button
                                        type="button"
                                        disabled={transition.isPending}
                                        onClick={() => transition.mutate(item)}
                                    >
                                        {item.archived ? 'Восстановить' : 'Архивировать'}
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                    {query.hasNextPage && (
                        <button
                            type="button"
                            disabled={query.isFetchingNextPage}
                            onClick={() => void query.fetchNextPage()}
                        >
                            {query.isFetchingNextPage ? 'Загружаем…' : 'Показать ещё'}
                        </button>
                    )}
                </>
            )}
        </>
    );
}

export function AiConversationPage({ id }: { id: string }) {
    return (
        <Frame>
            <ConversationContent id={id} />
        </Frame>
    );
}

function ConversationContent({ id }: { id: string }) {
    const { api, queryClient } = useRuntime(),
        session = useSession('user'),
        [message, setMessage] = useState(''),
        [familyReserveAccepted, setFamilyReserveAccepted] = useState(false);
    const queryKey = ['ai-conversation', session.data?.id, id];
    const query = useQuery({
        queryKey,
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/ai/tasks/{id}', undefined, signal, { id })).data,
    });
    const send = useMutation({
        mutationFn: async () =>
            (
                await api!.request(
                    'POST /api/v1/ai/tasks/{id}/messages',
                    { message, idempotencyKey: crypto.randomUUID(), familyReserveAccepted },
                    undefined,
                    { id },
                )
            ).data,
        onSuccess: (value) => {
            queryClient.setQueryData(queryKey, value);
            setMessage('');
            setFamilyReserveAccepted(false);
            void queryClient.invalidateQueries({ queryKey: ['ai-balance', session.data?.id] });
            void queryClient.invalidateQueries({ queryKey: ['ai-history', session.data?.id] });
        },
    });
    if (query.isPending) return <p role="status">Открываем беседу…</p>;
    if (query.isError)
        return isConsentRequiredError(query.error) ? (
            <section role="alert" className={styles.card}>
                <h1>Личный контекст AI отключён</h1>
                <p>Эта беседа использовала личные данные. Ознакомьтесь с условиями и снова разрешите доступ.</p>
                <Link href={`/settings/privacy?consent=ai_data_access&returnTo=${encodeURIComponent(`/ai/${id}`)}`}>
                    Ознакомиться и согласиться
                </Link>
            </section>
        ) : (
            <p role="alert">Беседа недоступна или не найдена.</p>
        );
    const continuation = query.data.continuation;
    return (
        <>
            <header className={styles.heading}>
                <div>
                    <h1>{query.data.item.title}</h1>
                    <p>История одной цели. Повторное чтение не расходует AI-действия.</p>
                </div>
                <div className={styles.actions}>
                    <Link href="/ai/history">История</Link>
                    <Link href="/ai">Новая задача</Link>
                </div>
            </header>
            <section className={styles.conversation} aria-label="Сообщения AI-беседы">
                {query.data.messages.map((entry) => (
                    <article
                        key={entry.id}
                        className={entry.role === 'assistant' ? styles['assistant-message'] : styles['user-message']}
                    >
                        <strong>{entry.role === 'assistant' ? 'AI-помощник' : 'Вы'}</strong>
                        <p>{entry.body}</p>
                        <small>{new Date(entry.createdAt).toLocaleTimeString('ru')}</small>
                    </article>
                ))}
            </section>
            <section className={styles.card}>
                {continuation.state === 'wait' ? (
                    <p role="status">
                        Два уточнения использованы. Следующее сообщение можно отправить после{' '}
                        {new Date(continuation.intervalEndsAt!).toLocaleTimeString('ru')}.
                    </p>
                ) : continuation.state === 'processing' ? (
                    <p role="status">AI уже обрабатывает сообщение…</p>
                ) : (
                    <p>
                        {continuation.nextMessageCost === 0
                            ? `Включено уточнений: ${continuation.clarificationsRemaining} из 2.`
                            : `Начнётся новый 10-минутный интервал: ${continuation.nextMessageCost} AI-действие.`}
                    </p>
                )}
                <form
                    className={styles.reply}
                    onSubmit={(event) => {
                        event.preventDefault();
                        send.mutate();
                    }}
                >
                    <label>
                        Уточнение по той же цели
                        <textarea
                            required
                            minLength={1}
                            maxLength={4000}
                            rows={4}
                            value={message}
                            onChange={(event) => setMessage(event.target.value)}
                        />
                    </label>
                    {continuation.nextMessageCost > 0 && (
                        <label className={styles.check}>
                            <input
                                type="checkbox"
                                checked={familyReserveAccepted}
                                onChange={(event) => setFamilyReserveAccepted(event.target.checked)}
                            />
                            Разрешить семейный резерв, если личной доли не хватит на новый интервал
                        </label>
                    )}
                    <button
                        className="button primary"
                        disabled={send.isPending || continuation.state !== 'ready' || !message.trim()}
                    >
                        {send.isPending ? 'Отправляем…' : 'Отправить'}
                    </button>
                    {send.isError &&
                        (isConsentRequiredError(send.error) ? (
                            <div role="alert">
                                <p>
                                    Согласие на использование личных данных отозвано. Уточнение не отправлено и
                                    сохранено в форме.
                                </p>
                                <Link
                                    href={`/settings/privacy?consent=ai_data_access&returnTo=${encodeURIComponent(`/ai/${id}`)}`}
                                >
                                    Ознакомиться и согласиться
                                </Link>
                            </div>
                        ) : (
                            <p role="alert">Сообщение не отправлено. Обновите беседу и проверьте баланс.</p>
                        ))}
                </form>
            </section>
        </>
    );
}
