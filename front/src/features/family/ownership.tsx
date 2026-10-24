'use client';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useRuntime } from '../../app/providers.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { Guard, useSession } from '../auth/session.js';
import { PersonalShell } from '../personalization/shell.js';
import styles from './family.module.css';
type Preview = Success<'POST /api/v1/family/ownership/preview'>['data'];

function OwnershipContent() {
    const { api } = useRuntime();
    const session = useSession('user');
    const [target, setTarget] = useState('');
    const [preview, setPreview] = useState<Preview | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const query = useQuery({
        queryKey: ['family-ownership', session.data?.id],
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/family/ownership', undefined, signal)).data,
    });
    const review = useMutation({
        mutationFn: async () =>
            (
                await api!.request('POST /api/v1/family/ownership/preview', {
                    targetMembershipId: target,
                    expectedFamilyVersion: query.data!.familyVersion,
                })
            ).data,
        onSuccess: setPreview,
    });
    const submit = useMutation({
        mutationFn: async () =>
            (
                await api!.request('POST /api/v1/family/ownership/requests', {
                    targetMembershipId: preview!.to.id,
                    expectedFamilyVersion: preview!.familyVersion,
                    previewKey: preview!.previewKey,
                    idempotencyKey: crypto.randomUUID(),
                })
            ).data,
        onSuccess: (value) => {
            setToken(value.token);
            setPreview(null);
            void query.refetch();
        },
        onError: () => void query.refetch(),
    });
    if (query.isPending) return <p role="status">Проверяем владение…</p>;
    if (query.isError)
        return (
            <section role="alert">
                <h1>Передача владения недоступна</h1>
                <p>Проверьте, что вы владелец действующей семьи.</p>
                <button className="button outline" onClick={() => void query.refetch()}>
                    Проверить снова
                </button>
                <Link href="/family">К семье</Link>
            </section>
        );
    return (
        <>
            <h1>Передать владение семьёй</h1>
            <p>
                Запрос действует без срока. До принятия получателем владельцем остаётесь вы. После передачи вы остаётесь
                обычным участником.
            </p>
            <section className={styles.panel}>
                <p>Владелец: {query.data.owner.displayName}</p>
                <p>
                    Мест: {query.data.seatLimit}. Оплаченных дополнительных мест: {query.data.paidSeats}.
                </p>
                {query.data.pendingRequest ? (
                    <Link href={`/family/ownership/requests/${query.data.pendingRequest.id}`}>
                        Открыть действующий запрос
                    </Link>
                ) : (
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            review.mutate();
                        }}
                    >
                        <label>
                            Новый владелец
                            <select
                                required
                                value={target}
                                onChange={(event) => {
                                    setTarget(event.target.value);
                                    setPreview(null);
                                }}
                            >
                                <option value="">Выберите участника</option>
                                {query.data.candidates.map((member) => (
                                    <option key={member.id} value={member.id}>
                                        {member.displayName}
                                    </option>
                                ))}
                            </select>
                        </label>
                        {!query.data.candidates.length && <p>Нет подходящих проверенных участников.</p>}
                        <button className="button primary" disabled={!target || review.isPending}>
                            Проверить последствия
                        </button>
                    </form>
                )}
            </section>
            {review.isError && <p role="alert">Не удалось проверить последствия. Обновите сведения о семье.</p>}
            {preview && (
                <section className={styles.panel}>
                    <h2>Проверка передачи</h2>
                    <p>
                        {preview.from.displayName} → {preview.to.displayName}
                    </p>
                    <p>Оплаченные места остаются с семьёй. Личные подписки и автопродление не меняются.</p>
                    <p>
                        Семейный доступ после передачи:{' '}
                        {preview.coverage.after === 'active' ? 'активен' : 'заблокирован до подключения покрытия'}.
                    </p>
                    {preview.blockers.map((blocker) => (
                        <p key={blocker}>{blocker}</p>
                    ))}
                    <button
                        className="button primary"
                        disabled={!preview.canSubmit || submit.isPending}
                        onClick={() => submit.mutate()}
                    >
                        Отправить запрос
                    </button>
                    <button className="button outline" disabled={submit.isPending} onClick={() => setPreview(null)}>
                        Отмена
                    </button>
                </section>
            )}
            {submit.isError && (
                <p role="alert">
                    Результат отправки не подтверждён. Список запросов перечитан — проверьте его до повторной отправки.
                </p>
            )}
            {token && (
                <p role="status">
                    Запрос создан. <Link href={`/family/ownership/requests/${token}`}>Открыть запрос</Link>. Эта ссылка
                    доступна только вам и получателю после входа.
                </p>
            )}
            <Link href="/family/members">К участникам</Link>
        </>
    );
}
function RequestContent({ token }: { token: string }) {
    const { api, queryClient } = useRuntime();
    const session = useSession('user');
    const queryKey = ['family-ownership-request', session.data?.id, token] as const;
    const query = useQuery({
        queryKey,
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/family/ownership/requests/{token}', undefined, signal, { token })).data,
    });
    const mutation = useMutation({
        mutationFn: async (action: 'accept' | 'decline' | 'cancel') => {
            const value = query.data!.request;
            return (
                await api!.request(
                    action === 'accept'
                        ? 'POST /api/v1/family/ownership/requests/{token}/accept'
                        : action === 'decline'
                          ? 'POST /api/v1/family/ownership/requests/{token}/decline'
                          : 'POST /api/v1/family/ownership/requests/{token}/cancel',
                    {
                        expectedVersion: value.version,
                        expectedFamilyVersion: value.familyVersion,
                        idempotencyKey: crypto.randomUUID(),
                    },
                    undefined,
                    { token },
                )
            ).data;
        },
        onSuccess: (result) => {
            queryClient.setQueryData(queryKey, (current) =>
                current ? { ...current, request: result.request, token: result.token } : current,
            );
            void query.refetch();
            void queryClient.invalidateQueries({ queryKey: ['family'] });
            void queryClient.invalidateQueries({ queryKey: ['family-ownership'] });
        },
        onError: () => void query.refetch(),
    });
    if (query.isPending) return <p role="status">Проверяем запрос…</p>;
    if (query.isError)
        return (
            <section role="alert">
                <h1>Запрос недоступен</h1>
                <p>Войдите аккаунтом получателя или владельца. Состав семьи мог измениться.</p>
                <button className="button outline" onClick={() => void query.refetch()}>
                    Проверить снова
                </button>
                <Link href="/family">К семье</Link>
            </section>
        );
    const request = query.data.request;
    const statuses = {
        pending: 'Ожидает решения',
        accepted: 'Владение передано',
        declined: 'Отклонён получателем',
        cancelled: 'Отменён',
    };
    return (
        <>
            <h1>Запрос передачи владения</h1>
            <section className={styles.panel}>
                <p>
                    {request.from.displayName} → {request.to.displayName}
                </p>
                <p role="status">{statuses[request.status]}</p>
                <p>
                    Участников: {request.review.memberCount}. Мест: {request.review.seatLimit}; дополнительных
                    оплаченных: {request.review.paidSeats}.
                </p>
                <p>
                    Семейный доступ после принятия:{' '}
                    {request.review.coverage.after === 'active'
                        ? 'активен'
                        : 'будет заблокирован до подключения покрытия'}
                    .
                </p>
                <p>
                    Запрос бессрочный. При принятии прежний владелец остаётся участником; оплаченные места остаются с
                    семьёй. Личные подписки не передаются.
                </p>
                {request.status === 'pending' && (
                    <div className={styles.actions}>
                        {request.to.userId === session.data?.id ? (
                            <>
                                <button
                                    className="button primary"
                                    disabled={mutation.isPending}
                                    onClick={() => mutation.mutate('accept')}
                                >
                                    Принять владение
                                </button>
                                <button
                                    className="button outline"
                                    disabled={mutation.isPending}
                                    onClick={() => mutation.mutate('decline')}
                                >
                                    Отклонить запрос
                                </button>
                            </>
                        ) : (
                            <button
                                className="button outline"
                                disabled={mutation.isPending}
                                onClick={() => mutation.mutate('cancel')}
                            >
                                Отменить запрос
                            </button>
                        )}
                    </div>
                )}
                {mutation.isError && (
                    <p role="alert">
                        Изменение не подтверждено. Данные перечитаны; при изменении состава или покрытия создайте новый
                        запрос после проверки последствий.
                    </p>
                )}
            </section>
            <Link href="/family">К семье</Link>
        </>
    );
}
export function OwnershipPage() {
    return (
        <Guard context="user">
            <PersonalShell>
                <OwnershipContent />
            </PersonalShell>
        </Guard>
    );
}
export function OwnershipRequestPage({ token }: { token: string }) {
    return (
        <Guard context="user">
            <PersonalShell>
                <RequestContent token={token} />
            </PersonalShell>
        </Guard>
    );
}
