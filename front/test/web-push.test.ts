import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { decodeVapidPublicKey } from '../src/features/notifications/web-push.js';

void test('VAPID public key decoder accepts URL-safe base64 without padding', () => {
    const decoded = decodeVapidPublicKey('AQIDBA');
    assert.deepEqual([...decoded], [1, 2, 3, 4]);
});

void test('notification worker keeps push navigation same-origin and allowlisted', async () => {
    const worker = await readFile('public/offline-worker.js', 'utf8');
    assert.match(worker, /self\.addEventListener\('push'/);
    assert.match(worker, /self\.addEventListener\('notificationclick'/);
    assert.match(worker, /url\.origin === self\.location\.origin/);
    assert.match(worker, /PUSH_ROUTES\.some/);
    assert.doesNotMatch(worker, /payload\.endpoint|payload\.p256dh|payload\.auth/);
});

void test('Web Push permission is requested only inside explicit connect flow', async () => {
    const source = await readFile('src/features/notifications/web-push.ts', 'utf8');
    const request = source.indexOf('Notification.requestPermission()');
    const connect = source.indexOf('export async function connectWebPush');
    assert.ok(connect >= 0 && request > connect);
    assert.equal(source.slice(0, connect).includes('requestPermission'), false);
});

void test('user logout removes the browser Web Push binding', async () => {
    const source = await readFile('src/features/auth/sessions-panel.tsx', 'utf8');
    assert.match(source, /forgetBrowserWebPush\(principal\.data\.id\)/);
    assert.ok(source.lastIndexOf('forgetBrowserWebPush(') > source.indexOf("'POST /api/v1/auth/logout'"));
});
