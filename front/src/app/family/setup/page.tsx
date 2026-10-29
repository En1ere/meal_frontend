import { FamilySetupPage } from '../../../features/family/setup/client.js';
import { PersonalShell } from '../../../widgets/personal-shell/client.js';

export const metadata = { title: 'Создание семьи', robots: { index: false, follow: false } };

export default function Page() {
    return (
        <PersonalShell>
            <FamilySetupPage />
        </PersonalShell>
    );
}
