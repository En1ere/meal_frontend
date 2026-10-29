import { Suspense } from 'react';
import { SearchPage } from '../../features/search/client.js';
import { PersonalShell } from '../../widgets/personal-shell/client.js';

export const metadata = { title: 'Поиск', robots: { index: false, follow: false } };

export default function Page() {
    return (
        <Suspense fallback={<p role="status">Открываем поиск…</p>}>
            <PersonalShell>
                <SearchPage />
            </PersonalShell>
        </Suspense>
    );
}
