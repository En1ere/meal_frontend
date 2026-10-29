import { FamilyInvitePage } from '../../../features/family/invite/client.js';
import { PersonalShell } from '../../../widgets/personal-shell/client.js';

export default function Page() {
    return (
        <PersonalShell>
            <FamilyInvitePage />
        </PersonalShell>
    );
}
