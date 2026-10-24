import type { CellObject } from 'xlsx';

function chooseDelimiter(text: string, extension: string) {
    if (extension === 'tsv') return '\t';
    const firstRecord = text.split(/\r?\n/u, 1)[0] ?? '';
    const counts = new Map([
        [';', 0],
        [',', 0],
        ['\t', 0],
    ]);
    let quoted = false;
    for (let index = 0; index < firstRecord.length; index++) {
        const character = firstRecord[index]!;
        if (character === '"') {
            if (quoted && firstRecord[index + 1] === '"') index++;
            else quoted = !quoted;
        } else if (!quoted && counts.has(character)) counts.set(character, counts.get(character)! + 1);
    }
    return [...counts].sort((left, right) => right[1] - left[1])[0]?.[0] ?? ',';
}

function parseDelimited(text: string, extension: string) {
    const delimiter = chooseDelimiter(text, extension);
    const rows: string[][] = [];
    let row: string[] = [];
    let value = '';
    let quoted = false;
    let formulas = 0;
    let characters = 0;
    const pushValue = () => {
        if (value.startsWith('=')) {
            formulas++;
            value = '';
        }
        if (value.length > 2000) throw new Error('Слишком длинное значение ячейки');
        characters += value.length;
        if (characters > 26214400) throw new Error('Превышен размер текстового предпросмотра');
        row.push(value);
        value = '';
        if (row.length > 100) throw new Error('Превышен лимит строк или колонок');
    };
    const pushRow = () => {
        pushValue();
        rows.push(row);
        row = [];
        if (rows.length > 5000) throw new Error('Превышен общий лимит строк');
    };
    for (let index = 0; index < text.length; index++) {
        const character = text[index]!;
        if (character === '"') {
            if (quoted && text[index + 1] === '"') {
                value += '"';
                index++;
            } else quoted = !quoted;
        } else if (character === delimiter && !quoted) pushValue();
        else if ((character === '\n' || character === '\r') && !quoted) {
            pushRow();
            if (character === '\r' && text[index + 1] === '\n') index++;
        } else value += character;
    }
    if (quoted) throw new Error('Некорректные кавычки в таблице');
    if (value || row.length || !rows.length) pushRow();
    return {
        sheets: [{ name: 'Sheet1', rows }],
        warnings: formulas ? [`Пропущено формул: ${formulas}. Проверьте пустые ячейки.`] : [],
    };
}

async function zipSafety(bytes: Uint8Array) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
        if (view.getUint32(i, true) === 0x06054b50) {
            end = i;
            break;
        }
    if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true))
        throw new Error('Некорректный архив');
    const count = view.getUint16(end + 10, true);
    if (count > 2000) throw new Error('Слишком много объектов в архиве');
    let cursor = view.getUint32(end + 16, true),
        total = 0;
    const names = new Set<string>();
    for (let i = 0; i < count; i++) {
        if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50) throw new Error('Некорректный архив');
        const method = view.getUint16(cursor + 10, true),
            compressed = view.getUint32(cursor + 20, true),
            size = view.getUint32(cursor + 24, true);
        const nameLength = view.getUint16(cursor + 28, true),
            extra = view.getUint16(cursor + 30, true),
            comment = view.getUint16(cursor + 32, true),
            local = view.getUint32(cursor + 42, true);
        const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
        if (
            view.getUint16(cursor + 8, true) & 1 ||
            ![0, 8].includes(method) ||
            name.includes('..') ||
            name.includes('\\') ||
            name.startsWith('/') ||
            names.has(name) ||
            /vbaProject|externalLinks/i.test(name)
        )
            throw new Error('Неподдерживаемое содержимое архива');
        names.add(name);
        if (local + 30 > cursor || view.getUint32(local, true) !== 0x04034b50 || size > 52428800 - total)
            throw new Error('Превышен размер архива');
        const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
        if (start + compressed > cursor) throw new Error('Некорректный архив');
        const input = bytes.slice(start, start + compressed);
        let actual = input.length;
        if (method === 8) {
            const reader = new Blob([input]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
            actual = 0;
            try {
                while (true) {
                    const result = await reader.read();
                    if (result.done) break;
                    actual += result.value.length;
                    if (actual > 52428800 - total) {
                        await reader.cancel();
                        throw new Error('Превышен размер распакованных данных');
                    }
                }
            } finally {
                reader.releaseLock();
            }
        }
        if (actual !== size) throw new Error('Некорректный размер архива');
        total += actual;
        cursor += 46 + nameLength + extra + comment;
    }
    if (cursor !== end) throw new Error('Неподдерживаемая структура архива');
}
self.onmessage = async (event: MessageEvent<{ filename: string; bytes: ArrayBuffer }>) => {
    try {
        const { filename, bytes } = event.data;
        const extension = filename.toLowerCase().split('.').at(-1);
        if (
            !extension ||
            !['csv', 'tsv', 'xlsx', 'ods'].includes(extension) ||
            !bytes.byteLength ||
            bytes.byteLength > 10485760
        )
            throw new Error('Нужен CSV, TSV, XLSX или ODS до 10 МБ');
        const zipped = ['xlsx', 'ods'].includes(extension);
        let sheets: { name: string; rows: string[][] }[];
        let warnings: string[];
        if (!zipped) {
            if (new Uint8Array(bytes).includes(0)) throw new Error('Нужен текст UTF-8');
            ({ sheets, warnings } = parseDelimited(new TextDecoder('utf-8', { fatal: true }).decode(bytes), extension));
        } else {
            await zipSafety(new Uint8Array(bytes));
            // Keep the large spreadsheet parser out of the common CSV/TSV worker path. In Firefox a mock
            // service-worker request can otherwise wait on this split chunk while the split chunk waits on
            // that same service worker.
            const XLSX = await import('xlsx');
            const workbook = XLSX.read(bytes, {
                type: 'array',
                raw: true,
                cellFormula: true,
                cellDates: true,
                cellHTML: false,
                bookVBA: false,
                bookDeps: false,
                sheetRows: 5002,
            });
            if (workbook.SheetNames.length > 10) throw new Error('Превышен лимит листов');
            let total = 0,
                formulas = 0,
                characters = 0;
            sheets = workbook.SheetNames.map((name) => {
                const sheet = workbook.Sheets[name]!;
                const fullRange: unknown = sheet['!fullref'];
                const range = XLSX.utils.decode_range(
                    typeof fullRange === 'string' ? fullRange : (sheet['!ref'] ?? 'A1:A1'),
                );
                if (range.e.r >= 5000 || range.e.c >= 100) throw new Error('Превышен лимит строк или колонок');
                const rows: string[][] = [];
                for (let r = 0; r <= range.e.r; r++) {
                    const row: string[] = [];
                    for (let c = 0; c <= range.e.c; c++) {
                        const cell = sheet[XLSX.utils.encode_cell({ r, c })] as CellObject | undefined;
                        if (cell?.f) formulas++;
                        const text =
                            cell?.f || cell?.v === undefined || cell.v === null
                                ? ''
                                : cell.v instanceof Date
                                  ? cell.v.toISOString().slice(0, 10)
                                  : String(cell.v);
                        if (text.length > 2000) throw new Error('Слишком длинное значение ячейки');
                        characters += text.length;
                        if (characters > 26214400) throw new Error('Превышен размер текстового предпросмотра');
                        row.push(text);
                    }
                    rows.push(row);
                }
                total += rows.length;
                if (total > 5000) throw new Error('Превышен общий лимит строк');
                return { name, rows };
            });
            warnings = formulas ? [`Пропущено формул: ${formulas}. Проверьте пустые ячейки.`] : [];
        }
        self.postMessage({
            ok: true,
            data: {
                filename,
                sheets,
                warnings,
            },
        });
    } catch (error) {
        self.postMessage({ ok: false, message: error instanceof Error ? error.message : 'Ошибка обработки файла' });
    }
};
