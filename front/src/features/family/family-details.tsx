'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useRuntime } from '../../app/providers.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { InlineLoader as ArcInlineLoader } from '@meal-planner/design-system';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import { Guard, useSession } from '../auth/session.js';
import { PersonalShell } from '../personalization/shell.js';
import styles from './family.module.css';

type Family = NonNullable<Success<'GET /api/v1/family'>['data']['family']>;

function MembersPanel({ family, userId }: { family: Family; userId: string }) {
    const { api, queryClient } = useRuntime();
    const [selected, setSelected] = useState<Family['members'][number] | null>(null);
    const removeDialog = useRef<HTMLDialogElement>(null);
    const key = useRef(crypto.randomUUID());
    const [login, setLogin] = useState('');
    const [inviteLink, setInviteLink] = useState('');
    const invitations = useQuery({
        queryKey: ['family-invitations', userId],
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/family/invitations', undefined, signal)).data,
    });
    const invite = useMutation({
        mutationFn: async () =>
            (
                await api!.request('POST /api/v1/family/invitations', {
                    login,
                    expectedVersion: family.version,
                    idempotencyKey: crypto.randomUUID(),
                })
            ).data,
        onSuccess: async (result) => {
            setLogin('');
            setInviteLink(result.token ? `${window.location.origin}/family/invite?token=${result.token}` : '');
            await invitations.refetch();
        },
    });
    const decide = useMutation({
        mutationFn: async ({ id, version, action }: { id: string; version: number; action: 'approve' | 'cancel' }) =>
            (
                await api!.request(
                    action === 'approve'
                        ? 'POST /api/v1/family/invitations/{invitationId}/approve'
                        : 'POST /api/v1/family/invitations/{invitationId}/cancel',
                    { expectedVersion: version, idempotencyKey: crypto.randomUUID() },
                    undefined,
                    { invitationId: id },
                )
            ).data,
        onSuccess: async (result) => {
            setInviteLink(result.token ? `${window.location.origin}/family/invite?token=${result.token}` : '');
            await invitations.refetch();
        },
    });
    function submitInvitation(event: FormEvent) {
        event.preventDefault();
        invite.mutate();
    }
    const remove = useMutation({
        mutationFn: async (member: Family['members'][number]) =>
            (
                await api!.request(
                    'POST /api/v1/family/members/{membershipId}/remove',
                    { expectedVersion: family.version, idempotencyKey: key.current },
                    undefined,
                    { membershipId: member.id },
                )
            ).data,
        onSuccess: (result) => {
            queryClient.setQueryData(['family', userId], result);
            setSelected(null);
            key.current = crypto.randomUUID();
        },
    });
    useEffect(() => {
        const node = removeDialog.current;
        if (selected && node && !node.open) node.showModal();
    }, [selected]);
    return (
        <div className={styles.stack}>
            <section className={styles.panel}>
                <p className={styles.eyebrow}>Семья · Участники</p>
                <h1>{family.name}</h1>
                <p>
                    {family.memberCount} из {family.seatLimit} мест занято. Профили без аккаунта и будущие приглашения
                    места не занимают.
                </p>
            </section>
            <section className={styles.panel}>
                <ul className={styles.members}>
                    {family.members.map((member) => (
                        <li className={styles.member} key={member.id}>
                            <div>
                                <strong>{member.displayName}</strong>
                                <p className={styles.muted}>{member.role === 'owner' ? 'Владелец' : 'Участник'}</p>
                            </div>
                            <div className={styles.actions}>
                                {member.userId === userId && <span>Это вы</span>}
                                {family.role === 'owner' && member.userId !== userId && (
                                    <button
                                        className="text-button"
                                        onClick={() => {
                                            key.current = crypto.randomUUID();
                                            setSelected(member);
                                        }}
                                    >
                                        Исключить
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            </section>
            <section className={styles.panel}>
                <h2>{family.role === 'owner' ? 'Пригласить участника' : 'Предложить приглашение'}</h2>
                <p className={styles.muted}>
                    Адресат задаётся точным уникальным логином. Ссылка действует 7 дней; предложение участника сначала
                    подтверждает владелец.
                </p>
                <form className={styles.form} onSubmit={submitInvitation}>
                    <label>
                        Логин
                        <input
                            required
                            minLength={3}
                            maxLength={30}
                            value={login}
                            onChange={(event) => setLogin(event.target.value)}
                        />
                    </label>
                    <button className="button primary" disabled={invite.isPending}>
                        {invite.isPending && <ArcInlineLoader label={null} />}
                        {family.role === 'owner' ? 'Создать приглашение' : 'Отправить владельцу'}
                    </button>
                </form>
                {invite.isError && <p role="alert">Проверьте логин, свободные места и актуальность состава.</p>}
                {inviteLink && (
                    <div className={styles.notice} role="status">
                        <strong>Ссылка создана</strong>
                        <p className={styles.muted}>
                            Передайте её указанному пользователю. Другой аккаунт принять её не сможет.
                        </p>
                        <input readOnly value={inviteLink} aria-label="Ссылка приглашения" />
                        <button
                            className="button outline"
                            onClick={() => void navigator.clipboard.writeText(inviteLink)}
                        >
                            Скопировать
                        </button>
                    </div>
                )}
                {invitations.isPending ? (
                    <ArcSkeleton variant="lines" lines={2} label="Загружаем приглашения" />
                ) : invitations.data?.items.length ? (
                    <ul className={styles.members}>
                        {invitations.data.items.map((invitation) => (
                            <li className={styles.member} key={invitation.id}>
                                <div>
                                    <strong>{invitation.recipientDisplayName}</strong>
                                    <p className={styles.muted}>
                                        @{invitation.recipientLogin} · {invitation.status}
                                    </p>
                                </div>
                                <div className={styles.actions}>
                                    {family.role === 'owner' && invitation.status === 'proposed' && (
                                        <button
                                            className="button outline"
                                            disabled={decide.isPending}
                                            onClick={() =>
                                                decide.mutate({
                                                    id: invitation.id,
                                                    version: invitation.version,
                                                    action: 'approve',
                                                })
                                            }
                                        >
                                            Подтвердить
                                        </button>
                                    )}
                                    {['proposed', 'pending'].includes(invitation.status) &&
                                        (family.role === 'owner' || invitation.proposedByMe) && (
                                            <button
                                                className="text-button"
                                                disabled={decide.isPending}
                                                onClick={() =>
                                                    decide.mutate({
                                                        id: invitation.id,
                                                        version: invitation.version,
                                                        action: 'cancel',
                                                    })
                                                }
                                            >
                                                Отменить
                                            </button>
                                        )}
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className={styles.muted}>Активных приглашений нет.</p>
                )}
            </section>
            <Link href="/family">← Вернуться к семье</Link>
            {selected && (
                <dialog
                    ref={removeDialog}
                    className={styles.modal}
                    aria-labelledby="remove-title"
                    onClose={() => setSelected(null)}
                >
                    <h2 id="remove-title">Исключить {selected.displayName}?</h2>
                    <p>Семейные данные останутся в семье. Личные данные участника не изменятся.</p>
                    {remove.isError && <p role="alert">Состав изменился или действие недоступно. Обновите страницу.</p>}
                    <div className={styles.actions}>
                        <button
                            className="button outline"
                            disabled={remove.isPending}
                            onClick={() => removeDialog.current?.close()}
                        >
                            Отмена
                        </button>
                        <button
                            className={`button ${styles.danger}`}
                            disabled={remove.isPending}
                            onClick={() => remove.mutate(selected)}
                        >
                            {remove.isPending && <ArcInlineLoader label={null} />}Исключить
                        </button>
                    </div>
                </dialog>
            )}
        </div>
    );
}

function AccessPanel({ family, state, plan, userId }: { family: Family; state: string; plan: string; userId: string }) {
    const { api, queryClient, ui } = useRuntime();
    const router = useRouter();
    const preview = useQuery({
        queryKey: ['family-leave-preview', userId, family.version],
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/family/leave-preview', undefined, signal)).data,
    });
    const [successor, setSuccessor] = useState('');
    const leaveKey = useRef(crypto.randomUUID());
    const leave = useMutation({
        mutationFn: async (automatic: boolean) => {
            if (!preview.data) throw new Error('Preview missing');
            return (
                await api!.request('POST /api/v1/family/leave', {
                    expectedVersion: preview.data.familyVersion,
                    selection: automatic ? 'automatic' : 'manual',
                    successorMembershipId: automatic ? null : successor,
                    idempotencyKey: leaveKey.current,
                })
            ).data;
        },
        onSuccess: () => {
            queryClient.removeQueries({ queryKey: ['family', userId] });
            queryClient.removeQueries({ queryKey: ['family-leave-preview', userId] });
            ui.getState().resetScope();
            router.replace('/');
        },
    });
    return (
        <div className={styles.stack}>
            <section className={styles.panel}>
                <p className={styles.eyebrow}>Семья · Доступ</p>
                <h1>{state === 'active' ? 'Семейные функции доступны' : 'Семейные действия приостановлены'}</h1>
                <p>Тариф {plan.toUpperCase()}.</p>
                <p className={styles.muted}>Личные и семейные данные остаются раздельными после выхода.</p>
            </section>
            <section className={styles.panel}>
                <h2>Выйти из семьи</h2>
                {preview.isPending ? (
                    <ArcSkeleton variant="lines" lines={3} label="Проверяем последствия" />
                ) : preview.isError ? (
                    <p role="alert">Не удалось проверить актуальный состав. Выход не выполнялся.</p>
                ) : (
                    <>
                        {preview.data.aiQuotaRedistribution.applies && (
                            <section className={styles['quota-preview']} aria-labelledby="leave-ai-quota-title">
                                <h3 id="leave-ai-quota-title">Перераспределение AI-квоты</h3>
                                <p>
                                    Из вашей подписочной доли сейчас доступно{' '}
                                    {preview.data.aiQuotaRedistribution.currentUserBefore}. Всего будет перераспределено{' '}
                                    {preview.data.aiQuotaRedistribution.unspentActions} неизрасходованных действий.
                                </p>
                                <p>
                                    {preview.data.aiQuotaRedistribution.memberCountAfter > 0
                                        ? `После выхода каждый из оставшихся участников получит по ${preview.data.aiQuotaRedistribution.shareAfter}, резерв семьи составит ${preview.data.aiQuotaRedistribution.familyReserveAfter}.`
                                        : `После архивирования ${preview.data.aiQuotaRedistribution.familyReserveAfter} действий останутся недоступным остатком семьи до конца периода.`}
                                </p>
                                <p className={styles.muted}>Уже потраченные и переданные действия не отзываются.</p>
                            </section>
                        )}
                        {preview.data.role === 'owner' && preview.data.candidates.length ? (
                            <div className={styles.form}>
                                <p>Перед выходом владение обязательно перейдёт одному из оставшихся участников.</p>
                                <label>
                                    Кому передать владение
                                    <select value={successor} onChange={(event) => setSuccessor(event.target.value)}>
                                        <option value="">Выберите участника</option>
                                        {preview.data.candidates.map((candidate) => (
                                            <option key={candidate.id} value={candidate.id}>
                                                {candidate.displayName}
                                                {candidate.id === preview.data.recommendedMembershipId
                                                    ? ' · старейший участник'
                                                    : ''}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <div className={styles.actions}>
                                    <button
                                        className={`button ${styles.danger}`}
                                        disabled={!successor || leave.isPending}
                                        onClick={() => leave.mutate(false)}
                                    >
                                        Передать и выйти
                                    </button>
                                    <button
                                        className="button outline"
                                        disabled={leave.isPending}
                                        onClick={() => leave.mutate(true)}
                                    >
                                        Всё равно
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className={styles.form}>
                                <p>
                                    {preview.data.willArchive
                                        ? 'Вы последний участник с аккаунтом. Семья будет архивирована, а история сохранится.'
                                        : 'Семейные данные останутся семье; ваша запись сохранится в истории.'}
                                </p>
                                <button
                                    className={`button ${styles.danger}`}
                                    disabled={leave.isPending}
                                    onClick={() => leave.mutate(true)}
                                >
                                    Выйти из семьи
                                </button>
                            </div>
                        )}
                    </>
                )}
                {leave.isError && <p role="alert">Состав изменился или действие недоступно. Ничего не изменено.</p>}
            </section>
            <Link href="/family">← Вернуться к семье</Link>
        </div>
    );
}

function FamilyQuery({ view }: { view: 'members' | 'access' }) {
    const { api } = useRuntime();
    const session = useSession('user');
    const query = useQuery({
        queryKey: ['family', session.data?.id],
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/family', undefined, signal)).data,
    });
    if (query.isPending) return <ArcSkeleton variant="lines" lines={5} label="Загружаем семью" />;
    if (query.isError)
        return (
            <section className={styles.panel} role="alert">
                <h1>Не удалось загрузить семью</h1>
                <button className="button outline" onClick={() => void query.refetch()}>
                    Повторить
                </button>
            </section>
        );
    if (!query.data.family)
        return (
            <section className={styles.panel}>
                <h1>Семья не найдена</h1>
                <Link className="button primary" href="/family/setup">
                    Настроить семью
                </Link>
            </section>
        );
    return view === 'members' ? (
        <MembersPanel family={query.data.family} userId={session.data!.id} />
    ) : (
        <AccessPanel
            family={query.data.family}
            state={query.data.state}
            plan={query.data.entitlement.plan}
            userId={session.data!.id}
        />
    );
}

export function FamilyDetailsPage({ view }: { view: 'members' | 'access' }) {
    return (
        <Guard context="user">
            <PersonalShell>
                <FamilyQuery view={view} />
            </PersonalShell>
        </Guard>
    );
}
