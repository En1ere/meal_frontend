'use client';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRuntime } from '../../app/providers.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import { Guard, useSession } from '../auth/session.js';
import { PersonalShell } from '../personalization/shell.js';
import styles from './family-chat.module.css';

type Chat = Success<'GET /api/v1/family/chat'>['data'];
type Message = Chat['items'][number];
const labels = { like: '👍', heart: '❤️', laugh: '😄', surprise: '😮' } as const;

function LoadedChat({
    chat,
    q,
    hasMore,
    isLoadingMore,
    loadMoreError,
    loadMore,
}: {
    chat: Chat;
    q: string;
    hasMore: boolean;
    isLoadingMore: boolean;
    loadMoreError: boolean;
    loadMore: () => void;
}) {
    const { api } = useRuntime();
    const session = useSession('user');
    const client = useQueryClient();
    const localDraftKey = session.data ? `meal-planner-family-chat-draft:${session.data.id}` : null;
    const [body, setBody] = useState(chat.draft?.body ?? '');
    const [draftVersion, setDraftVersion] = useState<number | null>(chat.draft?.version ?? null);
    const [reply, setReply] = useState<Message | null>(null);
    const [editing, setEditing] = useState<Message | null>(null);
    const [mentions, setMentions] = useState<string[]>([]);
    const [error, setError] = useState('');
    const [readState, setReadState] = useState<'idle' | 'pending' | 'error'>('idle');
    const [readRetry, setReadRetry] = useState(0);
    const readKeys = useRef(new Map<string, { key: string; pending: boolean; confirmed: boolean }>());
    const readMessageId = chat.items.at(-1)?.id;
    useEffect(() => {
        if (!localDraftKey) return;
        let active = true;
        queueMicrotask(() => {
            const localDraft = sessionStorage.getItem(localDraftKey);
            if (active && localDraft !== null) setBody(localDraft);
        });
        return () => {
            active = false;
        };
    }, [localDraftKey]);
    useEffect(() => {
        if (!api || !readMessageId) return;
        const state = readKeys.current.get(readMessageId) ?? {
            key: crypto.randomUUID(),
            pending: false,
            confirmed: false,
        };
        if (state.pending || state.confirmed) return;
        readKeys.current.set(readMessageId, state);
        state.pending = true;
        setReadState('pending');
        const markRead = async () => {
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    await api.request('POST /api/v1/family/chat/read', {
                        messageId: readMessageId,
                        idempotencyKey: state.key,
                    });
                    state.confirmed = true;
                    state.pending = false;
                    setReadState('idle');
                    return;
                } catch {
                    // Retry once with the same key; never expose an unconfirmed optimistic read state.
                }
            }
            state.pending = false;
            setReadState('error');
        };
        void markRead();
    }, [api, readMessageId, readRetry]);
    const refresh = () => client.invalidateQueries({ queryKey: ['family-chat'] });
    const command = useMutation({
        mutationFn: async (run: () => Promise<unknown>) => run(),
        onSuccess: () => void refresh(),
        onError: () => setError('Действие не выполнено. Обновите чат и повторите.'),
    });
    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (!api || !body.trim()) return;
        setError('');
        try {
            if (editing)
                await api.request(
                    'PUT /api/v1/family/chat/messages/{id}',
                    {
                        body: body.trim(),
                        mentionUserIds: mentions,
                        expectedVersion: editing.version,
                        idempotencyKey: crypto.randomUUID(),
                    },
                    undefined,
                    { id: editing.id },
                );
            else
                await api.request('POST /api/v1/family/chat/messages', {
                    body: body.trim(),
                    replyToId: reply?.id ?? null,
                    mentionUserIds: mentions,
                    idempotencyKey: crypto.randomUUID(),
                });
            setBody('');
            setDraftVersion(null);
            setReply(null);
            setEditing(null);
            setMentions([]);
            if (localDraftKey) sessionStorage.removeItem(localDraftKey);
            await refresh();
        } catch {
            setError('Сообщение не отправлено. Введённый текст сохранён на экране.');
        }
    };
    const saveDraft = async () => {
        if (!api || (!body && draftVersion === null)) return;
        try {
            const result = await api.request('PUT /api/v1/family/chat/draft', {
                body,
                expectedVersion: draftVersion,
                idempotencyKey: crypto.randomUUID(),
            });
            setDraftVersion(result.data.version);
            if (localDraftKey) sessionStorage.removeItem(localDraftKey);
        } catch {
            setError('Черновик не сохранён. Текст остаётся в этом окне.');
        }
    };
    const startEdit = (message: Message) => {
        setEditing(message);
        setReply(null);
        setBody(message.body);
        setMentions(message.mentions.map((item) => item.userId));
    };
    return (
        <div className={styles.stack}>
            <p className={styles.notice}>
                История доступна с {new Date(chat.joinedAt).toLocaleDateString('ru-RU')} — даты вашего вступления в
                семью.
            </p>
            {readState === 'error' && (
                <p role="alert">
                    Не удалось отметить сообщения прочитанными. Сами сообщения доступны.{' '}
                    <button className="text-button" onClick={() => setReadRetry((value) => value + 1)}>
                        Повторить
                    </button>
                </p>
            )}
            {!!chat.pinned.length && (
                <section className={styles.pinned} aria-label="Закреплённые сообщения">
                    <strong>Закреплено</strong>
                    {chat.pinned.map((item) => (
                        <p key={item.id}>
                            {item.author.displayName}: {item.body || 'Сообщение удалено'}
                        </p>
                    ))}
                </section>
            )}
            {(hasMore || loadMoreError) && (
                <div className={styles.actions}>
                    <button className="button outline" disabled={isLoadingMore} onClick={loadMore}>
                        {isLoadingMore ? 'Загружаем…' : loadMoreError ? 'Повторить загрузку' : 'Загрузить ещё'}
                    </button>
                    {loadMoreError && <p role="alert">Не удалось загрузить предыдущие сообщения.</p>}
                </div>
            )}
            <section className={styles.feed} aria-label={q ? 'Результаты поиска' : 'Сообщения семьи'}>
                {!chat.items.length && (
                    <p className={styles.muted}>{q ? 'Ничего не найдено.' : 'Начните семейный разговор.'}</p>
                )}
                {chat.items.map((message) => (
                    <article
                        className={`${styles.message} ${message.author.userId === session.data?.id ? styles.mine : styles.other}`}
                        key={message.id}
                    >
                        {message.replyTo && (
                            <div className={styles.reply}>
                                {message.replyTo.removedForAll
                                    ? 'Исходное сообщение удалено'
                                    : `${message.replyTo.author.displayName}: ${message.replyTo.body}`}
                            </div>
                        )}
                        <div className={styles['message-meta']}>
                            <strong>{message.author.displayName}</strong>
                            <time>{new Date(message.sentAt).toLocaleString('ru-RU')}</time>
                        </div>
                        {message.removedForAllAt ? (
                            <p className={styles.tombstone}>Сообщение удалено</p>
                        ) : (
                            <p>{message.body}</p>
                        )}
                        {!!message.mentions.length && (
                            <small className={styles.muted}>
                                Упомянуты: {message.mentions.map((item) => item.displayName).join(', ')}
                            </small>
                        )}
                        {!message.removedForAllAt && (
                            <>
                                <div className={styles.reactions}>
                                    {(Object.keys(labels) as Array<keyof typeof labels>).map((reaction) => {
                                        const value = message.reactions.find((item) => item.reaction === reaction);
                                        return (
                                            <button
                                                className={value?.reactedByMe ? styles.active : ''}
                                                key={reaction}
                                                aria-label={`Реакция ${labels[reaction]}`}
                                                onClick={() =>
                                                    command.mutate(() =>
                                                        api!.request(
                                                            'POST /api/v1/family/chat/messages/{id}/reaction',
                                                            {
                                                                reaction,
                                                                active: !value?.reactedByMe,
                                                                idempotencyKey: crypto.randomUUID(),
                                                            },
                                                            undefined,
                                                            { id: message.id },
                                                        ),
                                                    )
                                                }
                                            >
                                                {labels[reaction]} {value?.count ?? ''}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className={styles.actions}>
                                    <button
                                        onClick={() => {
                                            setReply(message);
                                            setEditing(null);
                                        }}
                                    >
                                        Ответить
                                    </button>
                                    <button
                                        onClick={() =>
                                            command.mutate(() =>
                                                api!.request(
                                                    'POST /api/v1/family/chat/messages/{id}/pin',
                                                    { pinned: !message.pinned, idempotencyKey: crypto.randomUUID() },
                                                    undefined,
                                                    { id: message.id },
                                                ),
                                            )
                                        }
                                    >
                                        {message.pinned ? 'Открепить' : 'Закрепить'}
                                    </button>
                                    {message.canEdit && <button onClick={() => startEdit(message)}>Изменить</button>}
                                    <button
                                        onClick={() => {
                                            if (confirm('Скрыть сообщение только у вас?'))
                                                command.mutate(() =>
                                                    api!.request(
                                                        'POST /api/v1/family/chat/messages/{id}/hide',
                                                        { idempotencyKey: crypto.randomUUID() },
                                                        undefined,
                                                        { id: message.id },
                                                    ),
                                                );
                                        }}
                                    >
                                        Скрыть у себя
                                    </button>
                                    {message.canRemoveForAll && (
                                        <button
                                            onClick={() => {
                                                if (confirm('Удалить сообщение для всех участников?'))
                                                    command.mutate(() =>
                                                        api!.request(
                                                            'POST /api/v1/family/chat/messages/{id}/remove',
                                                            {
                                                                expectedVersion: message.version,
                                                                idempotencyKey: crypto.randomUUID(),
                                                            },
                                                            undefined,
                                                            { id: message.id },
                                                        ),
                                                    );
                                            }}
                                        >
                                            Удалить для всех
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </article>
                ))}
            </section>
            <form className={styles.composer} onSubmit={(event) => void submit(event)}>
                {(reply || editing) && (
                    <p className={styles.muted}>
                        {editing
                            ? `Редактирование: ${editing.body}`
                            : `Ответ для ${reply!.author.displayName}: ${reply!.body}`}{' '}
                        <button
                            type="button"
                            onClick={() => {
                                setReply(null);
                                setEditing(null);
                                setBody('');
                                setMentions([]);
                            }}
                        >
                            Отменить
                        </button>
                    </p>
                )}
                <div className={styles.members}>
                    {chat.members
                        .filter((member) => member.userId !== session.data?.id)
                        .map((member) => (
                            <button
                                className={styles.member}
                                type="button"
                                key={member.userId}
                                onClick={() => {
                                    setMentions((current) =>
                                        current.includes(member.userId) ? current : [...current, member.userId],
                                    );
                                    setBody((current) => `${current}${current ? ' ' : ''}@${member.displayName} `);
                                }}
                            >
                                @{member.displayName}
                            </button>
                        ))}
                </div>
                <textarea
                    aria-label="Сообщение"
                    maxLength={4000}
                    value={body}
                    onChange={(event) => {
                        const value = event.target.value;
                        setBody(value);
                        if (localDraftKey) sessionStorage.setItem(localDraftKey, value);
                    }}
                    onBlur={() => void saveDraft()}
                    placeholder="Напишите сообщение"
                />
                <div className={styles['composer-actions']}>
                    <button className="button primary" disabled={!body.trim() || command.isPending}>
                        {editing ? 'Сохранить' : 'Отправить'}
                    </button>
                    <span className={styles.muted}>{body.length}/4000</span>
                </div>
                {error && (
                    <p className={styles.error} role="alert">
                        {error}
                    </p>
                )}
            </form>
        </div>
    );
}

function Content() {
    const { api } = useRuntime();
    const user = useSession('user');
    const router = useRouter();
    const search = useSearchParams();
    const q = search.get('q') ?? '';
    const [draftSearch, setDraftSearch] = useState(q);
    const chat = useInfiniteQuery({
        queryKey: ['family-chat', user.data?.id, q],
        enabled: !!api && !!user.data,
        initialPageParam: null as string | null,
        queryFn: async ({ signal, pageParam }) =>
            (
                await api!.request('GET /api/v1/family/chat', undefined, signal, undefined, {
                    query: { q, ...(pageParam ? { before: pageParam } : {}) },
                })
            ).data,
        getNextPageParam: (lastPage) => lastPage.nextBefore ?? undefined,
        retry: false,
    });
    const pages = chat.data?.pages;
    const loaded = pages
        ? {
              ...pages[0]!,
              items: [
                  ...new Map(
                      pages
                          .toReversed()
                          .flatMap((page) => page.items)
                          .map((message) => [message.id, message] as const),
                  ).values(),
              ],
              nextBefore: pages.at(-1)?.nextBefore ?? null,
          }
        : null;
    return (
        <div className={styles.stack}>
            <div className={styles.heading}>
                <div>
                    <h1>Семейный чат</h1>
                    <p className={styles.muted}>Один общий разговор вашей семьи.</p>
                </div>
            </div>
            <div className={styles.toolbar}>
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        const params = new URLSearchParams();
                        if (draftSearch.trim()) params.set('q', draftSearch.trim());
                        router.push(`/family/chat${params.size ? `?${params}` : ''}`);
                    }}
                >
                    <input
                        aria-label="Поиск в чате"
                        maxLength={100}
                        value={draftSearch}
                        onChange={(event) => setDraftSearch(event.target.value)}
                        placeholder="Поиск сообщений"
                    />
                    <button className="button outline">Найти</button>
                </form>
                {q && (
                    <button className="button outline" onClick={() => router.push('/family/chat')}>
                        Очистить
                    </button>
                )}
            </div>
            {chat.isPending ? (
                <ArcSkeleton variant="lines" lines={8} label="Загружаем чат" />
            ) : chat.isError && !loaded ? (
                <p className={styles.error} role="alert">
                    Чат недоступен. Проверьте семейный доступ и подключение.
                </p>
            ) : loaded ? (
                <LoadedChat
                    key={`${loaded.threadId}:${q}`}
                    chat={loaded}
                    q={q}
                    hasMore={chat.hasNextPage}
                    isLoadingMore={chat.isFetchingNextPage}
                    loadMoreError={chat.isFetchNextPageError}
                    loadMore={() => void chat.fetchNextPage()}
                />
            ) : (
                <ArcSkeleton variant="lines" lines={8} label="Загружаем чат" />
            )}
        </div>
    );
}
export function FamilyChatPage() {
    return (
        <Guard context="user">
            <PersonalShell>
                <Content />
            </PersonalShell>
        </Guard>
    );
}
