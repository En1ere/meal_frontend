import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const cssRoot = path.resolve('src');
const colorLiteral = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(/iu;

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
