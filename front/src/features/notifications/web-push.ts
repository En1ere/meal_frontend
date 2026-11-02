import { z } from 'zod';
import type { ApiClient } from '../../shared/api/client.js';
import { forgetBrowserWebPush, webPushBindingStorageKey } from '../../shared/browser/web-push.js';

const bindingSchema = z.strictObject({ id: z.uuid(), version: z.number().int().positive() });
export type PushTransport = Pick<ApiClient, 'request'>;
export type WebPushState = 'unsupported' | 'unavailable' | 'default' | 'denied' | 'ready' | 'connected';

export function readWebPushBinding(userId: string): z.infer<typeof bindingSchema> | null {
    try {
        const raw = localStorage.getItem(webPushBindingStorageKey(userId));
        return raw ? bindingSchema.parse(JSON.parse(raw)) : null;
    } catch {
        return null;
    }
}
function saveBinding(userId: string, value: z.infer<typeof bindingSchema> | null) {
    try {
        if (value) localStorage.setItem(webPushBindingStorageKey(userId), JSON.stringify(value));
        else localStorage.removeItem(webPushBindingStorageKey(userId));
    } catch {
        // The server binding remains authoritative when tab storage is unavailable.
    }
}
export function decodeVapidPublicKey(value: string): Uint8Array<ArrayBuffer> {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
    const bytes = new Uint8Array(new ArrayBuffer(decoded.length));
    for (let index = 0; index < decoded.length; index++) bytes[index] = decoded.charCodeAt(index);
    return bytes;
}
export function browserWebPushState(available: boolean, userId: string): WebPushState {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'unsupported';
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window))
        return 'unsupported';
    if (!available) return 'unavailable';
    if (Notification.permission === 'denied') return 'denied';
    if (readWebPushBinding(userId)) return 'connected';
    return Notification.permission === 'granted' ? 'ready' : 'default';
}
export async function loadWebPushConfig(transport: PushTransport, signal?: AbortSignal) {
    return (await transport.request('GET /api/v1/notification-push/config', undefined, signal)).data;
}
export async function connectWebPush(transport: PushTransport, userId: string, vapidPublicKey: string) {
    if (Notification.permission === 'default' && (await Notification.requestPermission()) !== 'granted')
        throw new Error('permission_denied');
    if (Notification.permission !== 'granted') throw new Error('permission_denied');
    const registration = await navigator.serviceWorker.ready;
    if (!registration.active?.scriptURL.endsWith('/offline-worker.js')) throw new Error('worker_unavailable');
    const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: decodeVapidPublicKey(vapidPublicKey),
        }));
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('invalid_subscription');
    const raw = await transport.request('POST /api/v1/notification-push/subscriptions', {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        expirationTime: json.expirationTime == null ? null : Math.floor(json.expirationTime),
        idempotencyKey: crypto.randomUUID(),
    });
    const binding = raw.data;
    saveBinding(userId, binding);
    return binding;
}
export async function disconnectWebPush(transport: PushTransport, userId: string) {
    const binding = readWebPushBinding(userId);
    if (!binding) return;
    await transport.request(
        'DELETE /api/v1/notification-push/subscriptions/{id}',
        { expectedVersion: binding.version, idempotencyKey: crypto.randomUUID() },
        undefined,
        { id: binding.id },
    );
    await forgetBrowserWebPush(userId);
}
