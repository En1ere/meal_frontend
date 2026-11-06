import { existsSync, realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const hookNames = new Set(['useQuery', 'useInfiniteQuery', 'useSuspenseQuery']);
const queryClientMethods = new Set([
    'setQueryData',
    'setQueriesData',
    'invalidateQueries',
    'removeQueries',
    'resetQueries',
    'cancelQueries',
    'getQueryData',
    'getQueriesData',
]);
const excludedDirectories = new Set(['mocks', 'generated', '__tests__']);

const normalized = (value) => path.resolve(value).replaceAll('\\', '/');
const comparable = (value) => (process.platform === 'win32' ? value.toLocaleLowerCase('en-US') : value);
const canonical = (value) => normalized(existsSync(value) ? realpathSync.native(value) : value);
const isInside = (root, target) => {
    const rootKey = comparable(root);
    const targetKey = comparable(target);
    return targetKey === rootKey || targetKey.startsWith(`${rootKey}/`);
};
const canonicalRelative = (root, target) => target.slice(root.length + 1).replaceAll('\\', '/');

const formatHost = {
    getCanonicalFileName: (file) => file,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => '\n',
};

function loadConfig(tsconfigPath) {
    const config = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
    if (config.error) throw new Error(ts.formatDiagnostic(config.error, formatHost));
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(tsconfigPath));
    if (parsed.errors.length) throw new Error(ts.formatDiagnostics(parsed.errors, formatHost));
    return parsed;
}

function isProductionSource(sourceRoot, file) {
    if (!isInside(sourceRoot, file) || file === sourceRoot) return false;
    const relative = canonicalRelative(sourceRoot, file);
    const parts = relative.split('/');
    if (parts.some((part) => excludedDirectories.has(part))) return false;
    if (/\.test\.[cm]?[jt]sx?$/u.test(relative) || /contracts\.generated\.[cm]?[jt]s$/u.test(relative)) return false;
    return /\.[cm]?[jt]sx?$/u.test(relative);
}

function unwrap(expression) {
    let current = expression;
    while (
        ts.isParenthesizedExpression(current) ||
        ts.isAsExpression(current) ||
        ts.isTypeAssertionExpression(current) ||
        ts.isSatisfiesExpression(current) ||
        ts.isNonNullExpression(current)
    )
        current = current.expression;
    return current;
}

function tupleElementShape(expression) {
    const current = unwrap(expression);
    if (ts.isStringLiteralLike(current)) return JSON.stringify(current.text);
    if (ts.isNumericLiteral(current)) return current.text;
    if (current.kind === ts.SyntaxKind.TrueKeyword) return 'true';
    if (current.kind === ts.SyntaxKind.FalseKeyword) return 'false';
    if (current.kind === ts.SyntaxKind.NullKeyword) return 'null';
    if (ts.isArrayLiteralExpression(current)) return tupleShape(current);
    if (ts.isSpreadElement(current)) return '<spread>';
    return '*';
}

function tupleShape(array) {
    return `[${array.elements.map(tupleElementShape).join(',')}]`;
}

function propertyName(node) {
    if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) return node.text;
    return null;
}

function queryKeyProperty(object) {
    return object.properties.find(
        (property) =>
            (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) &&
            propertyName(property.name) === 'queryKey',
    );
}

function queryKeyExpression(property) {
    return ts.isPropertyAssignment(property) ? property.initializer : property.name;
}

function calleeName(expression) {
    if (ts.isIdentifier(expression)) return expression.text;
    if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
    return null;
}

function rootIdentifier(expression) {
    let current = unwrap(expression);
    if (ts.isCallExpression(current)) current = unwrap(current.expression);
    while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current))
        current = unwrap(current.expression);
    return ts.isIdentifier(current) ? current : null;
}

function importInformation(identifier, checker, sourceRoot, options) {
    const symbol = checker.getSymbolAtLocation(identifier);
    if (!symbol) return null;
    const declaration = symbol.declarations?.find(
        (item) =>
            ts.isImportSpecifier(item) ||
            ts.isImportClause(item) ||
            ts.isNamespaceImport(item) ||
            ts.isImportEqualsDeclaration(item),
    );
    if (!declaration) return null;

    let moduleSpecifier = null;
    let importedName = identifier.text;
    if (ts.isImportSpecifier(declaration)) {
        importedName = declaration.propertyName?.text ?? declaration.name.text;
        moduleSpecifier = declaration.parent.parent.parent.moduleSpecifier;
    } else if (ts.isImportClause(declaration)) {
        importedName = 'default';
        moduleSpecifier = declaration.parent.moduleSpecifier;
    } else if (ts.isNamespaceImport(declaration)) {
        importedName = '*';
        moduleSpecifier = declaration.parent.parent.moduleSpecifier;
    } else if (ts.isImportEqualsDeclaration(declaration) && ts.isExternalModuleReference(declaration.moduleReference)) {
        importedName = declaration.name.text;
        moduleSpecifier = declaration.moduleReference.expression;
    }
    if (!moduleSpecifier || !ts.isStringLiteralLike(moduleSpecifier)) return null;

    const resolved = ts.resolveModuleName(
        moduleSpecifier.text,
        declaration.getSourceFile().fileName,
        options,
        ts.sys,
    ).resolvedModule;
    let ownerRelativeTarget = null;
    if ((symbol.flags & ts.SymbolFlags.Alias) !== 0) {
        const ownerDeclaration = checker.getAliasedSymbol(symbol).declarations?.[0];
        if (ownerDeclaration) {
            const ownerTarget = canonical(ownerDeclaration.getSourceFile().fileName);
            if (isInside(sourceRoot, ownerTarget)) ownerRelativeTarget = canonicalRelative(sourceRoot, ownerTarget);
        }
    }
    if (!resolved)
        return {
            importedName,
            module: moduleSpecifier.text,
            target: null,
            relativeTarget: null,
            ownerRelativeTarget,
        };
    const target = canonical(resolved.resolvedFileName);
    return {
        importedName,
        module: moduleSpecifier.text,
        target,
        relativeTarget: isInside(sourceRoot, target) ? canonicalRelative(sourceRoot, target) : null,
        ownerRelativeTarget,
    };
}

function contextOf(relativeFile) {
    const [layer = '', domain = ''] = relativeFile.split('/');
    return `${layer}/${domain}`;
}

function isCanonicalOwner(relativeTarget, consumerContext) {
    if (!relativeTarget) return false;
    const withoutExtension = relativeTarget.replace(/\.[cm]?[jt]sx?$/u, '');
    if (/^entities\/[^/]+\/(?:.+\/)?(?:model|query-keys)$/u.test(withoutExtension)) return true;
    const match = /^features\/([^/]+)\/(?:.+\/)?query-keys$/u.exec(withoutExtension);
    return match ? consumerContext === `features/${match[1]}` : false;
}

function increment(map, key) {
    map.set(key, (map.get(key) ?? 0) + 1);
}

function sortedRecord(map) {
    return Object.fromEntries([...map.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

export function createQueryKeySnapshot(result) {
    return {
        version: 1,
        metrics: { ...result.metrics },
        rawSites: sortedRecord(result.rawSiteCounts),
        legacyFactories: sortedRecord(result.legacyFactoryCounts),
    };
}

function compareSnapshot(actual, baseline, failures) {
    if (!baseline) return;
    if (baseline.version !== 1) failures.push(`Unsupported query-key baseline version: ${baseline.version}`);
    for (const [section, actualCounts] of [
        ['rawSites', actual.rawSiteCounts],
        ['legacyFactories', actual.legacyFactoryCounts],
    ]) {
        const expected = new Map(Object.entries(baseline[section] ?? {}));
        for (const [fingerprint, count] of actualCounts) {
            const accepted = expected.get(fingerprint) ?? 0;
            if (count > accepted)
                failures.push(`${section}: new or increased debt ${fingerprint} (${count}; accepted ${accepted})`);
        }
        for (const [fingerprint, accepted] of expected) {
            const count = actualCounts.get(fingerprint) ?? 0;
            if (count < accepted)
                failures.push(
                    `${section}: stale baseline ${fingerprint} (${count}; accepted ${accepted}); update intentionally`,
                );
        }
    }
    for (const name of ['rawSites', 'rawFiles', 'rawContexts', 'legacyFactorySites']) {
        if (baseline.metrics?.[name] !== actual.metrics[name])
            failures.push(
                `metrics: stale ${name} baseline (${actual.metrics[name]}; accepted ${baseline.metrics?.[name]})`,
            );
    }
}

export async function loadQueryKeySnapshot(snapshotPath) {
    return JSON.parse(await readFile(snapshotPath, 'utf8'));
}

export async function analyzeQueryKeys({
    cwd = process.cwd(),
    sourceRoot: requestedSourceRoot = path.resolve(cwd, 'src'),
    tsconfigPath = path.resolve(cwd, 'tsconfig.json'),
    baseline = null,
} = {}) {
    const sourceRoot = canonical(requestedSourceRoot);
    const config = loadConfig(tsconfigPath);
    const program = ts.createProgram({ rootNames: config.fileNames, options: config.options });
    const checker = program.getTypeChecker();
    const rawSiteCounts = new Map();
    const legacyFactoryCounts = new Map();
    const rawSiteNodes = new Set();
    const legacyFactoryNodes = new Set();
    const rawFiles = new Set();
    const rawContexts = new Set();
    const failures = [];

    for (const sourceFile of program.getSourceFiles()) {
        const file = canonical(sourceFile.fileName);
        if (!isProductionSource(sourceRoot, file)) continue;
        const relativeFile = canonicalRelative(sourceRoot, file);
        const consumerContext = contextOf(relativeFile);

        const recordRaw = (array, operation, local) => {
            const effectiveOperation = local ? 'localKey' : operation;
            const nodeKey = `${comparable(file)}:${array.getStart(sourceFile)}:${effectiveOperation}`;
            if (rawSiteNodes.has(nodeKey)) return;
            rawSiteNodes.add(nodeKey);
            const fingerprint = `${relativeFile}|${effectiveOperation}|${tupleShape(array)}`;
            increment(rawSiteCounts, fingerprint);
            rawFiles.add(relativeFile);
            rawContexts.add(consumerContext);
        };

        const recordLegacyFactory = (expression, operation, imported) => {
            const nodeKey = `${comparable(file)}:${expression.getStart(sourceFile)}`;
            if (legacyFactoryNodes.has(nodeKey)) return;
            legacyFactoryNodes.add(nodeKey);
            const importedLabel = imported
                ? `${imported.relativeTarget ?? imported.module}#${imported.importedName}`
                : expression.getText(sourceFile);
            const fingerprint = `${relativeFile}|${operation}|${importedLabel}`;
            increment(legacyFactoryCounts, fingerprint);
        };

        const resolveKey = (expression, operation, visited = new Set(), local = false) => {
            const current = unwrap(expression);
            const visitKey = `${current.pos}:${current.end}`;
            if (visited.has(visitKey)) {
                failures.push(`${relativeFile}: cyclic query-key expression at ${current.getText(sourceFile)}`);
                return;
            }
            visited.add(visitKey);

            if (ts.isArrayLiteralExpression(current)) {
                recordRaw(current, operation, local || current !== unwrap(expression));
                return;
            }

            if (ts.isIdentifier(current)) {
                const imported = importInformation(current, checker, sourceRoot, config.options);
                if (imported) {
                    if (isCanonicalOwner(imported.ownerRelativeTarget ?? imported.relativeTarget, consumerContext))
                        return;
                    recordLegacyFactory(current, operation, imported);
                    return;
                }
                const symbol = ts.isShorthandPropertyAssignment(current.parent)
                    ? checker.getShorthandAssignmentValueSymbol(current.parent)
                    : checker.getSymbolAtLocation(current);
                const declaration = symbol?.declarations?.find(ts.isVariableDeclaration);
                if (declaration?.initializer) {
                    resolveKey(declaration.initializer, operation, visited, true);
                    return;
                }
                failures.push(`${relativeFile}: unresolved query key identifier ${current.text}`);
                return;
            }

            if (ts.isCallExpression(current) || ts.isPropertyAccessExpression(current)) {
                const root = rootIdentifier(current);
                const imported = root ? importInformation(root, checker, sourceRoot, config.options) : null;
                if (
                    imported &&
                    isCanonicalOwner(imported.ownerRelativeTarget ?? imported.relativeTarget, consumerContext)
                )
                    return;
                if (root && !imported) {
                    const symbol = checker.getSymbolAtLocation(root);
                    const declaration = symbol?.declarations?.[0];
                    if (declaration) {
                        const ownerFile = canonical(declaration.getSourceFile().fileName);
                        const ownerRelative = isInside(sourceRoot, ownerFile)
                            ? canonicalRelative(sourceRoot, ownerFile)
                            : null;
                        if (isCanonicalOwner(ownerRelative, consumerContext)) return;
                    }
                }
                recordLegacyFactory(current, operation, imported);
                return;
            }

            failures.push(`${relativeFile}: unsupported computed query key ${current.getText(sourceFile)}`);
        };

        const inspectCall = (node) => {
            const name = calleeName(node.expression);
            if (hookNames.has(name)) {
                const options = node.arguments[0];
                if (!options || !ts.isObjectLiteralExpression(unwrap(options))) {
                    failures.push(`${relativeFile}: ${name} options must expose an inspectable queryKey`);
                    return;
                }
                const property = queryKeyProperty(unwrap(options));
                if (!property) {
                    failures.push(`${relativeFile}: ${name} must declare queryKey`);
                    return;
                }
                return;
            }
            if (!queryClientMethods.has(name)) return;
            const argument = node.arguments[0];
            if (!argument) return;
            const unwrapped = unwrap(argument);
            if (ts.isObjectLiteralExpression(unwrapped)) {
                const property = queryKeyProperty(unwrapped);
                if (property) resolveKey(queryKeyExpression(property), name);
                return;
            }
            resolveKey(unwrapped, name);
        };

        const visit = (node) => {
            if (
                (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) &&
                propertyName(node.name) === 'queryKey'
            )
                resolveKey(queryKeyExpression(node), 'queryKey');
            if (ts.isCallExpression(node)) inspectCall(node);
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
    }

    const result = {
        rawSiteCounts,
        legacyFactoryCounts,
        metrics: {
            rawSites: [...rawSiteCounts.values()].reduce((total, count) => total + count, 0),
            rawFiles: rawFiles.size,
            rawContexts: rawContexts.size,
            legacyFactorySites: [...legacyFactoryCounts.values()].reduce((total, count) => total + count, 0),
        },
        failures,
    };
    compareSnapshot(result, baseline, failures);
    return result;
}
