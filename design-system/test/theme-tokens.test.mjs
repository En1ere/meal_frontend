import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

for (const theme of ['coffee-light', 'coffee-dark', 'nature-light', 'nature-dark']) {
    test(`${theme} exposes its semantic token block`, () => {
        assert.match(css, new RegExp(`data-theme=['\"]${theme}['\"]`));
    });
}

test('shared layout tokens match the accepted desktop shell', () => {
    assert.match(css, /--mp-sidebar-width:\s*17\.875rem/);
    assert.match(css, /--mp-topbar-height:\s*4\.25rem/);
});
