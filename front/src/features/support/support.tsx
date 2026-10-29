'use client';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRuntime } from '../../shared/runtime/index.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { useSession } from '../../entities/session/client.js';
import styles from './support.module.css';
type Attachment = {
    name: string;
    mime:
        'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf' | 'video/mp4' | 'video/webm' | 'video/quicktime';
    size: number;
    duration: number | null;
};
const statusFilters = [
    ['all', 'Все'],
    ['active', 'Активные'],
    ['waiting_for_user', 'Нужен ответ'],
    ['closed', 'Закрытые'],
] as const;
function files(event: ChangeEvent<HTMLInputElement>): Attachment[] {
    return Array.from(event.target.files ?? [])
        .slice(0, 5)
        .map((file) => ({ name: file.name, mime: file.type as Attachment['mime'], size: file.size, duration: null }));
}
export function SupportList() {
    return (
        <>
            <ListContent />
        </>
    );
}
function ListContent() {
    const { api } = useRuntime(),
        session = useSession('user'),
        params = useSearchParams(),
        category = params.get('category') ?? 'all',
        status = params.get('status') ?? 'all';
    const query = useQuery({
        queryKey: ['support', session.data?.id, category, status],
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/support', undefined, signal, undefined, { query: { category, status } }))
                .data,
    });
    return (
        <>
            <header className={styles.heading}>
                <div>
                    <h1>Поддержка</h1>
                    <p>Обращения и переписка со службой поддержки без обещания фиксированного срока ответа.</p>
                </div>
                <Link className="button primary" href="/support/new">
                    Новое обращение
                </Link>
            </header>
            <nav className={styles.filters}>
                {statusFilters.map(([code, label]) => (
                    <Link
                        key={code}
                        href={`/support?category=${encodeURIComponent(category)}&status=${code}`}
                        aria-current={status === code ? 'page' : undefined}
                    >
                        {label}
                    </Link>
                ))}
            </nav>
            {query.isPending ? (
                <p role="status">Загружаем обращения…</p>
            ) : query.isError ? (
                <section className={styles.panel} role="alert">
                    <h2>Не удалось загрузить обращения</h2>
                    <button className="button outline" onClick={() => void query.refetch()}>
                        Повторить
                    </button>
                </section>
            ) : query.data.items.length === 0 ? (
                <section className={styles.panel}>
                    <h2>Обращений пока нет</h2>
                    <p>Создайте обращение, если вам нужна помощь.</p>
                </section>
            ) : (
                <div className={styles.list}>
                    {query.data.items.map((item) => (
                        <Link className={styles.ticket} href={`/support/${item.id}`} key={item.id}>
                            <div>
                                <small>
                                    {item.number} · {item.categoryLabel}
                                </small>
                                <h2>{item.subject}</h2>
                                <p>Создано {new Date(item.createdAt).toLocaleString('ru')}</p>
                            </div>
                            <strong>{item.statusLabel}</strong>
                        </Link>
                    ))}
                </div>
            )}
        </>
    );
}
export function SupportNew() {
    return (
        <>
            <NewContent />
        </>
    );
}
function NewContent() {
    const { api } = useRuntime(),
        router = useRouter(),
        [subject, setSubject] = useState(''),
        [body, setBody] = useState(''),
        [category, setCategory] = useState('general'),
        [attached, setAttached] = useState<Attachment[]>([]),
        submitting = useRef(false),
        idempotency = useRef<{ signature: string; key: string } | null>(null);
    const meta = useQuery({
        queryKey: ['support-meta'],
        enabled: !!api,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/support/meta', undefined, signal)).data,
    });
    const mutation = useMutation({
        mutationFn: async () => {
            const input = { category, subject, body, attachments: attached };
            const signature = JSON.stringify(input);
            if (idempotency.current?.signature !== signature)
                idempotency.current = { signature, key: crypto.randomUUID() };
            return (
                await api!.request('POST /api/v1/support', {
                    ...input,
                    idempotencyKey: idempotency.current.key,
                })
            ).data;
        },
        onSuccess: (value) => router.replace(`/support/${value.ticket.id}`),
        onSettled: () => {
            submitting.current = false;
        },
    });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (submitting.current) return;
        submitting.current = true;
        mutation.mutate();
    };
    return (
        <>
            <header className={styles.heading}>
                <div>
                    <h1>Новое обращение</h1>
                    <p>Выберите категорию, чтобы обращение сразу попало в нужную очередь.</p>
                </div>
                <Link href="/support">К обращениям</Link>
            </header>
            <form className={styles.form} onSubmit={submit}>
                <label>
                    Категория
                    <select value={category} onChange={(e) => setCategory(e.target.value)}>
                        {meta.data?.categories.map((x) => (
                            <option key={x.code} value={x.code}>
                                {x.label}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    Тема
                    <input
                        required
                        minLength={3}
                        maxLength={160}
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                    />
                </label>
                <label>
                    Сообщение
                    <textarea
                        required
                        rows={8}
                        maxLength={10000}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                    />
                </label>
                <label>
                    Вложения
                    <input
                        type="file"
                        multiple
                        accept={meta.data?.attachmentPolicy.mime.join(',')}
                        disabled={!meta.data || meta.data.uploadMode === 'unavailable'}
                        onChange={(e) => setAttached(files(e))}
                    />
                    <small>
                        {meta.data?.uploadMode === 'simulation'
                            ? 'В мок-режиме проверяется интерфейс и метаданные; файлы не отправляются.'
                            : 'Хранилище и антивирусная проверка ещё не подключены.'}
                    </small>
                </label>
                {attached.length > 0 && (
                    <ul>
                        {attached.map((x) => (
                            <li key={x.name}>
                                {x.name} · {Math.ceil(x.size / 1024)} КБ
                            </li>
                        ))}
                    </ul>
                )}
                {mutation.isError && <p role="alert">Не удалось создать обращение. Проверьте поля и повторите.</p>}
                <button className="button primary" disabled={mutation.isPending}>
                    Отправить обращение
                </button>
            </form>
        </>
    );
}
export function SupportDetail({ id }: { id: string }) {
    return (
        <>
            <DetailContent id={id} />
        </>
    );
}
function DetailContent({ id }: { id: string }) {
    const { api, queryClient } = useRuntime(),
        session = useSession('user'),
        [reply, setReply] = useState(''),
        [attached, setAttached] = useState<Attachment[]>([]),
        [editing, setEditing] = useState<string | null>(null),
        [editBody, setEditBody] = useState('');
    const key = ['support-detail', session.data?.id, id] as const;
    const query = useQuery({
        queryKey: key,
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/support/{id}', undefined, signal, { id })).data,
    });
    const meta = useQuery({
        queryKey: ['support-meta'],
        enabled: !!api,
        queryFn: async () => (await api!.request('GET /api/v1/support/meta')).data,
    });
    const update = (value: Success<'GET /api/v1/support/{id}'>['data']) => {
        queryClient.setQueryData(key, value);
        void queryClient.invalidateQueries({ queryKey: ['support', session.data?.id] });
    };
    const replyMutation = useMutation({
        mutationFn: async () =>
            (
                await api!.request(
                    'POST /api/v1/support/{id}/reply',
                    {
                        body: reply,
                        attachments: attached,
                        expectedVersion: query.data!.ticket.version,
                        idempotencyKey: crypto.randomUUID(),
                    },
                    undefined,
                    { id },
                )
            ).data,
        onSuccess: (value) => {
            update(value);
            setReply('');
            setAttached([]);
        },
    });
    const state = useMutation({
        mutationFn: async (kind: 'close' | 'reopen') =>
            kind === 'close'
                ? (
                      await api!.request(
                          'POST /api/v1/support/{id}/close',
                          { expectedVersion: query.data!.ticket.version, idempotencyKey: crypto.randomUUID() },
                          undefined,
                          { id },
                      )
                  ).data
                : (
                      await api!.request(
                          'POST /api/v1/support/{id}/reopen',
                          { expectedVersion: query.data!.ticket.version, idempotencyKey: crypto.randomUUID() },
                          undefined,
                          { id },
                      )
                  ).data,
        onSuccess: update,
    });
    const edit = useMutation({
        mutationFn: async (message: { id: string; version: number }) =>
            (
                await api!.request(
                    'PATCH /api/v1/support/{id}/messages/{messageId}',
                    {
                        body: editBody,
                        messageVersion: message.version,
                        expectedVersion: query.data!.ticket.version,
                        idempotencyKey: crypto.randomUUID(),
                    },
                    undefined,
                    { id, messageId: message.id },
                )
            ).data,
        onSuccess: (value) => {
            update(value);
            setEditing(null);
        },
    });
    if (query.isPending) return <p role="status">Открываем обращение…</p>;
    if (query.isError)
        return (
            <section className={styles.panel} role="alert">
                <h1>Обращение недоступно</h1>
                <Link href="/support">К списку</Link>
            </section>
        );
    const value = query.data;
    return (
        <>
            <header className={styles.heading}>
                <div>
                    <small>
                        {value.ticket.number} · {value.ticket.categoryLabel}
                    </small>
                    <h1>{value.ticket.subject}</h1>
                    <p>{value.ticket.statusLabel}</p>
                </div>
                <div className={styles.actions}>
                    <Link href="/support">К обращениям</Link>
                    <button
                        className="button outline"
                        disabled={state.isPending}
                        onClick={() => state.mutate(value.ticket.status === 'closed' ? 'reopen' : 'close')}
                    >
                        {value.ticket.status === 'closed' ? 'Возобновить' : 'Закрыть'}
                    </button>
                </div>
            </header>
            <div className={styles.conversation}>
                {value.messages.map((message) => (
                    <article className={`${styles.message} ${message.own ? styles.own : ''}`} key={message.id}>
                        <header>
                            <strong>{message.authorLabel}</strong>
                            <small>
                                {new Date(message.createdAt).toLocaleString('ru')}
                                {message.edited ? ' · изменено' : ''}
                            </small>
                        </header>
                        {editing === message.id ? (
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    edit.mutate({ id: message.id, version: message.version });
                                }}
                            >
                                <textarea
                                    required
                                    rows={5}
                                    maxLength={10000}
                                    value={editBody}
                                    onChange={(e) => setEditBody(e.target.value)}
                                />
                                <div className={styles.actions}>
                                    <button className="button primary">Сохранить</button>
                                    <button type="button" className="button outline" onClick={() => setEditing(null)}>
                                        Отмена
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <>
                                <p>{message.body}</p>
                                {message.attachments.map((file) => (
                                    <div className={styles.attachment} key={file.id}>
                                        {file.name} · {file.status === 'ready' ? 'готов' : 'проверяется'}
                                    </div>
                                ))}
                                {message.own && value.ticket.status !== 'closed' && (
                                    <button
                                        className="text-button"
                                        onClick={() => {
                                            setEditing(message.id);
                                            setEditBody(message.body);
                                        }}
                                    >
                                        Изменить
                                    </button>
                                )}
                            </>
                        )}
                    </article>
                ))}
            </div>
            {value.ticket.status !== 'closed' && (
                <form
                    className={styles.form}
                    onSubmit={(e) => {
                        e.preventDefault();
                        replyMutation.mutate();
                    }}
                >
                    <h2>Ответить</h2>
                    <textarea
                        required
                        rows={6}
                        maxLength={10000}
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                    />
                    <input
                        aria-label="Вложения"
                        type="file"
                        multiple
                        accept={meta.data?.attachmentPolicy.mime.join(',')}
                        disabled={!meta.data || meta.data.uploadMode === 'unavailable'}
                        onChange={(e) => setAttached(files(e))}
                    />
                    {meta.data?.uploadMode === 'simulation' && (
                        <small>Мок сохраняет только метаданные выбранных файлов.</small>
                    )}
                    {meta.data?.uploadMode === 'unavailable' && (
                        <small>Вложения недоступны до подключения защищённого хранилища и медиасканера.</small>
                    )}
                    <button className="button primary" disabled={replyMutation.isPending}>
                        Отправить
                    </button>
                </form>
            )}
            {(replyMutation.isError || edit.isError || state.isError) && (
                <p role="alert">Состояние изменилось или запрос не выполнен. Обновите страницу и повторите.</p>
            )}
        </>
    );
}
