import { ModerationOverview } from '../../features/moderation/client.js';
import { moderationShellClassName } from '../../features/moderation/server.js';
import { GuardedUserAppShell } from '../../widgets/user-app-shell/client.js';
export const metadata = { title: 'Модератор', robots: { index: false, follow: false } };
export default function Page() {
    return (
        <GuardedUserAppShell context="moderator" contentClassName={moderationShellClassName}>
            <ModerationOverview />
        </GuardedUserAppShell>
    );
}
