import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authRoutes, safeReturnTo, type AuthContext } from '../src/shared/auth/routes.js';

await test('returnTo cannot cross auth contexts, escape origin, or loop through login', () => {
    assert.equal(safeReturnTo('/profile', 'user'), '/profile');
    assert.equal(safeReturnTo('/settings/account', 'user'), '/settings/account');
    assert.equal(safeReturnTo('/profile', 'moderator'), '/moderation');
    for (const context of ['user', 'moderator'] as const satisfies readonly AuthContext[]) {
        const home = authRoutes[context].home;
        assert.equal(safeReturnTo(home, context), home);
        for (const value of [
            null,
            '',
            'https://evil.test',
            '//evil.test',
            '/\\evil.test',
            '/auth',
            '/staff/sign-in',
            '/moderation/mfa',
            '/admin',
            '/moderation',
            '/?next=https://evil.test',
            '/#token',
            '/%0a',
            ' /',
            '/\n',
        ]) {
            assert.equal(safeReturnTo(value, context), home);
        }
    }
});

await test('domain URLs preserve filter context through authentication without allowing external destinations', () => {
    const id = '70000000-0000-4000-8000-000000000001';
    for (const path of [
        '/recipes?q=pasta&category=mains',
        `/recipes/${id}?tab=steps&servings=6`,
        '/recipes/new',
        '/recipes/mine?status=archived',
        '/recipes/offline',
        `/recipes/${id}/edit`,
        `/recipes/${id}/cook?attempt=${id}&community=1`,
        '/shopping',
        `/shopping/${id}?view=unchecked`,
        '/reports?page=2',
        '/preserves?create=1',
        `/preserves/${id}?returnTo=%2Fpreserves`,
        `/inventory/prepared?batch=${id}`,
        '/family',
        '/family/access',
        '/family/members',
        '/family/setup',
        '/family/inventory/history?q=milk',
        '/family/inventory/import',
        '/family/inventory/locations',
        '/family/inventory/new',
        '/family/inventory/scan',
        `/family/inventory/batches/${id}`,
        '/family/recipes?status=archived',
        '/family/recipes/new',
        `/family/recipes/${id}`,
        `/family/recipes/${id}/edit`,
        '/family/shopping?q=milk',
        `/family/shopping/${id}`,
        '/family/receipts/new',
        `/family/receipts/${id}`,
        `/family/purchases/${id}`,
        `/products/${id}?tab=nutrition`,
        '/inventory?status=archived',
    ])
        assert.equal(safeReturnTo(path, 'user'), path);
    assert.equal(safeReturnTo('/recipes//evil.test', 'user'), '/');
    assert.equal(safeReturnTo('/recipes?x=1#private', 'user'), '/');
    assert.equal(safeReturnTo('/recipes?q=1', 'moderator'), '/moderation');
});

await test('moderator deep links survive authentication without widening the staff boundary', () => {
    const id = 'c1000000-0000-4000-8000-000000000001';
    for (const path of [
        '/moderation/queues/recipes?status=pending&assignment=mine&priority=high',
        `/moderation/items/${id}`,
        `/moderation/support/${id}`,
    ])
        assert.equal(safeReturnTo(path, 'moderator'), path);
    for (const path of [
        '/moderation/queues/not-a-queue',
        '/moderation/items/not-a-uuid',
        '/moderation/sign-in',
        '/admin',
        `/moderation/items/${id}?leak=1`,
    ])
        assert.equal(safeReturnTo(path, 'moderator'), '/moderation');
});
