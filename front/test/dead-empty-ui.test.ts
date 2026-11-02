import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path: string) => readFile(path, 'utf8');

await test('recipe empty states provide working recovery routes', async () => {
    const source = await read('src/features/recipes/catalog.tsx');
    assert.match(source, /href="\/inventory\/new"/u);
    assert.match(source, /href="\/settings\/preferences"/u);
    assert.match(source, /href="\/family\/recipes"/u);
    assert.doesNotMatch(source, /Семейная коллекция появится/u);
});

await test('unavailable QR capability points to pricing instead of rendering a dead button', async () => {
    const source = await read('src/features/preserves/qr-label.tsx');
    assert.match(source, /role="note"/u);
    assert.match(source, /href="\/pricing"/u);
    assert.doesNotMatch(source, /<button disabled>Создать этикетку/u);
});

await test('unsupported locale is presented as readonly information', async () => {
    const source = await read('src/features/profiles/profile-pages.tsx');
    assert.match(source, /Смена языка пока не поддерживается/u);
    assert.doesNotMatch(source, /<select value="ru" disabled>/u);
});
