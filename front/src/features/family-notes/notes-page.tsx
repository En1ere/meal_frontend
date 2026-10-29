'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useRuntime } from '../../shared/runtime/index.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import { useSession } from '../../entities/session/client.js';
import styles from './family-notes.module.css';

function Content() {
    const { api } = useRuntime();
    const user = useSession('user');
    const router = useRouter();
    const search = useSearchParams();
    const tab = search.get('tab') === 'archived' ? 'archived' : 'active';
    const q = search.get('q') ?? '';
    const [draft, setDraft] = useState(q);
    const notes = useQuery({
        queryKey: ['family-notes', user.data?.id, tab, q],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/family/notes', undefined, signal, undefined, { query: { tab, q } })).data
                .items,
    });
    function submit(event: FormEvent) {
        event.preventDefault();
        const params = new URLSearchParams({ tab });
        if (draft.trim()) params.set('q', draft.trim());
        router.push(`/family/notes?${params}`);
    }
    return (
        <div className={styles.stack}>
            <div className={styles.heading}>
                <div>
                    <h1>Семейные заметки</h1>
                    <p className={styles.muted}>
                        Заметки видят все участники. Текст меняет автор, отметки чек-листа — любой участник.
                    </p>
                </div>
                <Link href="/family/notes/new">Новая заметка</Link>
            </div>
            <form className={styles.filters} onSubmit={submit}>
                <input
                    aria-label="Поиск заметок"
                    value={draft}
                    maxLength={100}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Поиск"
                />
                <button className={styles.button}>Найти</button>
                <Link href={`/family/notes?tab=${tab === 'active' ? 'archived' : 'active'}`}>
                    {tab === 'active' ? 'Архив' : 'Активные'}
                </Link>
            </form>
            {notes.isPending ? (
                <ArcSkeleton variant="lines" lines={6} label="Загружаем заметки" />
            ) : notes.isError ? (
                <p className={styles.error} role="alert">
                    Не удалось загрузить заметки.
                </p>
            ) : (
                <div className={styles.grid}>
                    {notes.data.map((note) => (
                        <Link className={styles.card} href={`/family/notes/${note.id}`} key={note.id}>
                            <span className={styles.badge}>{note.kind === 'checklist' ? 'Чек-лист' : 'Заметка'}</span>
                            <strong>{note.title}</strong>
                            <span>{note.body || 'Без описания'}</span>
                            <small className={styles.muted}>
                                {note.author.displayName}
                                {note.kind === 'checklist'
                                    ? ` · ${note.items.filter((item) => item.checked).length}/${note.items.length}`
                                    : ''}
                            </small>
                        </Link>
                    ))}
                    {!notes.data.length && <p className={styles.muted}>В этом разделе заметок нет.</p>}
                </div>
            )}
        </div>
    );
}
export function FamilyNotesPage() {
    return (
        <>
            <Content />
        </>
    );
}
