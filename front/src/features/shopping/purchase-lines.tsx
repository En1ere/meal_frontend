'use client';
import { useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../shared/runtime/index.js';
import { useSession } from '../../entities/session/client.js';
import { loadShoppingLocations } from './api.js';
import { inventoryKeys } from '../../entities/inventory/query-keys.js';
import { units } from '../../entities/measurement/model.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { ProductPicker } from './product-picker.js';
import { useShoppingScope } from './shared.js';
import styles from './shopping.module.css';

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
        queryFn: ({ signal }) => loadShoppingLocations(api!, scope, signal),
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
