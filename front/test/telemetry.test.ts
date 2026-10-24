import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBrowserTelemetryPayload } from '../src/shared/telemetry/browser.js';

void test('frontend telemetry payload contains only bounded classification and release', () => {
    const payload = createBrowserTelemetryPayload('unhandled_error', '0.0.82');
    assert.deepEqual(payload, { application: 'front', code: 'unhandled_error', appVersion: '0.0.82' });
    assert.deepEqual(Object.keys(payload).sort(), ['appVersion', 'application', 'code']);
});
