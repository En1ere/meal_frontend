import path from 'node:path';
import process from 'node:process';
import { analyzeQueryKeys, loadQueryKeySnapshot } from './query-key-analyzer.mjs';

const snapshotPath = path.resolve('scripts/query-key-baseline.json');
const baseline = await loadQueryKeySnapshot(snapshotPath);
const result = await analyzeQueryKeys({ baseline });

if (result.failures.length) {
    console.error(['Query-key ratchet violations:', ...result.failures.map((item) => `- ${item}`)].join('\n'));
    process.exitCode = 1;
} else {
    const { rawSites, rawFiles, rawContexts } = result.metrics;
    console.log(
        `Query-key ratchet is valid (${rawSites} raw sites across ${rawFiles} files and ${rawContexts} contexts).`,
    );
}
