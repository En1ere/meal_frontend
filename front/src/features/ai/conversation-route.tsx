'use client';

import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useRuntime } from '../../shared/runtime/index.js';
import { useSession } from '../../entities/session/client.js';
import { aiBalanceKeys } from '../../entities/ai-balance/model.js';
import { aiKeys, continueAiTask, loadAiConversation, loadAiOperation } from '../../entities/ai/index.js';
import styles from './ai.module.css';
import { isConsentRequiredError } from '../../entities/consent/client.js';
import { Frame } from './shared.js';
import { useStableCommandKey } from './use-stable-command-key.js';

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
        [familyReserveAccepted, setFamilyReserveAccepted] = useState(false),
        [operationId, setOperationId] = useState<string | null>(null);
    const continuationCommand = useStableCommandKey();
    const queryKey = aiKeys.conversation(session.data?.id, id);
    const query = useQuery({
        queryKey,
        enabled: !!api && !!session.data,
        queryFn: ({ signal }) => loadAiConversation(api!, id, signal),
    });
    const send = useMutation({
        mutationFn: () => {
            const intent = JSON.stringify({ id, message, familyReserveAccepted });
            return continueAiTask(api!, id, {
                message,
                idempotencyKey: continuationCommand.forIntent(intent),
                familyReserveAccepted,
            });
        },
        onSuccess: (value) => {
            continuationCommand.reset();
            setOperationId(value.item.id);
            setMessage('');
            setFamilyReserveAccepted(false);
            void queryClient.invalidateQueries({ queryKey: aiBalanceKeys.forAccount(session.data?.id) });
        },
    });
    const operation = useQuery({
        queryKey: aiKeys.operation(session.data?.id, operationId ?? 'pending'),
        enabled: !!api && !!session.data && !!operationId,
        queryFn: ({ signal }) => loadAiOperation(api!, operationId!, signal),
        refetchInterval: (state) => {
            const value = state.state.data?.item.state;
            return value && ['succeeded', 'failed', 'cancelled', 'unknown'].includes(value) ? false : 2_000;
        },
        retry: 2,
    });
    useEffect(() => {
        if (operation.data?.item.state !== 'succeeded') return;
        void queryClient.invalidateQueries({ queryKey: aiKeys.conversation(session.data?.id, id) });
        void queryClient.invalidateQueries({ queryKey: aiBalanceKeys.forAccount(session.data?.id) });
        void queryClient.invalidateQueries({ queryKey: aiKeys.historyRoot(session.data?.id) });
    }, [id, operation.data?.item.state, queryClient, session.data?.id]);
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
                {operationId && (!operation.data || ['queued', 'running'].includes(operation.data.item.state)) && (
                    <p role="status">
                        {operation.data?.item.state === 'running'
                            ? 'AI обрабатывает уточнение…'
                            : 'Уточнение принято и ожидает обработки…'}
                    </p>
                )}
                {operation.data?.item.state === 'unknown' && (
                    <p role="alert">
                        Провайдер не подтвердил исход. Не отправляйте уточнение повторно: операция удерживается до
                        безопасной сверки.
                    </p>
                )}
                {operation.data && ['failed', 'cancelled'].includes(operation.data.item.state) && (
                    <div role="alert">
                        <p>Уточнение не обработано, подтверждённое списание отсутствует.</p>
                        <button type="button" className="button secondary" onClick={() => setOperationId(null)}>
                            Закрыть статус
                        </button>
                    </div>
                )}
                {operation.data?.item.state === 'succeeded' && (
                    <div role="status">
                        <p>AI-ответ добавлен в беседу.</p>
                        <button type="button" className="button secondary" onClick={() => setOperationId(null)}>
                            Продолжить беседу
                        </button>
                    </div>
                )}
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
                        disabled={send.isPending || !!operationId || continuation.state !== 'ready' || !message.trim()}
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
