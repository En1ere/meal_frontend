import { Suspense } from 'react';
import { ExportsPage } from '../../features/exports/exports-page.js';

export const metadata = { title: 'Экспорт данных', robots: { index: false, follow: false } };

export default function Page() {
    return (
        <Suspense fallback={<p role="status">Открываем экспорт…</p>}>
            <ExportsPage />
        </Suspense>
    );
}
