import { Suspense } from 'react';
import { SupportList } from '../../features/support/support.js';
export const metadata = { title: 'Поддержка', robots: { index: false, follow: false } };
export default function Page() {
    return (
        <Suspense
            fallback={
                <main id="main">
                    <p role="status">Загружаем обращения…</p>
                </main>
            }
        >
            <SupportList />
        </Suspense>
    );
}
