'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../shared/runtime/index.js';
import { useRequestSignal } from '../../shared/api/use-request-signal.js';
import { useSession } from '../../entities/session/client.js';
import { inventoryScopeQuery } from '../../entities/inventory/model.js';
import { inventoryKeys } from '../../entities/inventory/query-keys.js';
import { units } from '../../entities/measurement/model.js';
import { ApiError } from '../../shared/api/client.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { localDate } from '../../shared/lib/date.js';
import { ProductPicker } from './product-picker.js';
import { useShoppingCommand } from './use-command.js';
import styles from './shopping.module.css';
import { PurchaseResolution } from './purchase-resolution.js';
import { purchaseBase, useShoppingScope } from './shared.js';
export type PurchaseLine = Success<'GET /api/v1/receipts/{id}'>['data']['receipt']['lines'][number];
export const emptyPurchaseLine = (name = ''): PurchaseLine => ({
    id: crypto.randomUUID(),
    name,
    quantity: null,
    unit: null,
    ingredientId: null,
    productId: null,
    locationId: null,
    isFood: true,
    intake: false,
    shoppingItemId: null,
    expiryOn: null,
    amountMinor: null,
    originalAmountMinor: null,
    discountMinor: null,
});
export function PurchaseLines({
    lines,
    setLines,
    locked = false,
    fixedIdentity = false,
    showFinancial = false,
}: {
    lines: PurchaseLine[];
    setLines: (v: PurchaseLine[]) => void;
    locked?: boolean;
    fixedIdentity?: boolean;
    showFinancial?: boolean;
}) {
    const scope = useShoppingScope();
    const { api } = useRuntime();
    const user = useSession('user');
    const locations = useQuery({
        queryKey: inventoryKeys.locations(scope, user.data?.id),
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (
                await api!.request('GET /api/v1/inventory-locations', undefined, signal, undefined, {
                    query: inventoryScopeQuery(scope),
                })
            ).data.items,
    });
    const change = (id: string, patch: Partial<PurchaseLine>) =>
        setLines(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    return (
        <div className={styles.stack}>
            {lines.map((l, index) => (
                <fieldset disabled={locked} className={styles.panel} key={l.id}>
                    <legend>Позиция {index + 1}</legend>
                    <div className={styles.fields}>
                        <label className={styles.field}>
                            Фактическое название
                            <input
                                required
                                maxLength={200}
                                value={l.name}
                                onChange={(e) => change(l.id, { name: e.target.value })}
                            />
                        </label>
                        {showFinancial && (
                            <>
                                <label className={styles.field}>
                                    Оплачено за позицию, ₽
                                    <input
                                        required
                                        min="0"
                                        step="0.01"
                                        type="number"
                                        value={l.amountMinor === null ? '' : (l.amountMinor / 100).toFixed(2)}
                                        onChange={(e) =>
                                            change(l.id, {
                                                amountMinor: e.target.value
                                                    ? Math.round(Number(e.target.value) * 100)
                                                    : null,
                                            })
                                        }
                                    />
                                </label>
                                <label className={styles.field}>
                                    Цена до скидки, ₽
                                    <input
                                        min="0"
                                        step="0.01"
                                        type="number"
                                        value={
                                            l.originalAmountMinor === null
                                                ? ''
                                                : (l.originalAmountMinor / 100).toFixed(2)
                                        }
                                        onChange={(e) =>
                                            change(l.id, {
                                                originalAmountMinor: e.target.value
                                                    ? Math.round(Number(e.target.value) * 100)
                                                    : null,
                                            })
                                        }
                                    />
                                </label>
                            </>
                        )}
                        <label className={styles.field}>
                            Фактически куплено
                            <input
                                inputMode="decimal"
                                value={l.quantity ?? ''}
                                placeholder="Не распознано"
                                onChange={(e) => change(l.id, { quantity: e.target.value.replace(',', '.') || null })}
                            />
                        </label>
                        <label className={styles.field}>
                            Единица
                            <select
                                value={l.unit ?? ''}
                                onChange={(e) => change(l.id, { unit: e.target.value || null })}
                            >
                                <option value="">Не распознано</option>
                                {Object.entries(units).map(([k, v]) => (
                                    <option key={k} value={k}>
                                        {v}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className={styles.field}>
                            Место хранения
                            <select
                                value={l.locationId ?? ''}
                                onChange={(e) => change(l.id, { locationId: e.target.value || null })}
                            >
                                <option value="">Выберите место</option>
                                {locations.data?.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className={styles.field}>
                            Годен до
                            <input
                                type="date"
                                value={l.expiryOn ?? ''}
                                onChange={(e) => change(l.id, { expiryOn: e.target.value || null })}
                            />
                        </label>
                    </div>
                    <ProductPicker
                        disabled={fixedIdentity || locked}
                        ingredientId={l.ingredientId}
                        productId={l.productId}
                        onChange={(ingredientId, productId) => change(l.id, { ingredientId, productId })}
                    />
                    <label className={styles.check}>
                        <input
                            type="checkbox"
                            disabled={fixedIdentity}
                            checked={l.isFood}
                            onChange={(e) =>
                                change(l.id, {
                                    isFood: e.target.checked,
                                    ...(!e.target.checked ? { intake: false } : {}),
                                })
                            }
                        />
                        Продукт питания
                    </label>
                    <label className={styles.check}>
                        <input
                            type="checkbox"
                            checked={l.intake}
                            disabled={fixedIdentity || !l.isFood}
                            onChange={(e) => change(l.id, { intake: e.target.checked })}
                        />
                        Добавить эту позицию в {scope === 'family' ? 'семейные' : 'личные'} запасы
                    </label>
                    {l.quantity === null && <p>Количество неизвестно. Для поступления его нужно уточнить.</p>}
                    <button
                        type="button"
                        disabled={fixedIdentity || lines.length === 1}
                        onClick={() => setLines(lines.filter((row) => row.id !== l.id))}
                    >
                        Исключить позицию
                    </button>
                </fieldset>
            ))}
            <button
                type="button"
                disabled={fixedIdentity || locked || lines.length >= 200}
                onClick={() => setLines([...lines, emptyPurchaseLine()])}
            >
                Добавить позицию вручную
            </button>
            {locations.isError && <p role="alert">Не удалось загрузить места хранения.</p>}
        </div>
    );
}
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
                const r =
                    kind === 'shopping'
                        ? await api.request('POST /api/v1/shopping-lists/{id}/purchase-preview', body, signal(), { id })
                        : await api.request('POST /api/v1/receipts/{id}/intake-preview', body, signal(), { id });
                setPreview(r.data);
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
