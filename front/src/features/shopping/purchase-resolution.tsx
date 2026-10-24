'use client';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../app/providers.js';
import { useSession } from '../auth/session.js';
import { ApiError } from '../../shared/api/client.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { PurchaseLines, type PurchaseLine } from './purchase-review.js';
import { useShoppingCommand } from './use-command.js';
import { ShoppingLoading, useShoppingScope } from './shared.js';
import styles from './shopping.module.css';
type StoredLine = Success<'GET /api/v1/purchases/{id}'>['data']['lines'][number];
function ResolveLine({ id, line, refresh }: { id: string; line: StoredLine; refresh: () => void }) {
    const scope = useShoppingScope();
    const { api } = useRuntime();
    const cmd = useShoppingCommand();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<PurchaseLine>(() => {
        const { version: _version, batchIds: _batchIds, ...fields } = line;
        void _version;
        void _batchIds;
        return { ...fields, intake: true };
    });
    const [preview, setPreview] = useState<Success<'POST /api/v1/purchases/{id}/resolve-preview'>['data'] | null>(null);
    const [busy, setBusy] = useState(false),
        [error, setError] = useState('');
    const reviewing = useRef(false);
    async function review() {
        if (!api || reviewing.current) return;
        reviewing.current = true;
        setBusy(true);
        setError('');
        try {
            setPreview(
                (
                    await api.request(
                        'POST /api/v1/purchases/{id}/resolve-preview',
                        { version: line.version, line: draft, scope },
                        undefined,
                        { id },
                    )
                ).data,
            );
        } catch (e) {
            setError(e instanceof ApiError ? e.message : 'Не удалось проверить поступление.');
        } finally {
            reviewing.current = false;
            setBusy(false);
        }
    }
    return (
        <article className={styles.panel}>
            <h3>{line.name}</h3>
            <p>
                {line.quantity ?? 'Количество неизвестно'} {line.unit ?? ''}
            </p>
            {line.intake ? (
                <p>Уже поступило в запасы. Повторное поступление недоступно.</p>
            ) : line.quantity !== null ? (
                <p>Количество уже зафиксировано. Его исправление будет отдельной операцией корректировки.</p>
            ) : !line.isFood ? (
                <p>Непищевой товар не добавляется в запасы.</p>
            ) : !line.ingredientId ? (
                <p>Товар не был сопоставлен до покупки. Позднее поступление в запасы для этой строки недоступно.</p>
            ) : (
                <>
                    <button onClick={() => setEditing(!editing)} disabled={cmd.pending || cmd.unknown}>
                        {editing ? 'Свернуть' : 'Уточнить и добавить в запасы'}
                    </button>
                    {editing && (
                        <>
                            <p>
                                Товар и связь со списком сохраняются. Укажите фактическое количество и место хранения.
                            </p>
                            <PurchaseLines
                                lines={[draft]}
                                setLines={(lines) => {
                                    if (lines[0]) setDraft(lines[0]);
                                    setPreview(null);
                                }}
                                locked={busy || cmd.pending || cmd.unknown}
                                fixedIdentity
                            />
                            {preview ? (
                                <>
                                    <p>
                                        В счёт списка: {preview.lines[0]?.allocatedQuantity ?? 'не распределяется'}.
                                        Осталось: {preview.lines[0]?.remainingNeed ?? 'неизвестно'}.
                                    </p>
                                    <button
                                        disabled={cmd.pending}
                                        onClick={() =>
                                            void (async () => {
                                                const r = await cmd.run(
                                                    'POST /api/v1/purchases/{id}/resolve-commit',
                                                    {
                                                        version: line.version,
                                                        line: draft,
                                                        previewToken: preview.previewToken,
                                                    },
                                                    { id },
                                                );
                                                if (r) {
                                                    setPreview(null);
                                                    setEditing(false);
                                                    refresh();
                                                }
                                            })()
                                        }
                                    >
                                        {cmd.unknown ? 'Повторить запрос' : 'Подтвердить поступление'}
                                    </button>
                                </>
                            ) : (
                                <button disabled={busy || cmd.pending || cmd.unknown} onClick={() => void review()}>
                                    Проверить поступление
                                </button>
                            )}
                        </>
                    )}
                </>
            )}
            {(error || cmd.error) && <p role="alert">{error || cmd.error}</p>}
        </article>
    );
}
export function PurchaseResolution({ id }: { id: string }) {
    const scope = useShoppingScope();
    const { api } = useRuntime();
    const user = useSession('user');
    const query = useQuery({
        queryKey: ['purchases', user.data?.id, scope, id],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/purchases/{id}', undefined, signal, { id }, { query: { scope } })).data,
    });
    if (query.isPending) return <ShoppingLoading />;
    if (query.isError)
        return (
            <p role="alert">
                Покупка недоступна. <button onClick={() => void query.refetch()}>Повторить</button>
            </p>
        );
    return (
        <section>
            <h2>Позиции покупки</h2>
            <button onClick={() => void query.refetch()}>Перечитать, сохранив ввод</button>
            {query.data.lines.map((line) => (
                <ResolveLine key={line.id} id={id} line={line} refresh={() => void query.refetch()} />
            ))}
        </section>
    );
}
