type BrowserTelemetryCode = 'root_error' | 'route_error' | 'unhandled_error' | 'unhandled_rejection';

const reportedAt = new Map<BrowserTelemetryCode, number>();
let csrfToken: Promise<string | null> | undefined;

export function createBrowserTelemetryPayload(code: BrowserTelemetryCode, appVersion: string | undefined) {
    return { application: 'front' as const, code, appVersion: appVersion || null };
}

async function csrf(): Promise<string | null> {
    csrfToken ??= fetch('/api/v1/auth/csrf', {
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
    if (process.env.NEXT_PUBLIC_API_MODE === 'mock') return;
    const now = Date.now();
    if (now - (reportedAt.get(code) ?? 0) < 60_000) return;
    reportedAt.set(code, now);
    try {
        const token = await csrf();
        if (!token) return;
        await fetch('/api/v1/telemetry/browser', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-csrf-token': token },
            credentials: 'include',
            cache: 'no-store',
            keepalive: true,
            body: JSON.stringify(createBrowserTelemetryPayload(code, process.env.NEXT_PUBLIC_APP_VERSION)),
        });
    } catch {
        // Telemetry is best-effort and must not create a second application error.
    }
}

export function installBrowserErrorHandlers(): void {
    if (typeof window === 'undefined') return;
    const runtime = window as Window & { __mealPlannerFrontTelemetryInstalled?: boolean };
    if (runtime.__mealPlannerFrontTelemetryInstalled) return;
    runtime.__mealPlannerFrontTelemetryInstalled = true;
    window.addEventListener('error', () => void reportBrowserError('unhandled_error'));
    window.addEventListener('unhandledrejection', () => void reportBrowserError('unhandled_rejection'));
}
