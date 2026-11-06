'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRuntime } from '../../shared/runtime/index.js';
import { useRequestSignal } from '../../shared/api/use-request-signal.js';
import { ApiError } from '../../shared/api/client.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { localDate } from '../../shared/lib/date.js';
import { useShoppingCommand } from './use-command.js';
import styles from './shopping.module.css';
import { PurchaseResolution } from './purchase-resolution.js';
import { PurchaseLines, emptyPurchaseLine, type PurchaseLine } from './purchase-lines.js';
import { purchaseBase, useShoppingScope } from './shared.js';
import { previewShoppingPurchase } from './api.js';
export { PurchaseLines, emptyPurchaseLine };
export type { PurchaseLine };
export function PurchaseReview({
    id,
    kind,
    version,
    initialLines,
    onDone,
}: {
    id: string;
    kind: 'shopping' | 'receipt';
    version: number;
    initialLines: PurchaseLine[];
    onDone: () => void;
}) {
    const scope = useShoppingScope();
    const { api } = useRuntime();
    const signal = useRequestSignal();
    const cmd = useShoppingCommand();
    const [lines, setLines] = useState(initialLines),
        [date, setDate] = useState(`${localDate()}T12:00`),
        [preview, setPreview] = useState<Success<'POST /api/v1/shopping-lists/{id}/purchase-preview'>['data'] | null>(
            null,
        ),
        [busy, setBusy] = useState(false),
        [error, setError] = useState(''),
        [result, setResult] = useState<Success<'POST /api/v1/shopping-lists/{id}/purchase-commit'>['data'] | null>(
            null,
        );
    const reviewing = useRef(false);
    const purchasedAt = new Date(date);
    const body = {
        version,
        purchasedAt: Number.isFinite(purchasedAt.getTime()) ? purchasedAt.toISOString() : '',
        lines,
        scope,
    };
    async function submit() {
        if (!api || reviewing.current) return;
        setError('');
        if (!preview) {
            reviewing.current = true;
            setBusy(true);
            try {
                const requestSignal = signal();
                const nextPreview =
                    kind === 'shopping'
                        ? await previewShoppingPurchase(api, 'shopping', id, body, requestSignal)
                        : await previewShoppingPurchase(api, 'receipt', id, body, requestSignal);
                setPreview(nextPreview);
            } catch (e) {
                setError(e instanceof ApiError ? e.message : 'Проверьте заполнение полей и соединение.');
            } finally {
                reviewing.current = false;
                setBusy(false);
            }
            return;
        }
        if (kind === 'shopping') {
            const r = await cmd.run(
                'POST /api/v1/shopping-lists/{id}/purchase-commit',
                { ...body, previewToken: preview.previewToken },
                { id },
            );
            if (r) setResult(r);
        } else {
            const r = await cmd.run(
                'POST /api/v1/receipts/{id}/commit',
                { ...body, previewToken: preview.previewToken },
                { id },
            );
            if (r) onDone();
        }
    }
    if (result)
        return (
            <section className={styles.panel}>
                <h2>Покупка подтверждена</h2>
                <p>
                    Создано партий: {result.batchIds.length}. Неизвестных количеств: {result.unknownLineIds.length}.
                </p>
                {result.batchIds.map((batch) => (
                    <Link
                        key={batch}
                        href={`${scope === 'family' ? '/family/inventory' : '/inventory'}/batches/${batch}`}
                    >
                        Открыть партию
                    </Link>
                ))}
                <p className={styles.result}>
                    Покупка: {result.purchaseId}. Поздний чек связывайте с этой покупкой, не создавая повторное
                    поступление.
                </p>
                <Link href={`${purchaseBase(scope)}/${result.purchaseId}`}>Открыть покупку отдельной страницей</Link>
                <PurchaseResolution id={result.purchaseId} />
                <button onClick={onDone}>Готово</button>
            </section>
        );
    return (
        <form
            className={styles.panel}
            onSubmit={(e) => {
                e.preventDefault();
                void submit();
            }}
        >
            <h2>Проверить покупку</h2>
            <p>
                Отметка в списке не равна поступлению. Добавятся только выбранные пищевые позиции с известным
                количеством. До подтверждения сопоставьте продукты с каталогом: после покупки выбранный товар изменить
                нельзя.
            </p>
            <label className={styles.field}>
                Дата и время покупки (местное)
                <input
                    disabled={cmd.pending || cmd.unknown || busy}
                    required
                    type="datetime-local"
                    value={date}
                    onChange={(e) => {
                        setDate(e.target.value);
                        setPreview(null);
                    }}
                />
            </label>
            <PurchaseLines
                lines={lines}
                locked={cmd.pending || cmd.unknown || busy}
                setLines={(v) => {
                    setLines(v);
                    setPreview(null);
                }}
            />
            {preview && (
                <section className={styles.notice}>
                    <h3>Результат после подтверждения</h3>
                    {preview.lines.map((l) => (
                        <p key={l.id}>
                            {lines.find((row) => row.id === l.id)?.name}: зачтено{' '}
                            {l.allocatedQuantity ?? 'не определено'}; осталось купить{' '}
                            {l.remainingNeed ?? 'не определено'}; избыток {l.overage ?? 'не определено'};{' '}
                            {l.intake ? 'пополнит запас' : 'без пополнения запаса'}.
                        </p>
                    ))}
                </section>
            )}
            {(error || cmd.error) && <p role="alert">{error || cmd.error}</p>}
            {cmd.conflict && (
                <p>
                    Перечитайте карточку кнопкой выше. Введённые строки останутся в форме; затем пересчитайте
                    предпросмотр.
                </p>
            )}
            <div className={styles.sticky}>
                <button disabled={cmd.pending || busy}>
                    {cmd.unknown
                        ? 'Повторить сохранённый запрос'
                        : preview
                          ? 'Подтвердить покупку и поступление'
                          : 'Рассчитать поступление'}
                </button>
                <button
                    type="button"
                    disabled={cmd.pending || cmd.unknown || busy}
                    onClick={() => {
                        setPreview(null);
                        setError('Предпросмотр сброшен. Ввод сохранён.');
                    }}
                >
                    Пересчитать
                </button>
            </div>
        </form>
    );
}
