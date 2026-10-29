import { PreferencesPage } from '../../../features/personalization/client.js';
import { PersonalShell } from '../../../widgets/personal-shell/client.js';
export const metadata = { title: 'Питание и рекомендации', robots: { index: false, follow: false } };
export default function Page() {
    return (
        <PersonalShell>
            <PreferencesPage />
        </PersonalShell>
    );
}
