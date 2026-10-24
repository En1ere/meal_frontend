import { Suspense } from 'react';
import { NotificationCenter } from '../../features/notifications/notifications.js';
export const metadata = { title: 'Уведомления', robots: { index: false, follow: false } };
export default function Page() {
    return (
        <Suspense
            fallback={
                <main id="main">
                    <p role="status">Загружаем уведомления…</p>
                </main>
            }
        >
            <NotificationCenter />
        </Suspense>
    );
}
