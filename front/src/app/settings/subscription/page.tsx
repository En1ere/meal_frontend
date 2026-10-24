import { SubscriptionPage } from '../../../features/subscription/subscription-page.js';
import { Suspense } from 'react';

export const metadata = { title: 'Подписка и квоты', robots: { index: false, follow: false } };

export default function Page() {
    return (
        <Suspense fallback={<p role="status">Загружаем подписку…</p>}>
            <SubscriptionPage />
        </Suspense>
    );
}
