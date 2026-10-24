import { mkdirSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export function qaRoot() {
    if (!process.env.QA_OUTPUT_DIR) throw new Error('Set QA_OUTPUT_DIR to a dedicated temporary directory');
    const directory = resolve(process.env.QA_OUTPUT_DIR);
    mkdirSync(directory, { recursive: true });
    return pathToFileURL(directory + sep);
}
