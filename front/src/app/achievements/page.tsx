import { OwnAchievementsPage } from '../../features/achievements/client.js';
import { GuardedUserAppShell } from '../../widgets/user-app-shell/client.js';

export const metadata = { title: 'Достижения' };

export default function Page() {
    return (
        <GuardedUserAppShell context="user">
            <OwnAchievementsPage />
        </GuardedUserAppShell>
    );
}
