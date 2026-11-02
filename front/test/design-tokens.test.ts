import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const cssRoot = path.resolve('src');
const colorLiteral = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(/iu;
const invalidVarSuffix = /var\([^)]*\)\s+[0-9a-f]{3,8}\b/iu;
const hardcodedWhite = /(?:^|:\s*)white\s*;/iu;
const legacyFontVariable = /--font-(?:sans|serif)\b/iu;
const directSerif = /font(?:-family|\s*:)[^;]*\bGeorgia\b/iu;

async function cssFiles(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(
        entries.map((entry) => {
            const target = path.join(directory, entry.name);
            return entry.isDirectory()
                ? cssFiles(target)
                : Promise.resolve(entry.name.endsWith('.css') ? [target] : []);
        }),
    );
    return nested.flat();
}

await test('application styles use design-system color tokens only', async () => {
    const violations: string[] = [];
    for (const file of await cssFiles(cssRoot)) {
        const lines = (await readFile(file, 'utf8')).split(/\r?\n/u);
        lines.forEach((line, index) => {
            if (colorLiteral.test(line))
                violations.push(`${path.relative(cssRoot, file)}:${index + 1}: ${line.trim()}`);
        });
    }
    assert.deepEqual(violations, []);
});

await test('application styles do not contain malformed colors or bypass typography and contrast tokens', async () => {
    const violations: string[] = [];
    for (const file of await cssFiles(cssRoot)) {
        const lines = (await readFile(file, 'utf8')).split(/\r?\n/u);
        lines.forEach((line, index) => {
            if (
                invalidVarSuffix.test(line) ||
                hardcodedWhite.test(line) ||
                legacyFontVariable.test(line) ||
                directSerif.test(line)
            )
                violations.push(`${path.relative(cssRoot, file)}:${index + 1}: ${line.trim()}`);
        });
    }
    assert.deepEqual(violations, []);
});
