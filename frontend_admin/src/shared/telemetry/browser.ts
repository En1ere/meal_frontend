export type BrowserTelemetryCode = 'root_error' | 'route_error' | 'unhandled_error' | 'unhandled_rejection';

const reportedAt = new Map<BrowserTelemetryCode, number>();
let csrfToken: Promise<string | null> | undefined;

export function createBrowserTelemetryPayload(code: BrowserTelemetryCode, appVersion: string | undefined) {
    return { application: 'admin' as const, code, appVersion: appVersion || null };
}

async function csrf(): Promise<string | null> {
    csrfToken ??= fetch('/api/v1/admin/auth/csrf', {
        credentials: 'include',
        cache: 'no-store',
    })
        .then(async (response) => {
            if (!response.ok) return null;
            const value: unknown = await response.json();
            if (!value || typeof value !== 'object' || !('data' in value)) return null;
            const data = value.data;
            if (!data || typeof data !== 'object' || !('token' in data) || typeof data.token !== 'string') return null;
            return /^[A-Za-z0-9_-]{43}$/.test(data.token) ? data.token : null;
        })
        .catch(() => null);
    return csrfToken;
}

export async function reportBrowserError(code: BrowserTelemetryCode): Promise<void> {
    if (import.meta.env.VITE_API_MODE === 'mock') return;
    const now = Date.now();
    if (now - (reportedAt.get(code) ?? 0) < 60_000) return;
    reportedAt.set(code, now);
    try {
        const token = await csrf();
        if (!token) return;
        const configuredVersion: unknown = import.meta.env.VITE_APP_VERSION;
        await fetch('/api/v1/admin/telemetry/browser', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-csrf-token': token },
            credentials: 'include',
            cache: 'no-store',
            keepalive: true,
            body: JSON.stringify(
                createBrowserTelemetryPayload(
                    code,
                    typeof configuredVersion === 'string' ? configuredVersion : undefined,
                ),
            ),
        });
    } catch {
        // Telemetry is best-effort and must not create a second application error.
    }
}

export function installBrowserErrorHandlers(): void {
    const runtime = window as Window & { __mealPlannerAdminTelemetryInstalled?: boolean };
    if (runtime.__mealPlannerAdminTelemetryInstalled) return;
    runtime.__mealPlannerAdminTelemetryInstalled = true;
    window.addEventListener('error', () => void reportBrowserError('unhandled_error'));
    window.addEventListener('unhandledrejection', () => void reportBrowserError('unhandled_rejection'));
}
