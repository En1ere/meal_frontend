'use client';
import { useState } from 'react';
import type { Success } from '../../shared/api/contracts.generated.js';
import { units } from './shared.js';
import styles from './inventory.module.css';

export type Batch = Success<'GET /api/v1/inventory/{id}'>['data']['batch'];
export type Fields = Pick<
    Batch,
    | 'name'
    | 'quantity'
    | 'unit'
    | 'locationId'
    | 'purchasedOn'
    | 'expiryOn'
    | 'packageState'
    | 'precision'
    | 'pricePaidRub'
    | 'storeName'
    | 'barcode'
    | 'openedAt'
>;
export const emptyFields: Fields = {
    name: '',
    quantity: '',
    unit: 'g',
    locationId: null,
    purchasedOn: null,
    expiryOn: null,
    openedAt: null,
    packageState: 'unknown',
    precision: 'exact',
    pricePaidRub: null,
    storeName: null,
    barcode: null,
};
export function BatchFields({
    initial,
    locations,
    onChange,
}: {
    initial: Fields;
    locations: { id: string; name: string }[];
    onChange: (fields: Fields) => void;
}) {
    const [fields, setFields] = useState(initial);
    function set<K extends keyof Fields>(key: K, value: Fields[K]) {
        const next = { ...fields, [key]: value };
        setFields(next);
        onChange(next);
    }
    return (
        <div className={styles.form}>
            <label>
                Название партии
                <input required maxLength={200} value={fields.name} onChange={(e) => set('name', e.target.value)} />
            </label>
            <label>
                Место хранения
                <select
                    required
                    value={fields.locationId ?? ''}
                    onChange={(e) => set('locationId', e.target.value || null)}
                >
                    <option value="">Выберите место</option>
                    {locations.map((x) => (
                        <option value={x.id} key={x.id}>
                            {x.name}
                        </option>
                    ))}
                </select>
            </label>
            <div className={styles.columns}>
                <label>
                    Количество
                    <input
                        inputMode="decimal"
                        required={fields.quantity !== null}
                        disabled={fields.quantity === null}
                        pattern="[0-9]+([.][0-9]{1,8})?"
                        value={fields.quantity ?? ''}
                        onChange={(e) => set('quantity', e.target.value.replace(',', '.'))}
                    />
                </label>
                <label>
                    Единица
                    <select value={fields.unit} onChange={(e) => set('unit', e.target.value as Fields['unit'])}>
                        {Object.entries(units).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <fieldset>
                <legend>Количество</legend>
                <label>
                    <input
                        type="checkbox"
                        checked={fields.quantity === null}
                        onChange={(e) => set('quantity', e.target.checked ? null : '')}
                    />
                    Неизвестно
                </label>
                {(['exact', 'estimated'] as const).map((value) => (
                    <label key={value}>
                        <input
                            type="radio"
                            name="precision"
                            checked={fields.precision === value}
                            onChange={() => set('precision', value)}
                        />
                        {value === 'exact' ? 'Точно' : 'Примерно'}
                    </label>
                ))}
            </fieldset>
            <div className={styles.columns}>
                <label>
                    Дата покупки
                    <input
                        type="date"
                        value={fields.purchasedOn ?? ''}
                        onChange={(e) => set('purchasedOn', e.target.value || null)}
                    />
                </label>
                <label>
                    Срок годности
                    <input
                        type="date"
                        value={fields.expiryOn ?? ''}
                        onChange={(e) => set('expiryOn', e.target.value || null)}
                    />
                </label>
            </div>
            <fieldset>
                <legend>Упаковка {fields.packageState === 'unknown' ? '· не указано' : ''}</legend>
                {(['sealed', 'opened'] as const).map((value) => (
                    <label key={value}>
                        <input
                            type="radio"
                            name="package"
                            checked={fields.packageState === value}
                            onChange={() => set('packageState', value)}
                        />
                        {value === 'sealed' ? 'Закрыто' : 'Открыто'}
                    </label>
                ))}
                <button type="button" onClick={() => set('packageState', 'unknown')}>
                    Сбросить
                </button>
            </fieldset>
            {fields.packageState === 'opened' && (
                <label>
                    Дата открытия
                    <input
                        type="datetime-local"
                        value={
                            fields.openedAt
                                ? new Date(
                                      new Date(fields.openedAt).getTime() -
                                          new Date(fields.openedAt).getTimezoneOffset() * 60000,
                                  )
                                      .toISOString()
                                      .slice(0, 16)
                                : ''
                        }
                        onChange={(e) =>
                            set('openedAt', e.target.value ? new Date(e.target.value).toISOString() : null)
                        }
                    />
                </label>
            )}
            <details>
                <summary>Цена, магазин и штрихкод</summary>
                <div className={styles.form}>
                    <label>
                        Цена покупки, ₽
                        <input
                            inputMode="decimal"
                            pattern="[0-9]+([.][0-9]{1,8})?"
                            value={fields.pricePaidRub ?? ''}
                            onChange={(e) => set('pricePaidRub', e.target.value.replace(',', '.') || null)}
                        />
                    </label>
                    <label>
                        Магазин
                        <input
                            maxLength={200}
                            value={fields.storeName ?? ''}
                            onChange={(e) => set('storeName', e.target.value || null)}
                        />
                    </label>
                    <label>
                        Штрихкод
                        <input
                            maxLength={128}
                            value={fields.barcode ?? ''}
                            onChange={(e) => set('barcode', e.target.value || null)}
                        />
                    </label>
                </div>
            </details>
        </div>
    );
}
