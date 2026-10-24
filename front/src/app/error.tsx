'use client';
import { useEffect } from 'react';
import { reportBrowserError } from '../shared/telemetry/browser.js';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        void reportBrowserError('route_error');
    }, []);
    return (
        <main id="main" className="status-panel">
            <h1>Не удалось открыть страницу</h1>
            <p>Попробуйте ещё раз.</p>
            <button onClick={reset}>Повторить</button>
        </main>
    );
}
