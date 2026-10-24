'use client';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRuntime } from '../../app/providers.js';
import { ApiError } from '../../shared/api/client.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import { Guard, useSession } from '../auth/session.js';
import { PersonalShell } from '../personalization/shell.js';
import { useState } from 'react';
import styles from './family-notes.module.css';
function Content({ id }: { id: string }) {
    const { api } = useRuntime();
    const user = useSession('user');
    const cache = useQueryClient();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const note = useQuery({
        queryKey: ['family-note', id, user.data?.id],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/family/notes/{id}', undefined, signal, { id })).data,
    });
    const history = useQuery({
        queryKey: ['family-note-history', id, user.data?.id],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/family/notes/{id}/history', undefined, signal, { id })).data.items,
    });
    async function refresh() {
        await Promise.all([
            note.refetch(),
            history.refetch(),
            cache.invalidateQueries({ queryKey: ['family-notes', user.data?.id] }),
        ]);
    }
    async function toggle(item: NonNullable<typeof note.data>['items'][number]) {
        if (!api || !note.data) return;
        setBusy(true);
        setError(null);
        try {
            await api.request(
                'POST /api/v1/family/notes/{id}/items/{itemId}/toggle',
                {
                    expectedNoteVersion: note.data.version,
                    expectedItemVersion: item.version,
                    checked: !item.checked,
                    idempotencyKey: crypto.randomUUID(),
                },
                undefined,
                { id, itemId: item.id },
            );
            await refresh();
        } catch (reason) {
            setError(reason instanceof ApiError ? reason.message : 'Не удалось изменить пункт.');
        } finally {
            setBusy(false);
        }
    }
    async function archive() {
        if (!api || !note.data) return;
        setBusy(true);
        setError(null);
        try {
            await api.request(
                'POST /api/v1/family/notes/{id}/archive',
                {
                    expectedVersion: note.data.version,
                    archived: !note.data.archivedAt,
                    idempotencyKey: crypto.randomUUID(),
                },
                undefined,
                { id },
            );
            await refresh();
        } catch (reason) {
            setError(reason instanceof ApiError ? reason.message : 'Не удалось изменить архив.');
        } finally {
            setBusy(false);
        }
    }
    if (note.isPending) return <ArcSkeleton variant="lines" lines={7} label="Загружаем заметку" />;
    if (note.isError || !note.data)
        return (
            <p className={styles.error} role="alert">
                Заметка не найдена.
            </p>
        );
    const data = note.data;
    return (
        <div className={styles.stack}>
            <div className={styles.heading}>
                <div>
                    <span className={styles.badge}>{data.kind === 'checklist' ? 'Чек-лист' : 'Заметка'}</span>
                    <h1>{data.title}</h1>
                    <p className={styles.muted}>Автор: {data.author.displayName}</p>
                </div>
                <div className={styles.actions}>
                    <Link href="/family/notes">К списку</Link>
                    {data.canEdit && (
                        <>
                            <Link href={`/family/notes/${id}/edit`}>Редактировать</Link>
                            <button disabled={busy} onClick={() => void archive()}>
                                {data.archivedAt ? 'Восстановить' : 'В архив'}
                            </button>
                        </>
                    )}
                </div>
            </div>
            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}
            <section className={styles.panel}>
                <p>{data.body || 'Описание не добавлено.'}</p>
                {data.kind === 'checklist' && (
                    <div className={styles.items}>
                        {data.items.map((item) => (
                            <label className={styles.item} key={item.id}>
                                <input
                                    type="checkbox"
                                    checked={item.checked}
                                    disabled={busy || !!data.archivedAt}
                                    onChange={() => void toggle(item)}
                                />
                                <span className={styles['item-text']}>{item.text}</span>
                                {item.checkedBy && <small className={styles.muted}>{item.checkedBy.displayName}</small>}
                            </label>
                        ))}
                    </div>
                )}
            </section>
            <section className={styles.panel}>
                <h2>История</h2>
                {history.isPending ? (
                    <ArcSkeleton variant="lines" lines={3} label="Загружаем историю" />
                ) : (
                    <ol className={styles.history}>
                        {history.data?.map((revision) => (
                            <li key={revision.id}>
                                Версия {revision.revision} · {revision.actor.displayName} ·{' '}
                                {new Date(revision.recordedAt).toLocaleString('ru-RU')}
                            </li>
                        ))}
                    </ol>
                )}
            </section>
        </div>
    );
}
export function FamilyNoteDetail({ id }: { id: string }) {
    return (
        <Guard context="user">
            <PersonalShell>
                <Content id={id} />
            </PersonalShell>
        </Guard>
    );
}
