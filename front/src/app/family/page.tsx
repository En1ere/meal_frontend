import { FamilyPage } from '../../features/family/overview/client.js';
import { PersonalShell } from '../../widgets/personal-shell/client.js';

export const metadata = { title: 'Семья', robots: { index: false, follow: false } };

export default function Page() {
    return (
        <PersonalShell>
            <FamilyPage />
        </PersonalShell>
    );
}
