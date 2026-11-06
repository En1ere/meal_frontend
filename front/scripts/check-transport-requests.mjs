import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
    analyzeTransportRequests,
    createTransportRequestSnapshot,
    loadTransportRequestSnapshot,
} from './transport-request-analyzer.mjs';

const snapshotPath = path.resolve('scripts/transport-request-baseline.json');
const update = process.argv.includes('--write');
const baseline = update ? null : await loadTransportRequestSnapshot(snapshotPath);
const result = await analyzeTransportRequests({ baseline });

if (result.failures.length) {
    console.error(['Transport-request ratchet violations:', ...result.failures.map((item) => `- ${item}`)].join('\n'));
    process.exitCode = 1;
} else if (update) {
    await writeFile(snapshotPath, `${JSON.stringify(createTransportRequestSnapshot(result), null, 4)}\n`);
    console.log(`Transport-request baseline updated (${result.metrics.sites} sites).`);
} else {
    const { sites, files, contexts, reads, commands, computedSites } = result.metrics;
    console.log(
        `Transport-request ratchet is valid (${sites} sites across ${files} files and ${contexts} contexts; ${reads} reads, ${commands} commands, ${computedSites} computed).`,
    );
}
