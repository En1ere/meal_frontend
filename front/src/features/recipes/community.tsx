'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../shared/runtime/index.js';
import { useSession } from '../../entities/session/client.js';
import { RecipeLoading, RecipeError } from './shared.js';
import { useRecipeCommand } from './use-command.js';
import { useConsent } from '../../entities/consent/client.js';
import styles from './workspace.module.css';
const reasons: Record<string, string> = {
    copyright: 'Нарушение авторских прав',
    dangerous: 'Опасный рецепт',
    inappropriate: 'Неприемлемый контент',
    community: 'Нарушение правил сообщества',
    'personal-data': 'Персональные данные',
    quality: 'Недостоверная информация',
    fake: 'Поддельная активность',
};
export function RecipeCommunity({ id }: { id: string }) {
    const { api, queryClient } = useRuntime();
    const user = useSession('user');
    const command = useRecipeCommand();
    const dissemination = useConsent('dissemination');
    const [body, setBody] = useState(''),
        [reply, setReply] = useState<string | null>(null),
        [editing, setEditing] = useState<{ id: string; version: number } | null>(null),
        [rating, setRating] = useState(5),
        [reason, setReason] = useState('community'),
        [report, setReport] = useState(''),
        [reportTarget, setReportTarget] = useState<string | null>(null),
        [notice, setNotice] = useState('');
    const ratingDialog = useRef<HTMLDialogElement>(null),
        reportDialog = useRef<HTMLDialogElement>(null);
    const query = useQuery({
        queryKey: ['recipe-community', user.data?.id, id],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/recipe-workspace/{id}/community', undefined, signal, { id })).data,
    });
    const refresh = () =>
        Promise.all([
            queryClient.invalidateQueries({ queryKey: ['recipe-community'] }),
            queryClient.invalidateQueries({ queryKey: ['recipes', 'public', id] }),
        ]);
    async function comment() {
        const data = query.data;
        if (!data) return;
        const result = editing
            ? await command.run(
                  'PATCH /api/v1/recipe-workspace/{id}/comments/{commentId}',
                  { body, expectedVersion: editing.version },
                  { id, commentId: editing.id },
              )
            : await command.run(
                  'POST /api/v1/recipe-workspace/{id}/comments',
                  { body, attemptId: data.attemptId, replyToId: reply },
                  { id },
              );
        if (result) {
            setBody('');
            setReply(null);
            setEditing(null);
            setNotice('Комментарий сохранён.');
            await refresh();
        }
    }
    async function vote() {
        if (!query.data?.attemptId) return;
        const result = await command.run(
            'POST /api/v1/recipe-workspace/{id}/rating',
            { value: rating, confirmed: true, attemptId: query.data.attemptId },
            { id },
        );
        if (result) {
            ratingDialog.current?.close();
            await refresh();
            setNotice('Оценка сохранена.');
        }
    }
    async function sendReport() {
        const result = await command.run(
            'POST /api/v1/recipe-workspace/{id}/reports',
            { reason, comment: report || null, commentId: reportTarget },
            { id },
        );
        if (result) {
            reportDialog.current?.close();
            setReport('');
            setNotice('Жалоба отправлена на рассмотрение.');
            await refresh();
        }
    }
    if (!user.data)
        return (
            <p>
                <Link href={`/auth?returnTo=${encodeURIComponent(`/recipes/${id}?tab=comments`)}`}>Войдите</Link>, чтобы
                участвовать в обсуждении после приготовления.
            </p>
        );
    if (query.isPending) return <RecipeLoading />;
    if (query.isError) return <RecipeError error={query.error} retry={() => void query.refetch()} />;
    return (
        <div className={styles.stack}>
            <h2>Обсуждение и оценка</h2>
            <Link href="/reports">Мои жалобы</Link>
            {!dissemination.enabled && (
                <p className={styles.notice} role="status">
                    Новые комментарии и оценки заблокированы, пока не разрешена публикация материалов.{' '}
                    <Link
                        href={`/settings/privacy?consent=dissemination&returnTo=${encodeURIComponent(`/recipes/${id}?tab=comments`)}`}
                    >
                        Ознакомиться и согласиться
                    </Link>
                </p>
            )}
            {command.error && <p role="alert">{command.error}</p>}
            {notice && <p role="status">{notice}</p>}
            <div className={styles.actions}>
                {query.data.rating ? (
                    <p>Ваша оценка: {query.data.rating} из 5. Повторное голосование недоступно.</p>
                ) : (
                    <button
                        disabled={!query.data.attemptId || command.pending || !dissemination.enabled}
                        onClick={() => ratingDialog.current?.showModal()}
                    >
                        Оценить рецепт
                    </button>
                )}
                <button
                    onClick={() => {
                        setReportTarget(null);
                        reportDialog.current?.showModal();
                    }}
                >
                    Пожаловаться на рецепт
                </button>
            </div>
            {!query.data.attemptId && (
                <p className={styles.notice}>
                    Комментарии, ответы и оценка доступны после подтверждённого приготовления.
                </p>
            )}
            {query.data.comments.map((comment) => (
                <article className={styles.panel} key={comment.id}>
                    <div className={styles.actions}>
                        <strong>{comment.authorLogin ? `@${comment.authorLogin}` : 'Автор не указан'}</strong>
                        <time dateTime={comment.createdAt}>
                            {new Date(comment.createdAt).toLocaleDateString('ru-RU')}
                        </time>
                        {comment.editedAt && <span>Отредактировано</span>}
                    </div>
                    {comment.replyToId && <p>Ответ на комментарий</p>}
                    <p>{comment.body}</p>
                    <div className={styles.actions}>
                        <button
                            disabled={!query.data.attemptId || command.pending || !dissemination.enabled}
                            onClick={() => {
                                setReply(comment.id);
                                setEditing(null);
                                setBody('');
                            }}
                        >
                            Ответить
                        </button>
                        {comment.isOwn && (
                            <>
                                <button
                                    disabled={command.pending}
                                    onClick={() => {
                                        setEditing({ id: comment.id, version: comment.version });
                                        setBody(comment.body);
                                        setReply(null);
                                    }}
                                >
                                    Редактировать
                                </button>
                                <button
                                    disabled={command.pending}
                                    onClick={() =>
                                        void command
                                            .run(
                                                'POST /api/v1/recipe-workspace/{id}/comments/{commentId}/remove',
                                                { expectedVersion: comment.version },
                                                { id, commentId: comment.id },
                                            )
                                            .then((result) => (result ? refresh() : undefined))
                                    }
                                >
                                    Удалить
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => {
                                setReportTarget(comment.id);
                                reportDialog.current?.showModal();
                            }}
                        >
                            Пожаловаться
                        </button>
                    </div>
                </article>
            ))}
            {!query.data.comments.length && <p>Комментариев пока нет.</p>}
            {((query.data.attemptId && dissemination.enabled) || editing) && (
                <form
                    className={styles.panel}
                    onSubmit={(e) => {
                        e.preventDefault();
                        void comment();
                    }}
                >
                    <h3>
                        {editing ? 'Редактирование комментария' : reply ? 'Ответ на комментарий' : 'Новый комментарий'}
                    </h3>
                    <textarea
                        aria-label="Текст комментария"
                        required
                        maxLength={5000}
                        rows={4}
                        disabled={command.pending || command.unknown}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                    />
                    <p>Прикрепление медиа пока недоступно.</p>
                    <div className={styles.actions}>
                        <button disabled={command.pending}>Сохранить комментарий</button>
                        {(reply || editing) && (
                            <button
                                type="button"
                                disabled={command.pending || command.unknown}
                                onClick={() => {
                                    setReply(null);
                                    setEditing(null);
                                    setBody('');
                                }}
                            >
                                Отмена
                            </button>
                        )}
                    </div>
                </form>
            )}
            {!!query.data.reports.length && (
                <section className={styles.panel}>
                    <h3>Мои обращения</h3>
                    {query.data.reports.map((report) => (
                        <p key={report.id}>
                            {reasons[report.reason] ?? report.reason}:{' '}
                            {report.status === 'pending' ? 'На рассмотрении' : report.status}
                        </p>
                    ))}
                </section>
            )}
            <dialog ref={ratingDialog} className={styles.dialog} aria-label="Подтверждение оценки">
                <h2>Оцените приготовленный рецепт</h2>
                <label>
                    Оценка
                    <select
                        value={rating}
                        onChange={(e) => setRating(Number(e.target.value))}
                        disabled={command.pending || command.unknown}
                    >
                        {[1, 2, 3, 4, 5].map((value) => (
                            <option key={value} value={value}>
                                {value} из 5
                            </option>
                        ))}
                    </select>
                </label>
                <p>После подтверждения оценку нельзя изменить.</p>
                {command.error && <p role="alert">{command.error}</p>}
                <button disabled={command.pending} onClick={() => void vote()}>
                    Подтвердить оценку
                </button>
                <button disabled={command.pending || command.unknown} onClick={() => ratingDialog.current?.close()}>
                    Отмена
                </button>
            </dialog>
            <dialog ref={reportDialog} className={styles.dialog} aria-label="Жалоба">
                <h2>{reportTarget ? 'Жалоба на комментарий' : 'Жалоба на рецепт'}</h2>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        void sendReport();
                    }}
                    className={styles.stack}
                >
                    <label>
                        Причина
                        <select
                            value={reason}
                            disabled={command.pending || command.unknown}
                            onChange={(e) => setReason(e.target.value)}
                        >
                            {Object.entries(reasons).map(([v, l]) => (
                                <option key={v} value={v}>
                                    {l}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Пояснение
                        <textarea
                            maxLength={5000}
                            value={report}
                            disabled={command.pending || command.unknown}
                            onChange={(e) => setReport(e.target.value)}
                        />
                    </label>
                    {command.error && <p role="alert">{command.error}</p>}
                    <button disabled={command.pending}>Отправить жалобу</button>
                    <button
                        type="button"
                        disabled={command.pending || command.unknown}
                        onClick={() => reportDialog.current?.close()}
                    >
                        Отмена
                    </button>
                </form>
            </dialog>
        </div>
    );
}
