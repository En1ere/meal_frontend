import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
const source = process.argv[2];
if (!source) throw Error('Pass an explicit path to the backend OpenAPI artifact');
const local = new URL('../contracts/openapi.json', import.meta.url);
const hash = (file) =>
    createHash('sha256').update(fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n')).digest('hex');
if (hash(source) !== hash(local))
    throw Error('Frontend OpenAPI snapshot differs from backend; review and update it explicitly');
if (
    hash(path.join(path.dirname(source), 'http-cases.json')) !==
    hash(new URL('../contracts/http-cases.json', import.meta.url))
)
    throw Error('Shared HTTP cases differ');
console.log('Backend and frontend OpenAPI snapshots match with normalized line endings');
