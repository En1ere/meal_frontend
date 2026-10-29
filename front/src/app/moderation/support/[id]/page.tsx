import { ModerationSupport } from '../../../../features/moderation/client.js';
import { moderationShellClassName } from '../../../../features/moderation/server.js';
import { GuardedUserAppShell } from '../../../../widgets/user-app-shell/client.js';
export const metadata = { title: 'Обращение поддержки', robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    return (
        <GuardedUserAppShell context="moderator" contentClassName={moderationShellClassName}>
            <ModerationSupport id={(await params).id} />
        </GuardedUserAppShell>
    );
}
