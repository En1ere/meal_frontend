import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const sourceRoot = path.resolve('src');
const recipesFeatureRoot = path.join(sourceRoot, 'features', 'recipes');
const productsFeatureRoot = path.join(sourceRoot, 'features', 'products');
const shoppingFeatureRoot = path.join(sourceRoot, 'features', 'shopping');
const inventoryIngestFeatureRoot = path.join(sourceRoot, 'features', 'inventory-ingest');
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const layeredRoots = new Set(['app', 'widgets', 'features', 'entities', 'shared']);
const importPattern = /(?:from\s*|import\s*)['"]([^'"]+)['"]/g;
const legacyCrossFeatureImports = new Set();

async function collect(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(
        entries.map(async (entry) => {
            const absolute = path.join(directory, entry.name);
            if (entry.isDirectory()) return collect(absolute);
            return sourceExtensions.has(path.extname(entry.name)) ? [absolute] : [];
        }),
    );
    return nested.flat();
}

function layerOf(absolute) {
    const relative = path.relative(sourceRoot, absolute);
    const [root] = relative.split(path.sep);
    return layeredRoots.has(root) ? root : null;
}

function violation(sourceLayer, targetLayer) {
    if (!sourceLayer || !targetLayer) return null;
    if (sourceLayer !== 'app' && targetLayer === 'app') return 'only app may depend on app';
    if (sourceLayer === 'shared' && ['entities', 'features', 'widgets'].includes(targetLayer))
        return 'shared must not depend on upper layers';
    if (sourceLayer === 'entities' && ['features', 'widgets'].includes(targetLayer))
        return 'entities must not depend on features or widgets';
    if (sourceLayer === 'features' && targetLayer === 'widgets') return 'features must not depend on widgets';
    return null;
}

const failures = [];
const seenLegacyCrossFeatureImports = new Set();
for (const file of await collect(sourceRoot)) {
    const relativeFile = path.relative(sourceRoot, file);
    if (relativeFile.split(path.sep)[0] === 'ui') {
        failures.push(`${path.relative(process.cwd(), file)}: legacy src/ui is forbidden; use shared/ui or widgets`);
        continue;
    }
    const sourceLayer = layerOf(file);
    if (!sourceLayer) continue;
    const source = await readFile(file, 'utf8');
    if (/features\/auth\/session(?:\.js)?['"]/u.test(source))
        failures.push(`${path.relative(process.cwd(), file)}: session guarding belongs to widgets/session-guard`);
    if (/features\/auth\/use-request-signal(?:\.js)?['"]/u.test(source))
        failures.push(`${path.relative(process.cwd(), file)}: transport cancellation belongs to shared/api`);
    if (/features\/legal\/consent-state(?:\.js)?['"]/u.test(source))
        failures.push(`${path.relative(process.cwd(), file)}: consent state belongs to entities/consent`);
    if (/features\/offline\/(?:offline-store|queue|snapshots)(?:\.js)?['"]/u.test(source))
        failures.push(`${path.relative(process.cwd(), file)}: offline runtime belongs to entities/offline`);
    if (/features\/recipes\/offline-cache(?:\.js)?['"]/u.test(source))
        failures.push(`${path.relative(process.cwd(), file)}: recipe read cache belongs to entities/recipe-cache`);
    if (/features\/receipts\//u.test(source))
        failures.push(`${path.relative(process.cwd(), file)}: receipt flows belong to the shopping bounded context`);
    if (/features\/inventory-ingest\/image-metadata(?:\.js)?['"]/u.test(source))
        failures.push(`${path.relative(process.cwd(), file)}: generic image validation belongs to shared/media`);
    if (/features\/community\/community(?:\.js)?['"]/u.test(source))
        failures.push(`${path.relative(process.cwd(), file)}: public recipe community belongs to features/recipes`);
    if (sourceLayer === 'app' && /from\s*['"][^'"]*features\/[^'"]*\/shell-styles(?:\.js)?['"]/u.test(source))
        failures.push(
            `${path.relative(process.cwd(), file)}: app must import shell styles through a server-safe feature public API`,
        );
    if (
        !path.relative(sourceRoot, file).startsWith(`entities${path.sep}family${path.sep}`) &&
        (/(?:queryKey\s*:|setQueryData\()\s*\[\s*['"]family['"]/u.test(source) ||
            /features\/family\/ownership-notice(?:\.js)?['"]/u.test(source))
    )
        failures.push(
            `${path.relative(process.cwd(), file)}: consume canonical family state through its entity/feature public API`,
        );
    if (
        path.relative(sourceRoot, file) === path.join('shared', 'runtime', 'index.tsx') &&
        /\b(?:scopeInitializedFor|setScopeFor|initializeScope|resetScope)\b/u.test(source)
    )
        failures.push(
            `${path.relative(process.cwd(), file)}: workspace scope is domain state; keep it in entities/workspace-scope`,
        );
    if (
        !path.relative(sourceRoot, file).startsWith(`entities${path.sep}session${path.sep}`) &&
        /setQueryData\(\s*\[\s*['"]session['"]\s*,\s*['"]user['"]\s*\]/u.test(source)
    )
        failures.push(
            `${path.relative(process.cwd(), file)}: write user session through entities/session setUserSession`,
        );
    for (const match of source.matchAll(importPattern)) {
        const specifier = match[1];
        if (!specifier?.startsWith('.')) continue;
        const target = path.resolve(path.dirname(file), specifier);
        const targetLayer = layerOf(target);
        const reason = violation(sourceLayer, targetLayer);
        if (reason) failures.push(`${path.relative(process.cwd(), file)} -> ${specifier}: ${reason}`);
        const sourceParts = relativeFile.split(path.sep);
        const targetParts = path.relative(sourceRoot, target).split(path.sep);
        if (sourceLayer === 'features' && targetParts[0] === 'features' && sourceParts[1] !== targetParts[1]) {
            const edge = `${relativeFile} -> ${specifier}`;
            if (legacyCrossFeatureImports.has(edge)) seenLegacyCrossFeatureImports.add(edge);
            else
                failures.push(
                    `${path.relative(process.cwd(), file)} -> ${specifier}: cross-feature imports require an explicit domain boundary`,
                );
        }
        if (
            sourceLayer === 'app' &&
            targetParts[0] === 'features' &&
            !['client.js', 'server.js', 'index.js'].includes(path.basename(target))
        )
            failures.push(
                `${path.relative(process.cwd(), file)} -> ${specifier}: app routes must use a feature client/server/index public API`,
            );
        if (
            !file.startsWith(`${recipesFeatureRoot}${path.sep}`) &&
            target === path.join(recipesFeatureRoot, 'shared.js')
        )
            failures.push(
                `${path.relative(process.cwd(), file)} -> ${specifier}: consume recipe UI through its entity or feature public API`,
            );
        if (
            file.startsWith(`${productsFeatureRoot}${path.sep}`) &&
            target.startsWith(`${path.join(sourceRoot, 'features', 'inventory')}${path.sep}`)
        )
            failures.push(
                `${path.relative(process.cwd(), file)} -> ${specifier}: products must not depend on inventory feature internals`,
            );
        if (
            relativeFile.startsWith(`${path.join('app', 'products')}${path.sep}`) &&
            target.startsWith(`${productsFeatureRoot}${path.sep}`) &&
            target !== path.join(productsFeatureRoot, 'client.js')
        )
            failures.push(
                `${path.relative(process.cwd(), file)} -> ${specifier}: product routes must use the feature client API`,
            );
        if (
            file.startsWith(`${inventoryIngestFeatureRoot}${path.sep}`) &&
            target.startsWith(`${path.join(sourceRoot, 'features', 'inventory')}${path.sep}`)
        )
            failures.push(
                `${path.relative(process.cwd(), file)} -> ${specifier}: inventory ingest must depend on inventory entities, not its sibling feature`,
            );
        if (
            file.startsWith(`${shoppingFeatureRoot}${path.sep}`) &&
            target.startsWith(`${path.join(sourceRoot, 'features', 'inventory')}${path.sep}`)
        )
            failures.push(
                `${path.relative(process.cwd(), file)} -> ${specifier}: shopping must depend on inventory entities, not its sibling feature`,
            );
        if (
            sourceLayer === 'app' &&
            target.startsWith(`${inventoryIngestFeatureRoot}${path.sep}`) &&
            target !== path.join(inventoryIngestFeatureRoot, 'client.js')
        )
            failures.push(
                `${path.relative(process.cwd(), file)} -> ${specifier}: inventory ingest routes must use the feature client API`,
            );
        if (
            relativeFile.includes(`${path.sep}receipts${path.sep}`) &&
            sourceLayer === 'app' &&
            target.startsWith(`${path.join(sourceRoot, 'features', 'shopping')}${path.sep}`) &&
            ![
                path.join(sourceRoot, 'features', 'shopping', 'client.js'),
                path.join(sourceRoot, 'features', 'shopping', 'server.js'),
            ].includes(target)
        )
            failures.push(
                `${path.relative(process.cwd(), file)} -> ${specifier}: receipt routes must use shopping public APIs`,
            );
    }
}

for (const edge of legacyCrossFeatureImports)
    if (!seenLegacyCrossFeatureImports.has(edge))
        failures.push(`stale cross-feature debt baseline: remove ${edge} from legacyCrossFeatureImports`);

if (failures.length) {
    console.error(['Architecture boundary violations:', ...failures.map((item) => `- ${item}`)].join('\n'));
    process.exitCode = 1;
} else {
    console.log('Architecture boundaries are valid.');
}
