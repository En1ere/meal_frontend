import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const buildRoot = path.join(root, 'front', '.next');
const assets = path.join(buildRoot, 'static', 'chunks');
// Baseline after consolidating 12 identical nested layouts into four route groups:
// 192 files / 166 unique payloads / 26 route requests / 374,521 route gzip bytes.
// File/content caps keep only 2-4 chunks of headroom; route caps allow one small
// split without weakening the unchanged raw and gzip byte ceilings.
const budgets = {
    files: 196,
    uniqueContentChunks: 170,
    maxRawBytes: 900_000,
    maxGzipBytes: 140_000,
    totalRawBytes: 3_800_000,
    totalGzipBytes: 1_000_000,
    maxRouteRequests: 28,
    maxRouteGzipBytes: 390_000,
};
const forbidden = [
    /ACCEPTANCE_OWNER_DATABASE_URL/u,
    /\bDATABASE_URL\b/u,
    /\bmeal_owner\b/u,
    /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/u,
    /application-grants\.sql/u,
];

async function javascriptFiles(directory) {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...(await javascriptFiles(absolute)));
        else if (entry.isFile() && entry.name.endsWith('.js')) files.push(absolute);
    }
    return files;
}

const chunks = [];
const chunkByBuildPath = new Map();
for (const file of await javascriptFiles(assets)) {
    const bytes = await readFile(file);
    const source = bytes.toString('utf8');
    assert.equal(
        forbidden.some((pattern) => pattern.test(source)),
        false,
        `${path.relative(assets, file)}: server-only marker leaked into a browser chunk`,
    );
    const chunk = {
        rawBytes: bytes.length,
        gzipBytes: gzipSync(bytes, { level: 9 }).length,
        digest: createHash('sha256').update(bytes).digest('hex'),
    };
    chunks.push(chunk);
    chunkByBuildPath.set(path.relative(buildRoot, file).replaceAll(path.sep, '/'), chunk);
}
assert.ok(chunks.length > 0, 'production JavaScript chunks are missing; run the build first');

const buildManifest = JSON.parse(await readFile(path.join(buildRoot, 'build-manifest.json'), 'utf8'));
const rootMainFiles = buildManifest.rootMainFiles.filter((file) => file.endsWith('.js'));
assert.ok(rootMainFiles.length > 0, 'Next build manifest does not expose root browser files');

const routeManifestFiles = (await javascriptFiles(path.join(buildRoot, 'server', 'app'))).filter((file) =>
    file.endsWith(`page_client-reference-manifest.js`),
);
assert.ok(routeManifestFiles.length > 0, 'Next route client-reference manifests are missing');
const routeMetrics = [];
for (const manifestFile of routeManifestFiles) {
    const source = await readFile(manifestFile, 'utf8');
    const match = source.match(/globalThis\.__RSC_MANIFEST\[(?<route>"(?:[^"\\]|\\.)*")\]=(?<manifest>\{.*\});\s*$/su);
    assert.ok(match?.groups, `${path.relative(buildRoot, manifestFile)}: unsupported client-reference manifest`);
    const route = JSON.parse(match.groups.route);
    const manifest = JSON.parse(match.groups.manifest);
    const files = new Set(rootMainFiles);
    for (const clientModule of Object.values(manifest.clientModules ?? {}))
        for (const chunk of clientModule.chunks ?? [])
            if (typeof chunk === 'string' && chunk.startsWith('static/chunks/') && chunk.endsWith('.js'))
                files.add(chunk);
    let gzipBytes = 0;
    for (const encodedFile of files) {
        const file = decodeURIComponent(encodedFile);
        assert.equal((await stat(path.join(buildRoot, file))).isFile(), true, `${route}: missing browser chunk ${file}`);
        const chunk = chunkByBuildPath.get(file);
        assert.ok(chunk, `${route}: browser chunk is outside static/chunks: ${file}`);
        gzipBytes += chunk.gzipBytes;
    }
    routeMetrics.push({ route, requests: files.size, gzipBytes });
}
const appPaths = JSON.parse(await readFile(path.join(buildRoot, 'server', 'app-paths-manifest.json'), 'utf8'));
const expectedPageRoutes = Object.keys(appPaths)
    .filter((route) => route.endsWith('/page'))
    .sort();
assert.deepEqual(
    routeMetrics.map((route) => route.route).sort(),
    expectedPageRoutes,
    'client-reference manifests must cover every built app page',
);

const metrics = {
    files: chunks.length,
    uniqueContentChunks: new Set(chunks.map((chunk) => chunk.digest)).size,
    maxRawBytes: Math.max(...chunks.map((chunk) => chunk.rawBytes)),
    maxGzipBytes: Math.max(...chunks.map((chunk) => chunk.gzipBytes)),
    totalRawBytes: chunks.reduce((sum, chunk) => sum + chunk.rawBytes, 0),
    totalGzipBytes: chunks.reduce((sum, chunk) => sum + chunk.gzipBytes, 0),
    maxRouteRequests: Math.max(...routeMetrics.map((route) => route.requests)),
    maxRouteGzipBytes: Math.max(...routeMetrics.map((route) => route.gzipBytes)),
};
for (const [name, budget] of Object.entries(budgets))
    assert.ok(metrics[name] <= budget, `${name} ${metrics[name]} exceeds budget ${budget}`);
const heaviestRoute = routeMetrics.toSorted((left, right) => right.gzipBytes - left.gzipBytes)[0];
const widestRoute = routeMetrics.toSorted((left, right) => right.requests - left.requests)[0];
console.log(
    `Frontend browser budget passed: ${JSON.stringify({ ...metrics, heaviestRoute, widestRoute, routes: routeMetrics.length })}`,
);
