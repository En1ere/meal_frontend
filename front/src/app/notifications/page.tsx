import { Suspense } from 'react';
import { NotificationCenter } from '../../features/notifications/client.js';
import { PersonalShell } from '../../widgets/personal-shell/client.js';
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
            <PersonalShell>
                <NotificationCenter />
            </PersonalShell>
        </Suspense>
    );
}
