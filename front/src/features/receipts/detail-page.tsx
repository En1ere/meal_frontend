'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../app/providers.js';
import { useSession } from '../auth/session.js';
import {
    ShoppingShell,
    ShoppingLoading,
    shoppingBase,
    purchaseBase,
    useShoppingScope,
    type ShoppingScope,
} from '../shopping/shared.js';
import { PurchaseReview, PurchaseLines, type PurchaseLine } from '../shopping/purchase-review.js';
import { useShoppingCommand } from '../shopping/use-command.js';
import styles from '../shopping/shopping.module.css';
import { PurchaseResolution } from '../shopping/purchase-resolution.js';
function Corrections({
    id,
    version,
    initial,
    onDone,
}: {
    id: string;
    version: number;
    initial: PurchaseLine[];
    onDone: () => void;
}) {
    const [lines, setLines] = useState(initial);
    const cmd = useShoppingCommand();
    return (
        <section className={styles.panel}>
            <h2>Исправить позиции</h2>
            <PurchaseLines lines={lines} setLines={setLines} locked={cmd.pending || cmd.unknown} />
            {cmd.error && <p role="alert">{cmd.error}</p>}
            {cmd.unknown && (
                <button disabled={cmd.pending} onClick={() => void cmd.retry()}>
                    Повторить прежний запрос
                </button>
            )}
            <button
                disabled={cmd.pending}
                onClick={() =>
                    void (async () => {
                        const r = await cmd.run('POST /api/v1/receipts/{id}/edit', { version, lines }, { id });
                        if (r) onDone();
                    })()
                }
            >
                {cmd.unknown ? 'Повторить запрос' : 'Сохранить исправления'}
            </button>
            <button disabled={cmd.pending || cmd.unknown} onClick={onDone}>
                Закрыть
            </button>
        </section>
    );
}
function Content({ id }: { id: string }) {
    const scope = useShoppingScope();
    const { api } = useRuntime();
    const user = useSession('user');
    const cmd = useShoppingCommand();
    const [editing, setEditing] = useState(false),
        [review, setReview] = useState(false);
    const detail = useQuery({
        queryKey: ['receipts', user.data?.id, scope, id],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/receipts/{id}', undefined, signal, { id }, { query: { scope } })).data,
    });
    const duplicates = useQuery({
        queryKey: ['receipts', user.data?.id, scope, id, 'duplicates'],
        enabled: !!api && detail.data?.receipt.status === 'draft',
        queryFn: async ({ signal }) =>
            (
                await api!.request(
                    'GET /api/v1/receipts/{id}/duplicates',
                    undefined,
                    signal,
                    { id },
                    { query: { scope } },
                )
            ).data,
    });
    if (detail.isPending) return <ShoppingLoading />;
    if (detail.isError)
        return (
            <section role="alert">
                Чек недоступен.<button onClick={() => void detail.refetch()}>Повторить</button>
            </section>
        );
    const r = detail.data.receipt;
    const paymentLabels = { cash: 'наличные', card: 'карта', other: 'другой', unknown: 'не указан' } as const;
    return (
        <>
            <Link href={shoppingBase(scope)}>← Покупки</Link>
            <div className={styles.heading}>
                <h1>Чек</h1>
                <span className={styles.label}>
                    {r.status === 'draft'
                        ? 'Требует проверки'
                        : r.status === 'linked'
                          ? 'Связан с покупкой'
                          : 'Поступление подтверждено'}
                </span>
            </div>
            <p>{scope === 'family' ? 'Доступен всем активным участникам семьи' : 'Только владелец · Личная область'}</p>
            <button onClick={() => void detail.refetch()}>Перечитать, сохранив ввод</button>
            <div className={styles.detail}>
                <section className={styles.panel}>
                    <h2>Источник</h2>
                    {r.source.kind === 'electronic_link' ? (
                        <p>
                            Электронная ссылка:{' '}
                            <a href={r.source.reference} target="_blank" rel="noreferrer">
                                Открыть чек
                            </a>
                        </p>
                    ) : (
                        <p>Фото: {r.source.reference ?? 'Название не указано'}</p>
                    )}
                    {r.source.kind === 'photo' && (
                        <p>Хранение исходного изображения пока недоступно. Сохранён распознанный текст.</p>
                    )}
                    <pre className={styles.result}>{r.ocrText || 'Текст не распознан'}</pre>
                </section>
                <section className={styles.panel}>
                    <h2>Позиции и проверка</h2>
                    {r.lines.map((l) => (
                        <div className={styles.line} key={l.id}>
                            <strong>{l.name}</strong>
                            <span>
                                {l.quantity ?? 'Не распознано'} {l.unit ?? ''}
                            </span>
                            <span>
                                {!l.isFood ? 'Не пищевой товар' : l.intake ? 'Выбрано для запаса' : 'Без поступления'}
                            </span>
                            {l.amountMinor !== null && <span>{(l.amountMinor / 100).toFixed(2)} ₽</span>}
                        </div>
                    ))}
                    {r.status === 'draft' && (
                        <div className={styles.actions}>
                            <button
                                onClick={() => {
                                    setEditing((v) => !v);
                                    setReview(false);
                                }}
                            >
                                Исправить позиции
                            </button>
                            <button
                                onClick={() => {
                                    setReview((v) => !v);
                                    setEditing(false);
                                }}
                            >
                                Проверить поступление
                            </button>
                        </div>
                    )}
                </section>
                {r.financial && (
                    <section className={styles.panel}>
                        <h2>Финансовые данные · Pro</h2>
                        <p>
                            {r.financial.storeName ?? 'Магазин не указан'} · {(r.financial.totalMinor / 100).toFixed(2)}{' '}
                            ₽
                        </p>
                        <p>
                            Скидка: {(r.financial.discountMinor / 100).toFixed(2)} ₽ · способ оплаты:{' '}
                            {paymentLabels[r.financial.paymentMethod]}
                        </p>
                        {(r.financial.fiscalNumber || r.financial.fiscalDocumentNumber) && (
                            <p>
                                Фискальные реквизиты: {r.financial.fiscalNumber ?? '—'} /{' '}
                                {r.financial.fiscalDocumentNumber ?? '—'}
                            </p>
                        )}
                    </section>
                )}
            </div>
            {editing && r.status === 'draft' && (
                <Corrections
                    id={id}
                    version={r.version}
                    initial={r.lines}
                    onDone={() => {
                        setEditing(false);
                        void detail.refetch();
                    }}
                />
            )}
            {review && r.status === 'draft' && (
                <PurchaseReview
                    id={id}
                    kind="receipt"
                    version={r.version}
                    initialLines={r.lines}
                    onDone={() => {
                        setReview(false);
                        void detail.refetch();
                    }}
                />
            )}
            {r.status === 'draft' && (
                <section className={styles.panel}>
                    <h2>Уже добавляли эту покупку?</h2>
                    <p>
                        Совпадение нужно подтвердить самостоятельно. Связь с существующей покупкой не создаёт повторных
                        партий.
                    </p>
                    {duplicates.isPending ? (
                        <ShoppingLoading />
                    ) : duplicates.isError ? (
                        <p role="alert">Не удалось загрузить покупки для сравнения.</p>
                    ) : duplicates.data?.items.length ? (
                        duplicates.data.items.map((d) => (
                            <article className={styles.card} key={d.purchaseId}>
                                <time>{new Date(d.purchasedAt).toLocaleString('ru-RU')}</time>
                                <p>
                                    {d.lineNames.join(', ')} · {d.lineCount} позиций
                                </p>
                                <button
                                    disabled={cmd.pending || cmd.unknown}
                                    onClick={() => {
                                        if (
                                            window.confirm(
                                                'Это та же покупка? Связать чек без нового поступления в запасы?',
                                            )
                                        )
                                            void cmd.run(
                                                'POST /api/v1/receipts/{id}/link-purchase',
                                                { version: r.version, purchaseId: d.purchaseId },
                                                { id },
                                            );
                                    }}
                                >
                                    Это моя покупка — связать
                                </button>
                            </article>
                        ))
                    ) : (
                        <p>Предыдущих покупок для сравнения нет.</p>
                    )}
                </section>
            )}
            {cmd.error && <p role="alert">{cmd.error}</p>}
            {r.result && (
                <section className={styles.panel}>
                    <h2>Результат в запасах</h2>
                    <p>
                        Партий: {r.result.batchIds.length}; неизвестных количеств: {r.result.unknownLineIds.length}.
                        Повторное поступление чека заблокировано.
                    </p>
                    {r.result.batchIds.map((batch) => (
                        <Link
                            key={batch}
                            href={`${scope === 'family' ? '/family/inventory' : '/inventory'}/batches/${batch}`}
                        >
                            Открыть партию
                        </Link>
                    ))}
                    <Link href={`${purchaseBase(scope)}/${r.result.purchaseId}`}>
                        Открыть покупку отдельной страницей
                    </Link>
                    <PurchaseResolution id={r.result.purchaseId} />
                </section>
            )}
            <section className={styles.panel}>
                <h2>История</h2>
                <ol>
                    {r.history.map((h, i) => (
                        <li key={i}>
                            {(
                                {
                                    created: 'Чек создан',
                                    corrected: 'Позиции исправлены',
                                    committed: 'Поступление подтверждено',
                                    'linked-existing-purchase': 'Связан с существующей покупкой',
                                } as Record<string, string>
                            )[h.action] ?? 'Обновлён'}{' '}
                            · {new Date(h.at).toLocaleString('ru-RU')}
                        </li>
                    ))}
                </ol>
            </section>
        </>
    );
}
export function ReceiptDetailPage({ id, scope = 'private' }: { id: string; scope?: ShoppingScope }) {
    return (
        <ShoppingShell scope={scope}>
            <Content id={id} />
        </ShoppingShell>
    );
}
