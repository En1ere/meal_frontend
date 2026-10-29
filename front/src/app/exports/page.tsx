import { Suspense } from 'react';
import { ExportsPage } from '../../features/exports/client.js';
import { PersonalShell } from '../../widgets/personal-shell/client.js';

export const metadata = { title: 'Экспорт данных', robots: { index: false, follow: false } };

export default function Page() {
    return (
        <Suspense fallback={<p role="status">Открываем экспорт…</p>}>
            <PersonalShell>
                <ExportsPage />
            </PersonalShell>
        </Suspense>
    );
}
