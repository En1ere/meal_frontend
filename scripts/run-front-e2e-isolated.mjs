import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = process.env.QA_OUTPUT_DIR;
if (!output) throw new Error('Set QA_OUTPUT_DIR to a dedicated temporary directory');

const cli = path.join(root, 'node_modules', '@playwright', 'test', 'cli.js');
const config = 'playwright.front.config.ts';
const projects = ['front-desktop', 'front-mobile'];
const caseBatchSize = 4;
const routeMatrixBatchSize = 1;
const caseIsolatedSuites = new Set([
    'domain-route-residuals-completeness.spec.ts',
    'domain-route-residuals.spec.ts',
    'dynamic-route-fixtures.spec.ts',
    'dynamic-route-scope-actions.spec.ts',
    'inventory-recipes-plan-preserves-resilience.spec.ts',
    'moderator-resilience.spec.ts',
    'public-auth-notifications-support-resilience.spec.ts',
    'remaining-dynamic-route-fixtures.spec.ts',
    'residual-client-routes-resilience.spec.ts',
    'route-matrix.spec.ts',
]);
const suites = readdirSync(path.join(root, 'e2e-front'))
    .filter((name) => name.endsWith('.spec.ts') && name !== 'dev-production-404.spec.ts')
    .sort((left, right) => left.localeCompare(right));
const fromIndex = process.argv.indexOf('--from');
const from = fromIndex === -1 ? null : process.argv[fromIndex + 1];
if (fromIndex !== -1 && (!from || !suites.includes(from)))
    throw new Error(`--from must name one of: ${suites.join(', ')}`);
const selectedSuites = from ? suites.slice(suites.indexOf(from)) : suites;

function run(args, directory, capture = false) {
    const result = spawnSync(process.execPath, [cli, ...args], {
        cwd: root,
        stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
        encoding: capture ? 'utf8' : undefined,
        env: { ...process.env, QA_OUTPUT_DIR: directory },
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
        if (capture) {
            process.stdout.write(result.stdout ?? '');
            process.stderr.write(result.stderr ?? '');
        }
        process.exit(result.status ?? 1);
    }
    return result.stdout ?? '';
}

function listedCases(suite, project) {
    const stdout = run(
        ['test', path.posix.join('e2e-front', suite), '--config', config, `--project=${project}`, '--list'],
        output,
        true,
    );
    const cases = stdout
        .split(/\r?\n/u)
        .map((line) => /^\s+\[[^\]]+\]\s+›\s+.+?\s+›\s+(.+)$/u.exec(line)?.[1])
        .filter(Boolean);
    if (cases.length === 0) throw new Error(`${suite}/${project}: no tests listed`);
    return cases;
}

const parts = selectedSuites.flatMap((suite) =>
    projects.flatMap((project) => {
        if (!caseIsolatedSuites.has(suite)) return [{ suite, project, titles: null }];
        const cases = listedCases(suite, project);
        const batchSize = suite === 'route-matrix.spec.ts' ? routeMatrixBatchSize : caseBatchSize;
        const batches = [];
        for (let index = 0; index < cases.length; index += batchSize) {
            batches.push({ suite, project, titles: cases.slice(index, index + batchSize) });
        }
        return batches;
    }),
);

for (const [index, part] of parts.entries()) {
    const slug = path.basename(part.suite, '.spec.ts');
    const caseSlug = part.titles ? `batch-${String(index + 1).padStart(3, '0')}` : 'suite';
    console.log(
        `ISOLATED_E2E_START ${index + 1}/${parts.length} ${part.project} ${part.suite}${part.titles ? ` :: ${part.titles.join(' | ')}` : ''}`,
    );
    const grep = part.titles?.map((title) => title.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')).join('|');
    const args = [
        'test',
        path.posix.join('e2e-front', part.suite),
        '--config',
        config,
        `--project=${part.project}`,
        ...(grep ? ['--grep', `(?:${grep})$`] : []),
    ];
    run(args, path.join(output, 'isolated', slug, part.project, caseSlug));
    console.log(`ISOLATED_E2E_PASS ${index + 1}/${parts.length} ${part.project} ${part.suite}`);
}

console.log(`ISOLATED_E2E_COMPLETE ${parts.length}/${parts.length}`);
