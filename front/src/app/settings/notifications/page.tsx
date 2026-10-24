import { NotificationSettings } from '../../../features/notifications/notifications.js';
export const metadata = { title: 'Настройки уведомлений', robots: { index: false, follow: false } };
export default function Page() {
    return <NotificationSettings />;
}
