import { z } from 'zod';
export const importPreviewSchema = z.strictObject({
    filename: z.string(),
    sheets: z.array(z.strictObject({ name: z.string(), rows: z.array(z.array(z.string())) })),
    warnings: z.array(z.string()),
});
export const scanPreviewSchema = z.strictObject({
    images: z.array(z.strictObject({ filename: z.string(), text: z.string(), confidence: z.number() })),
    warnings: z.array(z.string()),
});
export type ImportPreview = z.infer<typeof importPreviewSchema>;
export interface ReviewRow {
    barcode?: string;
    key: string;
    source: string;
    name: string;
    quantity: string;
    unit: string;
    expiryOn: string;
    locationName: string;
    locationId: string;
    ingredientId: string;
    skip: boolean;
    reviewed: boolean;
}
export const columns = {
    name: 'Название',
    quantity: 'Количество',
    unit: 'Единица',
    expiryOn: 'Срок годности',
    locationName: 'Место хранения',
};
export type Mapping = Record<keyof typeof columns, number>;
export function mapRows(sheet: ImportPreview['sheets'][number], header: number, mapping: Mapping): ReviewRow[] {
    const unitNames: Record<string, string> = {
        г: 'g',
        кг: 'kg',
        мл: 'ml',
        л: 'l',
        шт: 'pcs',
        'шт.': 'pcs',
        уп: 'pack',
        'уп.': 'pack',
        порц: 'serv',
    };
    return sheet.rows.slice(header + 1).map((cells, index) => {
        const value = (key: keyof Mapping) => (cells[mapping[key]] ?? '').trim();
        const original = value('expiryOn');
        const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(original);
        const expiryOn = match ? `${match[3]}-${match[2]}-${match[1]}` : original;
        const unit = value('unit').toLowerCase();
        return {
            key: `${sheet.name}:${index + header + 2}`,
            source: `${sheet.name}, строка ${index + header + 2}`,
            name: value('name'),
            quantity: value('quantity').replace(',', '.'),
            unit: unitNames[unit] ?? unit,
            expiryOn,
            locationName: value('locationName'),
            locationId: '',
            ingredientId: '',
            skip: cells.every((cell) => !cell.trim()),
            reviewed: false,
        };
    });
}
export function rowError(row: ReviewRow): string | null {
    if (row.skip) return null;
    if (!row.name.trim() || row.name.length > 200 || /^[=+@]/.test(row.name)) return 'Проверьте название';
    if (!row.ingredientId) return 'Выберите товар из каталога';
    if (!row.locationId) return 'Выберите место хранения';
    if (row.quantity && !/^(0|[1-9]\d{0,15})(\.\d{1,8})?$/.test(row.quantity))
        return 'Количество должно быть неотрицательным числом';
    if (row.quantity && Number(row.quantity) === 0) return 'Количество новой партии должно быть больше нуля';
    if (!['g', 'kg', 'ml', 'l', 'pcs', 'pack', 'serv'].includes(row.unit)) return 'Выберите единицу';
    if (
        row.expiryOn &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(row.expiryOn) ||
            Number.isNaN(Date.parse(row.expiryOn)) ||
            new Date(row.expiryOn).toISOString().slice(0, 10) !== row.expiryOn)
    )
        return 'Исправьте срок годности';
    if (row.locationName && !row.locationId) return 'Сопоставьте место хранения или очистите исходное место';
    if (!row.reviewed) return 'Подтвердите проверку строки';
    return null;
}
