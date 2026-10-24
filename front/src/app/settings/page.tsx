import { SettingsPage } from '../../features/personalization/settings.js';
export const metadata = { title: 'Настройки', robots: { index: false, follow: false } };
export default function Page() {
    return <SettingsPage />;
}
