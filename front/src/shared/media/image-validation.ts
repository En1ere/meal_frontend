// Inspect dimensions before decoding to prevent an oversized image allocating a bitmap.
export function validateImage(bytes: Uint8Array, mime: string): void {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const ascii = (start: number, length: number) => new TextDecoder().decode(bytes.subarray(start, start + length));
    let width = 0,
        height = 0;
    if (
        mime === 'image/png' &&
        bytes.length >= 24 &&
        view.getUint32(0) === 0x89504e47 &&
        view.getUint32(4) === 0x0d0a1a0a
    ) {
        width = view.getUint32(16);
        height = view.getUint32(20);
        for (let cursor = 8; cursor + 12 <= bytes.length;) {
            if (ascii(cursor + 4, 4) === 'acTL') throw new Error('Анимированные изображения не поддерживаются');
            cursor += view.getUint32(cursor) + 12;
        }
    } else if (mime === 'image/jpeg' && bytes.length >= 4 && view.getUint16(0) === 0xffd8) {
        for (let cursor = 2; cursor + 4 <= bytes.length;) {
            if (bytes[cursor] !== 0xff) break;
            const marker = bytes[cursor + 1]!;
            if (marker === 0xff) {
                cursor++;
                continue;
            }
            if ([0xd8, 0xd9, 0x01, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7].includes(marker)) {
                cursor += 2;
                continue;
            }
            if (marker === 0xda) break;
            const length = view.getUint16(cursor + 2);
            if (length < 2 || cursor + 2 + length > bytes.length) break;
            if (
                [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) &&
                length >= 7
            ) {
                height = view.getUint16(cursor + 5);
                width = view.getUint16(cursor + 7);
                break;
            }
            cursor += 2 + length;
        }
    } else if (mime === 'image/webp' && bytes.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
        const kind = ascii(12, 4);
        if (kind === 'VP8X') {
            if (bytes[20]! & 2) throw new Error('Анимированные изображения не поддерживаются');
            width = 1 + bytes[24]! + (bytes[25]! << 8) + (bytes[26]! << 16);
            height = 1 + bytes[27]! + (bytes[28]! << 8) + (bytes[29]! << 16);
        } else if (kind === 'VP8 ') {
            width = view.getUint16(26, true) & 0x3fff;
            height = view.getUint16(28, true) & 0x3fff;
        } else if (kind === 'VP8L' && bytes[20] === 0x2f) {
            const bits = view.getUint32(21, true);
            width = (bits & 0x3fff) + 1;
            height = ((bits >>> 14) & 0x3fff) + 1;
        }
    }
    if (!width || !height) throw new Error('Не удалось проверить изображение. Нужен JPEG, PNG или WebP.');
    if (width * height > 20000000) throw new Error('Фото превышает 20 Мп');
}
