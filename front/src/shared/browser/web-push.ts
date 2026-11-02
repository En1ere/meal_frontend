export const webPushBindingStorageKey = (userId: string) => `meal:web-push:${userId}`;

export async function forgetBrowserWebPush(userId: string) {
    try {
        localStorage.removeItem(webPushBindingStorageKey(userId));
    } catch {
        // Server-side logout still revokes the session-bound subscription.
    }
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    await (await registration.pushManager.getSubscription())?.unsubscribe();
}
