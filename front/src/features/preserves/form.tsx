'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../shared/runtime/index.js';
import { useSession } from '../../entities/session/client.js';
import { units } from '../../entities/measurement/model.js';
import { localDate } from '../../shared/lib/date.js';
import type { Preserve } from './types.js';
import { preserveTypes } from './types.js';
import { usePreserveCommand } from './use-command.js';
import styles from './preserves.module.css';
export function PreserveForm({
    value,
    recipeRevisionId = null,
    onSaved,
    onCancel,
    scope = 'private',
}: {
    value?: Preserve;
    recipeRevisionId?: string | null;
    onSaved: (p: Preserve) => void;
    onCancel: () => void;
    scope?: 'private' | 'family';
}) {
    const { api } = useRuntime();
    const user = useSession('user');
    const cmd = usePreserveCommand(scope);
    const [fields, setFields] = useState(() => ({
        name: value?.name ?? '',
        type: value?.type ?? 'canned',
        createdOn: value?.createdOn ?? localDate(),
        expiryOn: value?.expiryOn ?? '',
        shelfLifeDays: value?.shelfLifeDays?.toString() ?? '',
        locationId: value?.locationId ?? '',
        unit: value?.unit ?? '',
        volumePerUnit: value?.volumePerUnit ?? '',
        notes: value?.notes ?? '',
        tags: value?.tags.join(', ') ?? '',
        ingredients: value?.ingredients.map((i) => i.name).join('\n') ?? '',
    }));
    const [containers, setContainers] = useState([{ label: 'Банка 1', quantity: '' }]);
    const [version, setVersion] = useState(value?.version ?? 1);
    const [notice, setNotice] = useState('');
    const [dirty, setDirty] = useState(false);
    const locations = useQuery({
        queryKey: ['inventory-locations', user.data?.id, scope],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/inventory-locations', undefined, signal, undefined, { query: { scope } }))
                .data,
    });
    function change(key: keyof typeof fields, v: string) {
        setDirty(true);
        setFields((f) => ({ ...f, [key]: v }));
    }
    async function save() {
        const ingredientOccurrences = new Map<string, number>();
        const metadata = {
            ...fields,
            expiryOn: fields.expiryOn || null,
            shelfLifeDays: fields.shelfLifeDays ? Number(fields.shelfLifeDays) : null,
            locationId: fields.locationId || null,
            unit: fields.unit || null,
            volumePerUnit: fields.volumePerUnit || null,
            notes: fields.notes || null,
            tags: fields.tags
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean),
            ingredients: fields.ingredients
                .split('\n')
                .map((v) => v.trim())
                .filter(Boolean)
                .map((name) => {
                    const occurrence = ingredientOccurrences.get(name) ?? 0;
                    ingredientOccurrences.set(name, occurrence + 1);
                    return (
                        value?.ingredients.filter((i) => i.name === name)[occurrence] ?? {
                            name,
                            ingredientId: null,
                            quantity: null,
                            unit: null,
                        }
                    );
                }),
            imageUrl: value?.imageUrl ?? null,
        };
        const result = value
            ? await cmd.run('POST /api/v1/preserves/{id}/edit', { version, fields: metadata }, { id: value.id })
            : await cmd.run('POST /api/v1/preserves', {
                  ...metadata,
                  recipeRevisionId,
                  containers: containers.map((c) => ({ ...c, quantity: c.quantity || null })),
              });
        if (result) onSaved(result.preserve);
    }
    return (
        <form
            className={styles.panel}
            onSubmit={(e) => {
                e.preventDefault();
                void save();
            }}
        >
            <h2>{value ? 'Изменить заготовку' : 'Новая заготовка'}</h2>
            <fieldset disabled={cmd.pending || cmd.unknown} className={styles.fields}>
                <label className={styles.field}>
                    Название
                    <input
                        required
                        maxLength={200}
                        value={fields.name}
                        onChange={(e) => change('name', e.target.value)}
                    />
                </label>
                <label className={styles.field}>
                    Тип
                    <select value={fields.type} onChange={(e) => change('type', e.target.value)}>
                        {Object.entries(preserveTypes).map(([k, v]) => (
                            <option value={k} key={k}>
                                {v}
                            </option>
                        ))}
                    </select>
                </label>
                <label className={styles.field}>
                    Дата приготовления
                    <input
                        required
                        type="date"
                        value={fields.createdOn}
                        onChange={(e) => change('createdOn', e.target.value)}
                    />
                </label>
                <label className={styles.field}>
                    Годен до
                    <input type="date" value={fields.expiryOn} onChange={(e) => change('expiryOn', e.target.value)} />
                </label>
                <label className={styles.field}>
                    Срок хранения, дней
                    <input
                        type="number"
                        min={1}
                        max={36500}
                        value={fields.shelfLifeDays}
                        onChange={(e) => change('shelfLifeDays', e.target.value)}
                    />
                </label>
                <label className={styles.field}>
                    Место хранения
                    <select value={fields.locationId} onChange={(e) => change('locationId', e.target.value)}>
                        <option value="">Место не указано</option>
                        {locations.data?.items.map((l) => (
                            <option key={l.id} value={l.id}>
                                {l.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className={styles.field}>
                    Единица количества
                    <select
                        disabled={!!value?.unit}
                        value={fields.unit}
                        onChange={(e) => change('unit', e.target.value)}
                    >
                        <option value="">Не указана</option>
                        {Object.entries(units).map(([k, v]) => (
                            <option key={k} value={k}>
                                {v}
                            </option>
                        ))}
                    </select>
                </label>
                <label className={styles.field}>
                    Объём одной единицы
                    <input
                        inputMode="decimal"
                        value={fields.volumePerUnit}
                        onChange={(e) => change('volumePerUnit', e.target.value)}
                    />
                </label>
                <label className={`${styles.field} ${styles.wide}`}>
                    Состав — по одному ингредиенту на строке
                    <textarea value={fields.ingredients} onChange={(e) => change('ingredients', e.target.value)} />
                </label>
                <label className={styles.field}>
                    Теги через запятую
                    <input value={fields.tags} onChange={(e) => change('tags', e.target.value)} />
                </label>
                <label className={styles.field}>
                    Заметки
                    <textarea value={fields.notes} onChange={(e) => change('notes', e.target.value)} />
                </label>
            </fieldset>
            {!value && (
                <fieldset disabled={cmd.pending || cmd.unknown}>
                    <legend>Отдельные банки или упаковки</legend>
                    <p>Количество можно оставить неизвестным. Перед расходом его нужно уточнить.</p>
                    {containers.map((c, i) => (
                        <div className={styles.fields} key={i}>
                            <label className={styles.field}>
                                Метка
                                <input
                                    required
                                    maxLength={100}
                                    value={c.label}
                                    onChange={(e) => {
                                        setDirty(true);
                                        setContainers((a) =>
                                            a.map((v, n) => (n === i ? { ...v, label: e.target.value } : v)),
                                        );
                                    }}
                                />
                            </label>
                            <label className={styles.field}>
                                Количество
                                <input
                                    inputMode="decimal"
                                    value={c.quantity}
                                    onChange={(e) => {
                                        setDirty(true);
                                        setContainers((a) =>
                                            a.map((v, n) => (n === i ? { ...v, quantity: e.target.value } : v)),
                                        );
                                    }}
                                />
                            </label>
                            <button
                                type="button"
                                disabled={containers.length === 1}
                                onClick={() => setContainers((a) => a.filter((_, n) => n !== i))}
                            >
                                Убрать упаковку
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        disabled={containers.length >= 500}
                        onClick={() => {
                            setDirty(true);
                            setContainers((a) => [...a, { label: `Банка ${a.length + 1}`, quantity: '' }]);
                        }}
                    >
                        Добавить упаковку
                    </button>
                </fieldset>
            )}
            <p>Фото необязательно. Загрузка фото пока недоступна.</p>
            {cmd.error && <p role="alert">{cmd.error}</p>}
            {cmd.conflict && value && (
                <button
                    type="button"
                    onClick={() => {
                        void (async () => {
                            try {
                                const fresh = await api!.request(
                                    'GET /api/v1/preserves/{id}',
                                    undefined,
                                    undefined,
                                    { id: value.id },
                                    { query: { scope } },
                                );
                                setVersion(fresh.data.preserve.version);
                                setNotice(
                                    `Актуальная версия ${fresh.data.preserve.version}: ${fresh.data.preserve.name}. Введённые поля сохранены — сравните их перед сохранением.`,
                                );
                            } catch {
                                setNotice('Не удалось перечитать карточку.');
                            }
                        })();
                    }}
                >
                    Перечитать, сохранив ввод
                </button>
            )}
            {notice && <p role="status">{notice}</p>}
            <div className={styles.actions}>
                <button type="submit" disabled={cmd.pending}>
                    {cmd.pending ? 'Сохраняем…' : cmd.unknown ? 'Повторить сохранённый запрос' : 'Сохранить'}
                </button>
                <button
                    type="button"
                    disabled={cmd.pending || cmd.unknown}
                    onClick={() => {
                        if (!dirty || window.confirm('Отменить несохранённые изменения?')) onCancel();
                    }}
                >
                    Отмена
                </button>
            </div>
        </form>
    );
}
