import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contracts } from '../src/shared/api/contracts.generated.js';
import { matchContract } from '../src/mocks/route-match.js';

void test('specific workspace routes win over generic admin section and identifiers remain validated', () => {
    assert.equal(matchContract('GET', '/api/v1/admin/news-workspace')?.key, 'GET /api/v1/admin/news-workspace');
    assert.equal(
        matchContract('POST', '/api/v1/admin/operations-workspace/execute')?.key,
        'POST /api/v1/admin/operations-workspace/execute',
    );
    const match = matchContract('GET', '/api/v1/admin/governance/users/not-a-uuid');
    assert.ok(match);
    assert.equal(contracts[match.key].params?.safeParse(match.params).success, false);
    assert.equal(matchContract('GET', '/api/v1/admin/governance/users/%E0%A4%A'), null);
});

void test('generated union and array bounds reject empty pages, wrong blocks and oversized audiences', () => {
    const schema = contracts['POST /api/v1/admin/news-workspace/save'].request;
    const input = {
        action: 'save',
        id: crypto.randomUUID(),
        version: 0,
        idempotencyKey: crypto.randomUUID(),
        content: {
            title: 'Новость',
            pages: [{ blocks: [{ kind: 'text', text: 'Текст' }] }],
            sources: [],
            audience: {
                plans: [],
                genders: [],
                families: [],
                registeredFrom: null,
                registeredTo: null,
                activeFrom: null,
                activeTo: null,
            },
            channels: ['in_app'],
            category: 'service',
        },
    };
    assert.equal(schema.safeParse(input).success, true);
    assert.equal(schema.safeParse({ ...input, content: { ...input.content, pages: [] } }).success, false);
    assert.equal(
        schema.safeParse({
            ...input,
            content: { ...input.content, pages: [{ blocks: [{ kind: 'image', text: 'не изображение' }] }] },
        }).success,
        false,
    );
    assert.equal(
        schema.safeParse({
            ...input,
            content: {
                ...input.content,
                audience: { ...input.content.audience, plans: ['free', 'plus', 'pro', 'free'] },
            },
        }).success,
        false,
    );
});

void test('generated record values preserve the allowed conflict choices', () => {
    const schema = contracts['POST /api/v1/admin/content-workspace/{section}/{id}/compare'].request;
    const input = {
        leftId: crypto.randomUUID(),
        rightId: crypto.randomUUID(),
        leftVersion: 1,
        rightVersion: 1,
        canonicalId: crypto.randomUUID(),
        choices: { name: 'left', brand: 'right' },
    };
    assert.equal(schema.safeParse(input).success, true);
    assert.equal(schema.safeParse({ ...input, choices: { name: 'average' } }).success, false);
    assert.equal(schema.safeParse({ ...input, choices: { name: 123 } }).success, false);
});
