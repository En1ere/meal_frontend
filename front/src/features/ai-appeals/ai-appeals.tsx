'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useRuntime } from '../../app/providers.js';
import { Guard, useSession } from '../auth/session.js';
import { PersonalShell } from '../personalization/shell.js';
import styles from '../support/support.module.css';

const appealStatuses = {
    pending: 'На рассмотрении',
    accepted: 'Удовлетворена',
    rejected: 'Отклонена',
} as const;
const restrictionStatuses = {
    scheduled: 'Запланировано',
    active: 'Действует',
    expired: 'Завершено',
    revoked: 'Отменено',
} as const;

function Frame({ children }: { children: React.ReactNode }) {
    return (
        <Guard context="user">
            <PersonalShell>{children}</PersonalShell>
        </Guard>
    );
}

export function AiAppealsPage() {
    return (
        <Frame>
            <AppealsContent />
        </Frame>
    );
}

function AppealsContent() {
    const { api, queryClient } = useRuntime(),
        session = useSession('user'),
        router = useRouter(),
        [body, setBody] = useState('');
    const query = useQuery({
        queryKey: ['ai-appeals', session.data?.id],
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/ai/appeals', undefined, signal)).data,
    });
    const create = useMutation({
        mutationFn: async () =>
            (
                await api!.request('POST /api/v1/ai/appeals', {
                    sanctionId: query.data!.restriction!.id,
                    body,
                    idempotencyKey: crypto.randomUUID(),
                })
            ).data,
        onSuccess: (value) => {
            void queryClient.invalidateQueries({ queryKey: ['ai-appeals', session.data?.id] });
            router.push(`/ai/appeals/${value.appeal.id}`);
        },
    });
    const pending = query.data?.items.some(
        (item) => item.sanctionId === query.data?.restriction?.id && item.status === 'pending',
    );
    return (
        <>
            <header className={styles.heading}>
                <div>
                    <h1>Ограничение и апелляция</h1>
                    <p>Здесь видны безопасная причина ограничения, формальный статус и переписка с поддержкой.</p>
                </div>
                <Link href="/ai">К AI-помощнику</Link>
            </header>
            {query.isPending ? (
                <p role="status">Загружаем статус…</p>
            ) : query.isError ? (
                <section className={styles.panel} role="alert">
                    <h2>Не удалось загрузить апелляции</h2>
                    <button type="button" onClick={() => void query.refetch()}>
                        Повторить
                    </button>
                </section>
            ) : (
                <>
                    <section className={styles.panel}>
                        <h2>Текущее ограничение</h2>
                        {query.data.restriction ? (
                            <>
                                <p>
                                    <strong>{restrictionStatuses[query.data.restriction.status]}</strong> ·{' '}
                                    {query.data.restriction.reasonLabel}
                                </p>
                                <p>
                                    Начало: {new Date(query.data.restriction.startsAt).toLocaleString('ru')}
                                    {query.data.restriction.endsAt
                                        ? ` · Завершение: ${new Date(query.data.restriction.endsAt).toLocaleString('ru')}`
                                        : ' · Без указанного срока'}
                                </p>
                                <p>Апелляция не снимает ограничение автоматически.</p>
                            </>
                        ) : (
                            <p>Активного AI-ограничения нет.</p>
                        )}
                    </section>
                    {query.data.restriction && !pending && (
                        <form
                            className={styles.form}
                            onSubmit={(event: FormEvent) => {
                                event.preventDefault();
                                create.mutate();
                            }}
                        >
                            <h2>Подать апелляцию</h2>
                            <label>
                                Объяснение
                                <textarea
                                    required
                                    rows={6}
                                    maxLength={10000}
                                    value={body}
                                    onChange={(event) => setBody(event.target.value)}
                                />
                            </label>
                            {create.isError && (
                                <p role="alert">Не удалось подтвердить отправку. Обновите список перед повтором.</p>
                            )}
                            <button disabled={create.isPending}>Отправить на рассмотрение</button>
                        </form>
                    )}
                    {pending && <p role="status">По текущему ограничению уже рассматривается апелляция.</p>}
                    <section>
                        <h2>История апелляций</h2>
                        {query.data.items.length === 0 ? (
                            <p>Апелляций пока нет.</p>
                        ) : (
                            <div className={styles.list}>
                                {query.data.items.map((item) => (
                                    <Link className={styles.ticket} href={`/ai/appeals/${item.id}`} key={item.id}>
                                        <div>
                                            <small>
                                                {item.ticket.number} · {new Date(item.submittedAt).toLocaleString('ru')}
                                            </small>
                                            <h3>{item.ticket.subject}</h3>
                                            <p>Переписка: {item.ticket.statusLabel}</p>
                                        </div>
                                        <strong>{appealStatuses[item.status]}</strong>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </section>
                </>
            )}
        </>
    );
}

export function AiAppealDetailPage({ id }: { id: string }) {
    return (
        <Frame>
            <AppealDetailContent id={id} />
        </Frame>
    );
}

function AppealDetailContent({ id }: { id: string }) {
    const { api, queryClient } = useRuntime(),
        session = useSession('user'),
        [reply, setReply] = useState('');
    const key = ['ai-appeal', session.data?.id, id] as const;
    const query = useQuery({
        queryKey: key,
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/ai/appeals/{id}', undefined, signal, { id })).data,
    });
    const send = useMutation({
        mutationFn: async () =>
            (
                await api!.request(
                    'POST /api/v1/support/{id}/reply',
                    {
                        body: reply,
                        attachments: [],
                        expectedVersion: query.data!.appeal.ticket.version,
                        idempotencyKey: crypto.randomUUID(),
                    },
                    undefined,
                    { id: query.data!.appeal.ticket.id },
                )
            ).data,
        onSuccess: () => {
            setReply('');
            void queryClient.invalidateQueries({ queryKey: key });
        },
    });
    if (query.isPending) return <p role="status">Открываем апелляцию…</p>;
    if (query.isError)
        return (
            <section className={styles.panel} role="alert">
                <h1>Апелляция недоступна</h1>
                <p>Она не найдена или принадлежит другому пользователю.</p>
                <Link href="/ai/appeals">К списку</Link>
            </section>
        );
    return (
        <>
            <header className={styles.heading}>
                <div>
                    <small>{query.data.appeal.ticket.number}</small>
                    <h1>Апелляция по ограничению AI</h1>
                    <p>
                        Формальный статус: <strong>{appealStatuses[query.data.appeal.status]}</strong>
                    </p>
                </div>
                <Link href="/ai/appeals">К списку</Link>
            </header>
            <section className={styles.panel}>
                <h2>Ограничение</h2>
                <p>{query.data.restriction.reasonLabel}</p>
                <p>
                    {restrictionStatuses[query.data.restriction.status]}
                    {query.data.restriction.endsAt
                        ? ` · до ${new Date(query.data.restriction.endsAt).toLocaleString('ru')}`
                        : ' · без указанного срока'}
                </p>
                {query.data.appeal.response && (
                    <p>
                        <strong>Ответ по решению:</strong> {query.data.appeal.response}
                    </p>
                )}
            </section>
            <section className={styles.conversation} aria-label="Переписка по апелляции">
                <h2>Переписка</h2>
                {query.data.messages.map((message) => (
                    <article className={`${styles.message} ${message.own ? styles.own : ''}`} key={message.id}>
                        <header>
                            <strong>{message.authorLabel}</strong>
                            <small>{new Date(message.createdAt).toLocaleString('ru')}</small>
                        </header>
                        <p>{message.body}</p>
                    </article>
                ))}
            </section>
            {query.data.appeal.ticket.status !== 'closed' && (
                <form
                    className={styles.form}
                    onSubmit={(event) => {
                        event.preventDefault();
                        send.mutate();
                    }}
                >
                    <label>
                        Дополнить обращение
                        <textarea
                            required
                            rows={5}
                            maxLength={10000}
                            value={reply}
                            onChange={(event) => setReply(event.target.value)}
                        />
                    </label>
                    {send.isError && <p role="alert">Не удалось отправить сообщение. Обновите страницу.</p>}
                    <button disabled={send.isPending}>Отправить</button>
                </form>
            )}
        </>
    );
}
