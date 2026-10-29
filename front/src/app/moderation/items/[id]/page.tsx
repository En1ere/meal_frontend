import { ModerationItem } from '../../../../features/moderation/client.js';
import { moderationShellClassName } from '../../../../features/moderation/server.js';
import { GuardedUserAppShell } from '../../../../widgets/user-app-shell/client.js';
export const metadata = { title: 'Проверка материала', robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    return (
        <GuardedUserAppShell context="moderator" contentClassName={moderationShellClassName}>
            <ModerationItem id={(await params).id} />
        </GuardedUserAppShell>
    );
}
