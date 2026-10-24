'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRuntime } from '../../app/providers.js';
import { InventoryShell, commandError, inventoryBase, type InventoryScope } from '../inventory/shared.js';
import { scanPreviewSchema, type ReviewRow } from './contracts.js';
import { IngestReview } from './review.js';
import { validateImage } from './image-metadata.js';
import styles from './ingest.module.css';

function Photo({ file, remove, disabled }: { file: File; remove: () => void; disabled: boolean }) {
    const image = useRef<HTMLImageElement>(null);
    useEffect(() => {
        const next = URL.createObjectURL(file);
        if (image.current) image.current.src = next;
        return () => URL.revokeObjectURL(next);
    }, [file]);
    return (
        <figure className={styles.card}>
            <img ref={image} className={styles.preview} alt={`Выбранное фото: ${file.name}`} />
            <figcaption>{file.name}</figcaption>
            <button className="button outline" disabled={disabled} onClick={remove}>
                Удалить фото
            </button>
        </figure>
    );
}
function draft(name: string, barcode?: string): ReviewRow {
    return {
        key: crypto.randomUUID(),
        source: 'Фото или штрихкод',
        name,
        ...(barcode ? { barcode } : {}),
        quantity: '',
        unit: '',
        expiryOn: '',
        locationName: '',
        locationId: '',
        ingredientId: '',
        skip: false,
        reviewed: false,
    };
}
export function ScanPage({ scope = 'private' }: { scope?: InventoryScope }) {
    const { api } = useRuntime();
    const [files, setFiles] = useState<File[]>([]);
    const [barcode, setBarcode] = useState('');
    const [cameraError, setCameraError] = useState('');
    const [camera, setCamera] = useState(false);
    const [review, setReview] = useState<ReviewRow[] | null>(null);
    const [text, setText] = useState('');
    const video = useRef<HTMLVideoElement>(null);
    const controls = useRef<{ stop: () => void } | null>(null);
    const generation = useRef(0);
    const photoGeneration = useRef(0);
    const upload = useRef<AbortController | null>(null);
    useEffect(
        () => () => {
            generation.current++;
            photoGeneration.current++;
            controls.current?.stop();
            upload.current?.abort();
        },
        [],
    );
    const stop = () => {
        generation.current++;
        controls.current?.stop();
        controls.current = null;
        setCamera(false);
    };
    async function start() {
        const attempt = ++generation.current;
        setCameraError('');
        setCamera(true);
        try {
            const { BrowserMultiFormatReader } = await import('@zxing/browser');
            if (attempt !== generation.current || !video.current) return;
            const reader = new BrowserMultiFormatReader();
            const next = await reader.decodeFromVideoDevice(undefined, video.current, (result) => {
                if (result && attempt === generation.current) setBarcode(result.getText());
            });
            if (attempt !== generation.current) next.stop();
            else controls.current = next;
        } catch {
            if (attempt === generation.current) {
                setCamera(false);
                setCameraError('Камера недоступна или доступ отклонён. Загрузите фото либо введите штрихкод вручную.');
            }
        }
    }
    async function add(incoming: File[]) {
        if (
            files.length + incoming.length > 3 ||
            incoming.some(
                (file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10485760,
            )
        ) {
            setCameraError('До 3 фото JPEG, PNG или WebP, каждое до 10 МБ и 20 Мп.');
            return;
        }
        const attempt = ++photoGeneration.current;
        try {
            for (const file of incoming) validateImage(new Uint8Array(await file.arrayBuffer()), file.type);
            if (attempt !== photoGeneration.current) return;
            setFiles([...files, ...incoming]);
            setCameraError('');
            mutation.reset();
            const { BrowserMultiFormatReader } = await import('@zxing/browser');
            const reader = new BrowserMultiFormatReader();
            for (const file of incoming) {
                if (attempt !== photoGeneration.current) return;
                const url = URL.createObjectURL(file);
                try {
                    const result = await reader.decodeFromImageUrl(url);
                    if (attempt === photoGeneration.current) setBarcode((current) => current || result.getText());
                } catch {
                    /* A package without a readable barcode can still be processed by OCR. */
                } finally {
                    URL.revokeObjectURL(url);
                }
            }
        } catch (error) {
            if (attempt === photoGeneration.current)
                setCameraError(error instanceof Error ? error.message : 'Не удалось проверить фото');
        }
    }
    function capture() {
        const source = video.current;
        if (!source?.videoWidth) return;
        const canvas = document.createElement('canvas');
        canvas.width = source.videoWidth;
        canvas.height = source.videoHeight;
        canvas.getContext('2d')?.drawImage(source, 0, 0);
        canvas.toBlob(
            (blob) => {
                if (blob) void add([new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' })]);
            },
            'image/jpeg',
            0.9,
        );
    }
    const mutation = useMutation({
        mutationFn: async () => {
            if (!api || !files.length) throw new Error('Добавьте фото');
            const body = new FormData();
            files.forEach((file) => body.append('files', file));
            upload.current?.abort();
            upload.current = new AbortController();
            return scanPreviewSchema.parse(
                (await api.upload('POST /api/v1/inventory/ingest/scan', body, upload.current.signal)).data,
            );
        },
        onSuccess: (result) => {
            setText(result.images.map((image) => image.text).join('\n'));
            stop();
        },
    });
    return (
        <InventoryShell scope={scope}>
            <div className={styles.page}>
                <Link href={inventoryBase(scope)}>← К запасам</Link>
                <h1>Фото и штрихкод</h1>
                <p>
                    Распознавание создаёт черновик. Продукт попадёт в {scope === 'family' ? 'семейные' : 'личные'}
                    запасы только после вашей проверки.
                </p>
                {review ? (
                    <IngestReview initialRows={review} onBack={() => setReview(null)} scope={scope} />
                ) : (
                    <>
                        <section className={styles.card}>
                            <h2>Снимите упаковку</h2>
                            <p>
                                До 3 фото JPEG, PNG или WebP, каждое до 10 МБ и 20 Мп. Хорошо освещённые название,
                                состав и штрихкод распознаются точнее.
                            </p>
                            <video
                                ref={video}
                                className={styles.preview}
                                autoPlay
                                playsInline
                                muted
                                hidden={!camera}
                                aria-label="Предпросмотр камеры"
                            />
                            <div className={styles.actions}>
                                {!camera ? (
                                    <button
                                        className="button primary"
                                        disabled={mutation.isPending}
                                        onClick={() => void start()}
                                    >
                                        Разрешить камеру
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            className="button primary"
                                            disabled={files.length >= 3 || mutation.isPending}
                                            onClick={capture}
                                        >
                                            Сделать фото
                                        </button>
                                        <button className="button outline" onClick={stop}>
                                            Остановить камеру
                                        </button>
                                    </>
                                )}
                                <label>
                                    Загрузить фото
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        multiple
                                        disabled={files.length >= 3 || mutation.isPending}
                                        onChange={(event) => {
                                            void add(Array.from(event.target.files ?? []));
                                            event.target.value = '';
                                        }}
                                    />
                                </label>
                            </div>
                            {cameraError && (
                                <p role="alert" className={styles.error}>
                                    {cameraError}
                                </p>
                            )}
                            <div className={styles.grid}>
                                {files.map((file, index) => (
                                    <Photo
                                        key={`${file.name}-${index}`}
                                        file={file}
                                        disabled={mutation.isPending}
                                        remove={() => {
                                            if (!mutation.isPending) {
                                                photoGeneration.current++;
                                                setFiles(files.filter((_, i) => i !== index));
                                                mutation.reset();
                                            }
                                        }}
                                    />
                                ))}
                            </div>
                            <button
                                className="button primary"
                                disabled={!files.length || !api || mutation.isPending}
                                onClick={() => mutation.mutate()}
                            >
                                {mutation.isPending ? 'Распознаём фото…' : 'Распознать выбранные фото'}
                            </button>
                            {mutation.isError && (
                                <p role="alert" className={styles.error}>
                                    {commandError(mutation.error)} Можно заполнить данные вручную.
                                </p>
                            )}
                        </section>
                        <section className={styles.card}>
                            <h2>Штрихкод или название</h2>
                            <label>
                                Введите штрихкод вручную
                                <input
                                    value={barcode}
                                    maxLength={128}
                                    onChange={(event) => setBarcode(event.target.value)}
                                />
                            </label>
                            <button
                                className="button outline"
                                disabled={!barcode.trim()}
                                onClick={() => {
                                    stop();
                                    setReview([draft(barcode.trim(), barcode.trim())]);
                                }}
                            >
                                Найти совпадение и проверить
                            </button>
                            <Link href={`${inventoryBase(scope)}/new`}>Добавить продукт вручную</Link>
                        </section>
                        {mutation.data && (
                            <section className={styles.card}>
                                <h2>Результат распознавания</h2>
                                {mutation.data.images.map((image) => (
                                    <p key={image.filename}>
                                        {image.filename}: уверенность {Math.round(image.confidence)}%
                                        {image.confidence < 70 ? ' · нужна особенно внимательная проверка' : ''}
                                    </p>
                                ))}
                                {mutation.data.warnings.map((warning) => (
                                    <p className={styles.notice} key={warning}>
                                        {warning}
                                    </p>
                                ))}
                                <label>
                                    Распознанный текст — можно исправить
                                    <textarea rows={8} value={text} onChange={(event) => setText(event.target.value)} />
                                </label>
                                <p>
                                    Выберите точный товар на следующем шаге. Количество и даты не списываются из текста
                                    автоматически.
                                </p>
                                <button
                                    className="button primary"
                                    onClick={() =>
                                        setReview([
                                            draft(
                                                text
                                                    .split('\n')
                                                    .find((line) => line.trim())
                                                    ?.trim()
                                                    .slice(0, 200) ?? '',
                                            ),
                                        ])
                                    }
                                >
                                    Проверить товар и количество
                                </button>
                            </section>
                        )}
                    </>
                )}
            </div>
        </InventoryShell>
    );
}
