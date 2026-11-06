import { existsSync, realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const excludedDirectories = new Set(['mocks', 'generated', '__tests__', 'test', 'tests']);
const routePattern = /^(GET|POST|PUT|PATCH|DELETE) \/api\/v1\/.+/u;
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

function propertyName(expression) {
    if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
    if (ts.isElementAccessExpression(expression)) {
        const argument = expression.argumentExpression && unwrap(expression.argumentExpression);
        return argument && ts.isStringLiteralLike(argument) ? argument.text : null;
    }
    return null;
}

function isProductionClientSource(sourceRoot, sourceFile) {
    const file = canonical(sourceFile.fileName);
    if (!isInside(sourceRoot, file) || file === sourceRoot) return false;
    const relative = canonicalRelative(sourceRoot, file);
    const parts = relative.split('/');
    if (!['features', 'entities'].includes(parts[0]) || !relative.endsWith('.tsx')) return false;
    if (parts.some((part) => excludedDirectories.has(part))) return false;
    if (/\.(?:test|spec)\.tsx$/u.test(relative) || /contracts\.generated\.tsx$/u.test(relative)) return false;
    return !sourceFile.statements.some(
        (statement) =>
            ts.isImportDeclaration(statement) &&
            ts.isStringLiteralLike(statement.moduleSpecifier) &&
            statement.moduleSpecifier.text === 'server-only',
    );
}

function sourceContext(relativeFile) {
    const [layer, domain] = relativeFile.split('/');
    return `${layer}/${domain}`;
}

function declarationBelongsToApiClient(declaration, sourceRoot) {
    const file = canonical(declaration.getSourceFile().fileName);
    if (!isInside(sourceRoot, file)) return false;
    return /^shared\/api\/client\.[cm]?tsx?$/u.test(canonicalRelative(sourceRoot, file));
}

function typeBelongsToApiClient(expression, checker, sourceRoot) {
    const inspect = (type) => {
        if (type.isUnion()) return type.types.some(inspect);
        const symbol = type.aliasSymbol ?? type.getSymbol();
        return (
            symbol?.declarations?.some((declaration) => declarationBelongsToApiClient(declaration, sourceRoot)) ?? false
        );
    };
    return inspect(checker.getTypeAtLocation(expression));
}

function isApiReceiver(expression, checker, sourceRoot, visited = new Set()) {
    const current = unwrap(expression);
    const key = `${current.getSourceFile().fileName}:${current.pos}:${current.end}`;
    if (visited.has(key)) return false;
    visited.add(key);
    if (typeBelongsToApiClient(current, checker, sourceRoot)) return true;
    if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current))
        return propertyName(current) === 'api';
    if (!ts.isIdentifier(current)) return false;
    if (current.text === 'api') return true;
    const symbol = checker.getSymbolAtLocation(current);
    for (const declaration of symbol?.declarations ?? []) {
        if (
            ts.isVariableDeclaration(declaration) &&
            declaration.initializer &&
            isApiReceiver(declaration.initializer, checker, sourceRoot, visited)
        )
            return true;
        if (ts.isBindingElement(declaration)) {
            const name = declaration.propertyName ?? declaration.name;
            if (ts.isIdentifier(name) && name.text === 'api') return true;
        }
        if (declarationBelongsToApiClient(declaration, sourceRoot)) return true;
    }
    return false;
}

function normalizeTemplate(expression) {
    let value = expression.head.text;
    for (const span of expression.templateSpans) value += '${*}' + span.literal.text;
    return value;
}

function resolveRoutes(expression, checker, sourceFile, visited = new Set()) {
    const current = unwrap(expression);
    const key = `${current.pos}:${current.end}`;
    if (visited.has(key)) return null;
    visited.add(key);
    if (ts.isStringLiteralLike(current)) return { routes: [current.text], computed: false };
    if (ts.isTemplateExpression(current)) return { routes: [normalizeTemplate(current)], computed: true };
    if (ts.isConditionalExpression(current)) {
        const whenTrue = resolveRoutes(current.whenTrue, checker, sourceFile, new Set(visited));
        const whenFalse = resolveRoutes(current.whenFalse, checker, sourceFile, new Set(visited));
        if (!whenTrue || !whenFalse) return null;
        return { routes: [...new Set([...whenTrue.routes, ...whenFalse.routes])].toSorted(), computed: true };
    }
    if (ts.isIdentifier(current)) {
        const symbol = checker.getSymbolAtLocation(current);
        const declaration = symbol?.declarations?.find(
            (candidate) => ts.isVariableDeclaration(candidate) && candidate.initializer,
        );
        if (!declaration?.initializer) return null;
        const resolved = resolveRoutes(declaration.initializer, checker, sourceFile, visited);
        return resolved ? { ...resolved, computed: true } : null;
    }
    return null;
}

function increment(map, key) {
    map.set(key, (map.get(key) ?? 0) + 1);
}

function sortedRecord(map) {
    return Object.fromEntries([...map.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

export function createTransportRequestSnapshot(result) {
    return { version: 1, metrics: { ...result.metrics }, sites: sortedRecord(result.siteCounts) };
}

function compareSnapshot(result, baseline, failures) {
    if (!baseline) return;
    if (baseline.version !== 1) failures.push(`Unsupported transport-request baseline version: ${baseline.version}`);
    const expected = new Map(Object.entries(baseline.sites ?? {}));
    for (const [fingerprint, count] of result.siteCounts) {
        const accepted = expected.get(fingerprint) ?? 0;
        if (count > accepted)
            failures.push(`sites: new or increased transport debt ${fingerprint} (${count}; accepted ${accepted})`);
    }
    for (const [fingerprint, accepted] of expected) {
        const count = result.siteCounts.get(fingerprint) ?? 0;
        if (count < accepted)
            failures.push(
                `sites: stale baseline ${fingerprint} (${count}; accepted ${accepted}); update intentionally`,
            );
    }
    for (const name of Object.keys(result.metrics)) {
        if (baseline.metrics?.[name] !== result.metrics[name])
            failures.push(
                `metrics: stale ${name} baseline (${result.metrics[name]}; accepted ${baseline.metrics?.[name]})`,
            );
    }
}

export async function loadTransportRequestSnapshot(snapshotPath) {
    return JSON.parse(await readFile(snapshotPath, 'utf8'));
}

export async function analyzeTransportRequests({
    cwd = process.cwd(),
    sourceRoot: requestedSourceRoot = path.resolve(cwd, 'src'),
    tsconfigPath = path.resolve(cwd, 'tsconfig.json'),
    baseline = null,
} = {}) {
    const sourceRoot = canonical(requestedSourceRoot);
    const config = loadConfig(tsconfigPath);
    const program = ts.createProgram({ rootNames: config.fileNames, options: config.options });
    const checker = program.getTypeChecker();
    const siteCounts = new Map();
    const files = new Set();
    const contexts = new Set();
    const failures = [];
    const metrics = {
        sites: 0,
        files: 0,
        contexts: 0,
        featureSites: 0,
        entitySites: 0,
        reads: 0,
        commands: 0,
        literalSites: 0,
        computedSites: 0,
    };

    for (const sourceFile of program.getSourceFiles()) {
        if (!isProductionClientSource(sourceRoot, sourceFile)) continue;
        const file = canonical(sourceFile.fileName);
        const relativeFile = canonicalRelative(sourceRoot, file);
        const inspectCall = (node) => {
            const callee = unwrap(node.expression);
            if (
                (!ts.isPropertyAccessExpression(callee) && !ts.isElementAccessExpression(callee)) ||
                propertyName(callee) !== 'request' ||
                !isApiReceiver(callee.expression, checker, sourceRoot)
            )
                return;
            const routeExpression = node.arguments[0];
            if (!routeExpression) {
                failures.push(`${relativeFile}: ApiClient.request must declare a route`);
                return;
            }
            const resolved = resolveRoutes(routeExpression, checker, sourceFile);
            if (!resolved) {
                failures.push(
                    `${relativeFile}: unresolved transport route ${routeExpression.getText(sourceFile)}; inventory it explicitly`,
                );
                return;
            }
            const routes = [...new Set(resolved.routes)].toSorted();
            const invalid = routes.filter((route) => !routePattern.test(route));
            if (invalid.length) {
                failures.push(`${relativeFile}: invalid transport route ${invalid.join(' || ')}`);
                return;
            }
            const methods = [...new Set(routes.map((route) => route.slice(0, route.indexOf(' '))))].toSorted();
            const hasRead = methods.includes('GET');
            const hasCommand = methods.some((method) => method !== 'GET');
            if (hasRead && hasCommand) {
                failures.push(`${relativeFile}: one request site must not mix read and command routes`);
                return;
            }
            const kind = hasRead ? 'read' : 'command';
            const shape = resolved.computed ? 'computed' : 'literal';
            const fingerprint = `${relativeFile}|${methods.join('+')}|${kind}|${shape}|${routes.join(' || ')}`;
            increment(siteCounts, fingerprint);
            files.add(relativeFile);
            contexts.add(sourceContext(relativeFile));
            metrics.sites += 1;
            metrics[relativeFile.startsWith('features/') ? 'featureSites' : 'entitySites'] += 1;
            metrics[kind === 'read' ? 'reads' : 'commands'] += 1;
            metrics[resolved.computed ? 'computedSites' : 'literalSites'] += 1;
        };
        const visit = (node) => {
            if (ts.isCallExpression(node)) inspectCall(node);
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
    }

    metrics.files = files.size;
    metrics.contexts = contexts.size;
    const result = { siteCounts, metrics, failures };
    compareSnapshot(result, baseline, failures);
    return result;
}
