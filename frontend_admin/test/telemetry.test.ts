import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBrowserTelemetryPayload } from '../src/shared/telemetry/browser.js';

void test('admin telemetry payload contains only bounded classification and release', () => {
    const payload = createBrowserTelemetryPayload('route_error', undefined);
    assert.deepEqual(payload, { application: 'admin', code: 'route_error', appVersion: null });
    assert.deepEqual(Object.keys(payload).sort(), ['appVersion', 'application', 'code']);
});
