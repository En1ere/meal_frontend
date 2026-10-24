import { importPreviewSchema, scanPreviewSchema } from '../features/inventory-ingest/contracts.js';
import { validateImage } from '../features/inventory-ingest/image-metadata.js';
import type { Worker as OcrWorker } from 'tesseract.js';

let active = false;
export async function runIngestUpload(path: string, form: FormData, signal?: AbortSignal): Promise<unknown> {
    signal?.throwIfAborted();
    if (active) throw new Error('Дождитесь завершения текущего распознавания');
    const files = Array.from(form.values());
    if (!files.length || files.some((file) => !(file instanceof File) || !file.size || file.size > 10485760))
        throw new Error('Каждый файл должен быть непустым и не больше 10 МБ');
    active = true;
    try {
        if (path.endsWith('/import')) {
            if (files.length !== 1) throw new Error('Выберите один файл');
            const file = files[0] as File;
            const bytes = await file.arrayBuffer();
            signal?.throwIfAborted();
            const result = await new Promise<unknown>((resolve, reject) => {
                // Webpack emits this worker as a classic bundle that loads its split XLSX chunk via importScripts.
                // Declaring it as a module makes importScripts unavailable in Firefox and leaves uploads waiting
                // until the watchdog fires.
                const worker = new Worker(new URL('../features/inventory-ingest/parser.worker.ts', import.meta.url));
                const finish = () => {
                    clearTimeout(timer);
                    worker.terminate();
                    signal?.removeEventListener('abort', abort);
                };
                const abort = () => {
                    finish();
                    reject(new DOMException('Обработка отменена', 'AbortError'));
                };
                const timer = setTimeout(() => {
                    finish();
                    reject(new Error('Обработка заняла слишком много времени'));
                }, 60000);
                signal?.addEventListener('abort', abort, { once: true });
                worker.onerror = () => {
                    finish();
                    reject(new Error('Не удалось прочитать таблицу'));
                };
                worker.onmessage = (event: MessageEvent<{ ok: boolean; data?: unknown; message?: string }>) => {
                    finish();
                    if (event.data.ok) resolve(event.data.data);
                    else reject(new Error(event.data.message));
                };
                worker.postMessage({ filename: file.name, bytes }, [bytes]);
            });
            return importPreviewSchema.parse(result);
        }
        if (
            !path.endsWith('/scan') ||
            files.length > 3 ||
            files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes((file as File).type))
        )
            throw new Error('Нужно до трёх фото JPEG, PNG или WebP');
        let worker: OcrWorker | undefined;
        let cancelled = false;
        let rejectCancellation: (reason: Error) => void = () => undefined;
        const cancellation = new Promise<never>((_, reject) => {
            rejectCancellation = reject;
        });
        const abort = () => {
            cancelled = true;
            void worker?.terminate();
            rejectCancellation(new DOMException('Обработка отменена или превышен срок ожидания', 'AbortError'));
        };
        signal?.addEventListener('abort', abort, { once: true });
        const timer = setTimeout(abort, 60000);
        const work = async () => {
            const { createWorker } = await import('tesseract.js');
            if (cancelled) throw new DOMException('Отменено', 'AbortError');
            worker = await createWorker(['rus', 'eng'], 1, {
                workerPath: '/ocr/worker.min.js',
                corePath: '/ocr',
                langPath: '/ocr',
                gzip: false,
                cacheMethod: 'none',
            });
            if (cancelled) {
                await worker.terminate();
                throw new DOMException('Отменено', 'AbortError');
            }
            const images = [];
            for (const item of files) {
                signal?.throwIfAborted();
                if (cancelled) throw new DOMException('Отменено', 'AbortError');
                const file = item as File;
                validateImage(new Uint8Array(await file.arrayBuffer()), file.type);
                const bitmap = await createImageBitmap(file);
                if (bitmap.width * bitmap.height > 20000000) {
                    bitmap.close();
                    throw new Error('Фото превышает 20 Мп');
                }
                const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
                const canvas = new OffscreenCanvas(
                    Math.max(1, Math.round(bitmap.width * scale)),
                    Math.max(1, Math.round(bitmap.height * scale)),
                );
                canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
                bitmap.close();
                const result = await worker.recognize(await canvas.convertToBlob({ type: 'image/png' }));
                images.push({
                    filename: file.name,
                    text: result.data.text.slice(0, 20000),
                    confidence: result.data.confidence,
                });
            }
            return scanPreviewSchema.parse({
                images,
                warnings: [
                    'Распознавание может ошибаться. Проверьте название, количество, единицу и даты перед сохранением.',
                ],
            });
        };
        try {
            return await Promise.race([work(), cancellation]);
        } finally {
            clearTimeout(timer);
            signal?.removeEventListener('abort', abort);
            await worker?.terminate();
        }
    } finally {
        active = false;
    }
}
