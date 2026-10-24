'use client';
import { BrowserQRCodeSvgWriter } from '@zxing/browser';
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../app/providers.js';
import type { Preserve } from './types.js';
import { usePreserveCommand } from './use-command.js';
import { dayText } from './shared.js';
import styles from './preserves.module.css';

const escapeHtml = (value: string) =>
    value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export function PreserveQrLabel({ preserve, scope = 'private' }: { preserve: Preserve; scope?: 'private' | 'family' }) {
    const { api } = useRuntime();
    const command = usePreserveCommand();
    const qr = useRef<HTMLDivElement>(null);
    const result = useQuery({
        queryKey: ['preserves', preserve.id, 'qr-label'],
        enabled: !!api,
        queryFn: async ({ signal: querySignal }) =>
            (
                await api!.request(
                    'GET /api/v1/preserves/{id}/qr-label',
                    undefined,
                    querySignal,
                    { id: preserve.id },
                    { query: { scope } },
                )
            ).data,
    });
    const label = result.data?.label ?? null;
    useEffect(() => {
        if (!qr.current) return;
        qr.current.replaceChildren();
        if (!label) return;
        const svg = new BrowserQRCodeSvgWriter().write(JSON.stringify(label.payload), 260, 260);
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', `QR-код этикетки «${label.payload.name}»`);
        qr.current.append(svg);
    }, [label]);
    async function issue() {
        const data = await command.run(
            'POST /api/v1/preserves/{id}/qr-label',
            { preserveVersion: preserve.version, scope },
            { id: preserve.id },
        );
        if (data) await result.refetch({ cancelRefetch: true });
    }
    function svgText() {
        return qr.current?.querySelector('svg')?.outerHTML ?? '';
    }
    function download() {
        const svg = svgText();
        if (!svg) return;
        const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `meal-planner-${preserve.id}-r${label?.revision ?? 1}.svg`;
        link.click();
        URL.revokeObjectURL(url);
    }
    function print() {
        const svg = svgText();
        if (!svg || !label) return;
        const popup = window.open('', '_blank');
        if (!popup) return;
        popup.opener = null;
        popup.document.write(
            `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${escapeHtml(label.payload.name)}</title><style>body{font-family:system-ui;margin:0;padding:24px}.label{width:72mm;border:1px solid #bbb;padding:6mm;box-sizing:border-box}.label svg{width:100%;height:auto}h1{font-size:18px;margin:0 0 8px}p{margin:4px 0}@media print{body{padding:0}.label{border:0}}</style></head><body><article class="label"><h1>${escapeHtml(label.payload.name)}</h1>${svg}<p>Приготовлено: ${escapeHtml(dayText(label.payload.createdOn))}</p><p>Срок: ${escapeHtml(label.payload.expiryOn ? dayText(label.payload.expiryOn) : 'не указан')}</p><p>Этикетка №${label.revision}</p></article><script>window.addEventListener('load',()=>window.print(),{once:true})</script></body></html>`,
        );
        popup.document.close();
    }
    if (result.isPending) return <p>Загружаем этикетку…</p>;
    if (result.isError)
        return (
            <>
                <p role="alert">Не удалось загрузить этикетку.</p>
                <button onClick={() => void result.refetch()}>Повторить</button>
            </>
        );
    if (!result.data?.capability.available)
        return (
            <>
                <p>Этикетки и QR-коды доступны на тарифах Plus и Pro.</p>
                <button disabled>Создать этикетку · Plus / Pro</button>
            </>
        );
    return (
        <>
            {label ? (
                <div className={styles.qrLabel}>
                    <div ref={qr} className={styles.qrCode} />
                    <div>
                        <strong>{label.payload.name}</strong>
                        <p>Версия этикетки: {label.revision}</p>
                        <p>В QR сохранены только название, тип, даты и ссылка на карточку.</p>
                    </div>
                </div>
            ) : (
                <p>Этикетка ещё не создана.</p>
            )}
            <div className={styles.actions}>
                <button disabled={command.pending} onClick={() => void issue()}>
                    {command.pending ? 'Создаём…' : label ? 'Выпустить новую версию' : 'Создать этикетку'}
                </button>
                <button disabled={!label} onClick={download}>
                    Скачать SVG
                </button>
                <button disabled={!label} onClick={print}>
                    Печать
                </button>
            </div>
            {command.error && <p role="alert">{command.error}</p>}
        </>
    );
}
