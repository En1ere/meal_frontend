'use client';

import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useRuntime } from '../../shared/runtime/index.js';
import { useSession } from '../../entities/session/client.js';
import styles from './ai.module.css';
import { Frame } from './shared.js';

export function AiBalancePage() {
    return (
        <Frame>
            <BalanceContent />
        </Frame>
    );
}

function BalanceContent() {
    const { api, queryClient } = useRuntime(),
        session = useSession('user'),
        [donorId, setDonorId] = useState(''),
        [amount, setAmount] = useState(1);
    const query = useQuery({
        queryKey: ['ai-balance', session.data?.id],
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/ai/balance', undefined, signal)).data,
    });
    const purchase = useMutation({
        mutationFn: async () =>
            (
                await api!.request('POST /api/v1/ai/package/purchase', {
                    acceptedAmountMinor: 19900,
                    idempotencyKey: crypto.randomUUID(),
                })
            ).data,
        onSuccess: (value) => queryClient.setQueryData(['ai-balance', session.data?.id], value.balance),
    });
    const sharing = useQuery({
        queryKey: ['ai-family-sharing', session.data?.id],
        enabled: !!api && !!session.data,
        retry: false,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/ai/family-sharing', undefined, signal)).data,
    });
    const refreshSharing = () => {
        void queryClient.invalidateQueries({ queryKey: ['ai-family-sharing', session.data?.id] });
        void queryClient.invalidateQueries({ queryKey: ['ai-balance', session.data?.id] });
    };
    const requestTransfer = useMutation({
        mutationFn: async () =>
            (
                await api!.request('POST /api/v1/ai/transfers', {
                    donorId,
                    amount,
                    idempotencyKey: crypto.randomUUID(),
                })
            ).data,
        onSuccess: refreshSharing,
    });
    const decideTransfer = useMutation({
        mutationFn: async (input: { id: string; expectedVersion: number; decision: 'accept' | 'reject' }) =>
            (
                await api!.request(
                    'POST /api/v1/ai/transfers/{id}/decision',
                    {
                        expectedVersion: input.expectedVersion,
                        decision: input.decision,
                        idempotencyKey: crypto.randomUUID(),
                    },
                    undefined,
                    { id: input.id },
                )
            ).data,
        onSuccess: refreshSharing,
    });
    const ownShare = sharing.data?.members.find((member) => member.currentUser),
        donors = sharing.data?.members.filter((member) => !member.currentUser && member.availableToTransfer > 0) ?? [];
    return (
        <>
            <header className={styles.heading}>
                <div>
                    <h1>Баланс AI</h1>
                    <p>Доступный и зарезервированный остаток показаны отдельно.</p>
                </div>
                <Link href="/ai">К помощнику</Link>
            </header>
            {query.isPending ? (
                <p role="status">Загружаем баланс…</p>
            ) : query.isError ? (
                <p role="alert">Баланс недоступен.</p>
            ) : (
                <>
                    <section className={styles.balance}>
                        <strong>{query.data.available}</strong>
                        <span>доступно</span>
                        <small>
                            {query.data.reserved} зарезервировано · {query.data.total} всего
                        </small>
                    </section>
                    <div className={styles.grid}>
                        {query.data.buckets.map((x) => (
                            <article className={styles.card} key={x.id}>
                                <h2>
                                    {x.kind === 'purchased'
                                        ? 'Купленные'
                                        : x.kind === 'subscription'
                                          ? 'Подписка'
                                          : x.kind === 'family_reserve'
                                            ? 'Резерв семьи'
                                            : x.kind === 'transferred'
                                              ? 'Переданные'
                                              : x.kind}
                                </h2>
                                <p>
                                    {x.available} доступно из {x.granted}
                                </p>
                                <small>
                                    {x.expiresAt ? `До ${new Date(x.expiresAt).toLocaleString('ru')}` : 'Не сгорает'}
                                    {x.requiresConfirmation ? ' · требуется подтверждение перед списанием' : ''}
                                </small>
                            </article>
                        ))}
                    </div>
                    <section className={styles.card}>
                        <h2>Пакет 40 AI-действий</h2>
                        <p>
                            {query.data.packageOffer.amountMinor / 100} ₽ · не меняет тариф и не открывает платные
                            функции.
                        </p>
                        <button
                            className="button primary"
                            disabled={purchase.isPending || query.data.packageOffer.purchaseMode === 'unavailable'}
                            onClick={() => purchase.mutate()}
                        >
                            {query.data.packageOffer.purchaseMode === 'simulation'
                                ? 'Провести тестовую покупку'
                                : 'Покупка пока недоступна'}
                        </button>
                        {purchase.isSuccess && (
                            <p role="status">Тестовый пакет начислен. Реального списания денег не было.</p>
                        )}
                    </section>
                    {sharing.isSuccess && (
                        <section className={styles.card}>
                            <h2>Передача AI-действий в семье</h2>
                            <p>
                                Когда личная доля исчерпана, можно запросить целое число действий у другого участника.
                                Списание произойдёт только после подтверждения донора.
                            </p>
                            <form
                                className={styles.form}
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    requestTransfer.mutate();
                                }}
                            >
                                <label>
                                    Участник-донор
                                    <select
                                        value={donorId}
                                        onChange={(event) => setDonorId(event.target.value)}
                                        required
                                    >
                                        <option value="">Выберите участника</option>
                                        {donors.map((member) => (
                                            <option key={member.userId} value={member.userId}>
                                                {member.displayName} · доступно {member.availableToTransfer}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    Количество действий
                                    <input
                                        type="number"
                                        min={1}
                                        step={1}
                                        value={amount}
                                        onChange={(event) => setAmount(event.target.valueAsNumber)}
                                        required
                                    />
                                </label>
                                <button
                                    className="button primary"
                                    disabled={
                                        requestTransfer.isPending ||
                                        !donorId ||
                                        !Number.isInteger(amount) ||
                                        amount < 1 ||
                                        (ownShare?.availableToTransfer ?? 0) > 0
                                    }
                                >
                                    Запросить передачу
                                </button>
                                {(ownShare?.availableToTransfer ?? 0) > 0 && (
                                    <small>Сначала используйте оставшиеся действия своей подписочной доли.</small>
                                )}
                                {requestTransfer.isSuccess && <p role="status">Запрос отправлен донору.</p>}
                                {requestTransfer.isError && <p role="alert">Не удалось отправить запрос.</p>}
                            </form>
                            {sharing.data.transfers.length > 0 && (
                                <div className={styles.list}>
                                    {sharing.data.transfers.map((transfer) => (
                                        <article className={styles.notice} key={transfer.id}>
                                            <strong>
                                                {transfer.recipientId === session.data?.id
                                                    ? `Вы запросили ${transfer.amount} у ${transfer.donorName}`
                                                    : `${transfer.recipientName} просит ${transfer.amount}`}
                                            </strong>
                                            <p>
                                                Статус:{' '}
                                                {transfer.status === 'pending'
                                                    ? 'ожидает решения'
                                                    : transfer.status === 'accepted'
                                                      ? 'передано'
                                                      : transfer.status === 'rejected'
                                                        ? 'отклонено'
                                                        : 'истекло'}
                                            </p>
                                            {transfer.donorId === session.data?.id && transfer.status === 'pending' && (
                                                <div className={styles.actions}>
                                                    <button
                                                        className="button primary"
                                                        disabled={decideTransfer.isPending}
                                                        onClick={() =>
                                                            decideTransfer.mutate({
                                                                id: transfer.id,
                                                                expectedVersion: transfer.version,
                                                                decision: 'accept',
                                                            })
                                                        }
                                                    >
                                                        Передать
                                                    </button>
                                                    <button
                                                        className="button secondary"
                                                        disabled={decideTransfer.isPending}
                                                        onClick={() =>
                                                            decideTransfer.mutate({
                                                                id: transfer.id,
                                                                expectedVersion: transfer.version,
                                                                decision: 'reject',
                                                            })
                                                        }
                                                    >
                                                        Отклонить
                                                    </button>
                                                </div>
                                            )}
                                        </article>
                                    ))}
                                </div>
                            )}
                            {decideTransfer.isError && <p role="alert">Запрос уже изменился или недоступен.</p>}
                        </section>
                    )}
                    <section className={styles.notice}>
                        <strong>Порядок списания</strong>
                        <p>Подписка → переданные действия → семейный резерв → купленные действия.</p>
                    </section>
                </>
            )}
        </>
    );
}
