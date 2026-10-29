import { ProOverviewPage } from '../../features/pro/client.js';
import { PersonalShell } from '../../widgets/personal-shell/client.js';

export default function Page() {
    return (
        <PersonalShell>
            <ProOverviewPage />
        </PersonalShell>
    );
}
