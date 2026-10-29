import { OwnReputationPage } from '../../features/achievements/client.js';
import { GuardedUserAppShell } from '../../widgets/user-app-shell/client.js';

export const metadata = { title: 'Репутация' };

export default function Page() {
    return (
        <GuardedUserAppShell context="user">
            <OwnReputationPage />
        </GuardedUserAppShell>
    );
}
