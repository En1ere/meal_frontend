import { existsSync, realpathSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const sourceExtensions = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const layeredRoots = new Set(['app', 'widgets', 'features', 'entities', 'shared', 'mocks']);
const publicFeatureEntries = new Set(['client', 'server', 'index']);

const normalized = (value) => path.resolve(value).replaceAll('\\', '/');
const comparable = (value) => (process.platform === 'win32' ? value.toLocaleLowerCase('en-US') : value);
const canonical = (value) => normalized(existsSync(value) ? realpathSync.native(value) : value);
const isInside = (root, target) => {
    const rootKey = comparable(root);
    const targetKey = comparable(target);
    return targetKey === rootKey || targetKey.startsWith(`${rootKey}/`);
};
const codeStem = (value) => path.posix.basename(value).replace(/\.(?:[cm]?[jt]sx?)$/u, '');
const stripCodeExtension = (value) => value.replace(/\.(?:[cm]?[jt]sx?)$/u, '');

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

function scriptKind(file) {
    const extension = path.extname(file);
    if (extension === '.tsx') return ts.ScriptKind.TSX;
    if (extension === '.jsx') return ts.ScriptKind.JSX;
    if (['.js', '.mjs', '.cjs'].includes(extension)) return ts.ScriptKind.JS;
    return ts.ScriptKind.TS;
}

const formatHost = {
    getCanonicalFileName: (file) => file,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => '\n',
};

function loadCompilerOptions(tsconfigPath) {
    const config = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
    if (config.error) throw new Error(ts.formatDiagnostic(config.error, formatHost));
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(tsconfigPath));
    if (parsed.errors.length) throw new Error(ts.formatDiagnostics(parsed.errors, formatHost));
    return parsed.options;
}

function aliasAssetCandidates(specifier, options) {
    if (!options.paths) return [];
    const base = options.baseUrl ?? process.cwd();
    const candidates = [];
    for (const [pattern, replacements] of Object.entries(options.paths)) {
        const star = pattern.indexOf('*');
        const prefix = star === -1 ? pattern : pattern.slice(0, star);
        const suffix = star === -1 ? '' : pattern.slice(star + 1);
        if (star === -1 ? specifier !== pattern : !specifier.startsWith(prefix) || !specifier.endsWith(suffix))
            continue;
        const capture = star === -1 ? '' : specifier.slice(prefix.length, specifier.length - suffix.length);
        for (const replacement of replacements) candidates.push(path.resolve(base, replacement.replace('*', capture)));
    }
    return candidates;
}

function resolveTarget(specifier, sourceFile, options) {
    const resolved = ts.resolveModuleName(specifier, sourceFile, options, ts.sys).resolvedModule;
    if (resolved)
        return {
            target: canonical(resolved.resolvedFileName),
            external: resolved.isExternalLibraryImport === true,
        };

    const cleanSpecifier = specifier.replace(/[?#].*$/u, '');
    const candidates = cleanSpecifier.startsWith('.')
        ? [path.resolve(path.dirname(sourceFile), cleanSpecifier)]
        : aliasAssetCandidates(cleanSpecifier, options);
    const asset = candidates.find((candidate) => existsSync(candidate));
    return asset ? { target: canonical(asset), external: false } : null;
}

function layerOf(sourceRoot, absolute) {
    if (!isInside(sourceRoot, absolute) || absolute === sourceRoot) return null;
    const [root] = absolute.slice(sourceRoot.length + 1).split('/');
    return layeredRoots.has(root) ? root : null;
}

function layerViolation(sourceLayer, targetLayer) {
    if (!sourceLayer || !targetLayer) return null;
    if (sourceLayer !== 'app' && targetLayer === 'app') return 'only app may depend on app';
    if (sourceLayer === 'shared' && ['entities', 'features', 'widgets'].includes(targetLayer))
        return 'shared must not depend on upper layers';
    if (sourceLayer === 'entities' && ['features', 'widgets'].includes(targetLayer))
        return 'entities must not depend on features or widgets';
    if (sourceLayer === 'features' && targetLayer === 'widgets') return 'features must not depend on widgets';
    return null;
}

function literalSpecifier(node) {
    return node && ts.isStringLiteralLike(node) ? node.text : null;
}

function isProductionTypeScript(relativeFile) {
    const parts = relativeFile.split('/');
    const base = path.posix.basename(relativeFile);
    return (
        ['app', 'widgets', 'features', 'entities', 'shared'].includes(parts[0]) &&
        !parts.includes('__tests__') &&
        !/\.(?:test|spec)\.[cm]?tsx?$/u.test(base) &&
        !/contracts\.generated\.[cm]?ts$/u.test(base) &&
        /\.[cm]?tsx?$/u.test(base)
    );
}

function isRuntimeImport(node) {
    if (!node.importClause) return true;
    if (node.importClause.isTypeOnly) return false;
    if (node.importClause.name) return true;
    const bindings = node.importClause.namedBindings;
    if (!bindings || ts.isNamespaceImport(bindings)) return true;
    return bindings.elements.some((element) => !element.isTypeOnly);
}

function isRuntimeExport(node) {
    if (node.isTypeOnly) return false;
    if (!node.exportClause || ts.isNamespaceExport(node.exportClause)) return true;
    return node.exportClause.elements.some((element) => !element.isTypeOnly);
}

function runtimeCycles(graph) {
    const indices = new Map();
    const lowLinks = new Map();
    const stack = [];
    const onStack = new Set();
    const cycles = [];
    let index = 0;

    const connect = (node) => {
        indices.set(node, index);
        lowLinks.set(node, index);
        index += 1;
        stack.push(node);
        onStack.add(node);

        for (const target of graph.get(node) ?? []) {
            if (!indices.has(target)) {
                connect(target);
                lowLinks.set(node, Math.min(lowLinks.get(node), lowLinks.get(target)));
            } else if (onStack.has(target)) {
                lowLinks.set(node, Math.min(lowLinks.get(node), indices.get(target)));
            }
        }

        if (lowLinks.get(node) !== indices.get(node)) return;
        const component = [];
        let member;
        do {
            member = stack.pop();
            onStack.delete(member);
            component.push(member);
        } while (member !== node);
        if (component.length > 1 || graph.get(node)?.has(node)) cycles.push(component.toSorted());
    };

    for (const node of [...graph.keys()].toSorted()) if (!indices.has(node)) connect(node);
    return cycles.toSorted((left, right) => left.join('\0').localeCompare(right.join('\0')));
}

export async function analyzeArchitecture({
    cwd = process.cwd(),
    sourceRoot: requestedSourceRoot = path.resolve(cwd, 'src'),
    tsconfigPath = path.resolve(cwd, 'tsconfig.json'),
} = {}) {
    const sourceRoot = canonical(requestedSourceRoot);
    const options = loadCompilerOptions(tsconfigPath);
    const failures = [];
    const metrics = { files: 0, edges: 0, dynamicImports: 0, runtimeEdges: 0, runtimeCycles: 0 };
    const runtimeGraph = new Map();
    const sourcePaths = (await collect(sourceRoot)).map(canonical);
    for (const file of sourcePaths) {
        const relativeFile = file.slice(sourceRoot.length + 1);
        if (isProductionTypeScript(relativeFile)) runtimeGraph.set(file, new Set());
    }

    for (const file of sourcePaths) {
        metrics.files += 1;
        const relativeFile = file.slice(sourceRoot.length + 1);
        const displayFile = path.relative(cwd, file);
        const sourceParts = relativeFile.split('/');
        const sourceLayer = layerOf(sourceRoot, file);
        if (sourceParts[0] === 'ui') {
            failures.push(`${displayFile}: legacy src/ui is forbidden; use shared/ui or widgets`);
            continue;
        }
        if (!sourceLayer) continue;

        const source = await readFile(file, 'utf8');
        const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind(file));

        // Semantic ownership checks deliberately remain source-pattern based in this checkpoint.
        if (
            !relativeFile.startsWith('entities/family/') &&
            /(?:queryKey\s*:|setQueryData\()\s*\[\s*['"]family['"]/u.test(source)
        )
            failures.push(`${displayFile}: consume canonical family state through its entity/feature public API`);
        if (
            relativeFile === 'shared/runtime/index.tsx' &&
            /\b(?:scopeInitializedFor|setScopeFor|initializeScope|resetScope)\b/u.test(source)
        )
            failures.push(`${displayFile}: workspace scope is domain state; keep it in entities/workspace-scope`);
        if (
            !relativeFile.startsWith('entities/session/') &&
            /setQueryData\(\s*\[\s*['"]session['"]\s*,\s*['"]user['"]\s*\]/u.test(source)
        )
            failures.push(`${displayFile}: write user session through entities/session setUserSession`);

        const inspectEdge = (specifier, kind, runtime = true) => {
            metrics.edges += 1;
            if (kind === 'dynamic') metrics.dynamicImports += 1;
            const resolution = resolveTarget(specifier, file, options);
            if (!resolution) {
                const cleanSpecifier = specifier.replace(/[?#].*$/u, '');
                const extension = path.extname(cleanSpecifier);
                const isLocalOrAlias =
                    cleanSpecifier.startsWith('.') || aliasAssetCandidates(cleanSpecifier, options).length;
                if (
                    runtime &&
                    runtimeGraph.has(file) &&
                    isLocalOrAlias &&
                    (!extension || sourceExtensions.has(extension))
                )
                    failures.push(`${displayFile} -> ${specifier}: runtime import must resolve for cycle analysis`);
                return;
            }
            if (!isInside(sourceRoot, resolution.target)) return;

            const target = resolution.target;
            if (runtime && runtimeGraph.has(file) && runtimeGraph.has(target)) {
                runtimeGraph.get(file).add(target);
                metrics.runtimeEdges += 1;
            }
            const targetLayer = layerOf(sourceRoot, target);
            const targetRelative = target.slice(sourceRoot.length + 1);
            const targetParts = targetRelative.split('/');
            const targetBase = codeStem(target);
            const targetWithoutExtension = stripCodeExtension(targetRelative);
            const reason = layerViolation(sourceLayer, targetLayer);
            if (reason) failures.push(`${displayFile} -> ${specifier}: ${reason}`);

            if (targetWithoutExtension === 'features/auth/session')
                failures.push(`${displayFile}: session guarding belongs to widgets/session-guard`);
            if (targetWithoutExtension === 'features/auth/use-request-signal')
                failures.push(`${displayFile}: transport cancellation belongs to shared/api`);
            if (targetWithoutExtension === 'features/legal/consent-state')
                failures.push(`${displayFile}: consent state belongs to entities/consent`);
            if (/^features\/offline\/(?:offline-store|queue|snapshots)$/u.test(targetWithoutExtension))
                failures.push(`${displayFile}: offline runtime belongs to entities/offline`);
            if (targetWithoutExtension === 'features/recipes/offline-cache')
                failures.push(`${displayFile}: recipe read cache belongs to entities/recipe-cache`);
            if (targetWithoutExtension.startsWith('features/receipts/'))
                failures.push(`${displayFile}: receipt flows belong to the shopping bounded context`);
            if (targetWithoutExtension === 'features/inventory-ingest/image-metadata')
                failures.push(`${displayFile}: generic image validation belongs to shared/media`);
            if (targetWithoutExtension === 'features/community/community')
                failures.push(`${displayFile}: public recipe community belongs to features/recipes`);
            if (sourceLayer === 'app' && targetParts[0] === 'features' && targetBase === 'shell-styles')
                failures.push(`${displayFile}: app must import shell styles through a server-safe feature public API`);
            if (
                !relativeFile.startsWith('entities/family/') &&
                !relativeFile.startsWith('features/family/') &&
                targetWithoutExtension === 'features/family/ownership-notice'
            )
                failures.push(`${displayFile}: consume canonical family state through its entity/feature public API`);

            if (sourceLayer === 'features' && targetParts[0] === 'features' && sourceParts[1] !== targetParts[1])
                failures.push(
                    `${displayFile} -> ${specifier}: cross-feature imports require an explicit domain boundary`,
                );
            if (
                ['app', 'widgets'].includes(sourceLayer) &&
                targetParts[0] === 'features' &&
                !publicFeatureEntries.has(targetBase)
            )
                failures.push(
                    `${displayFile} -> ${specifier}: upper layers must use a feature client/server/index public API`,
                );
            if (sourceLayer === 'mocks' && targetParts[0] === 'features' && targetBase !== 'mock')
                failures.push(`${displayFile} -> ${specifier}: mock composition must use an explicit feature mock API`);
            if (sourceLayer !== 'mocks' && targetParts[0] === 'features' && targetBase === 'mock')
                failures.push(`${displayFile} -> ${specifier}: feature mock APIs are restricted to mock composition`);
            if (targetWithoutExtension === 'features/recipes/shared' && sourceParts[1] !== 'recipes')
                failures.push(
                    `${displayFile} -> ${specifier}: consume recipe UI through its entity or feature public API`,
                );
            if (
                relativeFile.startsWith('features/products/') &&
                targetWithoutExtension.startsWith('features/inventory/')
            )
                failures.push(
                    `${displayFile} -> ${specifier}: products must not depend on inventory feature internals`,
                );
            if (
                relativeFile.startsWith('app/products/') &&
                targetWithoutExtension.startsWith('features/products/') &&
                targetWithoutExtension !== 'features/products/client'
            )
                failures.push(`${displayFile} -> ${specifier}: product routes must use the feature client API`);
            if (
                relativeFile.startsWith('features/inventory-ingest/') &&
                targetWithoutExtension.startsWith('features/inventory/')
            )
                failures.push(
                    `${displayFile} -> ${specifier}: inventory ingest must depend on inventory entities, not its sibling feature`,
                );
            if (
                relativeFile.startsWith('features/shopping/') &&
                targetWithoutExtension.startsWith('features/inventory/')
            )
                failures.push(
                    `${displayFile} -> ${specifier}: shopping must depend on inventory entities, not its sibling feature`,
                );
            if (
                sourceLayer === 'app' &&
                targetWithoutExtension.startsWith('features/inventory-ingest/') &&
                targetWithoutExtension !== 'features/inventory-ingest/client'
            )
                failures.push(
                    `${displayFile} -> ${specifier}: inventory ingest routes must use the feature client API`,
                );
            if (
                sourceLayer === 'app' &&
                sourceParts.includes('receipts') &&
                targetWithoutExtension.startsWith('features/shopping/') &&
                !['features/shopping/client', 'features/shopping/server'].includes(targetWithoutExtension)
            )
                failures.push(`${displayFile} -> ${specifier}: receipt routes must use shopping public APIs`);
        };

        const visit = (node) => {
            if (ts.isImportDeclaration(node)) {
                const specifier = literalSpecifier(node.moduleSpecifier);
                if (specifier) inspectEdge(specifier, 'import', isRuntimeImport(node));
            } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
                const specifier = literalSpecifier(node.moduleSpecifier);
                if (specifier) inspectEdge(specifier, 'export', isRuntimeExport(node));
            } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
                const specifier = literalSpecifier(node.moduleReference.expression);
                if (specifier) inspectEdge(specifier, 'import-equals', !node.isTypeOnly);
            } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
                const specifier = literalSpecifier(node.arguments[0]);
                if (specifier) inspectEdge(specifier, 'dynamic');
                else failures.push(`${displayFile}: dynamic import specifier must be a string literal`);
            } else if (
                ts.isCallExpression(node) &&
                ts.isIdentifier(node.expression) &&
                node.expression.text === 'require'
            ) {
                const specifier = literalSpecifier(node.arguments[0]);
                if (specifier) inspectEdge(specifier, 'require');
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
    }

    const cycles = runtimeCycles(runtimeGraph);
    metrics.runtimeCycles = cycles.length;
    for (const cycle of cycles)
        failures.push(`runtime dependency cycle: ${cycle.map((file) => path.relative(cwd, file)).join(' <-> ')}`);

    return { failures, metrics };
}
