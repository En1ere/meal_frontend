import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { browserLaunchOptions, createPlan, validateTarget, version } from './production-acceptance.mjs';

const validTarget = {
    version,
    publicOrigin: 'https://abstract-usable-gazebo.ruweb.place',
    adminOrigin: 'https://admin.abstract-usable-gazebo.ruweb.place',
    apiOrigin: 'https://abstract-usable-gazebo.ruweb.place',
    release: {
        frontendRoot: '0.0.25',
        frontendApp: '0.0.134',
        backend: '0.0.124',
        admin: '0.0.111',
        openapiSnapshot: '0.0.124',
    },
    allowMutations: false,
    acknowledgedAt: '2026-10-27T18:00:00.000Z',
};

test('production acceptance is blocked without an explicit target', () => {
    assert.deepEqual(createPlan(), {
        version,
        status: 'blocked',
        reason: 'target_not_provided',
        readOnly: true,
        willStartBrowser: false,
        willSendMutationRequests: false,
        devices: ['desktop-chromium', 'mobile-chromium'],
        checks: createPlan().checks,
        target: null,
    });
});

test('target accepts only exact public HTTPS origins, release versions and mutation denial', () => {
    assert.equal(validateTarget(validTarget).allowMutations, false);
    for (const invalid of [
        { ...validTarget, allowMutations: true },
        { ...validTarget, publicOrigin: 'http://localhost:3000' },
        { ...validTarget, release: { ...validTarget.release, backend: 'current' } },
        { ...validTarget, extra: true },
    ])
        assert.throws(() => validateTarget(invalid), /Invalid production acceptance target/);
});

test('browser executable override is explicit and absolute', () => {
    assert.deepEqual(browserLaunchOptions({}), { headless: true });
    assert.deepEqual(browserLaunchOptions({ PLAYWRIGHT_EXECUTABLE_PATH: `  ${resolve('browser')}  ` }), {
        headless: true,
        executablePath: resolve('browser'),
    });
    assert.throws(
        () => browserLaunchOptions({ PLAYWRIGHT_EXECUTABLE_PATH: 'relative/browser' }),
        /PLAYWRIGHT_EXECUTABLE_PATH must be absolute/,
    );
});
