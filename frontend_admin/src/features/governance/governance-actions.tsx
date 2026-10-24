import { useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../app/providers.js';
import { ApiError } from '../../shared/api/client.js';
import { CriticalConfirmation } from '../auth/critical-confirmation.js';
import { useRequestSignal } from '../auth/use-request-signal.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
const categories = [
    ['spam', 'Спам и навязчивая реклама'],
    ['harassment', 'Оскорбления, травля и угрозы'],
    ['discrimination', 'Дискриминация и разжигание ненависти'],
    ['privacy', 'Нарушение приватности'],
    ['copyright', 'Нарушение авторства и прав на контент'],
    ['dangerous', 'Опасный контент и вводящие в заблуждение рекомендации'],
    ['inappropriate', 'Недопустимые публикации'],
    ['fraud', 'Мошенничество и манипуляции'],
    ['evasion', 'Обход ограничений и злоупотребление сервисом'],
    ['other', 'Иное нарушение правил'],
    ['rules', 'Нарушение правил использования сервиса'],
];
export function GovernanceActions({ section, id }: { section: 'users' | 'sanctions' | 'access'; id: string }) {
    const { api, queryClient } = useRuntime();
    const begin = useRequestSignal();
    const [action, setAction] = useState(
        section === 'users' ? 'ban' : section === 'sanctions' ? 'revoke' : 'revokeRole',
    );
    const [appealId, setAppealId] = useState('');
    const [category, setCategory] = useState('');
    const [scope, setScope] = useState('account');
    const [starts, setStarts] = useState('');
    const [ends, setEnds] = useState('');
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');
    const [allow, setAllow] = useState(false);
    const [subscriptionDisposition, setSubscriptionDisposition] = useState<'keep' | 'transfer'>('keep');
    const [subscriptionRecipientUserId, setSubscriptionRecipientUserId] = useState('');
    const [confirmed, setConfirmed] = useState(false);
    const [preview, setPreview] = useState('');
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState('');
    const lock = useRef(false);
    const attempt = useRef<{
        fingerprint: string;
        key: string;
        version: string;
        appealVersion: string | undefined;
    } | null>(null);
    const query = useQuery({
        queryKey: ['admin-governance', section, id],
        enabled: !!api,
        queryFn: async ({ signal }) => {
            if (!api) throw new Error('Подключение не готово');
            return (
                await api.request('GET /api/v1/admin/governance/{section}/{id}', undefined, signal, { section, id })
            ).data;
        },
    });
    const fingerprint = JSON.stringify([
        action,
        category,
        scope,
        starts,
        ends,
        reason,
        note,
        allow,
        appealId,
        subscriptionDisposition,
        subscriptionRecipientUserId,
    ]);
    const previewFingerprint = JSON.stringify([fingerprint, query.data?.version]);
    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!api || !query.data || lock.current) return;
        if (preview !== previewFingerprint) {
            setPreview(previewFingerprint);
            setConfirmed(false);
            return;
        }
        if (!confirmed) return;
        if (attempt.current && attempt.current.fingerprint !== fingerprint) {
            setFeedback('Повторите прежнее действие: его результат пока неизвестен.');
            return;
        }
        attempt.current ??= {
            fingerprint,
            key: crypto.randomUUID(),
            version: query.data.version,
            appealVersion: query.data.appeals.find((a) => a.id === appealId)?.version,
        };
        lock.current = true;
        setBusy(true);
        const signal = begin();
        try {
            await api.request(
                'POST /api/v1/admin/governance/{section}/{id}',
                {
                    version: attempt.current.version,
                    idempotencyKey: attempt.current.key,
                    action,
                    category: category || null,
                    scope,
                    startsAt: starts ? new Date(starts).toISOString() : null,
                    endsAt: ends ? new Date(ends).toISOString() : null,
                    reason,
                    privateNote: note,
                    allowTemporaryBan: allow,
                    subscriptionDisposition,
                    subscriptionRecipientUserId:
                        subscriptionDisposition === 'transfer' ? subscriptionRecipientUserId : null,
                    confirmed: true,
                    ...(action === 'acceptAppeal' || action === 'rejectAppeal'
                        ? { appealId, appealVersion: attempt.current.appealVersion }
                        : {}),
                },
                signal,
                { section, id },
            );
            signal.throwIfAborted();
            attempt.current = null;
            setPreview('');
            setConfirmed(false);
            setFeedback('Действие сохранено в тестовых данных и истории.');
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['admin-governance'] }),
                queryClient.invalidateQueries({ queryKey: ['admin'] }),
                queryClient.invalidateQueries({ queryKey: ['admin-detail'] }),
                queryClient.invalidateQueries({ queryKey: ['admin-related'] }),
            ]);
        } catch (error) {
            if (signal.aborted) return;
            if (error instanceof ApiError && error.status < 500) {
                attempt.current = null;
                if (error.status === 409) void query.refetch();
            }
            setFeedback(error instanceof Error ? error.message : 'Неизвестный результат. Повторите прежний запрос.');
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }
    if (query.isPending) return <ArcSkeleton variant="lines" lines={3} label="Загружаем управление доступом…" />;
    if (query.isError)
        return (
            <section className="sessions-panel">
                <p role="alert">{query.error.message}</p>
                <button className="button outline" onClick={() => void query.refetch()}>
                    Повторить
                </button>
            </section>
        );
    const data = query.data;
    return (
        <section className="sessions-panel">
            <h2>Санкции и служебные права</h2>
            <p>
                {data.name} · {data.status}
            </p>
            {data.soleAdmin && <p>Единственного администратора нельзя заблокировать или лишить роли.</p>}
            <CriticalConfirmation />
            <form onSubmit={(e) => void submit(e)}>
                <label>
                    Действие
                    <select value={action} onChange={(e) => setAction(e.target.value)} disabled={busy}>
                        {section === 'users' ? (
                            <>
                                <option value="ban">Ограничить доступ</option>
                                <option value="grantModerator">Назначить модератора / изменить права</option>
                            </>
                        ) : section === 'sanctions' ? (
                            <>
                                <option value="revoke">Снять ограничение</option>
                                <option value="extend">Продлить ограничение</option>
                                <option value="acceptAppeal">Удовлетворить апелляцию</option>
                                <option value="rejectAppeal">Отклонить апелляцию</option>
                            </>
                        ) : (
                            <option value="revokeRole">Отозвать служебную роль</option>
                        )}
                    </select>
                </label>
                {(action === 'acceptAppeal' || action === 'rejectAppeal') && (
                    <label>
                        Апелляция
                        <select required value={appealId} onChange={(e) => setAppealId(e.target.value)} disabled={busy}>
                            <option value="">Выберите обращение</option>
                            {data.appeals
                                .filter((a) => a.status === 'pending')
                                .map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.body.slice(0, 100)}
                                    </option>
                                ))}
                        </select>
                    </label>
                )}
                {action === 'ban' && (
                    <>
                        <label>
                            Категория причины
                            <select
                                required
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                disabled={busy}
                            >
                                <option value="">Выберите категорию</option>
                                {categories.map(([key, label]) => (
                                    <option key={key} value={key}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            Область
                            <select value={scope} onChange={(e) => setScope(e.target.value)} disabled={busy}>
                                <option value="account">Весь аккаунт — только просмотр</option>
                                <option value="ai">ИИ</option>
                                <option value="publications">Публикации</option>
                                <option value="comments">Комментарии</option>
                            </select>
                        </label>
                        <label>
                            Начало (местное время; пусто — сейчас)
                            <input
                                type="datetime-local"
                                value={starts}
                                onChange={(e) => setStarts(e.target.value)}
                                disabled={busy}
                            />
                        </label>
                    </>
                )}
                {action === 'ban' && scope === 'account' && data.familySubscription && (
                    <fieldset>
                        <legend>Семейная подписка Plus</legend>
                        <p>
                            {data.familySubscription.familyName}: семья продолжит пользоваться оплаченным периодом.
                            Автопродление будет отключено.
                        </p>
                        <label>
                            <input
                                type="radio"
                                name="subscription-disposition"
                                checked={subscriptionDisposition === 'keep'}
                                onChange={() => {
                                    setSubscriptionDisposition('keep');
                                    setSubscriptionRecipientUserId('');
                                }}
                            />
                            Оставить владельца заблокированным, сохранив покрытие семьи
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="subscription-disposition"
                                checked={subscriptionDisposition === 'transfer'}
                                disabled={!data.familySubscription.candidates.length || !!starts}
                                onChange={() => setSubscriptionDisposition('transfer')}
                            />
                            Передать Plus участнику семьи сейчас
                        </label>
                        {subscriptionDisposition === 'transfer' && (
                            <label>
                                Новый владелец
                                <select
                                    required
                                    value={subscriptionRecipientUserId}
                                    onChange={(event) => setSubscriptionRecipientUserId(event.target.value)}
                                >
                                    <option value="">Выберите участника</option>
                                    {data.familySubscription.candidates.map((candidate) => (
                                        <option key={candidate.userId} value={candidate.userId}>
                                            {candidate.displayName} (@{candidate.login})
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}
                    </fieldset>
                )}
                {(action === 'ban' || action === 'extend') && (
                    <label>
                        Окончание (местное время; пусто — бессрочно)
                        <input
                            type="datetime-local"
                            value={ends}
                            onChange={(e) => setEnds(e.target.value)}
                            disabled={busy}
                        />
                    </label>
                )}
                {action === 'grantModerator' && (
                    <label>
                        <input
                            type="checkbox"
                            checked={allow}
                            onChange={(e) => setAllow(e.target.checked)}
                            disabled={busy}
                        />
                        Разрешить временные баны публикаций и комментариев до 24 часов
                    </label>
                )}
                <label>
                    {action === 'acceptAppeal' || action === 'rejectAppeal'
                        ? 'Ответ пользователю по апелляции'
                        : action === 'ban'
                          ? 'Объяснение пользователю'
                          : 'Причина действия'}
                    <textarea
                        required
                        maxLength={5000}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        disabled={busy}
                    />
                </label>
                {action === 'ban' && (
                    <label>
                        Внутренняя заметка
                        <textarea
                            maxLength={5000}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            disabled={busy}
                        />
                    </label>
                )}
                {preview === previewFingerprint && (
                    <div role="region" aria-label="Последствия действия">
                        <h3>Проверка последствий</h3>
                        <p>
                            Пользователь: {data.name}. Причина: {reason}
                        </p>
                        {action === 'ban' ? (
                            <>
                                <p>
                                    Область: {scope}. Начало: {starts || 'сейчас'}. Окончание: {ends || 'бессрочно'}.
                                    Оплаченный период не продлевается и не замораживается.
                                </p>
                                {scope === 'account' && (
                                    <p>
                                        Обычные действия блокируются, просмотр сохраняется. Доступны апелляция,
                                        безопасность, отключение автопродления и передача семейного Pro. Автопродление
                                        отключается при вступлении бана в силу; семья сохраняет оплаченное покрытие.
                                    </p>
                                )}
                                <p>
                                    Уведомления семье и предложение передачи Pro требуют интеграции основного
                                    приложения; в этом мок-срезе не доставляются.
                                </p>
                            </>
                        ) : action === 'acceptAppeal' || action === 'rejectAppeal' ? (
                            <p>
                                {action === 'acceptAppeal'
                                    ? 'Это ограничение будет снято. Остальные ограничения сохраняются.'
                                    : 'Ограничение останется без изменений.'}{' '}
                                Ответ по апелляции виден пользователю, решение сохраняется в истории.
                            </p>
                        ) : (
                            <p>
                                Изменение попадёт в аудит. При изменении служебных прав служебные сессии отзываются,
                                обычный аккаунт сохраняется.
                            </p>
                        )}
                        <label>
                            <input
                                type="checkbox"
                                checked={confirmed}
                                onChange={(e) => setConfirmed(e.target.checked)}
                                disabled={busy}
                            />
                            Подтверждаю указанные последствия
                        </label>
                    </div>
                )}
                <button
                    className="button primary"
                    disabled={
                        busy ||
                        (data.soleAdmin && ['ban', 'revokeRole', 'grantModerator'].includes(action)) ||
                        (preview === previewFingerprint && !confirmed)
                    }
                >
                    {busy ? 'Сохраняем…' : preview === previewFingerprint ? 'Выполнить' : 'Проверить последствия'}
                </button>
            </form>
            {feedback && <p role="status">{feedback}</p>}
            {section === 'sanctions' && (
                <section>
                    <h3>Апелляции</h3>
                    {data.appeals.length ? (
                        data.appeals.map((a) => (
                            <article key={a.id}>
                                <p>
                                    {new Date(a.submittedAt).toLocaleString()} ·{' '}
                                    {(
                                        {
                                            pending: 'Ожидает решения',
                                            accepted: 'Удовлетворена',
                                            rejected: 'Отклонена',
                                        } as Record<string, string>
                                    )[a.status] ?? a.status}
                                </p>
                                <p>{a.body}</p>
                                {a.response && <p>Ответ пользователю: {a.response}</p>}
                            </article>
                        ))
                    ) : (
                        <p>Апелляций пока нет.</p>
                    )}
                </section>
            )}
            <h3>История</h3>
            {data.history.length ? (
                data.history.map((entry, i) => (
                    <p key={i}>
                        {new Date(entry.at).toLocaleString()} · {entry.action}: {entry.reason}
                    </p>
                ))
            ) : (
                <p>Изменений пока нет.</p>
            )}
        </section>
    );
}
