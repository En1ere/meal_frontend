'use client';

import { useEffect } from 'react';
import { reportBrowserError } from '../shared/telemetry/browser.js';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        void reportBrowserError('root_error');
    }, []);
    return (
        <html lang="ru">
            <body>
                <main id="main" className="status-panel">
                    <h1>Не удалось открыть приложение</h1>
                    <p>Попробуйте ещё раз.</p>
                    <button onClick={reset}>Повторить</button>
                </main>
            </body>
        </html>
    );
}
