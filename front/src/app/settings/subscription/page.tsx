import { SubscriptionPage } from '../../../features/subscription/client.js';
import { Suspense } from 'react';
import { PersonalShell } from '../../../widgets/personal-shell/client.js';

export const metadata = { title: 'Подписка и квоты', robots: { index: false, follow: false } };

export default function Page() {
    return (
        <Suspense fallback={<p role="status">Загружаем подписку…</p>}>
            <PersonalShell>
                <SubscriptionPage />
            </PersonalShell>
        </Suspense>
    );
}
