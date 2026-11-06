import { readdir } from 'node:fs/promises';
import path from 'node:path';

const invisibleSegment = (segment) => (segment.startsWith('(') && segment.endsWith(')')) || segment.startsWith('@');

export async function collectRoutePatterns(appRoot) {
    const patterns = [];
    const walk = async (directory, segments = []) => {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            const full = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                await walk(full, invisibleSegment(entry.name) ? segments : [...segments, entry.name]);
            } else if (entry.name === 'page.tsx') {
                patterns.push('/' + segments.join('/'));
            }
        }
    };
    await walk(appRoot);
    patterns.sort((left, right) => left.localeCompare(right));
    if (new Set(patterns).size !== patterns.length) throw new Error('App pages resolve to duplicate route patterns');
    return patterns;
}

export function materializeRoute(pattern) {
    const route =
        pattern
            .replaceAll('[username]', 'user1')
            .replaceAll('[token]', 'invalid-preview-token')
            .replaceAll('[queue]', 'recipes')
            .replaceAll('[slug]', 'personal-data-consent')
            .replaceAll(
                '[id]',
                pattern.startsWith('/recipes/')
                    ? '70000000-0000-4000-8000-000000000001'
                    : '00000000-0000-4000-8000-000000000001',
            )
            .replaceAll('//', '/') || '/';
    if (/\[[^/]+\]/u.test(route)) throw new Error(`Unresolved dynamic route pattern: ${pattern}`);
    return route;
}

export function currentProgress(results, patterns, recheckPattern = null) {
    const current = new Set(patterns);
    return results.filter(
        (result) =>
            typeof result?.pattern === 'string' && current.has(result.pattern) && !recheckPattern?.test(result.pattern),
    );
}
