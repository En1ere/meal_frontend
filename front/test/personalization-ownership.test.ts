import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadPersonalization, saveOnboarding, savePreferences } from '../src/features/personalization/api.js';
import { personalizationKeys } from '../src/features/personalization/query-keys.js';

const personalization = {
    onboarding: {
        flow: null,
        status: 'not_started',
        step: 0,
        totalSteps: 0,
        version: 1,
    },
    preferences: {
        diets: [],
        allergens: [],
        dislikes: [],
        allergenMode: 'warn',
        equipment: {},
        goals: [],
        version: 2,
    },
    catalog: { diets: [], allergens: [], equipment: [], goals: [] },
} as const;

interface RecordedRequest {
    route: string;
    body: unknown;
    signal: AbortSignal | undefined;
}

function transportFixture() {
    const requests: RecordedRequest[] = [];
    const request = (route: string, body?: unknown, signal?: AbortSignal) => {
        requests.push({ route, body, signal });
        if (route === 'GET /api/v1/personalization') return Promise.resolve({ data: personalization });
        if (route === 'PUT /api/v1/personalization/onboarding')
            return Promise.resolve({
                data: { ...personalization.onboarding, flow: 'quick', status: 'in_progress', step: 1 },
            });
        return Promise.resolve({ data: { ...personalization.preferences, diets: ['vegetarian'], version: 3 } });
    };
    return { requests, transport: { request } };
}

void test('personalization keys preserve the exact account-scoped tuple', () => {
    assert.deepEqual(personalizationKeys.root, ['personalization']);
    assert.deepEqual(personalizationKeys.settings(undefined), ['personalization', undefined]);
    assert.deepEqual(personalizationKeys.settings('user-a'), ['personalization', 'user-a']);
});

void test('personalization adapter forwards GET signal and returns exact data', async () => {
    const { requests, transport } = transportFixture();
    const controller = new AbortController();
    const result = await loadPersonalization(transport, controller.signal);
    assert.equal(result, personalization);
    assert.deepEqual(requests, [{ route: 'GET /api/v1/personalization', body: undefined, signal: controller.signal }]);
});

void test('personalization commands preserve bodies and create a fresh idempotency key per call', async () => {
    const { requests, transport } = transportFixture();
    const onboarding = {
        flow: 'quick' as const,
        status: 'in_progress' as const,
        step: 1,
        expectedVersion: 1,
    };
    const preferences = {
        diets: ['vegetarian'],
        allergens: ['peanut'],
        dislikes: ['cilantro'],
        allergenMode: 'hide' as const,
        equipment: { oven: 'yes' as const },
        goals: ['balance'],
        expectedVersion: 2,
    };

    await saveOnboarding(transport, onboarding);
    await saveOnboarding(transport, onboarding);
    await savePreferences(transport, preferences);
    await savePreferences(transport, preferences);

    const commandRequests = requests.slice(0);
    assert.deepEqual(
        commandRequests.map(({ route, signal }) => ({ route, signal })),
        [
            { route: 'PUT /api/v1/personalization/onboarding', signal: undefined },
            { route: 'PUT /api/v1/personalization/onboarding', signal: undefined },
            { route: 'PUT /api/v1/personalization/preferences', signal: undefined },
            { route: 'PUT /api/v1/personalization/preferences', signal: undefined },
        ],
    );
    const bodies = commandRequests.map(({ body }) => body as Record<string, unknown>);
    const withoutIdempotency = (body: Record<string, unknown>) => {
        const command = { ...body };
        delete command.idempotencyKey;
        return command;
    };
    assert.deepEqual(bodies.slice(0, 2).map(withoutIdempotency), [onboarding, onboarding]);
    assert.deepEqual(bodies.slice(2).map(withoutIdempotency), [preferences, preferences]);
    const keys = bodies.map(({ idempotencyKey }) => idempotencyKey);
    assert.equal(new Set(keys).size, 4);
    for (const key of keys) assert.match(String(key), /^[0-9a-f-]{36}$/u);
});

void test('personalization UI consumes private owners without direct transport calls', async () => {
    const [onboarding, settings] = await Promise.all([
        readFile('src/features/personalization/onboarding.tsx', 'utf8'),
        readFile('src/features/personalization/settings.tsx', 'utf8'),
    ]);
    for (const source of [onboarding, settings]) {
        assert.doesNotMatch(source, /\.request\s*\(/u);
        assert.doesNotMatch(source, /['"](?:GET|PUT) \/api\/v1\/personalization/u);
        assert.match(source, /personalizationKeys\.settings\(session\.data\?\.id\)/u);
        assert.match(source, /loadPersonalization\(api!, signal\)/u);
    }
    assert.match(onboarding, /saveOnboarding\(api!, next\)/u);
    assert.match(settings, /savePreferences\(api!,/u);
});
