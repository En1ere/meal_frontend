import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const authShellCss = await readFile(new URL('../src/components/AuthShell/AuthShell.module.css', import.meta.url), 'utf8');
const authShellSource = await readFile(new URL('../src/components/AuthShell/AuthShell.tsx', import.meta.url), 'utf8');
const serviceShellCss = await readFile(new URL('../src/components/ServiceShell/ServiceShell.module.css', import.meta.url), 'utf8');

for (const theme of ['coffee-light', 'coffee-dark', 'nature-light', 'nature-dark']) {
    test(`${theme} exposes its semantic token block`, () => {
        assert.match(css, new RegExp(`data-theme=['\"]${theme}['\"]`));
    });
}

test('shared layout tokens match the accepted desktop shell', () => {
    assert.match(css, /--mp-sidebar-width:\s*17\.875rem/);
    assert.match(css, /--mp-topbar-height:\s*4\.25rem/);
});

test('service surfaces inherit native controls from the selected theme', () => {
    assert.doesNotMatch(authShellCss, /color-scheme\s*:/);
    assert.doesNotMatch(serviceShellCss, /color-scheme\s*:/);
    assert.doesNotMatch(authShellSource, /styles\.service|\bundefined\b/);
    assert.match(authShellSource, /data-service=\{service \? 'true' : 'false'\}/);
});

test('service shell uses semantic typography, overlay and accessible navigation targets', () => {
    assert.match(serviceShellCss, /font:\s*600 14px var\(--mp-font-sans\)/);
    assert.match(serviceShellCss, /\.link\s*\{[\s\S]*?min-height:\s*44px/);
    assert.match(serviceShellCss, /\.scrim::backdrop\s*\{[\s\S]*?var\(--mp-color-overlay\)/);
    assert.doesNotMatch(serviceShellCss, /#000b|\bArial\b/);
});
