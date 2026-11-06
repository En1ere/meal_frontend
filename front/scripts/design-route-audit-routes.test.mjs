import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { collectRoutePatterns, currentProgress, materializeRoute } from './design-route-audit-routes.mjs';

const appRoot = fileURLToPath(new URL('../src/app/', import.meta.url));

test('discovers the exact canonical app routes without route-group segments', async () => {
    const patterns = await collectRoutePatterns(appRoot);
    assert.equal(patterns.length, 119);
    assert.equal(
        patterns.some((pattern) => pattern.includes('/(') || pattern.includes('/@')),
        false,
    );
    assert.ok(patterns.includes('/ai'));
    assert.ok(patterns.includes('/family/notes'));
    assert.ok(patterns.includes('/legal'));
    assert.ok(patterns.includes('/legal/[slug]'));
});

test('materializes every current dynamic route and fails closed for a new placeholder', async () => {
    const patterns = await collectRoutePatterns(appRoot);
    for (const pattern of patterns) assert.doesNotMatch(materializeRoute(pattern), /\[[^/]+\]/u, pattern);
    assert.equal(materializeRoute('/legal/[slug]'), '/legal/personal-data-consent');
    assert.throws(() => materializeRoute('/future/[category]'), /Unresolved dynamic route pattern/u);
});

test('resume data keeps only current patterns and honors explicit rechecks', () => {
    const results = [
        { pattern: '/legal', viewport: 'desktop' },
        { pattern: '/(personal-shell)/ai', viewport: 'desktop' },
        { pattern: '/ai', viewport: 'desktop' },
    ];
    assert.deepEqual(currentProgress(results, ['/legal', '/ai'], /^\/legal$/u), [
        { pattern: '/ai', viewport: 'desktop' },
    ]);
});
