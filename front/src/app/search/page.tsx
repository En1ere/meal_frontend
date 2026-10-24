import { Suspense } from 'react';
import { SearchPage } from '../../features/search/search-page.js';

export const metadata = { title: 'Поиск', robots: { index: false, follow: false } };

export default function Page() {
    return (
        <Suspense fallback={<p role="status">Открываем поиск…</p>}>
            <SearchPage />
        </Suspense>
    );
}
