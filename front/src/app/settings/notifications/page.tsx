import { NotificationSettings } from '../../../features/notifications/client.js';
import { PersonalShell } from '../../../widgets/personal-shell/client.js';
export const metadata = { title: 'Настройки уведомлений', robots: { index: false, follow: false } };
export default function Page() {
    return (
        <PersonalShell>
            <NotificationSettings />
        </PersonalShell>
    );
}
