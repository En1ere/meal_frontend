'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRuntime } from '../../../shared/runtime/index.js';
import { useSession } from '../../../entities/session/client.js';
import { useQuery } from '@tanstack/react-query';
import { useRequestSignal } from '../../../shared/api/use-request-signal.js';
import { ApiError } from '../../../shared/api/client.js';
import { validateImage } from '../../../shared/media/image-validation.js';
import {
    ShoppingShell,
    ShoppingLoading,
    shoppingBase,
    receiptBase,
    useShoppingScope,
    type ShoppingScope,
} from '../shared.js';
import { PurchaseLines, emptyPurchaseLine, type PurchaseLine } from '../purchase-review.js';
import { useShoppingCommand } from '../use-command.js';
import styles from '../shopping.module.css';
function Photo({ file }: { file: File }) {
    const image = useRef<HTMLImageElement>(null);
    useEffect(() => {
        const next = URL.createObjectURL(file);
        if (image.current) image.current.src = next;
        return () => URL.revokeObjectURL(next);
    }, [file]);
    return <img ref={image} className={styles.source} alt={`Фото чека ${file.name}`} />;
}
function ReceiptNewContent() {
    const scope = useShoppingScope();
    const { api } = useRuntime();
    const router = useRouter();
    const cmd = useShoppingCommand();
    const user = useSession('user');
    const entitlement = useQuery({
        queryKey: ['entitlements', user.data?.id],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/entitlements', undefined, signal)).data,
    });
    const capabilities = useQuery({
        queryKey: ['receipt-capabilities'],
        enabled: !!api,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/receipts/capabilities', undefined, signal)).data,
    });
    const pro = entitlement.data?.plan === 'pro';
    const [files, setFiles] = useState<File[]>([]),
        [text, setText] = useState(''),
        [lines, setLines] = useState<PurchaseLine[]>([]),
        [sourceKind, setSourceKind] = useState<'photo' | 'electronic_link'>('photo'),
        [electronicLink, setElectronicLink] = useState(''),
        [financeEnabled, setFinanceEnabled] = useState(false),
        [storeName, setStoreName] = useState(''),
        [totalRub, setTotalRub] = useState(''),
        [discountRub, setDiscountRub] = useState('0'),
        [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'other' | 'unknown'>('unknown'),
        [fiscalNumber, setFiscalNumber] = useState(''),
        [fiscalDocumentNumber, setFiscalDocumentNumber] = useState(''),
        [financeConsent, setFinanceConsent] = useState(false),
        [busy, setBusy] = useState(false),
        [error, setError] = useState('');
    const requestSignal = useRequestSignal();
    const formLocked = busy || cmd.pending || cmd.unknown;
    async function add(incoming: File[]) {
        setError('');
        try {
            if (files.length + incoming.length > 3) throw new Error('Можно добавить до трёх фотографий.');
            for (const f of incoming) {
                if (f.size > 10485760) throw new Error('Фото должно быть не больше 10 МБ.');
                validateImage(new Uint8Array(await f.arrayBuffer()), f.type);
            }
            setFiles((a) => [...a, ...incoming]);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Не удалось прочитать фото.');
        }
    }
    async function ocr() {
        if (!api || !files.length) return;
        setBusy(true);
        setError('');
        const signal = requestSignal();
        try {
            const body = new FormData();
            files.forEach((f) => body.append('files', f));
            const result = await api.upload('POST /api/v1/inventory/ingest/scan', body, signal);
            if (signal.aborted) return;
            setText(result.data.images.map((i) => i.text).join('\n'));
        } catch (e) {
            if (!signal.aborted)
                setError(e instanceof ApiError ? e.message : 'Не удалось распознать. Можно заполнить позиции вручную.');
        } finally {
            if (!signal.aborted) setBusy(false);
        }
    }
    async function save() {
        if ((sourceKind === 'electronic_link' || financeEnabled) && !pro) {
            setError('Электронные и финансовые чеки доступны только с активным Pro.');
            return;
        }
        const result = await cmd.run('POST /api/v1/receipts', {
            source:
                sourceKind === 'photo'
                    ? {
                          kind: 'photo' as const,
                          storageStatus: 'deferred' as const,
                          reference:
                              files
                                  .map((f) => f.name)
                                  .join(', ')
                                  .slice(0, 200) || null,
                      }
                    : {
                          kind: 'electronic_link' as const,
                          storageStatus: 'not_required' as const,
                          reference: electronicLink,
                      },
            ocrText: text,
            lines,
            financial: financeEnabled
                ? {
                      currency: 'RUB' as const,
                      storeName: storeName.trim() || null,
                      totalMinor: Math.round(Number(totalRub) * 100),
                      discountMinor: Math.round(Number(discountRub || 0) * 100),
                      paymentMethod,
                      fiscalNumber: fiscalNumber.trim() || null,
                      fiscalDocumentNumber: fiscalDocumentNumber.trim() || null,
                      financeConsent: true as const,
                      consentedAt: null,
                  }
                : null,
        });
        if (result) router.push(`${receiptBase(scope)}/${result.receipt.id}`);
    }
    return (
        <>
            <Link href={shoppingBase(scope)}>← Покупки</Link>
            <h1>Добавить из чека</h1>
            <ol className={styles.stepper}>
                <li aria-current={!text && !lines.length ? 'step' : undefined}>Источник</li>
                <li aria-current={!!text || !!lines.length ? 'step' : undefined}>Проверка</li>
                <li>Поступление</li>
            </ol>
            <p>Фото доступно бесплатно. Электронная ссылка и финансовые поля входят в Pro.</p>
            <fieldset disabled={formLocked} className={styles.panel}>
                <div className={styles.fields}>
                    <label className={styles.check}>
                        <input type="radio" checked={sourceKind === 'photo'} onChange={() => setSourceKind('photo')} />
                        Фото чека
                    </label>
                    <label className={styles.check}>
                        <input
                            type="radio"
                            disabled={!pro}
                            checked={sourceKind === 'electronic_link'}
                            onChange={() => setSourceKind('electronic_link')}
                        />
                        Ссылка на электронный чек · Pro
                    </label>
                    <label className={styles.check} title="Нужны object storage, KMS и OCR-адаптер">
                        <input type="radio" disabled />
                        PDF · временно недоступен
                    </label>
                </div>
                {sourceKind === 'electronic_link' && (
                    <label className={styles.field}>
                        Безопасная HTTPS-ссылка
                        <input
                            required
                            type="url"
                            pattern="https://.*"
                            value={electronicLink}
                            onChange={(event) => setElectronicLink(event.target.value)}
                        />
                    </label>
                )}
                {sourceKind === 'photo' && (
                    <>
                        <div className={styles.fields}>
                            <label className={styles.field}>
                                Сфотографировать чек
                                <input
                                    disabled={busy || cmd.pending || cmd.unknown}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    capture="environment"
                                    onChange={(e) => {
                                        void add(Array.from(e.target.files ?? []));
                                        e.target.value = '';
                                    }}
                                />
                            </label>
                            <label className={styles.field}>
                                Выбрать из галереи
                                <input
                                    disabled={busy || cmd.pending}
                                    type="file"
                                    multiple
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={(e) => {
                                        void add(Array.from(e.target.files ?? []));
                                        e.target.value = '';
                                    }}
                                />
                            </label>
                        </div>
                        <p>
                            До трёх фото, каждое до 10 МБ и 20 Мп. Фото видно только здесь до закрытия страницы;
                            хранение исходника пока недоступно.
                        </p>
                    </>
                )}
                {!capabilities.isPending && !capabilities.data?.pdfUpload && (
                    <p>PDF не загружается: защищённое хранение и OCR-адаптер ещё не настроены.</p>
                )}
                {sourceKind === 'photo' && (
                    <>
                        <div className={styles.cards}>
                            {files.map((file, i) => (
                                <figure key={`${file.name}:${i}`}>
                                    <Photo file={file} />
                                    <button
                                        disabled={busy || cmd.pending}
                                        onClick={() => setFiles((a) => a.filter((_, n) => n !== i))}
                                    >
                                        Убрать фото
                                    </button>
                                </figure>
                            ))}
                        </div>
                        <button
                            disabled={busy || cmd.pending || cmd.unknown || !files.length}
                            onClick={() => void ocr()}
                        >
                            Распознать фото
                        </button>
                    </>
                )}
                {busy && <ShoppingLoading />}
                <label className={styles.field}>
                    Исходный распознанный текст
                    <textarea
                        rows={8}
                        value={text}
                        disabled={busy || cmd.pending || cmd.unknown}
                        onChange={(e) => setText(e.target.value)}
                    />
                </label>
                <button
                    disabled={!text.trim() || busy || cmd.pending || cmd.unknown}
                    onClick={() => {
                        if (
                            lines.length &&
                            !window.confirm(
                                'Заменить позиции текстовыми строками? Текущие исправления позиций будут потеряны.',
                            )
                        )
                            return;
                        if (text.split('\n').filter((v) => v.trim()).length > 200) {
                            setError('В чеке больше 200 строк. Сократите текст до 200 позиций перед разбором.');
                            return;
                        }
                        setLines(
                            text
                                .split('\n')
                                .map((v) => v.trim())
                                .filter(Boolean)
                                .slice(0, 200)
                                .map((v) => emptyPurchaseLine(v.slice(0, 200))),
                        );
                    }}
                >
                    Разобрать текст на строки для проверки
                </button>
                <p>
                    Удалите заголовки и итоги чека. Проверьте каждую позицию: OCR не определяет достоверность товара и
                    не создаёт запас автоматически.
                </p>
            </fieldset>
            {scope === 'private' && (
                <fieldset disabled={formLocked} className={styles.panel}>
                    <label className={styles.check}>
                        <input
                            type="checkbox"
                            disabled={!pro}
                            checked={financeEnabled}
                            onChange={(event) => setFinanceEnabled(event.target.checked)}
                        />
                        Сохранить цены и итог в личной финансовой истории · Pro
                    </label>
                    {financeEnabled && (
                        <div className={styles.fields}>
                            <label className={styles.field}>
                                Магазин
                                <input value={storeName} onChange={(e) => setStoreName(e.target.value)} />
                            </label>
                            <label className={styles.field}>
                                Итого, ₽
                                <input
                                    required
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={totalRub}
                                    onChange={(e) => setTotalRub(e.target.value)}
                                />
                            </label>
                            <label className={styles.field}>
                                Скидка, ₽
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={discountRub}
                                    onChange={(e) => setDiscountRub(e.target.value)}
                                />
                            </label>
                            <label className={styles.field}>
                                Способ оплаты
                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
                                >
                                    <option value="unknown">Не указан</option>
                                    <option value="card">Карта</option>
                                    <option value="cash">Наличные</option>
                                    <option value="other">Другой</option>
                                </select>
                            </label>
                            <label className={styles.field}>
                                Фискальный номер
                                <input value={fiscalNumber} onChange={(e) => setFiscalNumber(e.target.value)} />
                            </label>
                            <label className={styles.field}>
                                Номер фискального документа
                                <input
                                    value={fiscalDocumentNumber}
                                    onChange={(e) => setFiscalDocumentNumber(e.target.value)}
                                />
                            </label>
                            <label className={styles.check}>
                                <input
                                    required
                                    type="checkbox"
                                    checked={financeConsent}
                                    onChange={(e) => setFinanceConsent(e.target.checked)}
                                />
                                Я согласен сохранить суммы в личной финансовой истории Pro.
                            </label>
                        </div>
                    )}
                </fieldset>
            )}
            <PurchaseLines lines={lines} setLines={setLines} locked={formLocked} showFinancial={financeEnabled} />
            {(error || cmd.error) && <p role="alert">{error || cmd.error}</p>}
            <div className={styles.sticky}>
                <button
                    disabled={
                        !lines.length ||
                        cmd.pending ||
                        busy ||
                        (financeEnabled && (!financeConsent || !totalRub)) ||
                        (sourceKind === 'electronic_link' && !electronicLink)
                    }
                    onClick={() => void save()}
                >
                    {cmd.unknown ? 'Повторить сохранённый запрос' : 'Сохранить чек и перейти к поступлению'}
                </button>
            </div>
        </>
    );
}
export function ReceiptNewPage({ scope = 'private' }: { scope?: ShoppingScope }) {
    return (
        <ShoppingShell scope={scope}>
            <ReceiptNewContent />
        </ShoppingShell>
    );
}
