'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useRuntime } from '../../app/providers.js';
import { ApiError } from '../../shared/api/client.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { InlineLoader as ArcInlineLoader } from '@meal-planner/design-system';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import { Guard, useSession } from '../auth/session.js';
import { PersonalShell } from '../personalization/shell.js';
import styles from './family-notes.module.css';

type Item = { id?: string; text: string };
type Note = Success<'GET /api/v1/family/notes/{id}'>['data'];
function Form({ id, source }: { id?: string | undefined; source?: Note | undefined }) {
    const { api } = useRuntime();
    const router = useRouter();
    const [kind, setKind] = useState<'note' | 'checklist'>(source?.kind ?? 'note');
    const [title, setTitle] = useState(source?.title ?? '');
    const [body, setBody] = useState(source?.body ?? '');
    const [items, setItems] = useState<Item[]>(
        source?.items.map((item) => ({ id: item.id, text: item.text })) ?? [{ text: '' }],
    );
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!api) return;
        setBusy(true);
        setError(null);
        const payload = {
            kind,
            title,
            body,
            items:
                kind === 'checklist'
                    ? items.filter((item) => item.text.trim()).map((item) => ({ ...item, text: item.text.trim() }))
                    : [],
            idempotencyKey: crypto.randomUUID(),
        };
        try {
            const result = id
                ? await api.request(
                      'PUT /api/v1/family/notes/{id}',
                      { ...payload, expectedVersion: source!.version },
                      undefined,
                      { id },
                  )
                : await api.request('POST /api/v1/family/notes', payload);
            router.push(`/family/notes/${result.data.id}`);
        } catch (reason) {
            setError(reason instanceof ApiError ? reason.message : 'Не удалось сохранить заметку.');
        } finally {
            setBusy(false);
        }
    }
    if (source && !source.canEdit)
        return (
            <p className={styles.error} role="alert">
                Редактирование доступно только автору.
            </p>
        );
    return (
        <form className={`${styles.panel} ${styles.form}`} onSubmit={(event) => void submit(event)}>
            <div className={styles.heading}>
                <h1>{id ? 'Редактировать заметку' : 'Новая семейная заметка'}</h1>
                <Link href={id ? `/family/notes/${id}` : '/family/notes'}>Отмена</Link>
            </div>
            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}
            <label>
                Тип
                <select value={kind} onChange={(event) => setKind(event.target.value as 'note' | 'checklist')}>
                    <option value="note">Текстовая заметка</option>
                    <option value="checklist">Чек-лист</option>
                </select>
            </label>
            <label>
                Название
                <input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label>
                Описание
                <textarea maxLength={10000} value={body} onChange={(event) => setBody(event.target.value)} />
            </label>
            {kind === 'checklist' && (
                <fieldset>
                    <legend>Пункты</legend>
                    <div className={styles.items}>
                        {items.map((item, index) => (
                            <div className={styles.item} key={item.id ?? index}>
                                <input
                                    className={styles['item-text']}
                                    required
                                    value={item.text}
                                    maxLength={500}
                                    onChange={(event) =>
                                        setItems((current) =>
                                            current.map((value, position) =>
                                                position === index ? { ...value, text: event.target.value } : value,
                                            ),
                                        )
                                    }
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        setItems((current) => current.filter((_, position) => position !== index))
                                    }
                                >
                                    Убрать
                                </button>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={() => setItems((current) => [...current, { text: '' }])}>
                        Добавить пункт
                    </button>
                </fieldset>
            )}
            <button
                disabled={busy || !title.trim() || (kind === 'checklist' && !items.some((item) => item.text.trim()))}
            >
                {busy ? <ArcInlineLoader label="Сохраняем…" /> : 'Сохранить'}
            </button>
        </form>
    );
}
function LoadedForm({ id }: { id: string }) {
    const { api } = useRuntime();
    const user = useSession('user');
    const note = useQuery({
        queryKey: ['family-note', id, user.data?.id],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/family/notes/{id}', undefined, signal, { id })).data,
    });
    if (note.isPending) return <ArcSkeleton variant="lines" lines={6} label="Загружаем заметку" />;
    if (note.isError || !note.data)
        return (
            <p className={styles.error} role="alert">
                Заметка недоступна.
            </p>
        );
    return <Form key={`${note.data.id}:${note.data.version}`} id={id} source={note.data} />;
}
export function FamilyNoteEditor({ id }: { id?: string | undefined }) {
    return (
        <Guard context="user">
            <PersonalShell>{id ? <LoadedForm id={id} /> : <Form />}</PersonalShell>
        </Guard>
    );
}
