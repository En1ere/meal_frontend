'use client';
import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRuntime } from '../../app/providers.js';
import { InventoryShell, commandError, inventoryBase, type InventoryScope } from '../inventory/shared.js';
import {
    importPreviewSchema,
    columns,
    mapRows,
    type ImportPreview,
    type Mapping,
    type ReviewRow,
} from './contracts.js';
import { IngestReview } from './review.js';
import styles from './ingest.module.css';

const initialMapping: Mapping = { name: 0, quantity: 1, unit: 2, expiryOn: 3, locationName: 4 };
interface SheetOptions {
    enabled: boolean;
    header: number;
    mapping: Mapping;
}
export function ImportPage({ scope = 'private' }: { scope?: InventoryScope }) {
    const { api } = useRuntime();
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<ImportPreview | null>(null);
    const [options, setOptions] = useState<Record<string, SheetOptions>>({});
    const [review, setReview] = useState<ReviewRow[] | null>(null);
    const input = useRef<HTMLInputElement>(null);
    const upload = useRef<AbortController | null>(null);
    useEffect(() => () => upload.current?.abort(), []);
    const mutation = useMutation({
        mutationFn: async () => {
            if (!api || !file) throw new Error('Выберите файл');
            if (file.size > 10485760 || !/\.(csv|tsv|xlsx|ods)$/i.test(file.name))
                throw new Error('Нужен CSV, TSV, XLSX или ODS до 10 МБ');
            const body = new FormData();
            body.set('file', file);
            upload.current?.abort();
            upload.current = new AbortController();
            return importPreviewSchema.parse(
                (await api.upload('POST /api/v1/inventory/ingest/import', body, upload.current.signal)).data,
            );
        },
        onSuccess: (result) => {
            setPreview(result);
            setOptions(
                Object.fromEntries(
                    result.sheets.map((sheet) => [
                        sheet.name,
                        { enabled: true, header: 0, mapping: { ...initialMapping } },
                    ]),
                ),
            );
        },
    });
    function changeSheet(name: string, value: Partial<SheetOptions>) {
        setOptions((current) => ({ ...current, [name]: { ...current[name]!, ...value } }));
    }
    return (
        <InventoryShell scope={scope}>
            <div className={styles.page}>
                <Link href={inventoryBase(scope)}>← К запасам</Link>
                <h1>Импорт запасов из таблицы</h1>
                <ol className={styles.step}>
                    <li aria-current={!preview ? 'step' : undefined}>1. Файл</li>
                    <li aria-current={preview && !review ? 'step' : undefined}>2. Листы и колонки</li>
                    <li aria-current={review ? 'step' : undefined}>3. Проверка и добавление</li>
                </ol>
                {review ? (
                    <IngestReview initialRows={review} onBack={() => setReview(null)} scope={scope} />
                ) : (
                    <>
                        <section className={styles.card}>
                            <h2>Загрузите файл</h2>
                            <p>
                                CSV, TSV, XLSX или ODS · до 10 МБ · суммарно 5000 строк, 10 листов и 100 колонок.
                                Формулы пропускаются, внешние ссылки не загружаются.
                            </p>
                            <label>
                                Таблица
                                <input
                                    ref={input}
                                    type="file"
                                    accept=".csv,.tsv,.xlsx,.ods"
                                    disabled={mutation.isPending}
                                    onChange={(event) => {
                                        setFile(event.target.files?.[0] ?? null);
                                        setPreview(null);
                                        mutation.reset();
                                    }}
                                />
                            </label>
                            <div className={styles.actions}>
                                <button
                                    className="button primary"
                                    disabled={!file || !api || mutation.isPending}
                                    onClick={() => mutation.mutate()}
                                >
                                    {mutation.isPending ? 'Читаем таблицу…' : 'Загрузить и проверить'}
                                </button>
                                <a
                                    className="button outline"
                                    download="inventory-template.csv"
                                    href={`data:text/csv;charset=utf-8,${encodeURIComponent('\uFEFFНазвание;Количество;Единица;Срок годности;Место хранения\nМолоко;1;л;2026-10-10;Холодильник\n')}`}
                                >
                                    Скачать шаблон
                                </a>
                                {file && (
                                    <button
                                        className="button outline"
                                        disabled={mutation.isPending}
                                        onClick={() => {
                                            setFile(null);
                                            setPreview(null);
                                            if (input.current) input.current.value = '';
                                            mutation.reset();
                                        }}
                                    >
                                        Удалить файл
                                    </button>
                                )}
                            </div>
                            {mutation.isError && (
                                <p role="alert" className={styles.error}>
                                    {mutation.error instanceof Error && !(mutation.error.name === 'ApiError')
                                        ? mutation.error.message
                                        : commandError(mutation.error)}
                                </p>
                            )}
                        </section>
                        {preview && (
                            <>
                                <h2>{preview.filename}</h2>
                                {preview.warnings.map((warning) => (
                                    <p className={styles.notice} key={warning}>
                                        {warning}
                                    </p>
                                ))}
                                {preview.sheets.map((sheet) => {
                                    const setting = options[sheet.name]!;
                                    const headers = sheet.rows[setting.header] ?? [];
                                    return (
                                        <section className={styles.card} key={sheet.name}>
                                            <label className={styles.check}>
                                                <input
                                                    type="checkbox"
                                                    checked={setting.enabled}
                                                    onChange={(event) =>
                                                        changeSheet(sheet.name, { enabled: event.target.checked })
                                                    }
                                                />
                                                Лист «{sheet.name}» ({sheet.rows.length} строк)
                                            </label>
                                            {setting.enabled && (
                                                <>
                                                    <label>
                                                        Строка заголовков
                                                        <select
                                                            value={setting.header}
                                                            onChange={(event) =>
                                                                changeSheet(sheet.name, {
                                                                    header: Number(event.target.value),
                                                                })
                                                            }
                                                        >
                                                            {sheet.rows.map((_, index) => (
                                                                <option key={index} value={index}>
                                                                    {index + 1}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </label>
                                                    <div className={styles.grid}>
                                                        {Object.entries(columns).map(([key, title]) => (
                                                            <label key={key}>
                                                                {title}
                                                                <select
                                                                    value={setting.mapping[key as keyof Mapping]}
                                                                    onChange={(event) =>
                                                                        changeSheet(sheet.name, {
                                                                            mapping: {
                                                                                ...setting.mapping,
                                                                                [key]: Number(event.target.value),
                                                                            },
                                                                        })
                                                                    }
                                                                >
                                                                    <option value={-1}>Не импортировать</option>
                                                                    {headers.map((header, index) => (
                                                                        <option key={index} value={index}>
                                                                            {index + 1}. {header || '(без заголовка)'}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </label>
                                                        ))}
                                                    </div>
                                                    <details>
                                                        <summary>Предпросмотр первых строк</summary>
                                                        <div className={styles.scroll}>
                                                            <table className={styles.table}>
                                                                <thead>
                                                                    <tr>
                                                                        {headers.map((header, index) => (
                                                                            <th key={index}>{header || index + 1}</th>
                                                                        ))}
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {sheet.rows
                                                                        .slice(setting.header + 1, setting.header + 4)
                                                                        .map((cells, index) => (
                                                                            <tr key={index}>
                                                                                {cells.map((cell, c) => (
                                                                                    <td key={c}>{cell}</td>
                                                                                ))}
                                                                            </tr>
                                                                        ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </details>
                                                </>
                                            )}
                                        </section>
                                    );
                                })}
                                <button
                                    className="button primary"
                                    disabled={
                                        !preview.sheets.some(
                                            (sheet) =>
                                                options[sheet.name]?.enabled &&
                                                sheet.rows.length > options[sheet.name]!.header + 1,
                                        )
                                    }
                                    onClick={() =>
                                        setReview(
                                            preview.sheets.flatMap((sheet) =>
                                                options[sheet.name]?.enabled
                                                    ? mapRows(
                                                          sheet,
                                                          options[sheet.name]!.header,
                                                          options[sheet.name]!.mapping,
                                                      )
                                                    : [],
                                            ),
                                        )
                                    }
                                >
                                    К исправлению строк
                                </button>
                            </>
                        )}
                    </>
                )}
            </div>
        </InventoryShell>
    );
}
