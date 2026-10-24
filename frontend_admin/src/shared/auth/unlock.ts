const key = 'meal-admin-tab-unlock';
const tabKey = `${key}-tab-id`;
const tabNamePrefix = 'meal-admin:';
let token: string | undefined;

function currentTabId(create: boolean) {
    const existing = window.name.startsWith(tabNamePrefix) ? window.name.slice(tabNamePrefix.length) : undefined;
    if (existing || !create) return existing;
    const id = crypto.randomUUID();
    window.name = `${tabNamePrefix}${id}`;
    return id;
}

// A copied sessionStorage in a newly opened tab must not unlock that tab.
// Only an actual reload may restore the proof; SPA navigation keeps it in memory.
export function initializeAdminUnlock() {
    try {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        const storedTabId = sessionStorage.getItem(tabKey) || undefined;
        const tabId = currentTabId(false);
        token =
            navigation?.type === 'reload' && tabId && tabId === storedTabId
                ? sessionStorage.getItem(key) || undefined
                : undefined;
        if (!token) {
            sessionStorage.removeItem(key);
            sessionStorage.removeItem(tabKey);
        }
    } catch {
        token = undefined;
    }
}

export function getAdminUnlock() {
    return token;
}

export function setAdminUnlock(value?: string) {
    token = value;
    try {
        if (value) {
            sessionStorage.setItem(key, value);
            sessionStorage.setItem(tabKey, currentTabId(true)!);
        } else {
            sessionStorage.removeItem(key);
            sessionStorage.removeItem(tabKey);
        }
    } catch {
        // An unavailable sessionStorage requires TOTP again after reload.
    }
}
