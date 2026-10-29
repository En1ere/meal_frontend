'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useRuntime } from '../../shared/runtime/index.js';
import { InlineLoader as ArcInlineLoader } from '@meal-planner/design-system';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import { useSession } from '../../entities/session/client.js';
import { familyKeys } from '../../entities/family/model.js';
import { useWorkspaceScope } from '../../entities/workspace-scope/client.js';
import styles from './family.module.css';

function Content() {
    const { api, queryClient } = useRuntime();
    const session = useSession('user');
    const setScopeFor = useWorkspaceScope((state) => state.setScopeFor);
    const token = useSearchParams().get('token') ?? '';
    const key = useRef(crypto.randomUUID());
    const preview = useQuery({
        queryKey: ['family-invitation-preview', session.data?.id, token],
        enabled: !!api && !!session.data && token.length >= 32,
        queryFn: async ({ signal }) =>
            (
                await api!.request('GET /api/v1/family/invitation-preview', undefined, signal, undefined, {
                    query: { token },
                })
            ).data,
    });
    const accept = useMutation({
        mutationFn: async () =>
            (
                await api!.request('POST /api/v1/family/invitation-accept', {
                    token,
                    expectedFamilyVersion: preview.data!.familyVersion,
                    idempotencyKey: key.current,
                })
            ).data,
        onSuccess: (family) => {
            queryClient.setQueryData(familyKeys.context(session.data?.id), family);
            if (session.data?.id) setScopeFor(session.data.id, 'family');
        },
    });
    if (!token)
        return (
            <section className={styles.panel}>
                <h1>Ссылка приглашения не указана</h1>
            </section>
        );
    if (preview.isPending) return <ArcSkeleton variant="lines" lines={4} label="Проверяем приглашение" />;
    if (preview.isError)
        return (
            <section className={styles.panel} role="alert">
                <h1>Приглашение недоступно</h1>
                <p>Ссылка не относится к этому аккаунту, отменена или больше не существует.</p>
            </section>
        );
    if (accept.isSuccess)
        return (
            <section className={styles.panel}>
                <h1>Вы вступили в семью</h1>
                <Link className="button primary" href="/family">
                    Открыть семью
                </Link>
            </section>
        );
    return (
        <section className={styles.panel}>
            <p className={styles.eyebrow}>Приглашение в семью</p>
            <h1>{preview.data.familyName}</h1>
            <p>
                {preview.data.inviterName} приглашает аккаунт @{preview.data.recipientLogin}.
            </p>
            <p className={styles.muted}>Действует до {new Date(preview.data.expiresAt).toLocaleString('ru-RU')}.</p>
            {preview.data.aiQuotaRedistribution.applies && (
                <section className={styles['quota-preview']} aria-labelledby="join-ai-quota-title">
                    <h2 id="join-ai-quota-title">AI-квота после вступления</h2>
                    <p>
                        {preview.data.aiQuotaRedistribution.unspentActions} неизрасходованных действий будут
                        распределены между {preview.data.aiQuotaRedistribution.memberCountAfter} участниками: по{' '}
                        {preview.data.aiQuotaRedistribution.shareAfter} каждому
                        {preview.data.aiQuotaRedistribution.familyReserveAfter
                            ? `, ${preview.data.aiQuotaRedistribution.familyReserveAfter} останется в резерве семьи`
                            : ''}
                        .
                    </p>
                    <p className={styles.muted}>
                        Уже потраченные и ранее переданные действия не отзываются. Текущий период заканчивается{' '}
                        {new Date(preview.data.aiQuotaRedistribution.periodEndsAt!).toLocaleString('ru-RU')}.
                    </p>
                </section>
            )}
            {preview.data.status === 'pending' ? (
                <button className="button primary" disabled={accept.isPending} onClick={() => accept.mutate()}>
                    {accept.isPending && <ArcInlineLoader label={null} />}Принять приглашение
                </button>
            ) : (
                <p role="status">Приглашение уже завершено: {preview.data.status}.</p>
            )}
            {accept.isError && <p role="alert">Не удалось вступить: проверьте свободные места и текущую семью.</p>}
        </section>
    );
}

export function FamilyInvitePage() {
    return (
        <>
            <Content />
        </>
    );
}
