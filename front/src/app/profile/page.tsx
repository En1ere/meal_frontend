import { OwnProfilePage } from '../../widgets/profile-pages/client.js';
import { GuardedUserAppShell } from '../../widgets/user-app-shell/client.js';
export const metadata = { title: 'Мой профиль', robots: { index: false, follow: false } };
export default function Page() {
    return (
        <GuardedUserAppShell context="user">
            <OwnProfilePage />
        </GuardedUserAppShell>
    );
}
