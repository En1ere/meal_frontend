import { Component, type ReactNode } from 'react';
import { reportBrowserError, type BrowserTelemetryCode } from '../shared/telemetry/browser.js';

function ErrorPage({ reset }: { reset: () => void }) {
    return (
        <main id="main" className="status-panel">
            <h1>Не удалось открыть страницу</h1>
            <p>Попробуйте ещё раз.</p>
            <button onClick={reset}>Повторить</button>
        </main>
    );
}

export class AppErrorBoundary extends Component<
    { children: ReactNode; code: Extract<BrowserTelemetryCode, 'root_error' | 'route_error'> },
    { failed: boolean }
> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch() {
        void reportBrowserError(this.props.code);
    }

    render() {
        return this.state.failed ? <ErrorPage reset={() => window.location.reload()} /> : this.props.children;
    }
}
