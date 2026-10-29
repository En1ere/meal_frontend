import test from 'node:test';
import assert from 'node:assert/strict';
import { validateImage } from '../src/shared/media/image-validation.js';

void test('image validation accepts a bounded static PNG and rejects unknown content', () => {
    const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
    );
    assert.doesNotThrow(() => validateImage(png, 'image/png'));
    assert.throws(() => validateImage(png, 'text/plain'), /JPEG, PNG или WebP/u);
});

void test('image validation rejects dimensions above the 20 megapixel safety limit', () => {
    const png = new Uint8Array(24);
    const view = new DataView(png.buffer);
    view.setUint32(0, 0x89504e47);
    view.setUint32(4, 0x0d0a1a0a);
    view.setUint32(16, 5000);
    view.setUint32(20, 5000);
    assert.throws(() => validateImage(png, 'image/png'), /20 Мп/u);
});
