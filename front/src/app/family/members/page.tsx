import { FamilyDetailsPage } from '../../../features/family/access/client.js';
import { PersonalShell } from '../../../widgets/personal-shell/client.js';

export default function Page() {
    return (
        <PersonalShell>
            <FamilyDetailsPage view="members" />
        </PersonalShell>
    );
}
