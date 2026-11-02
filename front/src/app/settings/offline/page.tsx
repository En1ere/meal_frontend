import { OfflineSettingsPage } from '../../../features/offline/client.js';
import { PersonalShell } from '../../../widgets/personal-shell/client.js';

export const metadata = { title: 'Offline и устройство', robots: { index: false, follow: false } };

export default function Page() {
    return (
        <PersonalShell allowOffline>
            <OfflineSettingsPage />
        </PersonalShell>
    );
}
