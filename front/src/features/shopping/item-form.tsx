'use client';
import { useState } from 'react';
import type { Success } from '../../shared/api/contracts.generated.js';
import { units } from '../../entities/measurement/model.js';
import { ProductPicker } from './product-picker.js';
import { useShoppingCommand } from './use-command.js';
import styles from './shopping.module.css';
import { readOfflineOwner } from '../../entities/offline/store.js';
import { enqueueOfflineOperation } from '../../entities/offline/queue.js';
type Item = Success<'GET /api/v1/shopping-lists/{id}'>['data']['items'][number];
export function ItemForm({
    listId,
    listVersion,
    item,
    onDone,
}: {
    listId: string;
    listVersion: number;
    item?: Item;
    onDone: () => void;
}) {
    const cmd = useShoppingCommand();
    const [name, setName] = useState(item?.name ?? ''),
        [quantity, setQuantity] = useState(item?.quantity ?? ''),
        [unit, setUnit] = useState(item?.unit ?? 'pcs'),
        [ingredient, setIngredient] = useState(item?.ingredientId ?? null),
        [product, setProduct] = useState(item?.productId ?? null),
        [analog, setAnalog] = useState(item?.allowAnalog ?? true),
        [requirements, setRequirements] = useState(item?.requirements?.note ?? ''),
        [offlineMessage, setOfflineMessage] = useState('');
    async function save() {
        const fields = {
            name,
            quantity: quantity || null,
            unit: unit || null,
            ingredientId: ingredient,
            productId: product,
            allowAnalog: analog,
            requirements: { ...item?.requirements, note: requirements },
            recipeOrigin: item?.recipeOrigin ?? [],
            estimatedPriceMinor: item?.estimatedPriceMinor ?? null,
        };
        if (!navigator.onLine) {
            const owner = readOfflineOwner();
            if (!owner) {
                setOfflineMessage('Подключитесь к сети и подтвердите аккаунт перед сохранением на устройстве.');
                return;
            }
            try {
                await enqueueOfflineOperation({
                    owner,
                    route: item
                        ? 'POST /api/v1/shopping-lists/{id}/items/{itemId}'
                        : 'POST /api/v1/shopping-lists/{id}/items',
                    body: item
                        ? { version: item.version, status: item.status, fields }
                        : { version: listVersion, items: [fields] },
                    params: item ? { id: listId, itemId: item.id } : { id: listId },
                    operationType: item ? 'update' : 'create',
                    entityType: 'purchase',
                    entityId: item ? `${listId}:${item.id}` : listId,
                    baseVersion: item?.version ?? listVersion,
                });
                setOfflineMessage('Действие сохранено локально. Синхронизация начнётся при появлении сети.');
                onDone();
            } catch (error) {
                setOfflineMessage(error instanceof Error ? error.message : 'Не удалось сохранить действие локально.');
            }
            return;
        }
        const result = item
            ? await cmd.run(
                  'POST /api/v1/shopping-lists/{id}/items/{itemId}',
                  { version: item.version, status: item.status, fields },
                  { id: listId, itemId: item.id },
              )
            : await cmd.run(
                  'POST /api/v1/shopping-lists/{id}/items',
                  { version: listVersion, items: [fields] },
                  { id: listId },
              );
        if (result) onDone();
    }
    return (
        <form
            className={styles.panel}
            onSubmit={(e) => {
                e.preventDefault();
                void save();
            }}
        >
            <h2>{item ? 'Изменить строку' : 'Добавить товар'}</h2>
            {offlineMessage && <p role="status">{offlineMessage}</p>}
            <fieldset disabled={cmd.pending || cmd.unknown}>
                <div className={styles.fields}>
                    <label className={styles.field}>
                        Название
                        <input required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
                    </label>
                    <label className={styles.field}>
                        Количество
                        <input
                            inputMode="decimal"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value.replace(',', '.'))}
                            placeholder="Неизвестно"
                        />
                    </label>
                    <label className={styles.field}>
                        Единица
                        <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                            {Object.entries(units).map(([k, v]) => (
                                <option key={k} value={k}>
                                    {v}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className={styles.field}>
                        Требования
                        <input maxLength={200} value={requirements} onChange={(e) => setRequirements(e.target.value)} />
                    </label>
                </div>
                <ProductPicker
                    ingredientId={ingredient}
                    productId={product}
                    onChange={(i, p, n) => {
                        setIngredient(i);
                        setProduct(p);
                        if (n) setName(n);
                    }}
                />
                <label className={styles.check}>
                    <input type="checkbox" checked={analog} onChange={(e) => setAnalog(e.target.checked)} />
                    Можно аналог
                </label>
            </fieldset>
            {cmd.error && <p role="alert">{cmd.error}</p>}
            {cmd.conflict && <p>Обновите список кнопкой «Перечитать». Форма останется открытой.</p>}
            <div className={styles.actions}>
                <button disabled={cmd.pending}>{cmd.unknown ? 'Повторить запрос' : 'Сохранить'}</button>
                <button type="button" disabled={cmd.pending || cmd.unknown} onClick={onDone}>
                    Отмена
                </button>
            </div>
        </form>
    );
}
