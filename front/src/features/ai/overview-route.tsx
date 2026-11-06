'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { useRuntime } from '../../shared/runtime/index.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { useSession } from '../../entities/session/client.js';
import { aiBalanceKeys } from '../../entities/ai-balance/model.js';
import {
    aiKeys,
    enqueueAiTask,
    loadAiBalance,
    loadAiCapabilities,
    loadAiOperation,
    previewAiTask,
} from '../../entities/ai/index.js';
import styles from './ai.module.css';
import { isConsentRequiredError, useConsent } from '../../entities/consent/client.js';
import { taskClassLabels, priorityLabels, actionLabel, Frame } from './shared.js';
import { useStableCommandKey } from './use-stable-command-key.js';

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
        [taskType, setTaskType] =
            useState<Success<'GET /api/v1/ai/capabilities'>['data']['taskTypes'][number]['code']>('culinary_question'),
        [prompt, setPrompt] = useState(''),
        [personal, setPersonal] = useState(false),
        [agreement, setAgreement] = useState(false),
        [familyReserveAccepted, setFamilyReserveAccepted] = useState(false),
        [preview, setPreview] = useState<Success<'POST /api/v1/ai/preview'>['data'] | null>(null),
        [operationId, setOperationId] = useState<string | null>(null);
    const runCommand = useStableCommandKey();
    const capabilities = useQuery({
        queryKey: aiKeys.capabilities(session.data?.id),
        enabled: !!api && !!session.data,
        queryFn: ({ signal }) => loadAiCapabilities(api!, signal),
    });
    const aiConsent = useConsent('ai_data_access');
    const balance = useQuery({
        queryKey: aiBalanceKeys.forAccount(session.data?.id),
        enabled: !!api && !!session.data,
        queryFn: ({ signal }) => loadAiBalance(api!, signal),
    });
    const quote = useMutation({
        mutationFn: () => previewAiTask(api!, { taskType, prompt, usePersonalData: personal, agreementAccepted: true }),
        onSuccess: (value) => {
            runCommand.reset();
            setPreview(value);
            setFamilyReserveAccepted(false);
        },
    });
    const run = useMutation({
        mutationFn: () => {
            const intent = JSON.stringify({ previewId: preview!.previewId, familyReserveAccepted });
            return enqueueAiTask(api!, {
                previewId: preview!.previewId,
                idempotencyKey: runCommand.forIntent(intent),
                familyReserveAccepted,
            });
        },
        onSuccess: (value) => {
            runCommand.reset();
            setOperationId(value.item.id);
            setPreview(null);
            setFamilyReserveAccepted(false);
            setPrompt('');
            void queryClient.invalidateQueries({ queryKey: aiBalanceKeys.forAccount(session.data?.id) });
        },
    });
    const operation = useQuery({
        queryKey: aiKeys.operation(session.data?.id, operationId ?? 'pending'),
        enabled: !!api && !!session.data && !!operationId,
        queryFn: ({ signal }) => loadAiOperation(api!, operationId!, signal),
        refetchInterval: (query) => {
            const state = query.state.data?.item.state;
            return state && ['succeeded', 'failed', 'cancelled', 'unknown'].includes(state) ? false : 2_000;
        },
        retry: 2,
    });
    useEffect(() => {
        if (operation.data?.item.state !== 'succeeded') return;
        void queryClient.invalidateQueries({ queryKey: aiBalanceKeys.forAccount(session.data?.id) });
        void queryClient.invalidateQueries({ queryKey: aiKeys.historyRoot(session.data?.id) });
        router.push(`/ai/${operation.data.item.taskId}`);
    }, [operation.data, queryClient, router, session.data?.id]);
    const submit = (e: FormEvent) => {
        e.preventDefault();
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
                            setTaskType(e.target.value as typeof taskType);
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
            {operationId && (
                <section className={styles.result} aria-live="polite">
                    <h2>Статус запуска</h2>
                    {operation.isPending && <p role="status">Запрос принят. Ожидаем свободный AI-worker…</p>}
                    {operation.isError && (
                        <div role="alert">
                            <p>Не удалось прочитать состояние. Повторно запускать задачу не нужно.</p>
                            <button type="button" onClick={() => void operation.refetch()}>
                                Проверить состояние
                            </button>
                        </div>
                    )}
                    {operation.data?.item.state === 'queued' && <p role="status">Запрос находится в очереди.</p>}
                    {operation.data?.item.state === 'running' && <p role="status">AI обрабатывает запрос…</p>}
                    {operation.data?.item.state === 'unknown' && (
                        <div role="alert">
                            <p>
                                Результат уточняется. Резерв сохранён; повторная отправка может создать двойную работу.
                            </p>
                            <button type="button" onClick={() => void operation.refetch()}>
                                Обновить состояние
                            </button>
                        </div>
                    )}
                    {operation.data?.item.state === 'failed' && (
                        <div role="alert">
                            <p>{operation.data.item.failure?.userMessage ?? 'AI не завершил запрос.'}</p>
                            <button type="button" onClick={() => setOperationId(null)}>
                                Подготовить новый запуск
                            </button>
                        </div>
                    )}
                    {operation.data?.item.state === 'cancelled' && <p role="status">Запуск отменён.</p>}
                    <small>{capabilities.data?.disclaimer}</small>
                </section>
            )}
        </>
    );
}
