import { FamilyChatPage } from '../../../features/family-chat/client.js';
import { PersonalShell } from '../../../widgets/personal-shell/client.js';

export const metadata = { title: 'Семейный чат', robots: { index: false, follow: false } };
export default function Page() {
    return (
        <PersonalShell>
            <FamilyChatPage />
        </PersonalShell>
    );
}
