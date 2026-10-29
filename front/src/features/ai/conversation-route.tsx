'use client';

import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useRuntime } from '../../shared/runtime/index.js';
import { useSession } from '../../entities/session/client.js';
import styles from './ai.module.css';
import { isConsentRequiredError } from '../../entities/consent/client.js';
import { Frame } from './shared.js';

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
